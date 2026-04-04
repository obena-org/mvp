import { u } from './spawn.js';
import type { SpawnBubble } from './types.js';

export function makeSpawnBubble(
	seed: number,
	i: number,
	nextBubbleId: () => number,
	tone: 'blue' | 'red',
): SpawnBubble {
	const anims = ['a', 'b', 'c', 'd'] as const;
	const amp = (k: number) => 0.65 + u(seed + i, 0.5 + k * 0.17) * 1.95;
	const pair = (k: number) => {
		const a = amp(k);
		const x = (u(seed + i, k * 2 + 0.11) - 0.5) * 2 * a;
		const y = (u(seed + i, k * 2 + 0.22) - 0.5) * 2 * a;
		return { x: `${x.toFixed(2)}vmin`, y: `${y.toFixed(2)}vmin` };
	};
	const p1 = pair(1);
	const p2 = pair(2);
	const p3 = pair(3);
	const p4 = pair(4);
	return {
		id: `b-${tone}-${seed}-${i}-${nextBubbleId()}`,
		l: 18 + u(seed + i, 0.31) * 64,
		b: 18 + u(seed + i, 0.41) * 64,
		anim: anims[i % 4]!,
		bdDur: 8 + u(seed + i, 0.93) * 16,
		bdDelay: u(seed + i, 0.87) * 6,
		bdX1: p1.x,
		bdY1: p1.y,
		bdX2: p2.x,
		bdY2: p2.y,
		bdX3: p3.x,
		bdY3: p3.y,
		bdX4: p4.x,
		bdY4: p4.y,
	};
}
