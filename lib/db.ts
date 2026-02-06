import { neon } from '@neondatabase/serverless';

function getDb() {
  return neon(process.env.DATABASE_URL!);
}

// ── Schema ──────────────────────────────────────────────

export async function initDb() {
  const sql = getDb();

  // Create tables
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

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
      generation_id TEXT NOT NULL,
      blob_url TEXT NOT NULL,
      prompt TEXT NOT NULL,
      duration INTEGER NOT NULL,
      aspect_ratio TEXT NOT NULL,
      size INTEGER NOT NULL,
      scene_index INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS hearts (
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, video_id)
    )
  `;

  // Migrations: add columns that may not exist on older schemas
  try { await sql`ALTER TABLE generations ADD COLUMN IF NOT EXISTS user_id TEXT`; } catch {}
  try { await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS user_id TEXT`; } catch {}
  try { await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'`; } catch {}
  try { await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS title TEXT`; } catch {}
  try { await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS description TEXT`; } catch {}
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`; } catch {}

  // Promote initial admin
  try { await sql`UPDATE users SET is_admin = TRUE WHERE email = 'andrew.landini@vercel.com'`; } catch {}

  console.log('✅ Database tables initialized');
}

// ── Users ───────────────────────────────────────────────

export async function createUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  name: string;
}) {
  const sql = getDb();
  await sql`
    INSERT INTO users (id, email, password_hash, username, name)
    VALUES (${user.id}, ${user.email}, ${user.passwordHash}, ${user.username}, ${user.name})
  `;
}

export async function getUserByEmail(email: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

export async function getUserByUsername(username: string) {
  const sql = getDb();
  const rows = await sql`SELECT id, username, name, avatar_url, bio, created_at FROM users WHERE username = ${username}`;
  return rows[0] || null;
}

export async function getUserById(id: string) {
  const sql = getDb();
  const rows = await sql`SELECT id, username, name, avatar_url, bio, created_at FROM users WHERE id = ${id}`;
  return rows[0] || null;
}

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  const sql = getDb();
  await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${userId}`;
}

// ── Generations ─────────────────────────────────────────

export async function createGeneration(id: string, userInput: string, userId?: string) {
  const sql = getDb();
  await sql`
    INSERT INTO generations (id, user_id, user_input, status)
    VALUES (${id}, ${userId || null}, ${userInput}, 'generating')
  `;
}

export async function updateGenerationIdea(id: string, idea: any) {
  const sql = getDb();
  await sql`UPDATE generations SET idea = ${JSON.stringify(idea)} WHERE id = ${id}`;
}

export async function updateGenerationScenes(id: string, scenes: any) {
  const sql = getDb();
  await sql`UPDATE generations SET scenes = ${JSON.stringify(scenes)} WHERE id = ${id}`;
}

export async function updateGenerationStatus(id: string, status: string) {
  const sql = getDb();
  await sql`UPDATE generations SET status = ${status} WHERE id = ${id}`;
}

// ── Videos ──────────────────────────────────────────────

export async function saveVideoRecord(video: {
  id: string;
  generationId: string;
  userId?: string;
  blobUrl: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  size: number;
  sceneIndex: number;
}) {
  const sql = getDb();
  await sql`
    INSERT INTO videos (id, generation_id, user_id, blob_url, prompt, duration, aspect_ratio, size, scene_index)
    VALUES (${video.id}, ${video.generationId}, ${video.userId || null}, ${video.blobUrl}, ${video.prompt}, ${video.duration}, ${video.aspectRatio}, ${video.size}, ${video.sceneIndex})
  `;
}

export async function getVideoById(videoId: string) {
  const sql = getDb();
  const rows = await sql`SELECT * FROM videos WHERE id = ${videoId}`;
  return rows[0] || null;
}

export async function getGenerationVideos(generationId: string) {
  const sql = getDb();
  return sql`SELECT * FROM videos WHERE generation_id = ${generationId} ORDER BY scene_index ASC`;
}

export async function getGenerationWithVideos(generationId: string) {
  const sql = getDb();
  const generations = await sql`SELECT * FROM generations WHERE id = ${generationId}`;
  const generation = generations[0] || null;
  if (!generation) return null;
  const videos = await sql`
    SELECT v.*, u.username, u.name as user_name, u.avatar_url
    FROM videos v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.generation_id = ${generationId}
    ORDER BY v.scene_index ASC
  `;
  return { generation, videos };
}

export async function updateVideoSceneIndex(videoId: string, userId: string, newIndex: number) {
  const sql = getDb();
  await sql`UPDATE videos SET scene_index = ${newIndex} WHERE id = ${videoId} AND user_id = ${userId}`;
}

export async function removeVideoFromGeneration(videoId: string, userId: string) {
  const sql = getDb();
  await sql`DELETE FROM hearts WHERE video_id = ${videoId}`;
  await sql`DELETE FROM videos WHERE id = ${videoId} AND user_id = ${userId}`;
}

// ── Feed ────────────────────────────────────────────────

