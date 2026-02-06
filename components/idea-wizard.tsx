'use client';

import { useState } from 'react';
import { Lightbulb, Loader2, RotateCcw, ArrowLeft } from 'lucide-react';

interface IdeaWizardProps {
  onSelectIdea: (idea: string) => void;
  onActiveChange?: (active: boolean) => void;
}

const TOTAL_STEPS = 4;

export function IdeaWizard({ onSelectIdea, onActiveChange }: IdeaWizardProps) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(false);

  const fetchFirstStep = async () => {
    setLoadingStep(true);
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'first-step' }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentQuestion(data.question);
        setCurrentOptions(data.options);
      }
    } catch {}
    setLoadingStep(false);
  };

  const fetchNextStep = async (newQuestions: string[], newAnswers: string[]) => {
    setLoadingStep(true);
    try {
      const res = await fetch('/api/generate-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'next-step', questions: newQuestions, answers: newAnswers }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentQuestion(data.question);
        setCurrentOptions(data.options);
      }
    } catch {}
    setLoadingStep(false);
  };

  const handleActivate = () => {
    setActive(true);
    onActiveChange?.(true);
    fetchFirstStep();
  };

  const handleAnswer = async (answer: string) => {
    const newQuestions = [...questions, currentQuestion!];
    const newAnswers = [...answers, answer];
    setQuestions(newQuestions);
    setAnswers(newAnswers);

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

  const handleBack = async () => {
    if (step > 0) {
      const prevQuestions = questions.slice(0, -1);
      const prevAnswers = answers.slice(0, -1);
      setStep(step - 1);
      setQuestions(prevQuestions);
      setAnswers(prevAnswers);
      // Re-show the previous question
      setCurrentQuestion(questions[questions.length - 1]);
      // Refetch options for the previous state
      if (prevQuestions.length === 0) {
        await fetchFirstStep();
      } else {
        await fetchNextStep(prevQuestions, prevAnswers);
      }
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
        className="flex items-center gap-2 text-[#666] hover:text-[#ededed] transition-colors"
      >
        <Lightbulb className="h-4 w-4" />
        <span className="text-[15px]">Help me think of an idea</span>
      </button>
    );
  }

  // Show generated ideas
  if (ideas.length > 0) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-center justify-center gap-4">
          <span className="text-xs font-mono text-[#555]">Pick an idea</span>
          <button onClick={handleReset} className="flex items-center gap-1 text-xs text-[#555] hover:text-[#888] transition-colors">
            <RotateCcw className="h-3 w-3" />
            Start over
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {ideas.slice(0, visibleCount).map((idea, i) => (
            <button
              key={i}
              onClick={() => { onSelectIdea(idea); handleClose(); }}
              className="text-left px-3 py-2 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] hover:bg-[#111] transition-all text-sm text-[#ccc] leading-relaxed"
            >
              {idea}
            </button>
          ))}
        </div>
        {visibleCount < ideas.length && (
          <button
            onClick={() => setVisibleCount(prev => prev + 3)}
            className="text-xs text-[#555] hover:text-[#888] transition-colors"
          >
            Show more
          </button>
        )}
      </div>
    );
  }

  // Loading ideas
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-2 animate-fade-in">
        <Loader2 className="h-4 w-4 text-[#555] animate-spin" />
        <span className="text-sm text-[#555]">Generating ideas from your choices...</span>
      </div>
    );
  }

  // Progress bar component
  const progressBar = (
    <div className="w-full h-1 rounded-full bg-[#222] overflow-hidden">
      <div
        className="h-full rounded-full bg-white/40 transition-all duration-300"
        style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
      />
    </div>
  );

  // Loading next question
  if (loadingStep || !currentQuestion) {
    return (
      <div className="space-y-5 animate-fade-in max-w-md mx-auto w-full">
        {progressBar}
        <div className="flex items-center justify-center gap-3">
          {step > 0 && (
            <button onClick={handleBack} className="text-[#555] hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <Loader2 className="h-3.5 w-3.5 text-[#555] animate-spin" />
        </div>
        <button onClick={handleClose} className="text-xs text-[#555] hover:text-[#888] transition-colors mx-auto block">
          Cancel
        </button>
      </div>
    );
  }

  // Question step
  return (
    <div className="space-y-5 animate-fade-in max-w-md mx-auto w-full">
      {progressBar}

      <div className="flex items-center justify-center gap-2.5">
        {step > 0 && (
          <button onClick={handleBack} className="text-[#555] hover:text-white transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}
        <span className="text-sm text-[#ededed]">{currentQuestion}</span>
      </div>

      {/* Current options */}
      <div className="flex flex-col gap-3 w-full">
        {currentOptions.map((option) => (
          <button
            key={option}
            onClick={() => handleAnswer(option)}
            className="w-full h-11 px-5 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] hover:bg-[#111] transition-all text-sm text-[#ededed] text-left"
          >
            {option}
          </button>
        ))}
      </div>

      <button onClick={handleClose} className="text-xs text-[#555] hover:text-[#888] transition-colors mx-auto block">
        Cancel
      </button>
    </div>
  );
}
