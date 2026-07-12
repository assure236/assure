/**
 * Side gutters: 4× the previous 16/20px → 64px / 80px (24px on small phones).
 */
export const MARKETING_GUTTER_PX = { xs: 24, sm: 64, md: 80 };

export const marketingShellSx = {
  width: '100%',
  maxWidth: '100%',
  mx: 0,
  boxSizing: 'border-box',
  pl: {
    xs: `${MARKETING_GUTTER_PX.xs}px`,
    sm: `${MARKETING_GUTTER_PX.sm}px`,
    md: `${MARKETING_GUTTER_PX.md}px`,
  },
  pr: {
    xs: `${MARKETING_GUTTER_PX.xs}px`,
    sm: `${MARKETING_GUTTER_PX.sm}px`,
    md: `${MARKETING_GUTTER_PX.md}px`,
  },
};
