import { useEffect, useState } from 'react';
import { useWorldStore } from '../state/worldStore';
import type { Interaction } from '../spec/worldSpec';

function QuoteCard({ interaction }: { interaction: Interaction }) {
  const quote = interaction.quote;
  if (!quote) return <FallbackCard interaction={interaction} />;
  return (
    <>
      {interaction.prompt && <p className="panel-lead">{interaction.prompt}</p>}
      <blockquote className="panel-quote">{quote.text}</blockquote>
      <p className="panel-source">— Chapter {quote.chapter}</p>
    </>
  );
}

function QuizCard({ interaction }: { interaction: Interaction }) {
  const quiz = interaction.quiz;
  const completeInteraction = useWorldStore((s) => s.completeInteraction);
  const [picked, setPicked] = useState<number | null>(null);
  // captured once on open: replays of an already-solved quiz award nothing
  const [wasCompleted] = useState(() =>
    useWorldStore.getState().completedInteractions.has(interaction.id),
  );
  if (!quiz) return <FallbackCard interaction={interaction} />;
  const correct = picked !== null && picked === quiz.answerIndex;

  const pick = (index: number) => {
    if (correct) return;
    setPicked(index);
    if (index === quiz.answerIndex) {
      completeInteraction(interaction.id, interaction.xp);
    }
  };

  return (
    <>
      {interaction.prompt && <p className="panel-lead">{interaction.prompt}</p>}
      <p className="panel-question">{quiz.question}</p>
      <div>
        {quiz.options.map((option, i) => {
          const state =
            picked === i ? (i === quiz.answerIndex ? ' correct' : ' wrong') : '';
          return (
            <button
              key={option}
              type="button"
              className={`quiz-option${state}`}
              onClick={() => pick(i)}
              disabled={correct}
            >
              {option}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p className="panel-feedback">
          {correct
            ? `Right!${wasCompleted ? '' : ` +${interaction.xp} XP`}${quiz.chapterRef ? ` · from Chapter ${quiz.chapterRef}` : ''}`
            : 'Not quite — try again.'}
        </p>
      )}
    </>
  );
}

function FallbackCard({ interaction }: { interaction: Interaction }) {
  return <p className="panel-lead">{interaction.prompt ?? 'There is nothing more to see here.'}</p>;
}

/** Modal panel for the currently open interaction. */
export function InteractionPanel() {
  const active = useWorldStore((s) => s.activeInteraction);
  const closeInteraction = useWorldStore((s) => s.closeInteraction);

  // release the mouse so panel buttons are clickable
  useEffect(() => {
    if (active && document.pointerLockElement) document.exitPointerLock();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') closeInteraction();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, closeInteraction]);

  if (!active) return null;
  const interaction = active.interaction;

  return (
    <div className="panel-backdrop" onClick={closeInteraction}>
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {interaction.type === 'quote' ? (
          <QuoteCard interaction={interaction} />
        ) : interaction.type === 'quiz' ? (
          <QuizCard interaction={interaction} />
        ) : (
          <FallbackCard interaction={interaction} />
        )}
        <button type="button" className="panel-close" onClick={closeInteraction}>
          Close
        </button>
      </div>
    </div>
  );
}
