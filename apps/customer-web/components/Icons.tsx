type P = { className?: string };
const base = (cls?: string) => ({ className: cls || 'h-5 w-5', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });
export const IconSearch = (p: P) => <svg {...base(p.className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const IconCart = (p: P) => <svg {...base(p.className)}><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7" /><circle cx="9.5" cy="20" r="1.3" /><circle cx="17.5" cy="20" r="1.3" /></svg>;
export const IconUser = (p: P) => <svg {...base(p.className)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.2-4 4.2-6 8-6s6.8 2 8 6" /></svg>;
export const IconHeart = (p: P) => <svg {...base(p.className)}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>;
export const IconBell = (p: P) => <svg {...base(p.className)}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
export const IconMenu = (p: P) => <svg {...base(p.className)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const IconClose = (p: P) => <svg {...base(p.className)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconSun = (p: P) => <svg {...base(p.className)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const IconMoon = (p: P) => <svg {...base(p.className)}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></svg>;
export const IconChevron = (p: P) => <svg {...base(p.className)}><path d="m9 6 6 6-6 6" /></svg>;
export const IconBack = (p: P) => <svg {...base(p.className)}><path d="m15 6-6 6 6 6" /></svg>;
export const IconPackage = (p: P) => <svg {...base(p.className)}><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></svg>;
export const IconTruck = (p: P) => <svg {...base(p.className)}><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>;
export const IconCheck = (p: P) => <svg {...base(p.className)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IconAlert = (p: P) => <svg {...base(p.className)}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>;
export const IconPlus = (p: P) => <svg {...base(p.className)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconMinus = (p: P) => <svg {...base(p.className)}><path d="M5 12h14" /></svg>;
export const IconTrash = (p: P) => <svg {...base(p.className)}><path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13" /></svg>;
export const IconPin = (p: P) => <svg {...base(p.className)}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></svg>;
/** The S Mart logo: the official mark (from the brand's profile picture), shown as an image, never redrawn. */
export const IconLogo = ({ className }: P) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/brand/logo-mark.png" alt="" aria-hidden="true" className={className || 'h-8 w-auto'} />
);