type P = { className?: string };
export const InstagramIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);
export const FacebookIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.25-1.46 1.5-1.46h1.55V4.47A20.6 20.6 0 0 0 14.3 4.3c-2.24 0-3.8 1.37-3.8 3.9v2.3H8v3h2.5V21h3Z" />
  </svg>
);
export const TikTokIcon = ({ className }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M16.6 3c.3 2.3 1.6 3.8 3.9 4v2.7a7 7 0 0 1-3.9-1.2v6.3c0 3.4-2.3 5.7-5.6 5.7A5.4 5.4 0 0 1 5.5 15c0-3.4 2.8-5.8 6.3-5.4v2.9c-1.6-.4-3.4.5-3.4 2.4 0 1.5 1.1 2.6 2.6 2.6 1.6 0 2.7-1 2.7-3.1V3h2.9Z" />
  </svg>
);
