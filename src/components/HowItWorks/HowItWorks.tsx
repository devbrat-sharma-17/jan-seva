import { howItWorksSteps } from '../../data/howItWorks';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { CategoryIcon } from '../ui/CategoryIcon';
import { SectionHeader } from '../ui/SectionHeader';
import { useTranslation } from '../../hooks/useTranslation';
import './HowItWorks.css';

export function HowItWorks() {
  const sectionRef = useScrollAnimation<HTMLElement>();
  const { t } = useTranslation();

  const stepKeyMap: Record<number, { title: string; desc: string }> = {
    1: { title: 'howItWorks.step1.title', desc: 'howItWorks.step1.desc' },
    2: { title: 'howItWorks.step2.title', desc: 'howItWorks.step2.desc' },
    3: { title: 'howItWorks.step3.title', desc: 'howItWorks.step3.desc' },
    4: { title: 'howItWorks.step4.title', desc: 'howItWorks.step4.desc' },
    5: { title: 'howItWorks.step5.title', desc: 'howItWorks.step5.desc' },
  };

  return (
    <section className="how-it-works" id="how-it-works" aria-label={t('howItWorks.heading')} ref={sectionRef}>
      <div className="how-it-works__inner container">
        <SectionHeader
          title={t('howItWorks.heading')}
          subtitle={t('howItWorks.subtitle')}
          className="animate-on-scroll"
        />

        <ol className="how-it-works__steps">
          {howItWorksSteps.map((step, index) => {
            const keys = stepKeyMap[step.step];
            return (
              <li
                key={step.step}
                className={`how-it-works__step animate-on-scroll delay-${index + 1}`}
                style={{ '--step-index': index } as React.CSSProperties}
              >
                {/* Marker rail — badge plus the connector to the next step */}
                <div className="how-it-works__marker">
                  <span className="how-it-works__step-num">
                    {String(step.step).padStart(2, '0')}
                  </span>
                  <span className="how-it-works__connector" aria-hidden="true" />
                </div>

                <div className="how-it-works__step-content">
                  <span className="icon-tile icon-tile--raised icon-tile--settle how-it-works__step-icon" aria-hidden="true">
                    <CategoryIcon type={step.icon} size="md" draw />
                  </span>
                  <h3 className="how-it-works__step-title">
                    {keys ? t(keys.title) : step.title}
                  </h3>
                  <p className="how-it-works__step-desc">
                    {keys ? t(keys.desc) : step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
