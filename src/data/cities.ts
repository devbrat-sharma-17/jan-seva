import type { CityConfig } from '../types';

export const cities: CityConfig[] = [
  {
    id: 'gwalior',
    code: 'GWL',
    name: 'Gwalior',
    nameHindi: 'ग्वालियर',
    state: 'Madhya Pradesh',
    stateHindi: 'मध्य प्रदेश',
    country: 'India',
    heroImage: '/assets/gwalior/hero.jpg',
    coordinates: { lat: 26.2183, lng: 78.1828 },
    localTagline: 'Together, let\'s build a better and cleaner Gwalior.',
    localTaglineHindi: 'ग्वालियर — हमारा शहर, हमारा दायित्व',
    accent: 'var(--cat-roads)',
    landmarks: ['Gwalior Fort', 'Man Singh Palace', 'Teli Ka Mandir', 'Sas Bahu Temple', 'Jai Vilas Palace'],
    initiatives: [
      {
        id: 'swachh-ward',
        title: 'Swachh Ward Initiative',
        location: 'All Wards, Gwalior',
        description: 'A comprehensive cleanliness drive across all municipal wards to improve sanitation and waste management.',
        status: 'ongoing',
        image: '/assets/initiatives/swachh-ward.jpg',
      },
      {
        id: 'smart-streetlight',
        title: 'Smart Streetlight Upgrade',
        location: 'Lashkar, Morar, City Center',
        description: 'Upgrading conventional streetlights to energy-efficient smart LED systems with automated fault detection.',
        status: 'ongoing',
        image: '/assets/initiatives/smart-streetlight.jpg',
      },
      {
        id: 'water-conservation',
        title: 'Water Conservation Mission',
        location: 'Gwalior Municipal Area',
        description: 'Repairing leaking pipelines and installing smart meters to reduce water wastage across the city.',
        status: 'upcoming',
        image: '/assets/initiatives/water-conservation.jpg',
      },
      {
        id: 'road-repair',
        title: 'Road Repair Programme',
        location: 'Major Arterial Roads',
        description: 'Systematic repair and resurfacing of major roads and addressing critical pothole complaints.',
        status: 'ongoing',
        image: '/assets/initiatives/road-repair.jpg',
      },
    ],
    /**
     * Municipal programme totals. ILLUSTRATIVE, and labelled as such
     * wherever they render.
     *
     * `resolutionRate` is no longer stored. It used to say 94 while the
     * same object said 9,830 of 12,480 resolved — which is 79% — so the
     * page contradicted itself in two adjacent numbers. It is now
     * DERIVED by getProgrammeStats(), which makes that drift impossible
     * rather than merely fixed once.
     */
    statistics: {
      issuesReported: 12480,
      issuesResolved: 9830,
      activeInitiatives: 42,
    },
    status: 'active',
  },
  {
    id: 'indore',
    code: 'IND',
    name: 'Indore',
    nameHindi: 'इन्दौर',
    state: 'Madhya Pradesh',
    stateHindi: 'मध्य प्रदेश',
    country: 'India',
    heroImage: '/assets/gwalior/hero.jpg',
    coordinates: { lat: 22.7196, lng: 75.8577 },
    localTagline: 'India\'s cleanest city — empowering citizens through smart governance.',
    localTaglineHindi: 'इन्दौर — स्वच्छ भारत का प्रेरणास्रोत',
    accent: '#16A34A',
    landmarks: ['Rajwada Palace', 'Lal Bagh Palace', 'Khajrana Ganesh', 'Sarafa Bazaar', 'Chappan Dukan'],
    initiatives: [],
    statistics: {
      issuesReported: 0,
      issuesResolved: 0,
      activeInitiatives: 0,
    },
    status: 'coming-soon',
  },
  {
    id: 'bhopal',
    code: 'BPL',
    name: 'Bhopal',
    nameHindi: 'भोपाल',
    state: 'Madhya Pradesh',
    stateHindi: 'मध्य प्रदेश',
    country: 'India',
    heroImage: '/assets/gwalior/hero.jpg',
    coordinates: { lat: 23.2599, lng: 77.4126 },
    localTagline: 'City of Lakes — building sustainable civic services for every ward.',
    localTaglineHindi: 'भोपाल — झीलों का शहर, स्वच्छता और सेवा का संगम',
    accent: '#2563EB',
    landmarks: ['Upper Lake (Bada Talab)', 'Taj-ul-Masajid', 'Van Vihar', 'Bharat Bhavan', 'Shaukat Mahal'],
    initiatives: [],
    statistics: {
      issuesReported: 0,
      issuesResolved: 0,
      activeInitiatives: 0,
    },
    status: 'coming-soon',
  },
];

export const defaultCity = cities[0];

export function getCityById(id: string): CityConfig | undefined {
  return cities.find((city) => city.id === id);
}

/** Resolves a ticket code ("GWL") back to its city. */
export function getCityByCode(code: string): CityConfig | undefined {
  const upper = code.toUpperCase();
  return cities.find((city) => city.code === upper);
}

export function getCityCode(cityId: string): string {
  return getCityById(cityId)?.code ?? defaultCity.code;
}

/** Display label for a complaint card's city badge. */
export function getCityLabel(cityId: string): string {
  const city = getCityById(cityId);
  return city ? `${city.name}, ${city.state}` : cityId;
}
