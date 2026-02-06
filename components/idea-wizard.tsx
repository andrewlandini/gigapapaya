'use client';

import { useState, useMemo } from 'react';
import { Lightbulb, Loader2, RotateCcw } from 'lucide-react';

interface IdeaWizardProps {
  onSelectIdea: (idea: string) => void;
  onActiveChange?: (active: boolean) => void;
}

const TOTAL_STEPS = 3;

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
  const [optionsKey, setOptionsKey] = useState(0); // forces re-render for animations
  const [reaction, setReaction] = useState<string | null>(null);
  const pickHeadline = useMemo(() => PICK_HEADLINES[Math.floor(Math.random() * PICK_HEADLINES.length)], []);

  const fetchFirstStep = async () => {
    setLoadingStep(true);
    setCurrentOptions([]);
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'first-step' }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentQuestion(data.question);
        setCurrentOptions(data.options?.slice(0, 3) || []);
        setOptionsKey(prev => prev + 1);
      }
    } catch {}
    setLoadingStep(false);
  };

  const fetchNextStep = async (newQuestions: string[], newAnswers: string[]) => {
    setLoadingStep(true);
    setCurrentOptions([]);
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next-step', questions: newQuestions, answers: newAnswers }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentQuestion(data.question);
        setCurrentOptions(data.options?.slice(0, 3) || []);
        setOptionsKey(prev => prev + 1);
      }
    } catch {}
    setLoadingStep(false);
  };

  const handleActivate = () => {
    setActive(true);
    onActiveChange?.(true);
    fetchFirstStep();
  };

  const handleAnswer = async (answer: string, reactionText: string) => {
    const newQuestions = [...questions, currentQuestion!];
    const newAnswers = [...answers, answer];
    setQuestions(newQuestions);
    setAnswers(newAnswers);
    setReaction(reactionText);

    if (newAnswers.length < TOTAL_STEPS) {
      setStep(step + 1);
      await fetchNextStep(newQuestions, newAnswers);
    } else {
      // All questions answered — generate ideas
      setLoading(true);
      try {
        const res = await fetch('/api/generate-ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: newAnswers, steps: newQuestions }),
        });
        if (res.ok) {
          const data = await res.json();
          setIdeas(data.ideas || []);
        }
      } catch {}
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
        className="flex items-center gap-2 text-[#666] hover:text-[#ededed] transition-colors mx-auto"
      >
        <Lightbulb className="h-4 w-4" />
        <span className="text-[15px]">Help me think of an idea</span>
      </button>
    );
  }

  // Progress bar
  const progressBar = (
    <div className="w-full max-w-md mx-auto h-1 rounded-full bg-[#222] overflow-hidden">
      <div
        className="h-full rounded-full bg-white/40 transition-all duration-500"
        style={{ width: `${((step + (loading || ideas.length > 0 ? 1 : 0)) / TOTAL_STEPS) * 100}%` }}
      />
    </div>
  );

  // Show generated ideas
  if (ideas.length > 0) {
    return (
      <div className="w-full pb-24">
        <h2 className="text-[32px] font-bold tracking-tight leading-tight animate-fade-in text-center max-w-2xl mx-auto">
          {pickHeadline}
        </h2>

        <div className="flex flex-col gap-3 max-w-lg mx-auto w-full mt-8">
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
        {progressBar}
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
        {progressBar}
        <button onClick={handleClose} className="text-xs text-[#555] hover:text-[#888] transition-colors mx-auto block">
          Cancel
        </button>
      </div>
    </div>
  );

  // Loading next question
  if (loadingStep || !currentQuestion) {
    return (
      <div className="w-full pb-24">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          {reaction && (
            <p className="text-sm text-[#888] animate-fade-in">{reaction}</p>
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

      {/* Options with staggered fade-in */}
      <div className="flex flex-col gap-3 max-w-xl mx-auto w-full mt-8" key={optionsKey}>
        {currentOptions.map((option, i) => (
          <button
            key={option.text}
            onClick={() => handleAnswer(option.text, option.reaction)}
            className="w-full h-11 px-5 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] hover:bg-[#111] transition-all text-sm text-[#ededed] text-left opacity-0 animate-fade-in"
            style={{ animationDelay: `${i * 200}ms`, animationFillMode: 'forwards' }}
          >
            {option.text}
          </button>
        ))}
      </div>

      {bottomBar}
    </div>
  );
}
