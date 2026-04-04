/**
 * Ambient background effervescence — spawn timing, bubble data, and foam UI live under
 * `ambient/components/foam/`. Import components from there or this barrel (logic only here).
 */
export { AMBIENT_BUBBLE_POP_MAX_MS, boxMuller, spawnTimesRampTaper, u } from './spawn.js';
export { makeSpawnBubble } from './make.js';
export { AMBIENT_BUBBLE_RING_VMIN } from './types.js';
export type { BubbleAnim, BubbleGroup, SpawnBubble } from './types.js';
