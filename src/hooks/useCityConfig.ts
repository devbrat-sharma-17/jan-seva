import { useMemo } from 'react';
import { defaultCity, getCityById } from '../data/cities';
import type { CityConfig } from '../types';

export function useCityConfig(cityId?: string): CityConfig {
  return useMemo(() => {
    if (cityId) {
      return getCityById(cityId) ?? defaultCity;
    }
    return defaultCity;
  }, [cityId]);
}
