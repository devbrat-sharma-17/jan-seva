interface OfficerContactCardProps {
  departmentName: string;
  division: string;
  helpline: string;
  officerName?: string;
  officerDesignation?: string;
}

export function OfficerContactCard({
  departmentName,
  division,
  helpline,
  officerName,
  officerDesignation,
}: OfficerContactCardProps) {
  // "Request an update" lives in the sticky action bar, so this card stays
  // presentational — one clearly relevant action per screen, not two.
  const hasOfficer = Boolean(officerName);

  return (
    <div className="officer-card">
      <span className="officer-dept-name">
        {departmentName} — {division}
      </span>

      <div className="officer-details">
        <div className="officer-avatar-box">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          {/* A freshly filed complaint has no officer yet. Naming a
              placeholder engineer would be a fabrication the citizen
              might act on. */}
          <h4 className="officer-name">{hasOfficer ? officerName : 'Awaiting officer assignment'}</h4>
          <p className="officer-role">
            {hasOfficer ? officerDesignation : 'Usually assigned within a few hours'}
          </p>
        </div>
      </div>

      <div className="officer-actions">
        <a href={`tel:${helpline.replace(/\D/g, '')}`} className="report-btn report-btn--secondary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>Helpline</span>
        </a>

      </div>
    </div>
  );
}
