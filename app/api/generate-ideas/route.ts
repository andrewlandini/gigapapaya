import { NextRequest } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getTextModel } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ideaSchema = z.object({
  idea: z.string().describe('A single filmable video prompt, 1-2 sentences'),
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
      temperature: 1,
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
      temperature: 1,
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

  // Generate a single prompt from completed Q&A
  const { answers, steps } = body;

  const choicesSummary = steps
    .map((q: string, i: number) => `Q: ${q}\nA: ${answers[i]}`)
    .join('\n\n');

  const result = await generateObject({
    model: getTextModel('anthropic/claude-sonnet-4.5'),
    temperature: 0,
    schema: ideaSchema,
    prompt: `You are a video prompt writer. The user built a story through creative choices. Write ONE video prompt that is a DIRECT, FAITHFUL translation of their story into a filmable scene.

User's story:
${choicesSummary}

Your job: Combine ALL of the user's answers into a SINGLE filmable scene. Every detail from their answers must appear in the prompt. Do not add characters, worlds, or concepts they didn't choose. Do not interpret loosely — use their EXACT choices.

The prompt must be 1-2 sentences answering: WHO is doing WHAT, WHERE, WHEN, and HOW it looks. It should read like a direct instruction to a video generation AI.

RULES:
- Use the SPECIFIC world, characters, scenario, and details from EVERY answer
- The prompt must feel like a direct translation of their choices — if they chose "robots in a neon junkyard" and "learning to dance" and "a rival crew shows up", ALL of that must be in the prompt
- Do NOT generalize, abstract, or drift — stay literal to their choices
- ONE concrete sentence — a filmable scene with who/what/where/when/how
- NOTHING morbid, dark, violent, depressing, or disturbing`,
  });

  return Response.json({ idea: result.object.idea });
}
