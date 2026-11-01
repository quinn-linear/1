import type { ReactNode } from "react";

/** Small stroke icons for the dock: one 24px grid, 1.75 stroke, rounded, so they read as one set. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

export const ChevronLeft = () => (
  <Icon>
    <path d="m14.5 6-6 6 6 6" />
  </Icon>
);
export const ChevronRight = () => (
  <Icon>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
);
export const ShareIcon = () => (
  <Icon>
    <path d="M12 15V4" />
    <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </Icon>
);
export const SoundOn = () => (
  <Icon>
    <path d="M4 10v4h3.5l4.5 3.5v-11L7.5 10H4Z" />
    <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M18 7a7 7 0 0 1 0 10" />
  </Icon>
);
export const SoundOff = () => (
  <Icon>
    <path d="M4 10v4h3.5l4.5 3.5v-11L7.5 10H4Z" />
    <path d="m16 9.5 4 5" />
    <path d="m20 9.5-4 5" />
  </Icon>
);
export const EnterFullscreen = () => (
  <Icon>
    <path d="M4 9V5a1 1 0 0 1 1-1h4" />
    <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
    <path d="M4 15v4a1 1 0 0 0 1 1h4" />
    <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
  </Icon>
);
export const ExitFullscreen = () => (
  <Icon>
    <path d="M9 4v4a1 1 0 0 1-1 1H4" />
    <path d="M15 4v4a1 1 0 0 0 1 1h4" />
    <path d="M9 20v-4a1 1 0 0 0-1-1H4" />
    <path d="M15 20v-4a1 1 0 0 1 1-1h4" />
  </Icon>
);
export const CloseX = () => (
  <Icon>
    <path d="m6 6 12 12" />
    <path d="m18 6-12 12" />
  </Icon>
);
