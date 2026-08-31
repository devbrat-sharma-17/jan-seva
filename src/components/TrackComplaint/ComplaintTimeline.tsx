import type { ComplaintStatus, ComplaintTimelineEvent } from '../../types';
import { displayStamp, displayRelative } from '../../services/timeService';

interface ComplaintTimelineProps {
  currentStatus: ComplaintStatus;
  events: ComplaintTimelineEvent[];
}

const HIGH_LEVEL_STEPS = [
  { id: 'pending', label: 'Submitted' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
] as const;

function getStepIndex(status: ComplaintStatus): number {
  switch (status) {
    case 'pending': return 0;
    case 'assigned': return 1;
    case 'in-progress': return 2;
    case 'resolved': return 3;
    // Escalation is a state of the in-progress step, not a step of its own.
    case 'escalated': return 2;
    default: return 0;
  }
}

type EventState = 'completed' | 'current' | 'upcoming';

export function ComplaintTimeline({ currentStatus, events }: ComplaintTimelineProps) {
  const currentIndex = getStepIndex(currentStatus);
  const isEscalated = currentStatus === 'escalated';
  const isResolved = currentStatus === 'resolved';

  // Newest first. Every event carries an ISO stamp, so this is a real
  // ordering rather than insertion order.
  const ordered = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // The step still ahead, shown as a pending node so the citizen can see
  // what happens next rather than guessing where the process ends.
  const nextStep = !isResolved ? HIGH_LEVEL_STEPS[Math.min(currentIndex + 1, 3)] : null;

  return (
    <div className="timeline-card">
      <div className="timeline-card__head">
        <h3 className="timeline-card__title">Status timeline</h3>
        <span className="timeline-card__count">
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Layer A — high-level progression */}
      <ol
        className={`timeline-stepper ${isEscalated ? 'timeline-stepper--escalated' : ''}`.trim()}
        aria-label="Complaint progress"
      >
        {HIGH_LEVEL_STEPS.map((step, idx) => {
          const isDone = idx < currentIndex || (isResolved && idx === 3);
          const isActive = idx === currentIndex && !isResolved;

          let nodeClass = 'stepper-node';
          if (isDone) nodeClass += ' stepper-node--done';
          else if (isActive) nodeClass += ' stepper-node--active';
          if (isActive && isEscalated) nodeClass += ' stepper-node--alert';

          return (
            <li key={step.id} className={nodeClass} aria-current={isActive ? 'step' : undefined}>
              <span className="stepper-circle" aria-hidden="true">
                {isDone ? '✓' : isActive && isEscalated ? '!' : idx + 1}
              </span>
              <span className="stepper-label">{step.label}</span>
              {/* Status is never carried by colour alone. */}
              <span className="sr-only">
                {isDone ? 'completed' : isActive ? 'current step' : 'not started'}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Layer B — detailed event log */}
      <ol className="detailed-timeline">
        {ordered.map((evt, idx) => {
          const state: EventState = idx === 0 ? 'current' : 'completed';
          return (
            <li
              key={evt.id || idx}
              className={`timeline-event-item timeline-event-item--${evt.status} timeline-event-item--${state}`}
            >
              <span className="timeline-event-dot" aria-hidden="true" />
              <div className="timeline-event-info">
                <span className="timeline-event-title">{evt.title}</span>
                <p className="timeline-event-desc">{evt.description}</p>
                <span className="timeline-event-time">
                  <time dateTime={evt.timestamp}>{displayStamp(evt.timestamp)}</time>
                  <span className="timeline-event-ago"> · {displayRelative(evt.timestamp)}</span>
                  {evt.actor ? <span className="timeline-event-actor"> · via {evt.actor}</span> : null}
                </span>
              </div>
            </li>
          );
        })}

        {nextStep && (
          <li className="timeline-event-item timeline-event-item--upcoming">
            <span className="timeline-event-dot" aria-hidden="true" />
            <div className="timeline-event-info">
              <span className="timeline-event-title">{nextStep.label}</span>
              <span className="timeline-event-time">Pending</span>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}
