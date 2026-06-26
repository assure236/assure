/** Solid surfaces for tooltips/menus — readable text, no glass blur. */
export const solidTooltipMenuOverrides = {
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: '#475569',
        color: '#F8FAFC',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.45,
        padding: '8px 12px',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.18)',
        backdropFilter: 'none',
        maxWidth: 280,
      },
      arrow: {
        color: '#475569',
      },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        backgroundColor: '#FFFFFF',
        color: '#0B1F3B',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(11, 31, 59, 0.12)',
        backdropFilter: 'none',
      },
    },
  },
  MuiPopover: {
    styleOverrides: {
      paper: {
        backgroundColor: '#FFFFFF',
        color: '#0B1F3B',
        border: '1px solid #E2E8F0',
        backdropFilter: 'none',
      },
    },
  },
  MuiSelect: {
    styleOverrides: {
      select: {
        '&:focus': {
          backgroundColor: '#F1F5F9',
        },
      },
    },
  },
};

export const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: '#475569',
    border: '1px solid #64748B',
    borderRadius: 8,
    color: '#F8FAFC',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
  },
  labelStyle: { color: '#F1F5F9', fontWeight: 600 },
  itemStyle: { color: '#E2E8F0' },
};
