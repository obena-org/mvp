<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { streamKpa } from '$lib/api.js';
  import type { KPAResult, ProgressPhase } from '$lib/models';

  let topic = $state('');
  let strategy = $state<'bottom-up' | 'top-down'>('bottom-up');
  let loading = $state(false);
  let result = $state<KPAResult | null>(null);
  let error = $state<string | null>(null);
  let progressPhase = $state<ProgressPhase | null>(null);
  let sourcesCompleted = $state(0);
  let sourcesTotal = $state(0);

  let cancelStream: (() => void) | null = null;

  onMount(() => {
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
</script>

<svelte:head>
  <title>{result ? `${result.query} — OBENA KPA` : 'OBENA Key Points Analysis'}</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-4 py-8 sm:px-6">
  <!-- Search form -->
  <form
    class="mb-8 rounded-2xl border border-bg3 bg-bg1 p-4 shadow-sm"
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
        class="flex-1 rounded-full border border-bg3 bg-bg2 px-4 py-2 text-sm text-fg1 placeholder:text-fg4
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
      class="flex flex-col gap-2.5 rounded-xl border border-bg3 bg-bg1 px-5 py-4 text-sm text-fg3"
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
      class="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700
             dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400"
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
          <span>{result.sourcesAnalyzed} sources</span>
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
          <span class="text-fg4">{age(result.generatedAt)}</span>
        </div>
      </div>

      <!-- Key point cards -->
      {#if result.keyPoints.length === 0}
        <p class="text-sm italic text-fg3">No key points extracted for this topic.</p>
      {:else}
        {#each result.keyPoints as kp, i}
          <article class="mb-4 rounded-xl border border-bg3 bg-bg1 p-5 shadow-sm">
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
                <blockquote class="rounded-r-lg border-l-2 border-accent/50 bg-bg2 py-3 pl-4 pr-4">
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
                      href={quote.url}
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
  {/if}
</main>
