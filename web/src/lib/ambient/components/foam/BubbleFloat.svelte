<script lang="ts">
  import type { SpawnBubble } from '$lib/ambient/types.js';

  let {
    b,
    tone,
    ringVmin,
  }: {
    b: SpawnBubble;
    tone: 'blue' | 'red';
    ringVmin: number;
  } = $props();
</script>

<div
  class="ambient-bubble-float"
  style:--bubble-left="{b.l}%"
  style:--bubble-bottom="{b.b}%"
  style:--bubble-size="{ringVmin}vmin"
  style:--bd-dur="{b.bdDur}s"
  style:--bd-delay="{b.bdDelay}s"
  style:--bd-x1={b.bdX1}
  style:--bd-y1={b.bdY1}
  style:--bd-x2={b.bdX2}
  style:--bd-y2={b.bdY2}
  style:--bd-x3={b.bdX3}
  style:--bd-y3={b.bdY3}
  style:--bd-x4={b.bdX4}
  style:--bd-y4={b.bdY4}
>
  <div
    class="ambient-bubble ambient-bubble--{tone} ambient-bubble--anim-{b.anim}"
    style:--bubble-delay="0s"
  ></div>
</div>
