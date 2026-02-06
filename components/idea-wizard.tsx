'use client';

import { useState } from 'react';
import { Lightbulb, Loader2, RotateCcw, ArrowLeft } from 'lucide-react';

interface IdeaWizardProps {
  onSelectIdea: (idea: string) => void;
}

interface WizardStep {
  question: string;
  options: string[];
}

const STEPS: WizardStep[] = [
  {
    question: 'What mood?',
    options: ['Dreamy', 'Intense', 'Funny', 'Mysterious', 'Peaceful'],
  },
  {
    question: 'Where?',
    options: ['City', 'Nature', 'Space', 'Underwater', 'Indoors'],
  },
  {
    question: 'Who or what?',
    options: ['A person', 'An animal', 'An object', 'A crowd', 'Abstract'],
  },
  {
    question: 'Doing what?',
    options: ['Moving', 'Still', 'Dancing', 'Exploring', 'Creating'],
  },
  {
    question: 'What time?',
    options: ['Sunrise', 'Night', 'Golden hour', 'Storm', 'Timeless'],
  },
];

export function IdeaWizard({ onSelectIdea }: IdeaWizardProps) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(3);
  const [loading, setLoading] = useState(false);

  const handleAnswer = async (answer: string) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (newAnswers.length < STEPS.length) {
      setStep(step + 1);
    } else {
      // All questions answered — generate ideas
      setLoading(true);
      try {
        const res = await fetch('/api/generate-ideas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: newAnswers, steps: STEPS.map(s => s.question) }),
        });
        if (res.ok) {
          const data = await res.json();
          setIdeas(data.ideas || []);
        }
      } catch {}
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      setAnswers(answers.slice(0, -1));
    }
  };

  const handleReset = () => {
    setStep(0);
    setAnswers([]);
    setIdeas([]);
    setVisibleCount(3);
    setLoading(false);
  };

  const handleClose = () => {
    setActive(false);
    handleReset();
  };

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
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
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-[#555]">Pick an idea</span>
          <button onClick={handleReset} className="flex items-center gap-1 text-xs text-[#555] hover:text-[#888] transition-colors">
            <RotateCcw className="h-3 w-3" />
            Start over
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2 animate-fade-in">
        <Loader2 className="h-4 w-4 text-[#555] animate-spin" />
        <span className="text-sm text-[#555]">Generating ideas from your choices...</span>
      </div>
    );
  }

  // Question steps
  const current = STEPS[step];

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button onClick={handleBack} className="text-[#555] hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="text-xs font-mono text-[#555]">{step + 1}/{STEPS.length}</span>
          <span className="text-sm text-[#ededed]">{current.question}</span>
        </div>
        <button onClick={handleClose} className="text-xs text-[#555] hover:text-[#888] transition-colors">
          Cancel
        </button>
      </div>

      {/* Answer chips showing previous answers */}
      {answers.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {answers.map((a, i) => (
            <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-[#222] text-[#888] font-mono">
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Current options */}
      <div className="flex flex-wrap gap-2">
        {current.options.map((option) => (
          <button
            key={option}
            onClick={() => handleAnswer(option)}
            className="h-10 px-4 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#555] hover:bg-[#111] transition-all text-sm text-[#ededed]"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
