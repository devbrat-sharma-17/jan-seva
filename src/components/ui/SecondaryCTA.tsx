import './SecondaryCTA.css';

interface SecondaryCTAProps {
  label: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  id?: string;
}

export function SecondaryCTA({
  label,
  subtitle,
  onClick,
  href,
  icon,
  fullWidth = false,
  id,
}: SecondaryCTAProps) {
  const className = `secondary-cta ${fullWidth ? 'secondary-cta--full' : ''}`;

  const content = (
    <>
      <span className="secondary-cta__content">
        {icon && <span className="secondary-cta__icon">{icon}</span>}
        <span className="secondary-cta__text">
          <span className="secondary-cta__label">{label}</span>
          {subtitle && <span className="secondary-cta__subtitle">{subtitle}</span>}
        </span>
      </span>
      <span className="secondary-cta__arrow" aria-hidden="true">
        <svg className="icon icon--strong icon--sm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={className} id={id}>
        {content}
      </a>
    );
  }

  return (
    <button className={className} onClick={onClick} id={id} type="button">
      {content}
    </button>
  );
}
