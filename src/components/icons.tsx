import type { SVGProps } from 'react';

export const SpadeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" fill="currentColor" {...props}>
    <path d="M50 5C20 40 20 60 50 95C80 60 80 40 50 5Z" />
    <path d="M45 90 H55 V100 H45Z" transform="translate(0, -5)" />
  </svg>
);

export const HeartIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" fill="currentColor" {...props}>
    <path d="M50 95L10 40C10 10 40 10 50 30C60 10 90 10 90 40L50 95Z" />
  </svg>
);

export const ClubIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" fill="currentColor" {...props}>
    <circle cx="25" cy="50" r="20" />
    <circle cx="75" cy="50" r="20" />
    <circle cx="50" cy="25" r="20" />
    <path d="M45 45 H55 V100 H45Z" transform="translate(0, -10)" />
  </svg>
);

export const DiamondIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" fill="currentColor" {...props}>
    <path d="M50 5L95 50L50 95L5 50Z" />
  </svg>
);
