'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressTracker } from './progress-tracker';
import { ScenePreview } from './scene-preview';
import { VideoGallery } from './video-gallery';
import type { GenerationState, GenerationOptions, SSEMessage, ProgressEvent } from '@/lib/types';

export function VideoGenerator() {
  const [state, setState] = useState<GenerationState>({
    status: 'idle',
    idea: '',
    generatedIdea: null,
    scenes: null,
    videos: [],
    progress: [],
    error: null,
  });

  const [options, setOptions] = useState<GenerationOptions>({
    aspectRatio: '16:9',
    duration: 8,
    numScenes: 3,
  });

  const handleGenerate = async () => {
    if (!state.idea.trim()) {
      alert('Please enter a video idea');
      return;
    }

    console.log('🚀 Starting video generation...');
    console.log('Idea:', state.idea);
    console.log('Options:', options);

    setState(prev => ({
      ...prev,
      status: 'generating',
      generatedIdea: null,
      scenes: null,
      videos: [],
      progress: [],
      error: null,
    }));

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idea: state.idea,
          options,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6)) as SSEMessage;
            console.log('📡 SSE Event:', data.type, data);

            handleSSEEvent(data);
          }
        }
      }
    } catch (error) {
      console.error('❌ Generation failed:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        progress: [
          ...prev.progress,
          {
            type: 'error',
            timestamp: new Date(),
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      }));
    }
  };

  const handleSSEEvent = (data: SSEMessage) => {
    const progressEvent: ProgressEvent = {
      type: data.type,
      timestamp: new Date(),
      agent: data.agent as any,
      status: data.status,
      result: data.result,
      sceneIndex: data.sceneIndex,
      videoId: data.videoId,
      prompt: data.prompt,
      message: data.message,
    };

    setState(prev => ({
      ...prev,
      progress: [...prev.progress, progressEvent],
    }));

    switch (data.type) {
      case 'agent-complete':
        if (data.agent === 'idea') {
          setState(prev => ({
            ...prev,
            generatedIdea: data.result,
          }));
        } else if (data.agent === 'scenes') {
          setState(prev => ({
            ...prev,
            scenes: data.result.scenes,
          }));
        }
        break;

      case 'video-complete':
        // Video will be added when complete event fires
        break;

      case 'complete':
        setState(prev => ({
          ...prev,
          status: 'complete',
          videos: data.videos || [],
        }));
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          status: 'error',
          error: data.message || 'Unknown error',
        }));
        break;
    }
  };

  const handleReset = () => {
    setState({
      status: 'idle',
      idea: '',
      generatedIdea: null,
      scenes: null,
      videos: [],
      progress: [],
      error: null,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-8 max-w-7xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-4xl font-bold tracking-tight">
            <Sparkles className="h-10 w-10" />
            <h1>gigapapaya</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Idea in, videos out. Multi-agent generation powered by Veo 3.1.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Input & Options */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Video Idea</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Describe your video idea... (e.g., 'A sunrise over mountains')"
                  value={state.idea}
                  onChange={(e) => setState(prev => ({ ...prev, idea: e.target.value }))}
                  disabled={state.status === 'generating'}
                  className="text-base"
                />

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Aspect Ratio</label>
                    <select
                      value={options.aspectRatio}
                      onChange={(e) => setOptions(prev => ({ ...prev, aspectRatio: e.target.value as any }))}
                      disabled={state.status === 'generating'}
                      className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm"
                    >
                      <option value="16:9">16:9</option>
                      <option value="9:16">9:16</option>
                      <option value="4:3">4:3</option>
                      <option value="1:1">1:1</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duration (s)</label>
                    <Input
                      type="number"
                      min="4"
                      max="8"
                      value={options.duration}
                      onChange={(e) => setOptions(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                      disabled={state.status === 'generating'}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Scenes</label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={options.numScenes}
                      onChange={(e) => setOptions(prev => ({ ...prev, numScenes: parseInt(e.target.value) }))}
                      disabled={state.status === 'generating'}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={state.status === 'generating' || !state.idea.trim()}
                    className="flex-1"
                  >
                    {state.status === 'generating' ? 'Generating...' : 'Generate Videos'}
                  </Button>
                  {state.status !== 'idle' && (
                    <Button onClick={handleReset} variant="outline">
                      Reset
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Generated Idea */}
            {state.generatedIdea && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Video Concept</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{state.generatedIdea.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{state.generatedIdea.description}</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-gray-100 px-2 py-1 rounded">{state.generatedIdea.style}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">{state.generatedIdea.mood}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Progress */}
          <div className="space-y-6">
            {state.progress.length > 0 && (
              <ProgressTracker events={state.progress} />
            )}
          </div>
        </div>

        {/* Scene Preview */}
        {state.scenes && state.scenes.length > 0 && (
          <ScenePreview
            scenes={state.scenes}
            style={state.generatedIdea?.style}
            mood={state.generatedIdea?.mood}
          />
        )}

        {/* Video Gallery */}
        {state.videos.length > 0 && (
          <VideoGallery videos={state.videos} />
        )}

        {/* Error State */}
        {state.error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <p className="text-red-900 font-medium">Error: {state.error}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
