import { howItWorksSteps } from '../../data/howItWorks';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { CategoryIcon } from '../ui/CategoryIcon';
import { SectionHeader } from '../ui/SectionHeader';
import './HowItWorks.css';

export function HowItWorks() {
  const sectionRef = useScrollAnimation<HTMLElement>();

  return (
    <section className="how-it-works" id="how-it-works" aria-label="How JAN-SEVA Works" ref={sectionRef}>
      <div className="how-it-works__inner container">
        <SectionHeader
          title="How JAN-SEVA Works"
          subtitle="From reporting to resolution — a simple, transparent 5-step process."
          className="animate-on-scroll"
        />

        <ol className="how-it-works__steps">
          {howItWorksSteps.map((step, index) => (
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
                <h3 className="how-it-works__step-title">{step.title}</h3>
                <p className="how-it-works__step-desc">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
