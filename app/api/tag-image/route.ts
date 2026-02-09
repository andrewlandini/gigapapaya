import { NextRequest } from 'next/server';
import { generateText } from 'ai';
import { getTextModel } from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { imageDataUrl } = await request.json() as { imageDataUrl: string };

    if (!imageDataUrl) {
      return Response.json({ error: 'imageDataUrl is required' }, { status: 400 });
    }

    const result = await generateText({
      model: getTextModel('google/gemini-2.5-flash'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: imageDataUrl },
            { type: 'text', text: 'Return a 1-3 word lowercase descriptive tag for this image. No punctuation. Max 30 chars. Examples: "sunset beach", "golden retriever", "city skyline". Output only the tag, nothing else.' },
          ],
        },
      ],
    });

    const tag = (result.text || 'image').trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').slice(0, 30).trim() || 'image';

    return Response.json({ tag });
  } catch (error) {
    console.error('Tag image error:', error);
    return Response.json({ tag: 'image' });
  }
}
