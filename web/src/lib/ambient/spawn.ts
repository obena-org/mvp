/** Deterministic 0–1 hash for SSR-safe, repeatable randomness */
export function u(i: number, salt: number): number {
	const t = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453123;
	return t - Math.floor(t);
}

/** Box–Muller standard normal (deterministic inputs) */
export function boxMuller(u1: number, u2: number): number {
	const a = Math.max(u1, 1e-10);
	return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Spawn times (ms) over [0, T] — density rises then falls (sorted Gaussian samples).
 */
export function spawnTimesRampTaper(n: number, T: number, seed: number): number[] {
	const raw: number[] = [];
	for (let i = 0; i < n; i++) {
		const z = boxMuller(u(seed + i * 2, 0.11), u(seed + i * 2, 0.22));
		const t = T * 0.5 + z * (T * 0.2);
		raw.push(Math.max(0, Math.min(T, t)));
	}
	raw.sort((a, b) => a - b);
	for (let i = 1; i < raw.length; i++) {
		if (raw[i]! <= raw[i - 1]!) {
			raw[i] = raw[i - 1]! + 0.5;
		}
	}
	return raw;
}

/** Longest bubble-pop keyframe duration (ms) — keep in sync with ambient.css */
export const AMBIENT_BUBBLE_POP_MAX_MS = 4500;