export async function getPublicVideos(limit: number = 30, offset: number = 0) {
  const sql = getDb();
  return sql`
    SELECT v.*, u.username, u.name as user_name, u.avatar_url
    FROM videos v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.visibility = 'public'
    ORDER BY v.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getUserVideos(userId: string) {
  const sql = getDb();
  return sql`
    SELECT v.*, u.username, u.name as user_name
    FROM videos v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.user_id = ${userId}
    ORDER BY v.created_at DESC
  `;
}

export async function getUserPublicVideos(userId: string) {
  const sql = getDb();
  return sql`
    SELECT v.*, u.username, u.name as user_name
    FROM videos v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.user_id = ${userId} AND v.visibility = 'public'
    ORDER BY v.created_at DESC
  `;
}

export async function toggleVideoVisibility(videoId: string, userId: string, visibility: 'public' | 'private') {
  const sql = getDb();
  await sql`
    UPDATE videos SET visibility = ${visibility}
    WHERE id = ${videoId} AND user_id = ${userId}
  `;
}

export async function getUserStats(userId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT
      (SELECT COUNT(*) FROM videos WHERE user_id = ${userId}) as video_count,
      (SELECT COUNT(*) FROM videos WHERE user_id = ${userId} AND visibility = 'public') as public_count,
      (SELECT COUNT(*) FROM generations WHERE user_id = ${userId}) as generation_count
  `;
  return rows[0];
}

// ── Hearts ─────────────────────────────────────────────

export async function toggleHeart(userId: string, videoId: string): Promise<boolean> {
  const sql = getDb();
  const existing = await sql`SELECT 1 FROM hearts WHERE user_id = ${userId} AND video_id = ${videoId}`;
  if (existing.length > 0) {
    await sql`DELETE FROM hearts WHERE user_id = ${userId} AND video_id = ${videoId}`;
    return false; // unhearted
  }
  await sql`INSERT INTO hearts (user_id, video_id) VALUES (${userId}, ${videoId})`;
  return true; // hearted
}

export async function getHeartCount(videoId: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`SELECT COUNT(*) as count FROM hearts WHERE video_id = ${videoId}`;
  return parseInt(rows[0].count, 10);
}

export async function hasUserHearted(userId: string, videoId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`SELECT 1 FROM hearts WHERE user_id = ${userId} AND video_id = ${videoId}`;
  return rows.length > 0;
}

// ── Video Detail ───────────────────────────────────────

export async function getVideoDetail(videoId: string) {
  const sql = getDb();
  const rows = await sql`
    SELECT v.*, u.username, u.name as user_name, u.avatar_url,
      (SELECT COUNT(*) FROM hearts WHERE video_id = v.id) as heart_count
    FROM videos v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.id = ${videoId}
  `;
  return rows[0] || null;
}

export async function updateVideoDescription(videoId: string, userId: string, description: string) {
  const sql = getDb();
  await sql`UPDATE videos SET description = ${description} WHERE id = ${videoId} AND user_id = ${userId}`;
}

// ── Feed (sorted by hearts) ────────────────────────────

export async function getPublicVideosSorted(
  limit: number = 30,
  offset: number = 0,
  period: 'day' | 'week' | 'month' | 'year' | 'all' = 'all'
) {
  const sql = getDb();

  const intervals: Record<string, string> = {
    day: '1 day',
    week: '7 days',
    month: '30 days',
    year: '365 days',
  };

  if (period === 'all') {
    return sql`
      SELECT v.*, u.username, u.name as user_name, u.avatar_url,
        (SELECT COUNT(*) FROM hearts WHERE video_id = v.id) as heart_count
      FROM videos v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.visibility = 'public'
      ORDER BY heart_count DESC, RANDOM()
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  const interval = intervals[period];
  return sql`
    SELECT v.*, u.username, u.name as user_name, u.avatar_url,
      (SELECT COUNT(*) FROM hearts WHERE video_id = v.id) as heart_count
    FROM videos v
    LEFT JOIN users u ON v.user_id = u.id
    WHERE v.visibility = 'public' AND v.created_at >= NOW() - CAST(${interval} AS INTERVAL)
    ORDER BY heart_count DESC, RANDOM()
    LIMIT ${limit} OFFSET ${offset}
  `;
}

// ── Admin ──────────────────────────────────────────────

export async function isUserAdmin(userId: string): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`SELECT is_admin FROM users WHERE id = ${userId}`;
  return rows[0]?.is_admin === true;
}

export async function getAllUsers() {
  const sql = getDb();
  return sql`
    SELECT id, username, name, email, avatar_url, is_admin, created_at,
      (SELECT COUNT(*) FROM videos WHERE user_id = users.id) as video_count
    FROM users
    ORDER BY created_at DESC
  `;
}

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  const sql = getDb();
  await sql`UPDATE users SET is_admin = ${isAdmin} WHERE id = ${userId}`;
}

export async function deleteVideo(videoId: string) {
  const sql = getDb();
  await sql`DELETE FROM hearts WHERE video_id = ${videoId}`;
  await sql`DELETE FROM videos WHERE id = ${videoId}`;
}
