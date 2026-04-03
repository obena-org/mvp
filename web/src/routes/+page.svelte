<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { fetchKpa } from '$lib/api';
  import type { KPAResult } from '$lib/models';

  let topic = $state('');
  let strategy = $state<'bottom-up' | 'top-down'>('bottom-up');
  let loading = $state(false);
  let result = $state<KPAResult | null>(null);
  let error = $state<string | null>(null);

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('topic');
    if (t) {
      topic = t;
      void submit({ updateUrl: false });
    }
  });

  async function submit({ updateUrl = true } = {}) {
    const q = topic.trim();
    if (!q || loading) return;

    loading = true;
    error = null;
    result = null;

    if (updateUrl) {
      await goto(`?topic=${encodeURIComponent(q)}`, {
        replaceState: true,
        keepFocus: true,
        noScroll: true,
      });
    }

    try {
      result = await fetchKpa({ topic: q, options: { strategy } });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Something went wrong';
    } finally {
      loading = false;
    }
  }

  function age(isoString: string): string {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      return `${m}m ago`;
    }
    if (seconds < 86400) {
      const h = Math.floor(seconds / 3600);
      return `${h}h ago`;
    }
    const d = Math.floor(seconds / 86400);
    return `${d}d ago`;
  }
</script>

<svelte:head>
  <title>{result ? `KPA — ${result.query}` : 'KPA — Key Points Analysis'}</title>
</svelte:head>

<header>
  <div class="header-inner">
    <span class="logo">KPA</span>
    <span class="tagline">Key Points Analysis</span>
  </div>
</header>

