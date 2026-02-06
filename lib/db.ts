import { neon } from '@neondatabase/serverless';

function getDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return sql;
}

/**
 * Initialize database tables
 */
export async function initDb() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      user_input TEXT NOT NULL,
      idea JSONB,
      scenes JSONB,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      generation_id TEXT NOT NULL REFERENCES generations(id),
      blob_url TEXT NOT NULL,
      prompt TEXT NOT NULL,
      duration INTEGER NOT NULL,
      aspect_ratio TEXT NOT NULL,
      size INTEGER NOT NULL,
      scene_index INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  console.log('✅ Database tables initialized');
}

/**
 * Create a new generation record
 */
export async function createGeneration(id: string, userInput: string) {
  const sql = getDb();
  await sql`
    INSERT INTO generations (id, user_input, status)
    VALUES (${id}, ${userInput}, 'generating')
  `;
  console.log(`📝 DB: Created generation ${id}`);
}

/**
 * Update generation with idea result
 */
export async function updateGenerationIdea(id: string, idea: any) {
  const sql = getDb();
  await sql`
    UPDATE generations
    SET idea = ${JSON.stringify(idea)}
    WHERE id = ${id}
  `;
  console.log(`📝 DB: Updated generation ${id} with idea`);
}

/**
 * Update generation with scenes result
 */
export async function updateGenerationScenes(id: string, scenes: any) {
  const sql = getDb();
  await sql`
    UPDATE generations
    SET scenes = ${JSON.stringify(scenes)}
    WHERE id = ${id}
  `;
  console.log(`📝 DB: Updated generation ${id} with scenes`);
}

/**
 * Update generation status
 */
export async function updateGenerationStatus(id: string, status: string) {
  const sql = getDb();
  await sql`
    UPDATE generations
    SET status = ${status}
    WHERE id = ${id}
  `;
  console.log(`📝 DB: Updated generation ${id} status to ${status}`);
}

/**
 * Save a video record
 */
export async function saveVideoRecord(video: {
  id: string;
  generationId: string;
  blobUrl: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  size: number;
  sceneIndex: number;
}) {
  const sql = getDb();
  await sql`
    INSERT INTO videos (id, generation_id, blob_url, prompt, duration, aspect_ratio, size, scene_index)
    VALUES (${video.id}, ${video.generationId}, ${video.blobUrl}, ${video.prompt}, ${video.duration}, ${video.aspectRatio}, ${video.size}, ${video.sceneIndex})
  `;
  console.log(`📝 DB: Saved video ${video.id}`);
}

/**
 * Get all videos for a generation
 */
export async function getGenerationVideos(generationId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM videos
    WHERE generation_id = ${generationId}
    ORDER BY scene_index ASC
  `;
  return rows;
}

/**
 * Get a video by ID
 */
export async function getVideoById(videoId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT * FROM videos WHERE id = ${videoId}
  `;
  return rows[0] || null;
}

/**
 * Get recent generations
 */
export async function getRecentGenerations(limit: number = 20) {
  const sql = getDb();
  const rows = await sql`
    SELECT g.*,
      (SELECT COUNT(*) FROM videos v WHERE v.generation_id = g.id) as video_count
    FROM generations g
    ORDER BY g.created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}
