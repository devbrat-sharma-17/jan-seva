import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cities } from '../../data/cities';
import type { CityConfig } from '../../types';
import './CitySelector.css';

interface CitySelectorProps {
  cityName: string;
}

export function CitySelector({ cityName }: CitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleCityClick = (city: CityConfig) => {
    setIsOpen(false);
    if (city.id === 'gwalior') {
      navigate('/');
    } else {
      navigate(`/city/${city.id}`);
    }
  };

  return (
    <div className="city-selector-container" ref={dropdownRef}>
      <button
        className={`city-selector ${isOpen ? 'city-selector--active' : ''}`}
        type="button"
        aria-label={`Current city: ${cityName}. Change city`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg
          className="icon icon--xs"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="city-selector__name">{cityName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`icon icon--xs city-selector__chevron ${isOpen ? 'city-selector__chevron--open' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="city-dropdown" role="menu" aria-label="Select City">
          <div className="city-dropdown__header">
            <span className="city-dropdown__title">Select City</span>
            <span className="city-dropdown__state">MP</span>
          </div>

          <div className="city-dropdown__list">
            {cities.map((city) => {
              const isCurrent = city.id === 'gwalior';

              return (
                <button
                  key={city.id}
                  type="button"
                  role="menuitem"
                  className={`city-dropdown__item ${isCurrent ? 'city-dropdown__item--selected' : ''}`}
                  onClick={() => handleCityClick(city)}
                >
                  <div className="city-dropdown__item-info">
                    <div className="city-dropdown__item-name">
                      <span className="city-name-en">{city.name}</span>
                      <span className="city-name-hi">({city.nameHindi})</span>
                    </div>
                  </div>

                  <div className="city-dropdown__item-badge-wrap">
                    {isCurrent ? (
                      <span className="city-badge city-badge--active">Active</span>
                    ) : (
                      <span className="city-badge city-badge--soon">Coming Soon</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
