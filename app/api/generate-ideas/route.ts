import { NextRequest } from 'next/server';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getTextModel } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Random seeds to force variety — grounded real-world situations, not surreal/fantasy
const QUESTION_FRAMINGS = [
  "Ask about a real CITY or NEIGHBORHOOD", "Ask about a specific JOB or WORKPLACE",
  "Ask about a FAMILY moment", "Ask about a FRIENDSHIP dynamic",
  "Ask about a FIRST DATE scenario", "Ask about a ROAD TRIP situation",
  "Ask about a COOKING or KITCHEN moment", "Ask about a SPORTS moment",
  "Ask about a LATE NIGHT scenario", "Ask about an EARLY MORNING routine",
  "Ask about a MOVING DAY situation", "Ask about a JOB INTERVIEW moment",
  "Ask about a WEDDING or CELEBRATION", "Ask about a BREAKUP or GOODBYE",
  "Ask about a REUNION after years apart", "Ask about a PRANK or SURPRISE",
  "Ask about a ROAD RAGE or TRAFFIC moment", "Ask about a BARBERSHOP or SALON visit",
  "Ask about a GYM or FITNESS situation", "Ask about a GROCERY STORE moment",
  "Ask about a CONCERT or LIVE MUSIC experience", "Ask about a CAMPING or OUTDOOR trip",
  "Ask about a CLASSROOM or SCHOOL moment", "Ask about a HOSPITAL or DOCTOR visit",
  "Ask about a HOUSE PARTY situation", "Ask about a NEIGHBORHOOD drama",
  "Ask about a PET OWNER moment", "Ask about a COMMUTE or PUBLIC TRANSIT ride",
  "Ask about a BAR or RESTAURANT scene", "Ask about a BEACH DAY",
  "Ask about a LAUNDROMAT moment", "Ask about a PARKING LOT situation",
  "Ask about a GAS STATION stop", "Ask about a HOTEL or MOTEL stay",
  "Ask about a PHONE CALL that changes everything", "Ask about a TEXT MESSAGE situation",
  "Ask about a NEIGHBOR interaction", "Ask about a PARENT-CHILD conversation",
  "Ask about a COWORKER dynamic", "Ask about a STRANGER encounter",
  "Ask about a DELIVERY DRIVER moment", "Ask about a WAITING ROOM situation",
  "Ask about a ELEVATOR ride", "Ask about a DINER at 2am",
  "Ask about a GARAGE or WORKSHOP project", "Ask about a THRIFT STORE find",
  "Ask about a FARMER'S MARKET morning", "Ask about a COFFEE SHOP regular",
  "Ask about a DOG WALK encounter", "Ask about a AIRPORT or TRAVEL moment",
];

const OPTION_VIBES = [
  "Make one option feel like a comedy", "Make one option feel like a drama",
  "Make one option feel like a thriller", "Make one option feel heartwarming",
  "Make one option feel awkward/cringe", "Make one option feel triumphant",
  "Make one option feel chaotic", "Make one option feel peaceful",
  "Make one option feel tense", "Make one option feel nostalgic",
  "Make one option feel like a confession", "Make one option feel competitive",
  "Make one option feel rebellious", "Make one option feel bittersweet",
  "Make one option feel like an argument", "Make one option feel like a celebration",
  "Make one option feel exhausting", "Make one option feel like relief",
  "Make one option feel embarrassing", "Make one option feel inspiring",
];

function getRandomSeed(): string {
  const framing = QUESTION_FRAMINGS[Math.floor(Math.random() * QUESTION_FRAMINGS.length)];
  const vibe = OPTION_VIBES[Math.floor(Math.random() * OPTION_VIBES.length)];
  const num = Math.floor(Math.random() * 8_999_999_999) + 2;
  return `Seed: ${num}. ${framing}. ${vibe}.`;
}

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
    const seed1 = getRandomSeed();
    const seed2 = getRandomSeed();
    const result = await generateObject({
      model: getTextModel('anthropic/claude-sonnet-4.5'),
      temperature: 1,
      schema: nextStepSchema,
      prompt: `Creative direction seed: ${seed1}

You are a creative video concept brainstormer. You help people come up with cinematic, visually compelling video ideas grounded in REAL situations — real people, real places, real moments.

Ask ONE opening question that kicks off the creative direction. Rules:
- Ask about a REAL situation, setting, or scenario — not fantasy or sci-fi
- Think like: "Where are we?", "Who's in the scene?", "What just happened?", "What kind of day is it?"
- Keep it under 8 words. Make it feel natural and inviting.

Generate 3 answer options. Rules:
- Each option should be a specific, grounded, REAL scenario (5-12 words)
- Think real life but cinematic — a tense family dinner, two strangers stuck in an elevator, a chef who just burned the main course, a couple arguing in a parked car, a kid performing for an empty auditorium
- Each option should feel like a different GENRE of movie — one comedy, one drama, one thriller/tense
- They should make someone go "oh I can picture that exactly"
- Keep it grounded — real people in real places doing real things, but make the moment INTERESTING
- NOTHING morbid, dark, violent, depressing, or disturbing.

For each option, also write a short reaction (2-5 words) that would show if the user picks it — like a creative friend reacting. Examples: "Oh that's sick", "Now we're talking", "Yes love that", "OK I see you", "Good taste". Be natural and varied. No exclamation marks.

Also consider this angle: ${seed2}`,
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

This is question ${stepNumber} of 2. Build on what they chose — zoom into their world and add more detail, a twist, or a new dimension to the concept.

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
