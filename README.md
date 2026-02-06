# gigapapaya

Multi-agent video generation. Idea in, videos out.

Three AI agents work together to turn a text prompt into multiple video variations using Google Veo 3.1 via AI Gateway. Watch the whole process in real-time.

## How it works

1. **Idea Agent** — Takes your input, generates a structured video concept with style, mood, and key elements
2. **Scene Agent** — Breaks the concept into 3-5 similar scenes optimized for video generation
3. **Video Agent** — Generates each scene as a video using Veo 3.1

Everything streams back via SSE so you can watch each agent work.

## Stack

- Next.js 15 / App Router
- Vercel AI SDK (`gateway.videoModel`)
- Google Veo 3.1 (`veo-3.1-generate-001`)
- Tailwind CSS
- TypeScript

## Setup

```bash
npm install
```

Add your API key to `.env.local`:

```bash
AI_GATEWAY_API_KEY=your_key_here
```

Run it:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available models

```
google/veo-3.1-generate-001      # stable
google/veo-3.1-generate-preview   # latest
google/veo-3.1-fast-generate-001  # faster
```

Change in `lib/ai/provider.ts`.

## Project structure

```
├── app/
│   ├── api/
│   │   ├── generate/route.ts       # SSE orchestrator
│   │   ├── videos/[videoId]/       # serve videos
│   │   └── download/[videoId]/     # download videos
│   └── page.tsx
├── components/
│   ├── video-generator.tsx          # main UI + SSE client
│   ├── progress-tracker.tsx         # real-time progress
│   ├── scene-preview.tsx            # scene cards
│   └── video-gallery.tsx            # video grid + downloads
├── lib/
│   ├── ai/
│   │   ├── provider.ts              # AI Gateway config
│   │   ├── agents.ts                # agent logic
│   │   └── video-storage.ts         # file operations
│   ├── types.ts
│   └── prompts.ts
└── .env.local
```

## Deploy

Push to GitHub, import to Vercel, add `AI_GATEWAY_API_KEY` env var. Done.

Videos stored in `/tmp` — ephemeral on Vercel. Use S3/R2 for persistence.

## License

MIT
