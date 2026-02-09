'use client';

import { useState, useEffect, useRef } from 'react';
import { Lightbulb, Loader2, RotateCcw } from 'lucide-react';
import { useDebug } from './debug-context';

interface IdeaWizardProps {
  onSelectIdea: (idea: string) => void;
  onActiveChange?: (active: boolean) => void;
}

const TOTAL_STEPS = 2;

const SPARK_PHRASES = [
  "Let me think...",
  "Cooking something up.",
  "One sec, brainstorming.",
  "Digging into the vault.",
  "Pulling threads.",
  "Interesting. Very interesting.",
  "Oh, I've got ideas.",
  "Let's see what sticks.",
  "Thinking out loud here.",
  "Give me a second.",
  "This could be good.",
  "Running the mental film reel.",
  "Something's forming.",
  "Hold on, this is gonna be fun.",
  "Okay okay okay.",
  "Working on it.",
  "This is my favorite part.",
  "Bear with me.",
  "I see possibilities.",
  "Let the creative juices flow.",
  "Hmm, what if...",
  "The gears are turning.",
  "Almost there.",
  "I have a few directions.",
  "Let me narrow it down.",
  "Good vibes incoming.",
  "Gathering inspiration.",
  "Spinning up the idea machine.",
  "Let's find your angle.",
  "Where do we start...",
  "Oh this is going to be fun.",
  "Scanning the creative landscape.",
  "Warming up.",
  "Just a moment.",
  "Let me cook.",
  "Rummaging through concepts.",
  "Finding the spark.",
  "One moment of genius, please.",
  "Getting into the zone.",
  "This is the fun part.",
  "Shuffling the deck.",
  "Making connections.",
  "Mapping out the terrain.",
  "Building a vibe.",
  "Let me set the stage.",
  "Running through options.",
  "Okay, I'm into this.",
  "Feeling inspired already.",
  "Tuning into the frequency.",
  "The muse is on her way.",
];

const PICK_HEADLINES = [
  "Any of these good?",
  "How'd we do?",
  "Pick your favorite.",
  "Something click?",
  "See anything you like?",
  "Which one's the one?",
  "Anything jumping out?",
  "We nailed it, right?",
  "One of these, yeah?",
  "What are we going with?",
  "Take your pick.",
  "Anything spark joy?",
  "Which one speaks to you?",
  "These any good?",
  "Found your winner?",
  "Let's narrow it down.",
  "What catches your eye?",
  "Any of these hit?",
  "Pick your poison.",
  "Which one's calling you?",
  "See the one?",
  "Spot something good?",
  "What do we think?",
  "Ready to pick?",
  "These feel right?",
  "Any winners here?",
  "What's it gonna be?",
  "One of these work?",
  "Which one are we running with?",
  "Anything here worth making?",
];

