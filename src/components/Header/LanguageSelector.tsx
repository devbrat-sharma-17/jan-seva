import { useState } from 'react';
import './LanguageSelector.css';

export function LanguageSelector() {
  const [lang] = useState('EN');

  return (
    <button className="language-selector" type="button" aria-label={`Language: ${lang}. Change language`}>
      <span className="language-selector__label">{lang}</span>
      <svg className="icon icon--xs" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}
