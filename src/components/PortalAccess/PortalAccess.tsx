import { portalLinks } from '../../data/navigation';
import { CategoryIcon } from '../ui/CategoryIcon';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { useTranslation } from '../../hooks/useTranslation';
import './PortalAccess.css';

export function PortalAccess() {
  const sectionRef = useScrollAnimation<HTMLElement>();
  const { t } = useTranslation();

  const portalKeyMap: Record<string, { title: string; subtitle: string }> = {
    admin: { title: 'portal.admin.title', subtitle: 'portal.admin.subtitle' },
    department: { title: 'portal.dept.title', subtitle: 'portal.dept.subtitle' },
  };

  return (
    <section className="portal-access" id="portal-access" ref={sectionRef}>
      <div className="portal-access__inner container">
        <p className="portal-access__label animate-on-scroll">{t('nav.portalAccess')}</p>
        <div className="portal-access__grid">
          {portalLinks.map((portal, index) => {
            const keys = portalKeyMap[portal.id];
            return (
              <a
                key={portal.id}
                href={portal.href}
                className={`portal-card animate-on-scroll delay-${index + 1}`}
                id={`portal-${portal.id}`}
              >
                <div className="icon-tile icon-tile--bloom portal-card__icon">
                  <CategoryIcon type={portal.icon} size="md" />
                </div>
                <div className="portal-card__text">
                  <span className="portal-card__title">
                    {keys ? t(keys.title) : portal.title}
                  </span>
                  <span className="portal-card__subtitle">
                    {keys ? t(keys.subtitle) : portal.subtitle}
                  </span>
                </div>
                <svg className="icon icon--sm portal-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
