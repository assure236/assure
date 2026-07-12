/**
 * Tiny side gutters only (~16–20px). No max-width cap.
 * Use BOTH sx and className `mkt-shell` so MUI cannot override padding.
 */
export const MARKETING_GUTTER_PX = { xs: 16, md: 20 };

export const marketingShellSx = {
  width: '100%',
  maxWidth: '100%',
  mx: 0,
  boxSizing: 'border-box',
  pl: { xs: `${MARKETING_GUTTER_PX.xs}px`, md: `${MARKETING_GUTTER_PX.md}px` },
  pr: { xs: `${MARKETING_GUTTER_PX.xs}px`, md: `${MARKETING_GUTTER_PX.md}px` },
};
