<script lang="ts">
  import { browser } from '$app/environment';
  import {
    AMBIENT_BUBBLE_POP_MAX_MS,
    spawnTimesRampTaper,
    u,
  } from '$lib/ambient/spawn.js';
  import { makeSpawnBubble } from '$lib/ambient/make.js';
  import type { BubbleGroup } from '$lib/ambient/types.js';
  import { AMBIENT_BUBBLE_RING_VMIN } from '$lib/ambient/types.js';
  import BubbleFloat from './BubbleFloat.svelte';
  import { onMount } from 'svelte';

  let { tone }: { tone: 'blue' | 'red' } = $props();

  let groups = $state<BubbleGroup[]>([]);
  let runId = 0;
  let bubbleId = 0;
  let timeoutIds: ReturnType<typeof setTimeout>[] = [];

  function pushTimeout(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timeoutIds.push(id);
    return id;
  }

  function startBubbleGroup() {
    /** Disjoint seed space per stream so blue/red don’t mirror the same random sequence */
    const seedBase = tone === 'blue' ? 0 : 1_000_000;
    const seed = seedBase + runId++;
    const n = 10 + Math.floor(u(seed, 3) * 12);
    const T = 2600 + u(seed, 4) * 2600;
    const times = spawnTimesRampTaper(n, T, seed);
    const anchorLeft = 10 + u(seed, 5) * 78;
    const anchorBottom = 8 + u(seed, 6) * 78;
    const sizeVmin = 22 + u(seed, 7) * 14;
    const groupId = `bg-${tone}-${seed}-${globalThis.crypto?.randomUUID?.() ?? seed}`;

    const group: BubbleGroup = {
      id: groupId,
      anchorLeft,
      anchorBottom,
      sizeVmin,
      bubbles: [],
    };
    groups = [...groups, group];

    const nextBubbleId = () => bubbleId++;

    for (let i = 0; i < times.length; i++) {
      const tMs = times[i]!;
      pushTimeout(() => {
        const bubble = makeSpawnBubble(seed, i, nextBubbleId, tone);
        groups = groups.map((g) =>
          g.id === groupId ? { ...g, bubbles: [...g.bubbles, bubble] } : g,
        );
      }, tMs);
    }

    pushTimeout(() => {
      groups = groups.filter((g) => g.id !== groupId);
      const gap = 900 + u(seed + 900, 0.33) * 6800;
      pushTimeout(() => startBubbleGroup(), gap);
    }, T + AMBIENT_BUBBLE_POP_MAX_MS);
  }

  onMount(() => {
    if (!browser) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const initialDelay =
      tone === 'blue'
        ? 400 + u(1, 0.2) * 1600
        : 600 + u(2, 0.2) * 2000;
    pushTimeout(() => startBubbleGroup(), initialDelay);
    return () => {
      for (const id of timeoutIds) {
        clearTimeout(id);
      }
      timeoutIds = [];
    };
  });
</script>

{#each groups as group (group.id)}
  <div
    class="ambient-bubble-group"
    style:--g-left="{group.anchorLeft}%"
    style:--g-bottom="{group.anchorBottom}%"
    style:--g-size="{group.sizeVmin}vmin"
  >
    {#each group.bubbles as b (b.id)}
      <BubbleFloat b={b} {tone} ringVmin={AMBIENT_BUBBLE_RING_VMIN} />
    {/each}
  </div>
{/each}
