/**
 * Shared content rail — full width with only a small side gutter.
 * Header, hero, and sections MUST share this so logo ↔ content ↔ CTAs align.
 */
export const MARKETING_GUTTER = { xs: 2, sm: 2.5, md: 3, lg: 3.5 }; // 16–28px

export const marketingShellSx = {
  width: '100%',
  maxWidth: '100%',
  mx: 'auto',
  px: MARKETING_GUTTER,
  boxSizing: 'border-box',
};
