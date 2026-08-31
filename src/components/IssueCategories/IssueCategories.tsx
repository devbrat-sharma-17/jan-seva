import { issueCategories } from '../../data/issueCategories';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';
import { CategoryIcon } from '../ui/CategoryIcon';
import { SectionHeader } from '../ui/SectionHeader';
import './IssueCategories.css';

export function IssueCategories() {
  const sectionRef = useScrollAnimation<HTMLElement>();

  return (
    <section className="issue-categories" id="issue-categories" aria-label="Common Civic Issues" ref={sectionRef}>
      <div className="issue-categories__inner container">
        <SectionHeader
          title="Common Civic Issues"
          subtitle="Select a category to report an issue. Don't worry — we'll route it to the right department."
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
                <span className="issue-category-card__title">{category.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