<main>
  <form onsubmit={(e) => { e.preventDefault(); void submit(); }}>
    <div class="input-row">
      <input
        type="text"
        bind:value={topic}
        placeholder="Topic — e.g. &quot;Iran nuclear deal&quot;"
        disabled={loading}
        aria-label="Topic to analyse"
        required
      />
      <button type="submit" disabled={loading || !topic.trim()}>
        {loading ? 'Analysing…' : 'Analyse'}
      </button>
    </div>
    <div class="strategy-row">
      <span class="strategy-label">Strategy:</span>
      <label>
        <input type="radio" bind:group={strategy} value="bottom-up" disabled={loading} />
        bottom-up
      </label>
      <label>
        <input type="radio" bind:group={strategy} value="top-down" disabled={loading} />
        top-down
      </label>
    </div>
  </form>

  {#if loading}
    <div class="loading" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p>Fetching and analysing sources — this may take up to 30 seconds…</p>
    </div>
  {/if}

  {#if error}
    <div class="error" role="alert">
      <strong>Error:</strong> {error}
    </div>
  {/if}

  {#if result}
    <section class="results" aria-label="Analysis results">
      <div class="results-header">
        <h1 class="results-query">"{result.query}"</h1>
        <div class="results-meta">
          <span class="meta-item">{result.strategy}</span>
          <span class="meta-sep">·</span>
          <span class="meta-item">{result.sourcesAnalyzed} sources</span>
          <span class="meta-sep">·</span>
          <span class="badge" class:badge-cached={result.cacheHit} class:badge-fresh={!result.cacheHit}>
            {result.cacheHit ? 'cached' : 'fresh'}
          </span>
          <span class="meta-sep">·</span>
          <span class="meta-item meta-dim">{age(result.generatedAt)}</span>
        </div>
      </div>

      {#if result.keyPoints.length === 0}
        <p class="empty">No key points extracted for this topic.</p>
      {:else}
        {#each result.keyPoints as kp, i}
          <article class="key-point">
            <h2 class="kp-title">
              <span class="kp-number">{i + 1}</span>
              {kp.title}
            </h2>
            <p class="kp-summary">{kp.summary}</p>
            <div class="quotes">
              {#each kp.quotes as quote}
                <blockquote class="quote">
                  <p class="quote-text">"{quote.text}"</p>
                  <footer class="quote-footer">
                    {#if quote.author || quote.outlet}
                      <span class="attribution">
                        —
                        {#if quote.author}<span class="author">{quote.author}</span>{/if}
                        {#if quote.author && quote.outlet}<span class="sep"> · </span>{/if}
                        {#if quote.outlet}<span class="outlet">{quote.outlet}</span>{/if}
                      </span>
                    {/if}
                    <a
                      href={quote.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="source-link"
                      title={quote.url}
                    >
                      Read article ↗
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

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Header ─────────────────────────────────────────────── */

  header {
    background: #1d1d1f;
    color: #fff;
    padding: 1rem 2rem;
  }

  .header-inner {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #a78bfa;
  }

  .tagline {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  /* ── Main layout ─────────────────────────────────────────── */

  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  /* ── Search form ─────────────────────────────────────────── */

  form {
    margin-bottom: 2rem;
  }

  .input-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  input[type='text'] {
    flex: 1;
    padding: 0.625rem 0.875rem;
    font-size: 1rem;
    border: 1.5px solid #d1d5db;
    border-radius: 8px;
    background: #fff;
    color: #1d1d1f;
    outline: none;
    transition: border-color 0.15s;
  }

  input[type='text']:focus {
    border-color: #a78bfa;
  }

  input[type='text']:disabled {
    background: #f9fafb;
    color: #9ca3af;
  }

  button[type='submit'] {
    padding: 0.625rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    background: #7c3aed;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  button[type='submit']:hover:not(:disabled) {
    background: #6d28d9;
  }

  button[type='submit']:disabled {
    background: #c4b5fd;
    cursor: not-allowed;
  }

  .strategy-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .strategy-label {
    font-weight: 500;
    color: #4b5563;
  }

  .strategy-row label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    color: #374151;
  }

  /* ── Loading ─────────────────────────────────────────────── */

  .loading {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    color: #6b7280;
    font-size: 0.9375rem;
  }

  .spinner {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border: 3px solid #e5e7eb;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 0.75s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Error ───────────────────────────────────────────────── */

  .error {
    padding: 1rem 1.25rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    color: #b91c1c;
    font-size: 0.9375rem;
    margin-bottom: 1.5rem;
  }

  /* ── Results header ──────────────────────────────────────── */

  .results-header {
    margin-bottom: 1.75rem;
  }

  .results-query {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem;
    color: #1d1d1f;
  }

  .results-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
  }

  .meta-item {
    color: #6b7280;
  }

  .meta-dim {
    color: #9ca3af;
  }

  .meta-sep {
    color: #d1d5db;
  }

  .badge {
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .badge-cached {
    background: #fef3c7;
    color: #92400e;
  }

  .badge-fresh {
    background: #d1fae5;
    color: #065f46;
  }

  /* ── Key point cards ─────────────────────────────────────── */

  .key-point {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    padding: 1.5rem 1.75rem;
    margin-bottom: 1.25rem;
  }

  .kp-title {
    font-size: 1.0625rem;
    font-weight: 700;
    margin: 0 0 0.625rem;
    color: #1d1d1f;
    display: flex;
    align-items: baseline;
    gap: 0.625rem;
  }

  .kp-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.375rem;
    background: #7c3aed;
    color: #fff;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .kp-summary {
    margin: 0 0 1.125rem;
    color: #374151;
    font-size: 0.9375rem;
  }

  /* ── Quotes ──────────────────────────────────────────────── */

  .quotes {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  blockquote.quote {
    margin: 0;
    padding: 0.875rem 1rem;
    border-left: 3px solid #a78bfa;
    background: #faf5ff;
    border-radius: 0 8px 8px 0;
  }

  .quote-text {
    margin: 0 0 0.5rem;
    font-style: italic;
    color: #374151;
    font-size: 0.9375rem;
    line-height: 1.65;
  }

  .quote-footer {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
  }

  .attribution {
    color: #6b7280;
  }

  .author {
    font-weight: 500;
    color: #4b5563;
  }

  .outlet {
    color: #6b7280;
  }

  .sep {
    color: #d1d5db;
  }

  .source-link {
    color: #7c3aed;
    text-decoration: none;
    font-weight: 500;
    margin-left: auto;
    white-space: nowrap;
  }

  .source-link:hover {
    text-decoration: underline;
  }

  .empty {
    color: #9ca3af;
    font-style: italic;
    padding: 1.5rem 0;
  }
</style>
