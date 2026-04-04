<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { goto } from '$app/navigation';
  import { fetchHistory, streamKpa } from '$lib/api.js';
  import { portal } from '$lib/portal';
  import type {
    ArgGraphSummary,
    ArgUnitSummary,
    HistoryEntry,
    IssueSummary,
    KPAResult,
    ProposalSummary,
    ProgressPhase,
    SourceUsage,
  } from '$lib/models';

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
  let argGraph = $state<ArgGraphSummary | null>(null);
  let activeTab = $state<'key-points' | 'arg-map' | 'proposals'>('key-points');
  let error = $state<string | null>(null);
  let progressPhase = $state<ProgressPhase | null>(null);
  let sourcesCompleted = $state(0);
  let sourcesTotal = $state(0);

  let cancelStream: (() => void) | null = null;
  let history = $state<HistoryEntry[]>([]);

  /** Expanded state for each key point card (animated via `slide`); reset when a new result loads. */
  let keyPointOpen = $state<Record<number, boolean>>({});
  let debugOpen = $state<Record<string, boolean>>({});

  $effect(() => {
    if (result) {
      keyPointOpen = {};
      debugOpen = {};
    }
  });

  $effect(() => {
    // Switch to key-points tab when a new result arrives
    if (result) activeTab = 'key-points';
  });

  function toggleKeyPoint(index: number) {
    const next = !(keyPointOpen[index] ?? false);
    keyPointOpen = { ...keyPointOpen, [index]: next };
  }

  function toggleDebug(unitId: string) {
    debugOpen = { ...debugOpen, [unitId]: !(debugOpen[unitId] ?? false) };
  }

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
    argGraph = null;
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
        onComplete(r, graph) {
          result = r;
          argGraph = graph ?? null;
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
    const q = s.quoteCount === 1 ? '1 quote' : `${s.quoteCount} quotes`;
    const k = s.keyPointCount === 1 ? '1 key point' : `${s.keyPointCount} key points`;
    return `${q} · ${k}`;
  }

  function displayHost(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  // ── Taxonomy helpers ──────────────────────────────────────────────────────

  const ARG_TYPE_LABELS: Record<string, string> = {
    PROBLEM_FRAMING: 'Framing',
    DIAGNOSTIC_CAUSAL: 'Diagnostic',
    NORMATIVE_EVALUATIVE: 'Normative',
    PROPOSAL_PRESCRIPTION: 'Proposal',
    IMPLEMENTATION_DESIGN: 'Design',
    CONSEQUENCE_FORECAST: 'Forecast',
    FACTUAL_PREMISE_DISPUTE: 'Fact dispute',
    LEGAL_PROCEDURAL: 'Legal',
    ACTOR_APPRAISAL: 'Actor appraisal',
    TRADEOFF_BALANCING: 'Tradeoff',
    COALITION_STRATEGY: 'Coalition',
    META_DISCURSIVE: 'Meta',
  };

  const ARG_TYPE_COLORS: Record<string, string> = {
    PROBLEM_FRAMING: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    DIAGNOSTIC_CAUSAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    NORMATIVE_EVALUATIVE: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    PROPOSAL_PRESCRIPTION: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
    IMPLEMENTATION_DESIGN: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    CONSEQUENCE_FORECAST: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    FACTUAL_PREMISE_DISPUTE: 'bg-stone-100 text-stone-700 dark:bg-stone-800/40 dark:text-stone-300',
    LEGAL_PROCEDURAL: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    ACTOR_APPRAISAL: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    TRADEOFF_BALANCING: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300',
    COALITION_STRATEGY: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    META_DISCURSIVE: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300',
  };

  const POSITION_COLORS: Record<string, string> = {
    FOR: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    POSITIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    JUST: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    PRUDENT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    LEGITIMATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    AGAINST: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    NEGATIVE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    UNJUST: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    IMPRUDENT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    ILLEGITIMATE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  function argTypeBadgeClass(argType: string): string {
    return ARG_TYPE_COLORS[argType] ?? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300';
  }

  function positionBadgeClass(position: string | null): string {
    if (!position) return '';
    return POSITION_COLORS[position] ?? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  }

  function positionLabel(position: string | null): string {
    if (!position) return '';
    return position.toLowerCase().replace(/_/g, '-');
  }

  function childIssues(graph: ArgGraphSummary, parentId: string): IssueSummary[] {
    return graph.issues.filter((i) => i.parentId === parentId);
  }

  function issueUnits(graph: ArgGraphSummary, issueId: string, includeChildren = true): ArgUnitSummary[] {
    const childIds = includeChildren
      ? new Set(graph.issues.filter((i) => i.parentId === issueId).map((i) => i.id))
      : new Set<string>();
    return graph.argumentUnits.filter(
      (u) => u.issueId === issueId || (includeChildren && childIds.has(u.issueId ?? '')),
    );
  }

  function proposalUnits(graph: ArgGraphSummary, proposalId: string): ArgUnitSummary[] {
    return graph.argumentUnits.filter((u) => u.proposalId === proposalId);
  }

  function stanceCounts(units: ArgUnitSummary[]): { for: number; against: number; qualified: number; other: number } {
    let forCount = 0, againstCount = 0, qualifiedCount = 0, other = 0;
    for (const u of units) {
      const p = u.position ?? '';
      if (p === 'FOR' || p === 'POSITIVE' || p === 'JUST' || p === 'PRUDENT' || p === 'LEGITIMATE') forCount++;
      else if (p === 'AGAINST' || p === 'NEGATIVE' || p === 'UNJUST' || p === 'IMPRUDENT' || p === 'ILLEGITIMATE') againstCount++;
      else if (p.includes('CONDITION') || p === 'MIXED' || p === 'FOR_IN_PRINCIPLE_AGAINST_CURRENT') qualifiedCount++;
      else if (p) other++;
    }
    return { for: forCount, against: againstCount, qualified: qualifiedCount, other };
  }

  function typeBreakdown(units: ArgUnitSummary[]): Array<{ type: string; count: number }> {
    const m = new Map<string, number>();
    for (const u of units) m.set(u.argType, (m.get(u.argType) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }
</script>

<svelte:head>
  <title>{result ? `${result.query} — OBENA KPA` : 'OBENA Key Points Analysis'}</title>
</svelte:head>

{#if sidebar.open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="fixed inset-0 z-40"
    style="background: rgba(15, 23, 42, 0.08)"
    onclick={() => sidebar.close()}
  ></div>

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
                <div class="shrink-0 text-fg4 transition-colors group-hover:text-accent" aria-hidden="true">
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
    onsubmit={(e) => { e.preventDefault(); void submit(); }}
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
               backdrop-blur-sm transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30
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
          <input type="radio" bind:group={strategy} value={s} disabled={loading} class="accent-accent" />
          {s}
        </label>
      {/each}
    </div>
  </form>

  <!-- Loading -->
  {#if loading}
    <div class="glass-panel flex flex-col gap-2.5 px-5 py-4 text-sm text-fg3" aria-live="polite">
      <div class="flex items-center gap-3">
        <i class="fa-solid fa-circle-notch fa-spin text-accent"></i>
        <span>
          {#if progressPhase === 'searching'}Searching for sources…
          {:else if progressPhase === 'processing'}Processing sources…
          {:else if progressPhase === 'synthesizing'}Synthesising…
          {:else}Starting…{/if}
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
      <div class="mb-4">
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
                     outline-none transition-colors duration-200 hover:bg-black/10 dark:hover:bg-white/10
                     focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg1"
              aria-label={n <= 4 ? `View ${n} ${n === 1 ? 'source' : 'sources'}` : `View all ${n} sources`}
            >
              <span class="flex shrink-0 -space-x-1.5" aria-hidden="true">
                {#each result.sourceUsage.slice(0, 4) as s, i (s.url)}
                  {@const stackIcon = faviconUrl(s.url)}
                  <span
                    class="relative inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-bg1 bg-bg2 ring-1 ring-bg3/40"
                    style="z-index: {i + 1}"
                  >
                    {#if stackIcon}
                      <img src={stackIcon} alt="" width="20" height="20" loading="lazy" decoding="async"
                        class="h-full w-full rounded-full object-contain"
                        onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    {:else}
                      <i class="fa-solid fa-newspaper text-[9px] text-fg4"></i>
                    {/if}
                  </span>
                {/each}
              </span>
              <span class="min-w-0 text-fg2">
                {#if n <= 4}{n} {n === 1 ? 'source' : 'sources'}
                {:else}and {n - 4} more {n - 4 === 1 ? 'source' : 'sources'}{/if}
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

      <!-- View tabs (only show taxonomy tabs when argGraph is available) -->
      {#if argGraph}
        <div class="mb-5 flex gap-1 rounded-xl bg-bg2/60 p-1" role="tablist">
          {#each [
            { id: 'key-points', label: 'Key Points', icon: 'fa-list-ul' },
            { id: 'arg-map', label: 'Argument Map', icon: 'fa-diagram-project' },
            { id: 'proposals', label: 'Proposals', icon: 'fa-scale-balanced' },
          ] as const as tab}
            <button
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              onclick={() => { activeTab = tab.id; }}
              class="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all
                     {activeTab === tab.id
                       ? 'bg-bg1 text-fg1 shadow-sm'
                       : 'text-fg3 hover:text-fg1'}"
            >
              <i class="fa-solid {tab.icon} text-[10px]"></i>
              {tab.label}
            </button>
          {/each}
        </div>
      {/if}

      <!-- ── Key Points tab ────────────────────────────────────────────── -->
      {#if activeTab === 'key-points'}
        {#if result.keyPoints.length === 0}
          <p class="text-sm italic text-fg3">No key points extracted for this topic.</p>
        {:else}
          {#each result.keyPoints as kp, i}
            <article class="glass-panel mb-4 overflow-hidden p-0">
              <button
                type="button"
                class="flex w-full cursor-pointer items-start gap-3 p-5 text-left outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg1"
                aria-expanded={keyPointOpen[i] ?? false}
                aria-controls={`kpa-kp-panel-${i}`}
                id={`kpa-kp-trigger-${i}`}
                onclick={() => toggleKeyPoint(i)}
              >
                <span
                  class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white"
                  aria-hidden="true">{i + 1}</span>
                <span class="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <h2 class="text-base font-semibold leading-snug text-fg1">{kp.title}</h2>
                  <span
                    class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-fg3 transition-transform duration-200 {keyPointOpen[i] ? 'rotate-180' : ''}"
                    aria-hidden="true"><i class="fa-solid fa-chevron-down text-xs"></i></span>
                </span>
              </button>
              {#if keyPointOpen[i]}
                <div
                  id={`kpa-kp-panel-${i}`}
                  role="region"
                  aria-labelledby={`kpa-kp-trigger-${i}`}
                  class="border-t border-bg3/40 px-5 pb-5 pt-3"
                  transition:slide={{ duration: 220, easing: cubicOut }}
                >
                  <p class="mb-4 pl-8 text-sm leading-relaxed text-fg2">{kp.summary}</p>
                  <div class="flex flex-col gap-3 pl-8">
                    {#each kp.quotes as quote}
                      {@const quoteFavicon = faviconUrl(quote.url)}
                      {@const articleHref = articleUrlWithSnippetHighlight(quote.url, quote.text)}
                      <blockquote class="glass-inset rounded-r-lg border-l-2 border-accent/50 py-3 pl-4 pr-4">
                        <p class="mb-2 text-sm italic leading-relaxed text-fg2">"{quote.text}"</p>
                        <footer class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          {#if quote.author || quote.outlet || quoteFavicon}
                            <span class="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-fg3">
                              <span aria-hidden="true">—</span>
                              {#if quote.author}<span class="font-medium text-fg2">{quote.author}</span>{/if}
                              {#if quote.author && (quote.outlet || quoteFavicon)}<span class="text-fg4" aria-hidden="true">·</span>{/if}
                              {#if quote.outlet}
                                {#if quoteFavicon}
                                  <img src={quoteFavicon} alt="" width="16" height="16" loading="lazy" decoding="async"
                                    class="h-4 w-4 shrink-0 rounded-sm"
                                    onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                {/if}
                                <span class="font-medium text-fg2">{quote.outlet}</span>
                              {:else if quoteFavicon}
                                <img src={quoteFavicon} alt="" width="16" height="16" loading="lazy" decoding="async"
                                  class="h-4 w-4 shrink-0 rounded-sm"
                                  onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              {/if}
                            </span>
                          {/if}
                          <a href={articleHref} target="_blank" rel="noopener noreferrer"
                            class="ml-auto flex items-center gap-1 font-medium text-accent hover:underline" title={quote.url}>
                            Read article <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                          </a>
                        </footer>
                      </blockquote>
                    {/each}
                  </div>
                </div>
              {/if}
            </article>
          {/each}
        {/if}
      {/if}

      <!-- ── Argument Map tab ──────────────────────────────────────────── -->
      {#if activeTab === 'arg-map' && argGraph}
        {@const roots = argGraph.issues.filter((i) => !i.parentId)}
        {#if roots.length === 0}
          <p class="text-sm italic text-fg3">No issue nodes extracted for this topic.</p>
        {:else}
          {#each roots as root}
            {@const children = childIssues(argGraph, root.id)}
            {@const units = issueUnits(argGraph, root.id)}
            {@const breakdown = typeBreakdown(units)}
            {@const topUnits = units.filter((u) => u.centrality === 'CENTRAL').slice(0, 3)}
            {@const shownUnits = topUnits.length > 0 ? topUnits : units.slice(0, 3)}

            <div class="glass-panel mb-5 p-5">
              <!-- Issue header -->
              <div class="mb-3 flex items-start gap-2">
                <i class="fa-solid fa-circle-dot mt-0.5 text-accent text-sm shrink-0"></i>
                <div class="min-w-0 flex-1">
                  <h2 class="text-base font-semibold text-fg1">{root.title}</h2>
                  {#if root.description}
                    <p class="mt-0.5 text-xs text-fg3">{root.description}</p>
                  {/if}
                  {#if root.domain}
                    <span class="mt-1 inline-block rounded-full bg-bg3/60 px-2 py-0.5 text-xs text-fg4">
                      {root.domain}
                    </span>
                  {/if}
                </div>
                <span class="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent font-medium">
                  {units.length} unit{units.length !== 1 ? 's' : ''}
                </span>
              </div>

              <!-- Sub-issues -->
              {#if children.length > 0}
                <div class="mb-3 ml-5 flex flex-col gap-1">
                  {#each children as child}
                    {@const childUnits = issueUnits(argGraph, child.id, false)}
                    <div class="flex items-center gap-2 text-xs text-fg3">
                      <i class="fa-solid fa-turn-down-right text-fg4 text-[10px]"></i>
                      <span class="text-fg2">{child.title}</span>
                      <span class="text-fg4">· {childUnits.length}</span>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Type breakdown chips -->
              {#if breakdown.length > 0}
                <div class="mb-3 flex flex-wrap gap-1.5">
                  {#each breakdown as { type, count }}
                    <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium {argTypeBadgeClass(type)}">
                      {ARG_TYPE_LABELS[type] ?? type}
                      <span class="opacity-70">{count}</span>
                    </span>
                  {/each}
                </div>
              {/if}

              <!-- Top argument unit cards -->
              {#if shownUnits.length > 0}
                <div class="flex flex-col gap-2">
                  {#each shownUnits as unit}
                    <div class="glass-inset rounded-lg p-3">
                      <div class="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span class="rounded-full px-2 py-0.5 text-[11px] font-medium {argTypeBadgeClass(unit.argType)}">
                          {ARG_TYPE_LABELS[unit.argType] ?? unit.argType}
                        </span>
                        {#if unit.position}
                          <span class="rounded-full px-2 py-0.5 text-[11px] font-medium {positionBadgeClass(unit.position)}">
                            {positionLabel(unit.position)}
                          </span>
                        {/if}
                        {#if unit.centrality === 'CENTRAL'}
                          <span class="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">core</span>
                        {/if}
                      </div>
                      <p class="mb-1 text-xs italic text-fg2">"{unit.claimSummary}"</p>
                      <div class="flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg4">
                        <span>{[unit.author, unit.outlet].filter(Boolean).join(' · ') || displayHost(unit.sourceUrl)}</span>
                        <!-- Debug toggle -->
                        <button
                          type="button"
                          onclick={() => toggleDebug(unit.id)}
                          class="text-fg4 hover:text-fg2 transition-colors"
                          aria-label="Show synthesis details"
                        >
                          <i class="fa-solid fa-flask text-[10px]"></i>
                        </button>
                      </div>
                      {#if debugOpen[unit.id]}
                        <div
                          class="mt-2 rounded-md bg-bg3/40 p-2 text-[11px] text-fg4 space-y-0.5"
                          transition:slide={{ duration: 150, easing: cubicOut }}
                        >
                          {#if unit.issueLinkConfidence}
                            <p><span class="text-fg3">issue confidence:</span> {unit.issueLinkConfidence}</p>
                          {/if}
                          {#if unit.proposalLinkConfidence}
                            <p><span class="text-fg3">proposal confidence:</span> {unit.proposalLinkConfidence}</p>
                          {/if}
                          {#if unit.evidenceStyle}
                            <p><span class="text-fg3">evidence:</span> {unit.evidenceStyle.toLowerCase()}</p>
                          {/if}
                          <p><span class="text-fg3">centrality:</span> {unit.centrality.toLowerCase()}</p>
                          <p><span class="text-fg3">role:</span> {unit.claimRole.toLowerCase().replace(/_/g, ' ')}</p>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}

          <!-- Units not linked to any issue -->
          {@const unassigned = argGraph.argumentUnits.filter((u) => !u.issueId)}
          {#if unassigned.length > 0}
            <div class="glass-panel mb-4 p-4">
              <p class="mb-3 text-xs font-medium text-fg3">
                <i class="fa-solid fa-circle-question mr-1"></i>
                {unassigned.length} unit{unassigned.length !== 1 ? 's' : ''} not linked to an issue
              </p>
              <div class="flex flex-col gap-2">
                {#each unassigned.slice(0, 4) as unit}
                  <div class="flex items-start gap-2 text-xs text-fg3">
                    <span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium {argTypeBadgeClass(unit.argType)} shrink-0">
                      {ARG_TYPE_LABELS[unit.argType] ?? unit.argType}
                    </span>
                    <span class="text-fg2 italic">"{unit.claimSummary}"</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/if}
      {/if}

      <!-- ── Proposals tab ─────────────────────────────────────────────── -->
      {#if activeTab === 'proposals' && argGraph}
        {@const topProposals = argGraph.proposals.filter((p) => !p.parentId)}
        {#if topProposals.length === 0}
          <p class="text-sm italic text-fg3">No proposals extracted for this topic.</p>
        {:else}
          {#each topProposals as proposal}
            {@const units = proposalUnits(argGraph, proposal.id)}
            {@const stance = stanceCounts(units)}
            {@const total = units.length}
            {@const components = proposal.isBundle
              ? argGraph.proposals.filter((p) => p.parentId === proposal.id)
              : []}

            <div class="glass-panel mb-4 p-5">
              <div class="mb-3 flex items-start gap-2">
                <i class="fa-solid fa-arrow-right mt-0.5 text-accent text-sm shrink-0"></i>
                <div class="min-w-0 flex-1">
                  <h3 class="text-sm font-semibold text-fg1">{proposal.title}</h3>
                  {#if proposal.actionVerb}
                    <p class="mt-0.5 text-xs text-fg3">Action: {proposal.actionVerb}</p>
                  {/if}
                  {#if proposal.claimedEnds}
                    <p class="mt-0.5 text-xs text-fg4">
                      <span class="text-fg3">Goals:</span> {proposal.claimedEnds.replace(/\|/g, ' · ')}
                    </p>
                  {/if}
                </div>
                {#if proposal.isBundle}
                  <span class="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">bundle</span>
                {/if}
              </div>

              <!-- Stance bar -->
              {#if total > 0}
                <div class="mb-3">
                  <div class="mb-1 flex items-center justify-between text-[11px] text-fg4">
                    <span>{total} argument unit{total !== 1 ? 's' : ''}</span>
                    <span class="flex gap-3">
                      {#if stance.for > 0}<span class="text-green-600 dark:text-green-400">{stance.for} for</span>{/if}
                      {#if stance.against > 0}<span class="text-red-600 dark:text-red-400">{stance.against} against</span>{/if}
                      {#if stance.qualified > 0}<span class="text-amber-600 dark:text-amber-400">{stance.qualified} qualified</span>{/if}
                    </span>
                  </div>
                  {#if stance.for + stance.against + stance.qualified > 0}
                    <div class="flex h-2 overflow-hidden rounded-full bg-bg3">
                      {#if stance.for > 0}
                        <div class="bg-green-500" style="width: {(stance.for / total) * 100}%"></div>
                      {/if}
                      {#if stance.qualified > 0}
                        <div class="bg-amber-400" style="width: {(stance.qualified / total) * 100}%"></div>
                      {/if}
                      {#if stance.against > 0}
                        <div class="bg-red-500" style="width: {(stance.against / total) * 100}%"></div>
                      {/if}
                    </div>
                  {/if}
                </div>

                <!-- Argument units for this proposal (collapsed) -->
                <div class="flex flex-col gap-1.5">
                  {#each units.slice(0, 4) as unit}
                    <div class="flex items-start gap-2 text-xs">
                      {#if unit.position}
                        <span class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium {positionBadgeClass(unit.position)}">
                          {positionLabel(unit.position)}
                        </span>
                      {/if}
                      <span class="text-fg3 italic min-w-0">"{unit.claimSummary}"</span>
                    </div>
                  {/each}
                  {#if units.length > 4}
                    <p class="text-[11px] text-fg4 mt-1">+{units.length - 4} more</p>
                  {/if}
                </div>
              {:else}
                <p class="text-xs italic text-fg4">No argument units linked to this proposal.</p>
              {/if}

              <!-- Bundle components -->
              {#if components.length > 0}
                <div class="mt-3 border-t border-bg3/40 pt-3">
                  <p class="mb-2 text-[11px] font-medium text-fg3">Components:</p>
                  {#each components as comp}
                    {@const compUnits = proposalUnits(argGraph, comp.id)}
                    {@const compStance = stanceCounts(compUnits)}
                    <div class="mb-1 flex items-center gap-2 text-xs">
                      <i class="fa-solid fa-minus text-fg4 text-[9px] shrink-0"></i>
                      <span class="text-fg2">{comp.title}</span>
                      {#if compUnits.length > 0}
                        <span class="ml-auto flex gap-2 shrink-0 text-[10px]">
                          {#if compStance.for > 0}<span class="text-green-600 dark:text-green-400">{compStance.for}✓</span>{/if}
                          {#if compStance.against > 0}<span class="text-red-600 dark:text-red-400">{compStance.against}✗</span>{/if}
                        </span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      {/if}
    </section>

    <!-- Sources dialog -->
    {#if result.sourceUsage.length > 0}
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
          <div class="kpa-sources-panel flex h-full max-h-dvh w-full max-w-md flex-col border-0 shadow-2xl sm:rounded-l-2xl sm:border-l sm:border-bg3/60">
            <div class="flex shrink-0 items-start justify-between gap-3 border-b border-bg3/50 px-5 py-4">
              <div>
                <h2 id="sources-dialog-title" class="font-montserrat text-lg font-semibold text-fg1">Sources</h2>
                <p class="mt-1 text-xs leading-snug text-fg3">
                  Articles retrieved for this search and how often each appears in the analysis.
                </p>
              </div>
              <form method="dialog">
                <button
                  type="submit"
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-fg3 transition-colors hover:bg-bg2 hover:text-fg1"
                  aria-label="Close"
                ><i class="fa-solid fa-xmark text-lg"></i></button>
              </form>
            </div>
            <ul class="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
              {#each result.sourceUsage as s (s.url)}
                {@const icon = faviconUrl(s.url)}
                {@const articleLabel = s.title?.trim() ? s.title : 'Article'}
                <li class="mb-2.5 last:mb-0">
                  <a
                    href={s.url} target="_blank" rel="noopener noreferrer"
                    class="glass-inset group relative block overflow-hidden rounded-xl p-3 no-underline transition-all duration-200 ease-out
                           hover:border-accent/40 hover:shadow-md dark:hover:border-accent/35
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg1"
                    aria-label={`${articleLabel} — opens in new tab`}
                  >
                    <span
                      aria-hidden="true"
                      class="pointer-events-none absolute inset-0 rounded-[inherit] bg-transparent transition-colors duration-200
                             group-hover:bg-black/10 dark:group-hover:bg-white/10"
                    ></span>
                    <div class="relative z-10 flex min-w-0 gap-3">
                      <div class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-bg3/60 bg-bg1 transition-colors group-hover:border-accent/30">
                        {#if icon}
                          <img src={icon} alt="" width="32" height="32" loading="lazy" decoding="async"
                            class="h-8 w-8 object-contain"
                            onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        {:else}
                          <i class="fa-solid fa-newspaper text-fg4"></i>
                        {/if}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold leading-snug text-fg1">{s.title ?? 'Untitled article'}</p>
                        <p class="mt-0.5 text-xs text-fg3">{s.outlet ?? displayHost(s.url)}</p>
                        <p class="mt-2 text-xs text-fg4">{sourceUsageLabel(s)}</p>
                      </div>
                      <div class="shrink-0 self-center text-fg4 transition-colors group-hover:text-accent" aria-hidden="true">
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
