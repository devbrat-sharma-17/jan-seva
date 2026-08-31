import '../../styles/icons.css';

// SVG icons — inline for performance, no icon-font or sprite request.
//
// Sizing is CSS-driven: every glyph is 1em square and the size token
// class sets the font-size, so icons scale fluidly with the viewport.
// A fixed px `size` prop cannot do that.
//
// Every shape carries pathLength="1", which normalises glyphs of very
// different real path lengths onto a single draw-in keyframe.

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'inherit';

interface CategoryIconProps {
  type: string;
  size?: IconSize;
  /** Trace the strokes in when the icon is revealed. */
  draw?: boolean;
  className?: string;
}

export function CategoryIcon({
  type,
  size = 'md',
  draw = false,
  className = '',
}: CategoryIconProps) {
  const svgProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: ['icon', `icon--${size}`, draw ? 'icon--draw' : '', className]
      .filter(Boolean)
      .join(' '),
    'aria-hidden': true,
    focusable: 'false' as const,
  };

  // Spread onto every shape so the draw keyframe is glyph-agnostic
  const p = { pathLength: 1 };

  switch (type) {
    case 'roads':
      return (
        <svg {...svgProps}>
          <path {...p} d="M4 19L8 5" />
          <path {...p} d="M16 5L20 19" />
          <path {...p} d="M12 6v2" />
          <path {...p} d="M12 12v2" />
          <path {...p} d="M12 18v2" />
        </svg>
      );
    case 'garbage':
      return (
        <svg {...svgProps}>
          <path {...p} d="M3 6h18" />
          <path {...p} d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path {...p} d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path {...p} d="M10 11v6" />
          <path {...p} d="M14 11v6" />
        </svg>
      );
    case 'water':
      return (
        <svg {...svgProps}>
          <path {...p} d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      );
    case 'streetlight':
      return (
        <svg {...svgProps}>
          <circle {...p} cx="12" cy="5" r="3" />
          <path {...p} d="M12 8v13" />
          <path {...p} d="M8 21h8" />
          <path {...p} d="M9 5l-4 3" />
          <path {...p} d="M15 5l4 3" />
        </svg>
      );
    case 'infrastructure':
      return (
        <svg {...svgProps}>
          <rect {...p} x="4" y="10" width="16" height="12" rx="1" />
          <path {...p} d="M12 2L2 10h20L12 2z" />
          <path {...p} d="M9 22v-5h6v5" />
          <path {...p} d="M10 14h1" />
          <path {...p} d="M14 14h1" />
        </svg>
      );
    case 'others':
      return (
        <svg {...svgProps}>
          <circle {...p} cx="12" cy="12" r="10" />
          <path {...p} d="M12 16v.01" />
          <path {...p} d="M12 8a2.5 2.5 0 0 1 0 5" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...svgProps}>
          <path {...p} d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle {...p} cx="12" cy="13" r="4" />
        </svg>
      );
    case 'analyze':
      return (
        <svg {...svgProps}>
          <path {...p} d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path {...p} d="M12 22V12" />
          <path {...p} d="M3.27 6.96L12 12l8.73-5.04" />
        </svg>
      );
    case 'route':
      return (
        <svg {...svgProps}>
          <circle {...p} cx="6" cy="19" r="3" />
          <path {...p} d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
          <circle {...p} cx="18" cy="5" r="3" />
        </svg>
      );
    case 'track':
      return (
        <svg {...svgProps}>
          <path {...p} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle {...p} cx="12" cy="10" r="3" />
        </svg>
      );
    case 'resolve':
      return (
        <svg {...svgProps}>
          <path {...p} d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path {...p} d="M22 4L12 14.01l-3-3" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...svgProps}>
          <path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'department':
      return (
        <svg {...svgProps}>
          <rect {...p} x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <path {...p} d="M8 21h8" />
          <path {...p} d="M12 17v4" />
        </svg>
      );
    default:
      return (
        <svg {...svgProps}>
          <circle {...p} cx="12" cy="12" r="10" />
        </svg>
      );
  }
}
