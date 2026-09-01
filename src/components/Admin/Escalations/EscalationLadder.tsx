import { getLadderState, describeQueue } from '../../../services/escalationService';
import type { Complaint } from '../../../types';
import './escalation-ladder.css';

interface EscalationLadderProps {
  complaints: Complaint[];
}

/**
 * The escalation ladder as queues with clocks.
 *
 * `escalatedTo: 'Municipal Commissioner & Department Head'` was a string
 * on a complaint. Nobody's queue grew, no clock started, and nobody
 * became accountable for the escalation itself — which makes escalation
 * a label rather than a state with a cost.
 *
 * Each rung here is a POST, not a person: posts outlive postings, and
 * naming an individual would make this unusable the first time somebody
 * transfers.
 *
 *   Public exposure of these counts is a per-city configuration
 *   decision (`publiclyVisible`), not a default. Naming a serving
 *   officer's backlog in public is politically fraught enough to block
 *   adoption of the whole platform — so the ladder and the timers are
 *   built, and the city decides what leaves this room.
 */
export function EscalationLadder({ complaints }: EscalationLadderProps) {
  const rungs = getLadderState(complaints);
  const totalOpen = rungs.reduce((sum, r) => sum + r.openCount, 0);

  return (
    <section className="esc-ladder">
      <header className="esc-ladder__head">
        <h2 className="esc-ladder__title">Escalation ladder</h2>
        <p className="esc-ladder__lead">
          {totalOpen === 0
            ? 'No complaint is currently sitting in an escalation queue.'
            : `${totalOpen} complaint${totalOpen === 1 ? '' : 's'} across ${rungs.length} levels. Each level carries its own response window; an escalation that nobody answers rises.`}
        </p>
      </header>

      <ol className="esc-ladder__rungs">
        {rungs.map((rung) => {
          const overdue = rung.overdueCount > 0;

          return (
            <li
              key={rung.post.level}
              className={`esc-rung${overdue ? ' esc-rung--overdue' : ''}${rung.openCount === 0 ? ' esc-rung--clear' : ''}`}
            >
              <div className="esc-rung__level" aria-hidden="true">
                L{rung.post.level}
              </div>

              <div className="esc-rung__body">
                <div className="esc-rung__row">
                  <h3 className="esc-rung__post">{rung.post.postTitle}</h3>
                  {!rung.post.publiclyVisible && (
                    <span className="esc-rung__private" title="Not published outside the Command Centre">
                      internal
                    </span>
                  )}
                </div>

                <p className="esc-rung__state">{describeQueue(rung)}</p>

                <p className="esc-rung__window">
                  Response window {rung.post.responseHours} h
                  {overdue && (
                    <span className="esc-rung__overdue">
                      {' '}
                      · {rung.overdueCount} past it
                    </span>
                  )}
                </p>
              </div>

              <div className="esc-rung__count">
                <span className="esc-rung__count-value">{rung.openCount}</span>
                <span className="esc-rung__count-label">open</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
