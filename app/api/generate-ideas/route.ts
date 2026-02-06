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
  options: z.array(z.string()).min(3).max(3).describe('3 unique, creative answer options'),
});

const reactionSchema = z.object({
  reaction: z.string().describe('A short, enthusiastic 2-5 word reaction'),
});

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  // Quick reaction to user's answer (uses fast model)
  if (action === 'react') {
    const { answer } = body as { answer: string };
    const result = await generateObject({
      model: getTextModel('google/gemini-3-flash'),
      schema: reactionSchema,
      prompt: `Someone is brainstorming a video idea and just picked: "${answer}". Give a short, enthusiastic, casual reaction (2-5 words). Like a creative friend who's excited about the direction. Examples of the vibe: "Oh that's sick", "Yes, love that", "Ooh interesting choice", "Now we're talking", "OK I see you". Be natural and varied — don't always start with "Oh" or "Ooh". Never use exclamation marks.`,
    });
    return Response.json(result.object);
  }

  // Generate the first question (no prior context)
  if (action === 'first-step') {
    const result = await generateObject({
      model: getTextModel('anthropic/claude-sonnet-4.5'),
      schema: nextStepSchema,
      prompt: `You are a wildly creative video concept brainstormer. You help people come up with out-there, imaginative, cinematic video ideas — the weirder and more visually interesting, the better.

The first question should kick off the creative direction. Ask about what kind of WORLD, SCENARIO, or VISUAL they want to see — not how they feel.

Ask ONE opening question. Rules:
- Ask about a concept, scenario, world, or visual — NOT about feelings, emotions, or personal experiences
- Think like: "What world do you want to drop into?", "What would blow your mind to see?", "What's the wildest thing you'd film?", "What universe should we build?"
- Keep it under 8 words. Make it fun and energizing.

Generate 3 answer options. Rules:
- Each option should be a wild, specific, visual scenario or world (5-12 words)
- Think big — alien landscapes, impossible physics, talking animals, time travel, microscopic worlds, retro futures, underwater cities
- Example energy: "A chef cooking dinner on the surface of Mars", "Robots learning to dance in a neon junkyard", "A tiny civilization living inside a vending machine", "Dinosaurs commuting to office jobs in Tokyo", "An underwater jazz club run by octopuses"
- Each option should be a completely different creative universe — something sci-fi, something absurd/funny, something beautiful/epic, something surreal, something grounded-but-twisted
- They should make someone go "oh that would be sick to watch"
- Keep the energy fun, playful, epic, or mind-bending. Not personal or emotional.
- NOTHING morbid, dark, violent, depressing, or disturbing.`,
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
      prompt: `You are a wildly creative video concept brainstormer building on a conversation. Here's what they've picked so far:

${qaPairs}

This is question ${stepNumber} of 3. Build on what they chose — zoom into their world and add more detail, a twist, or a new dimension to the concept.

Question rules:
- Riff on their previous choices. Take the concept further, don't start over.
- Ask about specifics: characters, setting details, plot twists, visual style, what happens next, who's involved
- Think like a creative collaborator: "OK so who lives there?", "What goes wrong?", "What's the twist?", "What does it look like up close?"
- Keep it under 8 words. Keep it fun.
- NEVER ask about feelings or emotions. Stay in the world of the concept.

Answer options rules:
- 3 options, each 5-12 words
- Each should be a specific, vivid creative choice that builds on the concept so far
- They should add detail, characters, conflict, or visual flavor to the world being built
- Each option takes the video in a completely different direction
- Make them imaginative, unexpected, cinematic — the kind of ideas that make someone excited
- At least one option should be absurd or hilarious
- Keep the energy fun, epic, playful, or mind-bending. Not personal or emotional.
- NOTHING morbid, dark, violent, depressing, or disturbing.`,
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
    prompt: `You are a creative video prompt writer. Based on the user's choices below, generate 10 diverse video prompts.

Each prompt MUST be a single sentence that answers: WHO is doing WHAT, WHERE, WHEN, and HOW it looks. It should read like a direct instruction to a video generation AI.

Good examples:
- "A golden retriever in a tiny chef hat flips pancakes in a sunlit cabin kitchen at dawn, shot on 35mm film"
- "Two astronauts slow-dance on the surface of Mars while Earth rises behind them, cinematic wide shot"
- "A street musician plays saxophone on a rainy Tokyo rooftop at night, neon signs reflecting in the puddles around him"

Bad examples (too vague, not a prompt):
- "The feeling of discovery" ← no who/what/where
- "An exploration of urban loneliness" ← abstract, not filmable
- "Something magical happens" ← not specific enough

User's choices:
${choicesSummary}

Generate 10 video prompts. Each one must be:
- ONE concrete sentence — a filmable scene, not a concept
- Specific about the subject, action, location, and visual style
- Diverse from each other — different subjects, settings, and vibes
- NOTHING morbid, dark, violent, depressing, or disturbing — keep the energy fun and exciting`,
  });

  return Response.json({ ideas: result.object.ideas });
}
