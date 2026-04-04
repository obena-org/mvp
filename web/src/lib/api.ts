/**
 * Async fetch wrapper for POST /api/kpa.
 * Throws an Error with a human-readable message on HTTP or network failure.
 *
 * streamKpa opens a GET /api/kpa/stream EventSource and calls back on each event.
 * Returns a cancel function; the caller must invoke it on terminal events.
 */

import type {
	ArgGraphSummary,
	HistoryEntry,
	KPAErrorResponse,
	KPARequest,
	KPAResult,
	ProgressEvent,
} from '$lib/models';

export interface StreamKpaCallbacks {
	onProgress: (event: ProgressEvent) => void;
	onComplete: (result: KPAResult, argGraph?: ArgGraphSummary) => void;
	onError: (message: string) => void;
}

/** Opens GET /api/kpa/stream and routes events to callbacks. Returns a cancel fn. */
export function streamKpa(req: KPARequest, callbacks: StreamKpaCallbacks): () => void {
	const params = new URLSearchParams({ topic: req.topic });
	if (req.options?.strategy) params.set('strategy', req.options.strategy);
	if (req.options?.numSources !== undefined)
		params.set('numSources', String(req.options.numSources));
	if (req.options?.forceRefresh) params.set('forceRefresh', 'true');

	const es = new EventSource(`/api/kpa/stream?${params.toString()}`);

	es.onmessage = (ev) => {
		let event: ProgressEvent;
		try {
			event = JSON.parse(ev.data as string) as ProgressEvent;
		} catch {
			return;
		}
		if (event.type === 'complete' || event.type === 'cache-hit') {
			es.close();
			callbacks.onComplete(event.result, event.type === 'complete' ? event.argGraph : undefined);
		} else if (event.type === 'error') {
			es.close();
			callbacks.onError(event.message);
		} else {
			callbacks.onProgress(event);
		}
	};

	es.onerror = () => {
		es.close();
		callbacks.onError('Connection lost');
	};

	return () => es.close();
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
	try {
		const res = await fetch('/api/kpa/history');
		if (!res.ok) return [];
		return res.json() as Promise<HistoryEntry[]>;
	} catch {
		return [];
	}
}

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

export async function fetchArgGraph(runId: string): Promise<ArgGraphSummary | null> {
	try {
		const res = await fetch(`/api/kpa/run/${runId}`);
		if (!res.ok) return null;
		return res.json() as Promise<ArgGraphSummary>;
	} catch {
		return null;
	}
}
