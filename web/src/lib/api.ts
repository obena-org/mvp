/**
 * Async fetch wrapper for POST /api/kpa.
 * Throws an Error with a human-readable message on HTTP or network failure.
 */

import type { KPAErrorResponse, KPARequest, KPAResult } from '$lib/models';

export async function fetchKpa(req: KPARequest): Promise<KPAResult> {
	const res = await fetch('/api/kpa', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(req),
	});

	if (!res.ok) {
		let message = `Request failed (HTTP ${res.status})`;
		try {
			const body = (await res.json()) as KPAErrorResponse;
			if (body.error) message = body.error;
		} catch {
			// ignore JSON parse failure — use the default message
		}
		throw new Error(message);
	}

	return res.json() as Promise<KPAResult>;
}
