/**
 * Shared content rail for marketing pages.
 * Header, hero, and sections share these edges so logo ↔ content ↔ CTAs align.
 * Wide rail with only a small left/right gutter — not a narrow centered column.
 */
export const MARKETING_MAX = 1760;

export const marketingShellSx = {
  maxWidth: MARKETING_MAX,
  width: '100%',
  mx: 'auto',
  px: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
};
