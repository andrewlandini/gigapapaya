import { NextRequest } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getTextModel } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ideasSchema = z.object({
  ideas: z.array(z.string()).describe('10 creative video ideas, each 1-2 sentences'),
});

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { answers, steps } = await request.json();

  const choicesSummary = steps
    .map((q: string, i: number) => `${q} ${answers[i]}`)
    .join('\n');

  const result = await generateObject({
    model: getTextModel('anthropic/claude-sonnet-4.5'),
    schema: ideasSchema,
    prompt: `You are a creative video idea generator. Based on the user's choices below, generate 10 diverse, specific, and visually compelling video ideas. Each idea should be 1-2 sentences that someone could use as a prompt for AI video generation. Make them vivid, concrete, and varied — don't repeat the same structure. Surprise the user.

User's choices:
${choicesSummary}

Generate 10 video ideas that match these preferences. Each idea should be a complete scene description, not just a concept. Be specific about subjects, actions, and visual details.`,
  });

  return Response.json({ ideas: result.object.ideas });
}
