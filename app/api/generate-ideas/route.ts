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
      prompt: `You are a wildly creative director helping someone discover what video they actually want to make — they just don't know it yet.

The first question is ALWAYS about a feeling. Ask them what feeling they want to sit inside of, chase, or capture. Not a filmmaking term like "mood" — an actual human feeling.

Ask ONE opening question. Rules:
- The question must be about a feeling, emotion, or emotional state
- Frame it in a way that's personal and evocative, not clinical. Not "What emotion?" — more like "What feeling have you been chasing lately?", "What hits you right in the chest?", "What emotion do you keep coming back to?"
- Keep it under 8 words.

Generate 5 answer options. Rules:
- Each option should be a specific feeling described in vivid, human language (5-10 words)
- NOT single emotion words like "happiness" or "sadness". Describe the TEXTURE of the feeling.
- Example energy: "That ache when you almost remember something", "The buzz right before everything goes wrong", "Quiet pride no one else notices", "Missing someone who's sitting right next to you", "The reckless joy of not caring anymore"
- Each option should be a completely different emotional territory — cover the FULL spectrum: something dark, something light, something bittersweet, something chaotic, something quiet. Don't cluster around one emotional zone.
- They should feel like someone finally putting words to something they've felt but never said`,
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
      prompt: `You are a wildly creative director having a real conversation to discover what video someone needs to make. Here's what they've revealed so far:

${qaPairs}

This is question ${stepNumber} of 5. You're getting to know them. React to what they just said — pick up on something specific, something emotional, something interesting in their last answer.

Question rules:
- Reference or riff on their actual words. Show you were listening.
- Go deeper into the feeling behind what they said, not wider into new topics
- NEVER use filmmaking jargon (mood, tone, style, genre, aesthetic)
- Keep it under 8 words
- It should feel like something a curious friend would ask, not a chatbot

Answer options rules:
- 5 options, each 5-10 words
- Each should be a specific image, moment, or scenario — NOT categories or adjectives
- They should feel like responses in a real conversation
- Each one should take the video in a wildly different direction
- Ground them in sensory details — what you'd see, hear, feel
- Make at least one option weird or unexpected`,
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