export function IdeaWizard({ onSelectIdea, onActiveChange }: IdeaWizardProps) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentOptions, setCurrentOptions] = useState<{ text: string; reaction: string }[]>([]);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(false);
  const { pushLog } = useDebug();
  const pushLogRef = useRef(pushLog);
  pushLogRef.current = pushLog;
  const log = (raw: Record<string, unknown>) => {
    pushLogRef.current({ timestamp: Date.now(), source: 'idea-wizard', raw });
  };
  const [optionsKey, setOptionsKey] = useState(0); // forces re-render for animations
  const [reaction, setReaction] = useState<string | null>(null);
  const [pickHeadline, setPickHeadline] = useState(PICK_HEADLINES[0]);
  const [sparkPhrase, setSparkPhrase] = useState('');

  useEffect(() => {
    setPickHeadline(PICK_HEADLINES[Math.floor(Math.random() * PICK_HEADLINES.length)]);
  }, []);

  const fetchFirstStep = async () => {
    setLoadingStep(true);
    setCurrentOptions([]);
    log({ type: 'wizard-start', action: 'first-step', model: 'claude-sonnet-4.5' });
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'first-step' }),
      });
      log({ type: 'wizard-response', action: 'first-step', status: res.status });
      if (res.ok) {
        const data = await res.json();
        log({ type: 'wizard-question', question: data.question, optionCount: data.options?.length });
        setCurrentQuestion(data.question);
        setCurrentOptions(data.options?.slice(0, 6) || []);
        setOptionsKey(prev => prev + 1);
      }
    } catch (e: any) {
      log({ type: 'wizard-error', action: 'first-step', error: e?.message });
    }
    setLoadingStep(false);
  };

  const fetchNextStep = async (newQuestions: string[], newAnswers: string[]) => {
    setLoadingStep(true);
    setCurrentOptions([]);
    log({ type: 'wizard-next', action: 'next-step', step: newQuestions.length + 1, model: 'claude-sonnet-4.5' });
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next-step', questions: newQuestions, answers: newAnswers }),
      });
      log({ type: 'wizard-response', action: 'next-step', status: res.status });
      if (res.ok) {
        const data = await res.json();
        log({ type: 'wizard-question', question: data.question, optionCount: data.options?.length });
        setCurrentQuestion(data.question);
        setCurrentOptions(data.options?.slice(0, 6) || []);
        setOptionsKey(prev => prev + 1);
      }
    } catch (e: any) {
      log({ type: 'wizard-error', action: 'next-step', error: e?.message });
    }
    setLoadingStep(false);
  };

  const handleActivate = () => {
    setActive(true);
    onActiveChange?.(true);
    setSparkPhrase(SPARK_PHRASES[Math.floor(Math.random() * SPARK_PHRASES.length)]);
    fetchFirstStep();
  };

  const handleAnswer = async (answer: string, reactionText: string) => {
    log({ type: 'wizard-answer', step: questions.length + 1, answer, reaction: reactionText });
    const newQuestions = [...questions, currentQuestion!];
    const newAnswers = [...answers, answer];
    setQuestions(newQuestions);
    setAnswers(newAnswers);
    setReaction(reactionText);

    if (newAnswers.length < TOTAL_STEPS) {
      setStep(step + 1);
      await fetchNextStep(newQuestions, newAnswers);
    } else {
      // All questions answered — generate a single prompt and auto-fill
      setLoading(true);
      log({ type: 'wizard-finalize', model: 'claude-sonnet-4.5', answers: newAnswers, questions: newQuestions });
      try {
        const res = await fetch('/api/generate-ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: newAnswers, steps: newQuestions }),
        });
        log({ type: 'wizard-response', action: 'finalize', status: res.status });
        if (res.ok) {
          const data = await res.json();
          const prompt = data.idea || (data.ideas && data.ideas[0]);
          if (prompt) {
            log({ type: 'wizard-complete', generatedPrompt: prompt });
            onSelectIdea(prompt);
            handleClose();
          }
        }
      } catch (e: any) {
        log({ type: 'wizard-error', action: 'finalize', error: e?.message });
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setQuestions([]);
    setAnswers([]);
    setCurrentQuestion(null);
    setCurrentOptions([]);
    setIdeas([]);
    setVisibleCount(3);
    setLoading(false);
    setLoadingStep(false);
    setOptionsKey(0);
    setReaction(null);
    // Re-fetch the first question to start over
    fetchFirstStep();
  };

  const handleClose = () => {
    setActive(false);
    onActiveChange?.(false);
    handleReset();
  };

  if (!active) {
    return (
      <button
        onClick={handleActivate}
        className="flex items-center gap-2.5 mx-auto group"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
          new
        </span>
        <span className="text-[15px] font-medium text-white group-hover:text-white/80 transition-colors">
          Spark an idea for me
        </span>
      </button>
    );
  }

  // Show generated ideas
  if (ideas.length > 0) {
    return (
      <div className="w-full pb-24">
        <h2 className="text-[32px] font-bold tracking-tight leading-tight animate-fade-in text-center max-w-2xl mx-auto">
          {pickHeadline}
        </h2>

        <div className="flex flex-col gap-4 max-w-lg mx-auto w-full mt-8">
          {ideas.slice(0, visibleCount).map((idea, i) => (
            <div
              key={i}
              className="rounded-xl p-[1px] bg-gradient-to-r from-purple-500/40 via-violet-500/40 to-fuchsia-500/40 hover:from-purple-500/70 hover:via-violet-500/70 hover:to-fuchsia-500/70 transition-all opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 150}ms`, animationFillMode: 'forwards' }}
            >
              <button
                onClick={() => { onSelectIdea(idea); handleClose(); }}
                className="w-full text-left px-5 py-3.5 rounded-[11px] bg-[#0a0a0a] hover:bg-[#111] transition-colors text-sm text-[#ccc] leading-relaxed"
              >
                {idea}
              </button>
            </div>
          ))}
        </div>
        {visibleCount < ideas.length && (
          <button
            onClick={() => setVisibleCount(prev => prev + 3)}
            className="text-xs text-[#555] hover:text-[#888] transition-colors mx-auto block mt-4"
          >
            Show more
          </button>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-30 pb-8 pt-4 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
          <button
            onClick={handleClose}
            className="pointer-events-auto text-xs text-[#555] hover:text-[#888] transition-colors mx-auto block"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Loading ideas
  if (loading) {
    return (
      <div className="space-y-6 max-w-md mx-auto w-full">

        <div className="flex items-center justify-center gap-3 py-2">
          <Loader2 className="h-6 w-6 text-[#777] animate-spin" />
          <span className="text-sm text-[#666]">Generating ideas from your choices...</span>
        </div>
      </div>
    );
  }

  // Bottom bar (progress + cancel) — fixed to bottom of page
  const bottomBar = (
    <div className="fixed bottom-0 left-0 right-0 z-30 pb-8 pt-4 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
      <div className="pointer-events-auto max-w-md mx-auto w-full px-6 space-y-4">

        <button onClick={handleClose} className="text-xs text-[#555] hover:text-[#888] transition-colors mx-auto block">
          Cancel
        </button>
      </div>
    </div>
  );

  // Loading next question
  if (loadingStep || !currentQuestion) {
    const loadingText = reaction || sparkPhrase;
    return (
      <div className="w-full pb-24">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          {loadingText && (
            <p className="text-sm text-[#888] animate-fade-in">{loadingText}</p>
          )}
          <Loader2 className="h-6 w-6 text-[#777] animate-spin" />
        </div>
        {bottomBar}
      </div>
    );
  }

  // Question step — question replaces the page title
  return (
    <div className="w-full pb-24">
      {/* Question as title — wider, adapts to screen */}
      <h2 className="text-[32px] font-bold tracking-tight leading-tight animate-fade-in text-center max-w-2xl mx-auto">
        {currentQuestion}
      </h2>

      {/* Options — storyboard-style grid */}
      <div className={`grid gap-3 max-w-2xl mx-auto w-full mt-8 ${currentOptions.length <= 3 ? 'grid-cols-1 sm:grid-cols-3' : currentOptions.length === 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`} key={optionsKey}>
        {currentOptions.map((option, i) => (
          <button
            key={option.text}
            onClick={() => handleAnswer(option.text, option.reaction)}
            className="group relative w-full aspect-[3/2] rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] hover:bg-[#111] transition-all text-sm text-[#ededed] opacity-0 animate-fade-in flex items-center justify-center px-4 text-center"
            style={{ animationDelay: `${i * 120}ms`, animationFillMode: 'forwards' }}
          >
            <span className="leading-snug">{option.text}</span>
            <div className="absolute inset-0 rounded-xl border border-transparent group-hover:border-purple-500/30 transition-colors pointer-events-none" />
          </button>
        ))}
      </div>

      {bottomBar}
    </div>
  );
}
