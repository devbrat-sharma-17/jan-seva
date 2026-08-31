// ============================================================
// Error Boundary — one broken panel must not take the portal down
// ============================================================
// Wraps the parts most likely to fail on unexpected data: the map, the
// charts, a complaint detail with a malformed record. A throw inside one
// leaves the rest of the shell — navigation, other panels — usable.

import React from 'react';
import './portal.css';

interface Props {
  children: React.ReactNode;
  /** What failed, in the user's terms. "the civic map", "this chart". */
  area: string;
  /** Optional compact presentation for a panel inside a page. */
  variant?: 'page' | 'panel';
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Deliberately no console output. A portal renders citizen records,
    // and a stack trace here would put complaint data into a log that
    // outlives the session. Real builds send this to an error service
    // that strips payloads first.
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className={`portal-error portal-error--${this.props.variant ?? 'panel'}`} role="alert">
        <span className="portal-error__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12.01" y2="16.5" />
          </svg>
        </span>

        <div className="portal-error__text">
          <p className="portal-error__title">Unable to load {this.props.area}.</p>
          <p className="portal-error__desc">
            The rest of this page is unaffected. Try again, or reload if it keeps happening.
          </p>
        </div>

        <button type="button" className="portal-error__retry" onClick={this.handleRetry}>
          Try again
        </button>
      </div>
    );
  }
}
