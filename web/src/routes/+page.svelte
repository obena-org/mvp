<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { goto } from '$app/navigation';
  import { fetchHistory, streamKpa } from '$lib/api.js';
  import { portal } from '$lib/portal';
  import type { HistoryEntry, KPAResult, ProgressPhase, SourceUsage } from '$lib/models';

  interface SidebarContext {
    readonly open: boolean;
    toggle(): void;
    close(): void;
  }
  const sidebar = getContext<SidebarContext>('sidebar');

  let topic = $state('');
  let strategy = $state<'bottom-up' | 'top-down'>('bottom-up');
  let loading = $state(false);
  let result = $state<KPAResult | null>(null);
  let error = $state<string | null>(null);
  let progressPhase = $state<ProgressPhase | null>(null);
  let sourcesCompleted = $state(0);
  let sourcesTotal = $state(0);

  let cancelStream: (() => void) | null = null;
  let history = $state<HistoryEntry[]>([]);

  function loadFromHistory(entry: HistoryEntry) {
    topic = entry.query;
    strategy = entry.strategy;
    sidebar.close();
    void submit();
  }

  onMount(() => {
    void fetchHistory().then((h: HistoryEntry[]) => { history = h; });

    const params = new URLSearchParams(window.location.search);
    const t = params.get('topic');
    if (t) {
      topic = t;
      void submit({ updateUrl: false });
    }
  });

  onDestroy(() => {
    cancelStream?.();
  });

  async function submit({ updateUrl = true } = {}) {
    const q = topic.trim();
    if (!q || loading) return;

    loading = true;
    error = null;
    result = null;
    progressPhase = null;
    sourcesCompleted = 0;
    sourcesTotal = 0;

    if (updateUrl) {
      await goto(`?topic=${encodeURIComponent(q)}`, {
        replaceState: true,
        keepFocus: true,
        noScroll: true,
      });
    }

    cancelStream = streamKpa(
      { topic: q, options: { strategy } },
      {
        onProgress(event) {
          if (event.type === 'status') {
            progressPhase = event.phase;
            if (event.phase === 'processing') {
              sourcesCompleted = 0;
              sourcesTotal = 0;
            }
          } else if (event.type === 'source-done') {
            sourcesCompleted = event.completed;
            sourcesTotal = event.total;
          }
        },
        onComplete(r) {
          result = r;
          loading = false;
          cancelStream = null;
          void fetchHistory().then((h: HistoryEntry[]) => { history = h; });
        },
        onError(msg) {
          error = msg;
          loading = false;
          cancelStream = null;
        },
      },
    );
  }

  function age(isoString: string): string {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  /**
   * Append a Scroll To Text Fragment so supporting browsers jump to and highlight the quote.
   * @see https://wicg.github.io/scroll-to-text-fragment/
   */
  function articleUrlWithSnippetHighlight(baseUrl: string, snippet: string): string {
    const trimmed = snippet.trim();
    if (!trimmed) return baseUrl;
    const maxLen = 200;
    const text = trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
    try {
      const u = new URL(baseUrl);
      if (u.hash.includes(':~:text=')) return baseUrl;
      const encoded = encodeURIComponent(text);
      u.hash = u.hash ? `${u.hash.slice(1)}:~:text=${encoded}` : `:~:text=${encoded}`;
      return u.toString();
    } catch {
      return baseUrl;
    }
  }

  /** DuckDuckGo favicon proxy from article URL hostname (no backend / schema dependency). */
  function faviconUrl(url: string): string | null {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      const host = u.hostname.replace(/^www\./, '');
      if (!host) return null;
      return `https://icons.duckduckgo.com/ip3/${host}.ico`;
    } catch {
      return null;
    }
  }

  function openSourcesDialog() {
    const el = document.getElementById('kpa-sources-dialog');
    if (el instanceof HTMLDialogElement) el.showModal();
  }

  function sourceUsageLabel(s: SourceUsage): string {
    if (s.quoteCount === 0 && s.keyPointCount === 0) return 'Not cited in this analysis';
    const q =
      s.quoteCount === 1 ? '1 quote' : `${s.quoteCount} quotes`;
    const k =
      s.keyPointCount === 1 ? '1 key point' : `${s.keyPointCount} key points`;
    return `${q} · ${k}`;
  }

  function displayHost(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
</script>

<svelte:head>
  <title>{result ? `${result.query} — OBENA KPA` : 'OBENA Key Points Analysis'}</title>
</svelte:head>

{#if sidebar.open}
  <!-- Backdrop -->
  <!-- Light scrim — no blur, matching sources panel backdrop treatment -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-40"
    style="background: rgba(15, 23, 42, 0.08)"
    onclick={() => sidebar.close()}
  ></div>

  <!-- Sidebar panel — mirrors Sources panel, slides in from left, full viewport height -->
  <aside
    class="kpa-history-panel fixed inset-y-0 left-0 z-50 flex w-72 flex-col"
    aria-label="Recent queries"
    transition:fly={{ x: -288, duration: 220, easing: cubicOut }}
  >
    <div class="flex shrink-0 items-start justify-between gap-3 border-b border-bg3/50 px-5 py-4">
      <h2 class="font-montserrat text-lg font-semibold text-fg1">Recent</h2>
      <button
        onclick={() => sidebar.close()}
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg3 transition-colors hover:bg-bg2 hover:text-fg1"
        aria-label="Close"
      >
        <i class="fa-solid fa-xmark text-lg"></i>
      </button>
    </div>

    {#if history.length === 0}
      <p class="px-5 py-6 text-sm italic text-fg4">No recent queries yet.</p>
    {:else}
      <ul class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {#each history as entry (entry.query)}
          <li class="mb-2.5 last:mb-0">
            <button
              type="button"
              onclick={() => loadFromHistory(entry)}
              class="glass-inset group relative block w-full overflow-hidden rounded-xl p-3 text-left
                     no-underline transition-all duration-200 ease-out
                     hover:border-accent/40 hover:shadow-md dark:hover:border-accent/35
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45
                     focus-visible:ring-offset-2 focus-visible:ring-offset-bg1"
            >
              <span
                aria-hidden="true"
                class="pointer-events-none absolute inset-0 rounded-[inherit] bg-transparent
                       transition-colors duration-200 group-hover:bg-black/10 dark:group-hover:bg-white/10"
              ></span>
              <div class="relative z-10 flex min-w-0 items-center gap-3">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold leading-snug text-fg1">{entry.query}</p>
                  <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg4">
                    <span>{entry.strategy}</span>
                    <span>·</span>
                    <span>{age(entry.searchFetchedAt)}</span>
                  </div>
                </div>
                <div
                  class="shrink-0 text-fg4 transition-colors group-hover:text-accent"
                  aria-hidden="true"
                >
                  <i class="fa-solid fa-arrow-right text-sm"></i>
                </div>
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </aside>
{/if}

<main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
  <!-- Search form -->
  <form
    class="glass-panel mb-8 p-4"
    onsubmit={(e) => {
      e.preventDefault();
      void submit();
    }}
  >
    <div class="mb-3 flex gap-2">
      <input
        type="text"
        bind:value={topic}
        placeholder='Topic — e.g. "Iran nuclear deal"'
        disabled={loading}
        aria-label="Topic to analyse"
        required
        class="flex-1 rounded-full border border-bg3/60 bg-bg2/70 px-4 py-2 text-sm text-fg1 placeholder:text-fg4
               backdrop-blur-sm
               transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30
               disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={loading || !topic.trim()}
        class="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white
               transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <i class="fa-solid {loading ? 'fa-circle-notch fa-spin' : 'fa-magnifying-glass'} text-xs"></i>
        {loading ? 'Analysing…' : 'Analyse'}
      </button>
    </div>

    <div class="flex items-center gap-4 px-1 text-xs text-fg3">
      <span class="font-medium text-fg2">Strategy:</span>
      {#each ['bottom-up', 'top-down'] as const as s}
        <label class="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-fg1">
          <input
            type="radio"
            bind:group={strategy}
            value={s}
            disabled={loading}
            class="accent-accent"
          />
          {s}
        </label>
      {/each}
    </div>
  </form>

  <!-- Loading -->
  {#if loading}
    <div
      class="glass-panel flex flex-col gap-2.5 px-5 py-4 text-sm text-fg3"
      aria-live="polite"
    >
      <div class="flex items-center gap-3">
        <i class="fa-solid fa-circle-notch fa-spin text-accent"></i>
        <span>
          {#if progressPhase === 'searching'}
            Searching for sources…
          {:else if progressPhase === 'processing'}
            Processing sources…
          {:else if progressPhase === 'synthesizing'}
            Synthesising key points…
          {:else}
            Starting…
          {/if}
        </span>
      </div>
      {#if progressPhase === 'processing' && sourcesTotal > 0}
        <div class="flex items-center gap-3 pl-6">
          <div class="h-1 flex-1 overflow-hidden rounded-full bg-bg3">
            <div
              class="h-full rounded-full bg-accent transition-[width] duration-300"
              style="width: {Math.round((sourcesCompleted / sourcesTotal) * 100)}%"
            ></div>
          </div>
          <span class="tabular-nums text-xs text-fg4">{sourcesCompleted} / {sourcesTotal}</span>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Error -->
  {#if error}
    <div
      class="mb-4 flex items-start gap-3 rounded-xl border border-red-300/40 bg-red-50/75 px-4 py-3 text-sm text-red-700
             backdrop-blur-xl dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-400"
      role="alert"
    >
      <i class="fa-solid fa-circle-exclamation mt-0.5 flex-shrink-0"></i>
      <span><strong class="font-semibold">Error:</strong> {error}</span>
    </div>
  {/if}

  <!-- Results -->
  {#if result}
    <section aria-label="Analysis results">
      <!-- Results header -->
      <div class="mb-6">
        <h1 class="mb-1.5 text-xl font-semibold text-fg1">
          <i class="fa-solid fa-quote-left mr-1.5 text-sm text-accent/50"></i>{result.query}
        </h1>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg3">
          <span>{result.strategy}</span>
          <span class="text-fg4">·</span>
          {#if result.sourceUsage.length > 0}
            {@const n = result.sourceUsage.length}
            <button
              type="button"
              onclick={openSourcesDialog}
              class="inline-flex max-w-full items-center gap-2 rounded-full bg-transparent py-1 pl-1 pr-2.5 text-left font-medium text-fg2
                     outline-none transition-colors duration-200
                     hover:bg-black/10 dark:hover:bg-white/10
                     focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg1"
              aria-label={n <= 4
                ? `View ${n} ${n === 1 ? 'source' : 'sources'}`
                : `View all ${n} sources`}
            >
              <span class="flex shrink-0 -space-x-1.5" aria-hidden="true">
                {#each result.sourceUsage.slice(0, 4) as s, i (s.url)}
                  {@const stackIcon = faviconUrl(s.url)}
                  <span
                    class="relative inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-bg1 bg-bg2 ring-1 ring-bg3/40"
                    style="z-index: {i + 1}"
                  >
                    {#if stackIcon}
                      <img
                        src={stackIcon}
                        alt=""
                        width="20"
                        height="20"
                        loading="lazy"
                        decoding="async"
                        class="h-full w-full rounded-full object-contain"
                        onerror={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    {:else}
                      <i class="fa-solid fa-newspaper text-[9px] text-fg4"></i>
                    {/if}
                  </span>
                {/each}
              </span>
              <span class="min-w-0 text-fg2">
                {#if n <= 4}
                  {n}
                  {n === 1 ? 'source' : 'sources'}
                {:else}
                  and {n - 4} more {n - 4 === 1 ? 'source' : 'sources'}
                {/if}
              </span>
            </button>
          {:else}
            <span>{result.sourcesAnalyzed} sources</span>
          {/if}
          <span class="text-fg4">·</span>
          <span
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium
                   {result.cacheHit
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'}"
          >
            <i class="fa-solid {result.cacheHit ? 'fa-database' : 'fa-bolt-lightning'} text-[10px]"></i>
            {result.cacheHit ? 'cached' : 'fresh'}
          </span>
          <span class="text-fg4">·</span>
          <span class="text-fg4">{age(result.searchFetchedAt)}</span>
        </div>
      </div>

      <!-- Key point cards -->
      {#if result.keyPoints.length === 0}
        <p class="text-sm italic text-fg3">No key points extracted for this topic.</p>
      {:else}
        {#each result.keyPoints as kp, i}
          <article class="glass-panel mb-4 p-5">
            <h2 class="mb-2 flex items-start gap-3 text-base font-semibold text-fg1">
              <span
                class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full
                       bg-accent text-[10px] font-bold text-white"
              >
                {i + 1}
              </span>
              {kp.title}
            </h2>
            <p class="mb-4 pl-8 text-sm leading-relaxed text-fg2">{kp.summary}</p>

            <div class="flex flex-col gap-3 pl-8">
              {#each kp.quotes as quote}
                {@const quoteFavicon = faviconUrl(quote.url)}
                {@const articleHref = articleUrlWithSnippetHighlight(quote.url, quote.text)}
                <blockquote
                  class="glass-inset rounded-r-lg border-l-2 border-accent/50 py-3 pl-4 pr-4"
                >
                  <p class="mb-2 text-sm italic leading-relaxed text-fg2">"{quote.text}"</p>
                  <footer class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {#if quote.author || quote.outlet || quoteFavicon}
                      <span class="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-fg3">
                        <span aria-hidden="true">—</span>
                        {#if quote.author}
                          <span class="font-medium text-fg2">{quote.author}</span>
                        {/if}
                        {#if quote.author && (quote.outlet || quoteFavicon)}
                          <span class="text-fg4" aria-hidden="true">·</span>
                        {/if}
                        {#if quote.outlet}
                          {#if quoteFavicon}
                            <img
                              src={quoteFavicon}
                              alt=""
                              width="16"
                              height="16"
                              loading="lazy"
                              decoding="async"
                              class="h-4 w-4 shrink-0 rounded-sm"
                              onerror={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          {/if}
                          <span class="font-medium text-fg2">{quote.outlet}</span>
                        {:else if quoteFavicon}
                          <img
                            src={quoteFavicon}
                            alt=""
                            width="16"
                            height="16"
                            loading="lazy"
                            decoding="async"
                            class="h-4 w-4 shrink-0 rounded-sm"
                            onerror={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        {/if}
                      </span>
                    {/if}
                    <a
                      href={articleHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ml-auto flex items-center gap-1 font-medium text-accent hover:underline"
                      title={quote.url}
                    >
                      Read article
                      <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                  </footer>
                </blockquote>
              {/each}
            </div>
          </article>
        {/each}
      {/if}
    </section>

    {#if result.sourceUsage.length > 0}
      <!--
        Do not put `flex` / `fixed` / block layout on <dialog>: Tailwind `display:flex` overrides
        the UA `dialog:not([open]) { display:none }`, so close() removes [open] but the pane stays visible.
      -->
      <dialog
        use:portal
        id="kpa-sources-dialog"
        class="kpa-sources-dialog m-0 max-h-none w-full max-w-none border-0 bg-transparent p-0"
        aria-labelledby="sources-dialog-title"
      >
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="fixed inset-0 z-[100] flex h-full w-full max-w-none items-stretch justify-end bg-transparent"
          onclick={(e) => {
            if (e.target === e.currentTarget) {
              const d = document.getElementById('kpa-sources-dialog');
              if (d instanceof HTMLDialogElement) d.close();
            }
          }}
        >
          <div
            class="kpa-sources-panel flex h-full max-h-dvh w-full max-w-md flex-col border-0 shadow-2xl sm:rounded-l-2xl sm:border-l sm:border-bg3/60"
          >
          <div
            class="flex shrink-0 items-start justify-between gap-3 border-b border-bg3/50 px-5 py-4"
          >
            <div>
              <h2 id="sources-dialog-title" class="font-montserrat text-lg font-semibold text-fg1">
                Sources
              </h2>
              <p class="mt-1 text-xs leading-snug text-fg3">
                Articles retrieved for this search and how often each appears in the analysis.
              </p>
            </div>
            <form method="dialog">
              <button
                type="submit"
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg3 transition-colors hover:bg-bg2 hover:text-fg1"
                aria-label="Close"
              >
                <i class="fa-solid fa-xmark text-lg"></i>
              </button>
            </form>
          </div>
          <ul class="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
            {#each result.sourceUsage as s (s.url)}
              {@const icon = faviconUrl(s.url)}
              {@const articleLabel = s.title?.trim() ? s.title : 'Article'}
              <li class="mb-2.5 last:mb-0">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="glass-inset group relative block overflow-hidden rounded-xl p-3 no-underline transition-all duration-200 ease-out
                         hover:border-accent/40 hover:shadow-md
                         dark:hover:border-accent/35
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2
                         focus-visible:ring-offset-bg1"
                  aria-label={`${articleLabel} — opens in new tab`}
                >
                  <!-- Overlay: same 10% black/white as sources chip — layers on glass-inset without replacing its background -->
                  <span
                    aria-hidden="true"
                    class="pointer-events-none absolute inset-0 rounded-[inherit] bg-transparent transition-colors duration-200
                           group-hover:bg-black/10 dark:group-hover:bg-white/10"
                  ></span>
                  <div class="relative z-10 flex min-w-0 gap-3">
                    <div
                      class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bg3/60 bg-bg1 transition-colors group-hover:border-accent/30"
                    >
                      {#if icon}
                        <img
                          src={icon}
                          alt=""
                          width="32"
                          height="32"
                          loading="lazy"
                          decoding="async"
                          class="h-8 w-8 object-contain"
                          onerror={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      {:else}
                        <i class="fa-solid fa-newspaper text-fg4"></i>
                      {/if}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold leading-snug text-fg1">
                        {s.title ?? 'Untitled article'}
                      </p>
                      <p class="mt-0.5 text-xs text-fg3">
                        {s.outlet ?? displayHost(s.url)}
                      </p>
                      <p class="mt-2 text-xs text-fg4">{sourceUsageLabel(s)}</p>
                    </div>
                    <div
                      class="shrink-0 self-center text-fg4 transition-colors group-hover:text-accent"
                      aria-hidden="true"
                    >
                      <i class="fa-solid fa-arrow-up-right-from-square text-sm"></i>
                    </div>
                  </div>
                </a>
              </li>
            {/each}
          </ul>
          </div>
        </div>
      </dialog>
    {/if}
  {/if}
</main>
