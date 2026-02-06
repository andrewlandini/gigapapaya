// Core types for the video generation app

export interface VideoIdea {
  title: string;
  description: string;
  style: string;
  mood: string;
  keyElements: string[];
}

export interface Scene {
  index: number;
  prompt: string;
  duration: number;
  notes: string;
}

export interface ScenesResult {
  scenes: Scene[];
  consistencyNotes: string;
}

export interface Video {
  id: string;
  filename: string;
  path: string;
  url: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  createdAt: Date;
  size: number;
}

export type ProgressEventType =
  | 'agent-start'
  | 'agent-complete'
  | 'agent-log'
  | 'video-start'
  | 'video-complete'
  | 'complete'
  | 'error';

export interface ProgressEvent {
  type: ProgressEventType;
  timestamp: Date;
  agent?: 'idea' | 'scenes' | 'videos';
  status?: string;
  result?: any;
  sceneIndex?: number;
  videoId?: string;
  prompt?: string;
  message?: string;
}

export interface GenerationState {
  status: 'idle' | 'generating' | 'complete' | 'error';
  idea: string;
  generatedIdea: VideoIdea | null;
  scenes: Scene[] | null;
  videos: Video[];
  progress: ProgressEvent[];
  error: string | null;
}

export interface GenerationOptions {
  aspectRatio: '16:9' | '9:16' | '4:3' | '1:1';
  duration: number;
  numScenes?: number;
  mode: 'agents' | 'direct';
}

export interface SSEMessage {
  type: ProgressEventType;
  agent?: string;
  status?: string;
  result?: any;
  sceneIndex?: number;
  videoId?: string;
  prompt?: string;
  message?: string;
  sessionId?: string;
  videos?: Video[];
}
