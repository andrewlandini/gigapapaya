// Pricing constants (USD) — Vercel AI Gateway, 0% markup
// Last updated: Feb 2026

// Video generation — Google Veo 3.1
export const VIDEO_PRICE_PER_SEC = 0.50;
export const VIDEO_PRICE_PER_SEC_WITH_AUDIO = 0.75;

// Storyboard pipeline (idea agent + scenes agent + mood board + portraits + storyboards)
export const STORYBOARD_PIPELINE_COST = 0.40;

// Spark an Idea wizard (3 Claude Sonnet calls)
export const IDEA_WIZARD_COST = 0.03;

// Avatar generation (1 Gemini Flash image)
export const AVATAR_COST = 0.04;

export function formatCost(amount: number): string {
  return `~$${amount.toFixed(2)}`;
}

export function estimateVideoCost(durationSec: number, hasDialogue: boolean): number {
  return durationSec * (hasDialogue ? VIDEO_PRICE_PER_SEC_WITH_AUDIO : VIDEO_PRICE_PER_SEC);
}

export function estimateGenerateVideosCost(
  scenes: Array<{ duration: number; dialogue?: string }>
): number {
  return scenes.reduce((total, scene) => {
    return total + estimateVideoCost(scene.duration, Boolean(scene.dialogue?.trim()));
  }, 0);
}

export function estimateQuickGenerateCost(durationSec: number): number {
  return durationSec * VIDEO_PRICE_PER_SEC_WITH_AUDIO;
}
