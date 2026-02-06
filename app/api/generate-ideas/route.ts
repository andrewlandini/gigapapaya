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

const nextStepSchema = z.object({
  question: z.string().describe('A short, creative question (3-6 words) to ask the user'),
  options: z.array(z.string()).min(5).max(5).describe('5 unique, creative answer options'),
});

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  // Generate the first question (no prior context)
  if (action === 'first-step') {
    const result = await generateObject({
      model: getTextModel('anthropic/claude-sonnet-4.5'),
      schema: nextStepSchema,
      prompt: `You are helping someone brainstorm a video idea. Ask them ONE creative, unexpected opening question to understand what kind of video they want to make. The question should be short (3-6 words), intriguing, and NOT generic like "What mood?" or "What genre?". Think more like "What keeps you up at night?", "What made you laugh last?", "What's your guilty pleasure?", "What sounds do you love?". Be creative and surprising — the question should feel like a conversation starter, not a form field. Generate 5 diverse, specific answer options that are interesting and spark imagination. Options should NOT be single words — make them evocative phrases (3-8 words each).`,
    });
    return Response.json(result.object);
  }

  // Generate the next question based on previous Q&A
  if (action === 'next-step') {
    const { questions, answers } = body as { questions: string[]; answers: string[] };
    const qaPairs = questions
      .map((q: string, i: number) => `Q: ${q}\nA: ${answers[i]}`)
      .join('\n\n');

    const stepNumber = questions.length + 1;

    const result = await generateObject({
      model: getTextModel('anthropic/claude-sonnet-4.5'),
      schema: nextStepSchema,
      prompt: `You are helping someone brainstorm a video idea through a creative conversation. Here's what they've said so far:

${qaPairs}

Ask them question #${stepNumber} of 5. This question should:
- Build on their previous answers — pick up on something specific they said and dig deeper
- Be short (3-6 words), surprising, and conversational
- NOT repeat themes already covered
- Feel like a natural follow-up in a creative conversation, not a survey
- Get progressively more specific as you learn more about their vision

Generate 5 answer options that:
- Are specific and evocative (3-8 words each), not single words
- Feel like they naturally follow from the conversation so far
- Are diverse from each other — offer genuinely different creative directions
- Would each lead to a very different kind of video`,
    });
    return Response.json(result.object);
  }

  // Generate ideas from completed Q&A (default / backwards-compatible)
  const { answers, steps } = body;

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
