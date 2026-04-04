export type BubbleAnim = 'a' | 'b' | 'c' | 'd';

export type SpawnBubble = {
	id: string;
	l: number;
	b: number;
	anim: BubbleAnim;
	bdDur: number;
	bdDelay: number;
	bdX1: string;
	bdY1: string;
	bdX2: string;
	bdY2: string;
	bdX3: string;
	bdY3: string;
	bdX4: string;
	bdY4: string;
};

export type BubbleGroup = {
	id: string;
	anchorLeft: number;
	anchorBottom: number;
	sizeVmin: number;
	bubbles: SpawnBubble[];
};

/** Ring size (vmin); growth is from keyframe scale, not mixed bubble sizes */
export const AMBIENT_BUBBLE_RING_VMIN = 0.45;
