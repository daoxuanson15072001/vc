/** Small inline icons (no icon font, nothing loaded from outside: CSP allows only self). */
import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false, ...p }) as const;
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor">
    {[5, 12, 19].flatMap((y) => [5, 12, 19].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.8} />))}
  </svg>
);
export const IconChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 16, height: 16, ...p })} {...stroke}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconMore = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} fill="currentColor">
    <circle cx={5} cy={12} r={1.8} />
    <circle cx={12} cy={12} r={1.8} />
    <circle cx={19} cy={12} r={1.8} />
  </svg>
);
export const IconPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 16, height: 16, ...p })} {...stroke}>
    <path d="M9 4h6l-1 6 4 4H6l4-4z" />
    <path d="M12 14v6" />
  </svg>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 16, height: 16, ...p })} {...stroke} strokeWidth={2.2}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 16, height: 16, ...p })} {...stroke}>
    <rect x={9} y={9} width={11} height={11} rx={2} />
    <path d="M5 15V5a1 1 0 0 1 1-1h10" />
  </svg>
);
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ width: 18, height: 18, ...p })} {...stroke}>
    <circle cx={12} cy={12} r={9} />
    <path d="M12 11v5M12 7.5h.01" />
  </svg>
);
export const IconLogin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} {...stroke}>
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="M10 17l5-5-5-5M15 12H3" />
  </svg>
);
