// ============================================================
// One-Trip Work Card — the field view
// ============================================================
// Built for a phone held outdoors, not for a desk. Dark ground, large
// type, one decision per stop, and it keeps working with the network
// off — the existing sync queue drains it on the way back.

import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getComplaintsByDepartment } from '../../../services/complaintService';
import { buildDailyCards, summariseSaving } from '../../../services/workCardService';
import { formatDistance } from '../../../services/geoService';
import { useLiveData } from '../../../hooks/useLiveData';
import { getCurrentDepartmentUser } from '../../../services/authService';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import type { DepartmentId } from '../../../types/department';
import '../department-shared.css';
import './work-card.css';

function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function WorkCardView() {
  const [user] = useState(() => getCurrentDepartmentUser());
  const isOnline = useOnlineStatus();
  const departmentId = (user?.departmentId ?? 'roads') as DepartmentId;

  const complaints = useLiveData(
    useCallback(() => getComplaintsByDepartment(departmentId), [departmentId])
  );

  const cards = useMemo(
    () => buildDailyCards(departmentId, complaints),
    [departmentId, complaints]
  );
  const saving = useMemo(() => summariseSaving(cards), [cards]);

  const [activeIndex, setActiveIndex] = useState(0);
  const card = cards[activeIndex] ?? cards[0] ?? null;

  if (!card) {
    return (
      <div className="dept-page">
        <h1 className="dept-page-title">Today&rsquo;s work cards</h1>
        <div className="dept-empty">
          <p>No open jobs to route. Every complaint in this department is closed or resolved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dept-page">
      <header className="dept-page-head">
        <div className="dept-page-head__text">
          <h1 className="dept-page-title">Today&rsquo;s work cards</h1>
          <p className="dept-page-desc">
            Nearby open jobs of the same skill batched into single routed trips, so a crew stops
            driving across the city for one pothole and back.
          </p>
        </div>
      </header>

      {/* --------------------------------------------------------
          The line a department head actually reads. Stated as a
          heuristic, because that is what it is.
          -------------------------------------------------------- */}
      <section className="wc-summary">
        <div>
          <span className="wc-summary__value">{saving.trips}</span>
          <span className="wc-summary__label">trips</span>
        </div>
        <div>
          <span className="wc-summary__value">{saving.stops}</span>
          <span className="wc-summary__label">jobs covered</span>
        </div>
        <div>
          <span className="wc-summary__value wc-summary__value--good">
            {formatDistance(saving.savedMetres)}
          </span>
          <span className="wc-summary__label">
            saved vs one trip per complaint (~{minutesLabel(saving.savedMinutes)} of driving)
          </span>
        </div>
        <p className="wc-summary__method">
          Greedy nearest-neighbour over straight-line distance, anchored on the most urgent job.
          Not route optimisation and not a model — real road-network routing, crew capacity and
          time windows need a backend.
        </p>
      </section>

      {cards.length > 1 && (
        <div className="wc-tabs" role="tablist" aria-label="Work cards">
          {cards.map((c, index) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={`wc-tab${index === activeIndex ? ' is-active' : ''}`}
              onClick={() => setActiveIndex(index)}
            >
              <span className="wc-tab__skill">{c.skill}</span>
              <span className="wc-tab__stops">{c.stops.length} stops</span>
            </button>
          ))}
        </div>
      )}

      <article className="wc-card">
        <header className="wc-card__head">
          <div>
            <p className="wc-card__id">{card.id}</p>
            <h2 className="wc-card__title">
              {card.stops.length} stops · {formatDistance(card.totalDistanceMetres)} ·{' '}
              {minutesLabel(card.estimatedMinutes)}
            </h2>
            <p className="wc-card__from">Starting from {card.startsFrom.label}</p>
          </div>

          {/* Offline is a normal state for this screen, not an error.
              The card is already on the device; completions queue and
              drain on the way back. */}
          <span className={`wc-card__net${isOnline ? '' : ' is-offline'}`}>
            {isOnline ? 'Online' : 'Offline — work is queued'}
          </span>
        </header>

        <ol className="wc-stops">
          {card.stops.map((stop) => (
            <li key={stop.complaintId} className={`wc-stop wc-stop--${stop.slaStatus}`}>
              <span className="wc-stop__seq" aria-hidden="true">
                {stop.sequence}
              </span>

              <div className="wc-stop__body">
                <div className="wc-stop__row">
                  <h3 className="wc-stop__title">{stop.title}</h3>
                  {stop.isRepeatFailure && (
                    <span className="wc-stop__repeat">Repeat failure</span>
                  )}
                </div>

                <p className="wc-stop__address">{stop.address}</p>

                <div className="wc-stop__facts">
                  <span>
                    {stop.legMetres > 0
                      ? `${formatDistance(stop.legMetres)} from the last stop`
                      : 'First stop'}
                  </span>
                  <span>~{minutesLabel(stop.estimatedMinutes)}</span>
                  <span className={`wc-stop__sla wc-stop__sla--${stop.slaStatus}`}>
                    {stop.slaLabel}
                  </span>
                </div>

                {/* Told at the stop, not in a manual. A crew that
                    photographs the wrong thing has to come back. */}
                <p className="wc-stop__capture">
                  <strong>Capture here:</strong> {stop.captureRequirement}
                </p>

                {stop.assetId && (
                  <p className="wc-stop__asset">
                    Asset <code>{stop.assetId}</code>
                    {stop.isRepeatFailure && ' — this one has failed before. Check the ledger before patching.'}
                  </p>
                )}

                <Link className="wc-stop__link" to={`/department/complaints/${stop.complaintId}`}>
                  Open {stop.complaintId}
                </Link>
              </div>
            </li>
          ))}
        </ol>

        <footer className="wc-card__foot">
          <p>
            One trip instead of {card.stops.length}: {formatDistance(card.naiveDistanceMetres)}{' '}
            of driving becomes {formatDistance(card.totalDistanceMetres)}.
          </p>
        </footer>
      </article>
    </div>
  );
}
