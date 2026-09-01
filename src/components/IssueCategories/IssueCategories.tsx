import { issueCategories } from '../../data/issueCategories';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { CategoryIcon } from '../ui/CategoryIcon';
import { SectionHeader } from '../ui/SectionHeader';
import { useTranslation } from '../../hooks/useTranslation';
import './IssueCategories.css';

export function IssueCategories() {
  const sectionRef = useScrollAnimation<HTMLElement>();
  const { t } = useTranslation();

  const categoryKeyMap: Record<string, string> = {
    roads: 'category.roads',
    garbage: 'category.garbage',
    water: 'category.water',
    streetlights: 'category.streetlights',
    infrastructure: 'category.infrastructure',
    others: 'category.others',
  };

  return (
    <section className="issue-categories" id="issue-categories" aria-label={t('categories.heading')} ref={sectionRef}>
      <div className="issue-categories__inner container">
        <SectionHeader
          title={t('categories.heading')}
          subtitle={t('categories.subtitle')}
          className="animate-on-scroll"
        />

        <ul className="issue-categories__grid">
          {issueCategories.map((category, index) => (
            <li key={category.id}>
              <a
                href={`/report?category=${category.id}`}
                /* data-category selects the colour set from the token layer */
                data-category={category.id}
                className={`issue-category-card animate-on-scroll delay-${index + 1}`}
                id={`category-${category.id}`}
              >
                <span className="icon-tile icon-tile--raised icon-tile--bloom icon-tile--settle issue-category-card__tile">
                  <CategoryIcon type={category.icon} size="lg" draw />
                </span>
                <span className="issue-category-card__title">
                  {categoryKeyMap[category.id] ? t(categoryKeyMap[category.id]) : category.title}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
