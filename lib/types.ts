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
  | 'scenes-ready'
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
  status: 'idle' | 'generating' | 'reviewing' | 'generating-videos' | 'complete' | 'error';
  idea: string;
  generatedIdea: VideoIdea | null;
  scenes: Scene[] | null;
  editableScenes: Scene[] | null;
  videos: Video[];
  progress: ProgressEvent[];
  error: string | null;
  failedShots: Set<number>;
}

export interface AgentConfig {
  model: string;
  prompt: string;
}

export interface GenerationOptions {
  aspectRatio: '16:9' | '9:16' | '4:3' | '1:1';
  duration: number | 'auto';
  totalLength?: number; // target total length in seconds when duration is 'auto'
  numScenes?: number;
  noMusic?: boolean;
  mode: 'agents' | 'direct';
  ideaAgent?: AgentConfig;
  sceneAgent?: AgentConfig;
}

export const TEXT_MODELS = [
  { id: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6' },
  { id: 'openai/gpt-5', label: 'GPT-5' },
  { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'xai/grok-3', label: 'Grok 3' },
  { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' },
  { id: 'mistral/mistral-large-3', label: 'Mistral Large 3' },
  { id: 'google/gemini-3-flash', label: 'Gemini 3 Flash' },
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
] as const;

export interface SSEMessage {
  type: ProgressEventType;
  agent?: string;
  status?: string;
  result?: any;
  sceneIndex?: number;
  videoId?: string;
  video?: Video;
  prompt?: string;
  message?: string;
  sessionId?: string;
  videos?: Video[];
}
