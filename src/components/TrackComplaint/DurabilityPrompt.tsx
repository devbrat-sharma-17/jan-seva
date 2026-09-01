import { useState } from 'react';
import type { Complaint } from '../../types';
import { getDurabilityPrompt, answerDurabilityCheck } from '../../services/complaintService';
import { useToast } from '../ui/Toast';
import './durability.css';

interface DurabilityPromptProps {
  verifiedComplaint: Complaint | null;
  identityReference?: string;
  onChanged: () => void;
}

/**
 * "Is it still fixed?" — asked at 30 and 90 days.
 *
 * A citizen standing next to a fresh patch will confirm it. Whether the
 * patch is still there in November is the question that actually
 * matters, and no civic platform reviewed asks it — Swachhata lets you
 * reopen, but nobody proactively re-asks.
 *
 *   NOTIFICATION FATIGUE IS THE REAL RISK HERE, so the design is
 *   constrained rather than configurable: exactly two prompts per
 *   complaint, one tap each, the earliest outstanding one only, and
 *   never a third. A civic app that nags is a civic app that gets
 *   uninstalled, and this product cannot afford that — the durability
 *   answer is the only thing that separates a real repair from a
 *   cosmetic one.
 */
export function DurabilityPrompt({
  verifiedComplaint,
  identityReference,
  onChanged,
}: DurabilityPromptProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const { showToast } = useToast();

  // Only the verified reporter is asked, and only about their own fix.
  if (!verifiedComplaint || !identityReference) return null;

  const prompt = getDurabilityPrompt(verifiedComplaint);
  if (!prompt) return null;

  const answer = async (outcome: 'holding' | 'failed') => {
    setBusy(true);
    try {
      const updated = await answerDurabilityCheck(
        verifiedComplaint.id,
        identityReference,
        prompt.dayOffset,
        outcome,
        outcome === 'failed' ? note.trim() || undefined : undefined
      );

      if (!updated) {
        showToast('That answer could not be recorded. Please try again.', 'warning');
        return;
      }

      showToast(
        outcome === 'holding'
          ? 'Thank you — recorded as still fixed.'
          : 'Recorded. This complaint has been reopened with a 24-hour target.',
        outcome === 'holding' ? 'success' : 'warning'
      );
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="durability-prompt">
      <div className="durability-prompt__head">
        <span className="durability-prompt__badge">{prompt.dayOffset}-day check</span>
        <h3 className="durability-prompt__title">
          Is the {verifiedComplaint.issue.category === 'roads' ? 'road repair' : 'fix'} at{' '}
          {verifiedComplaint.location.locality} still holding?
        </h3>
      </div>

      <p className="durability-prompt__body">
        You confirmed this was fixed {prompt.dayOffset} days ago. One tap tells the city whether
        the repair lasted — and it counts towards this department&rsquo;s score, which is built on
        durability rather than on how fast complaints get closed.
      </p>

      {showNote && (
        <textarea
          className="durability-prompt__note"
          rows={2}
          placeholder="What has failed? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      <div className="durability-prompt__actions">
        <button
          type="button"
          className="durability-btn durability-btn--yes"
          onClick={() => void answer('holding')}
          disabled={busy}
        >
          Still fixed
        </button>
        <button
          type="button"
          className="durability-btn durability-btn--no"
          onClick={() => (showNote ? void answer('failed') : setShowNote(true))}
          disabled={busy}
        >
          {showNote ? 'Confirm — it failed again' : 'It has failed again'}
        </button>
      </div>

      <p className="durability-prompt__footnote">
        We will ask once more at 90 days, and then never again.
      </p>
    </section>
  );
}
