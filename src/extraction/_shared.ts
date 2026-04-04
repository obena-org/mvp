/**
 * Shared Claude tool-call helpers for all extraction strategies.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { Settings } from '../settings.js';

export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
	const def = schema._def as {
		typeName: string;
		shape?: () => Record<string, z.ZodTypeAny>;
		type?: z.ZodTypeAny;
		innerType?: z.ZodTypeAny;
		values?: readonly string[];
	};
	if (def.typeName === 'ZodObject') {
		const shape = def.shape?.() ?? {};
		const properties: Record<string, unknown> = {};
		const required: string[] = [];
		for (const [k, v] of Object.entries(shape)) {
			properties[k] = zodToJsonSchema(v as z.ZodTypeAny);
			if (!(v as z.ZodTypeAny).isOptional()) required.push(k);
		}
		return { type: 'object', properties, required };
	}
	if (def.typeName === 'ZodArray') return { type: 'array', items: zodToJsonSchema(def.type!) };
	if (def.typeName === 'ZodString') return { type: 'string' };
	if (def.typeName === 'ZodBoolean') return { type: 'boolean' };
	if (def.typeName === 'ZodNumber' || def.typeName === 'ZodInt') return { type: 'number' };
	if (def.typeName === 'ZodEnum') return { type: 'string', enum: def.values };
	if (def.typeName === 'ZodDefault') return zodToJsonSchema(def.innerType!);
	if (def.typeName === 'ZodNullable' || def.typeName === 'ZodOptional') {
		return zodToJsonSchema(def.innerType!);
	}
	return {};
}

export async function callClaude(
	client: Anthropic,
	prompt: string,
	toolName: string,
	toolDescription: string,
	schema: z.ZodTypeAny,
	settings: Settings,
	maxTokens = 4096,
): Promise<Record<string, unknown>> {
	const response = await client.messages.create({
		model: settings.claudeModel,
		max_tokens: maxTokens,
		tools: [
			{
				name: toolName,
				description: toolDescription,
				input_schema: zodToJsonSchema(schema) as Anthropic.Tool['input_schema'],
			},
		],
		tool_choice: { type: 'tool', name: toolName },
		messages: [{ role: 'user', content: prompt }],
	});

	const block = response.content.find((b) => b.type === 'tool_use');
	if (!block || block.type !== 'tool_use') {
		throw new Error('Claude did not return a tool_use block');
	}
	return block.input as Record<string, unknown>;
}
