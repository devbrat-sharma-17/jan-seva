interface ProcessIconProps {
  icon: string;
  size?: number;
}

export default function ProcessIcon({ icon, size = 28 }: ProcessIconProps) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (icon) {
    case 'camera':
      return (
        <svg {...props}>
          <path d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 3H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case 'analyze':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21L16.65 16.65" />
          <path d="M8 11H14" />
          <path d="M11 8V14" />
        </svg>
      );
    case 'route':
      return (
        <svg {...props}>
          <path d="M9 18L3 12L9 6" />
          <path d="M3 12H14C15.6569 12 17.2069 12.6848 18.364 13.8787C19.5211 15.0726 20.1818 16.6739 20.1818 18.3636" />
          <circle cx="20" cy="20" r="2" fill="currentColor" />
        </svg>
      );
    case 'track':
      return (
        <svg {...props}>
          <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" />
          <path d="M12 8V12" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
      );
    case 'resolve':
      return (
        <svg {...props}>
          <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85782 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" />
          <path d="M22 4L12 14.01L9 11.01" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
