import type { IssueCategory } from '../types';

// Colour lives in the token layer (`--cat-*` in styles/tokens.css) and is
// applied via the card's `data-category` attribute. Keeping hex here would
// hard-code brand decisions into data and bypass theming entirely.

export const issueCategories: IssueCategory[] = [
  { id: 'roads',          title: 'Roads & Potholes',      icon: 'roads' },
  { id: 'garbage',        title: 'Garbage & Sanitation',  icon: 'garbage' },
  { id: 'water',          title: 'Water Leakage',         icon: 'water' },
  { id: 'streetlights',   title: 'Street Lights',         icon: 'streetlight' },
  { id: 'infrastructure', title: 'Public Infrastructure', icon: 'infrastructure' },
  { id: 'others',         title: 'Others',                icon: 'others' },
];
