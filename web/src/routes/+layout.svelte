<script lang="ts">
  import '../app.css';
  import { onMount, setContext } from 'svelte';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  let dark = $state(false);
  let sidebarOpen = $state(true);

  setContext('sidebar', {
    get open() { return sidebarOpen; },
    toggle() { sidebarOpen = !sidebarOpen; },
    close() { sidebarOpen = false; },
  });

  onMount(() => {
    dark = document.documentElement.dataset.theme === 'dark';
  });

  function toggleTheme() {
    dark = !dark;
    const theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('kpa-theme', theme);
    } catch {}
  }
</script>

<div class="ambient-layer" aria-hidden="true">
  <div class="ambient-blob ambient-blob--blue"></div>
  <div class="ambient-blob ambient-blob--red"></div>
  <div class="ambient-bubble ambient-bubble--1"></div>
  <div class="ambient-bubble ambient-bubble--2"></div>
  <div class="ambient-bubble ambient-bubble--3"></div>
  <div class="ambient-bubble ambient-bubble--4"></div>
  <div class="ambient-bubble ambient-bubble--5"></div>
  <div class="ambient-bubble ambient-bubble--6"></div>
  <div class="ambient-bubble ambient-bubble--7"></div>
</div>

<div class="relative z-10 min-h-dvh">
  <header
    class="relative sticky top-0 z-50 border-b border-white/25 bg-bg1/65 backdrop-blur-xl dark:border-white/10 dark:bg-bg1/55"
  >
    <!-- History toggle: pinned to the far-left edge of the viewport -->
    <button
      onclick={() => { sidebarOpen = !sidebarOpen; }}
      class="absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center
             rounded-full text-fg3 transition-colors hover:bg-bg2 hover:text-fg1
             {sidebarOpen ? 'bg-bg2 text-fg1' : ''}"
      aria-label={sidebarOpen ? 'Close recent queries' : 'Open recent queries'}
      aria-expanded={sidebarOpen}
    >
      <i class="fa-solid fa-clock-rotate-left text-sm"></i>
    </button>

    <div class="mx-auto flex min-h-16 max-w-3xl items-center justify-between px-4 py-2 sm:px-6">
      <div class="flex items-baseline gap-2.5">
        <span class="o-logo text-2xl text-fg1 sm:text-3xl">OBENA</span>
        <span class="hidden text-2xl font-light text-fg4 sm:inline sm:text-3xl">/ Key Points</span>
      </div>

      <button
        onclick={toggleTheme}
        class="flex h-8 w-8 items-center justify-center rounded-full text-fg3 transition-colors hover:bg-bg2 hover:text-fg1"
        aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <i class="fa-solid {dark ? 'fa-sun' : 'fa-moon'} text-sm"></i>
      </button>
    </div>
  </header>

  {@render children()}
</div>
