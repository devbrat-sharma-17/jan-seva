import './PrimaryCTA.css';

interface PrimaryCTAProps {
  label: string;
  subtitle?: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  size?: 'md' | 'lg';
  id?: string;
}

export function PrimaryCTA({
  label,
  subtitle,
  onClick,
  href,
  icon,
  fullWidth = false,
  size = 'md',
  id,
}: PrimaryCTAProps) {
  const className = `primary-cta primary-cta--${size} ${fullWidth ? 'primary-cta--full' : ''}`;

  const content = (
    <>
      <span className="primary-cta__content">
        {icon && <span className="primary-cta__icon">{icon}</span>}
        <span className="primary-cta__text">
          <span className="primary-cta__label">{label}</span>
          {subtitle && <span className="primary-cta__subtitle">{subtitle}</span>}
        </span>
      </span>
      <span className="primary-cta__arrow" aria-hidden="true">
        <svg className="icon icon--strong icon--sm" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
