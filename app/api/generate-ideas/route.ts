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
  options: z.array(z.object({
    text: z.string().describe('The answer option text'),
    reaction: z.string().describe('A short 2-5 word enthusiastic reaction if the user picks this option, like "Oh that\'s sick" or "Now we\'re talking"'),
  })).min(3).max(3).describe('3 unique, creative answer options with pre-generated reactions'),
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
- NOTHING morbid, dark, violent, depressing, or disturbing.

For each option, also write a short reaction (2-5 words) that would show if the user picks it — like a creative friend reacting. Examples: "Oh that's sick", "Now we're talking", "Yes love that", "OK I see you", "Wild choice let's go". Be natural and varied. No exclamation marks.`,
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
- NOTHING morbid, dark, violent, depressing, or disturbing.

For each option, also write a short reaction (2-5 words) that would show if the user picks it — like a creative friend reacting. Examples: "Oh that's sick", "Now we're talking", "Yes love that", "OK I see you", "Wild choice let's go". Be natural and varied. No exclamation marks.`,
    });
    return Response.json(result.object);
  }

  // Generate ideas from completed Q&A (default / backwards-compatible)
  const { answers, steps } = body;

  const choicesSummary = steps
    .map((q: string, i: number) => `Q: ${q}\nA: ${answers[i]}`)
    .join('\n\n');

  const result = await generateObject({
    model: getTextModel('anthropic/claude-sonnet-4.5'),
    schema: ideasSchema,
    prompt: `You are a creative video prompt writer. The user just built a story through a series of creative choices. Your job is to turn THEIR story into 10 filmable video prompts.

IMPORTANT: The user's answers below form a COHERENT NARRATIVE — a world, characters, and a storyline. Every prompt you generate must be rooted in THIS story. Do not drift into unrelated territory.

User's story choices:
${choicesSummary}

Read those answers carefully. Together they describe a specific world, specific characters, and a specific scenario. ALL 10 prompts must live inside that story.

Each prompt MUST be a single sentence that answers: WHO is doing WHAT, WHERE, WHEN, and HOW it looks. It should read like a direct instruction to a video generation AI.

Good examples:
- "A golden retriever in a tiny chef hat flips pancakes in a sunlit cabin kitchen at dawn, shot on 35mm film"
- "Two astronauts slow-dance on the surface of Mars while Earth rises behind them, cinematic wide shot"

Bad examples (too vague, not a prompt):
- "The feeling of discovery" ← no who/what/where
- "Something magical happens" ← not specific enough

Generate 10 video prompts. CRITICAL RULES:
- ALL 10 prompts must feature the same world, characters, and story the user described
- The FIRST 3 should be direct translations of the user's exact answers into filmable scenes — use their specific characters, setting, and scenario
- The next 4 should explore different MOMENTS or ANGLES within the same story — different scenes, camera angles, or beats from the same narrative
- The last 3 can be the most creative — unexpected moments, dramatic reveals, or cinematic set pieces — but still starring the same characters in the same world
- NEVER introduce unrelated characters, worlds, or concepts that the user didn't describe
- Each one must be ONE concrete sentence — a filmable scene with who/what/where/when/how
- NOTHING morbid, dark, violent, depressing, or disturbing — keep the energy fun and exciting`,
  });

  return Response.json({ ideas: result.object.ideas });
}
