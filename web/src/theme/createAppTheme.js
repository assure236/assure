import { createTheme } from '@mui/material/styles';
import { brand } from './brand';
import { solidTooltipMenuOverrides } from './uiOverrides';

export function createAppTheme() {
  return createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: brand.navy,
        light: brand.royal,
        dark: brand.navyDeep,
        contrastText: '#ffffff',
      },
      secondary: {
        main: brand.gold,
        light: brand.goldSoft,
        dark: brand.goldDark,
        contrastText: brand.navy,
      },
      success: { main: brand.success },
      error: { main: brand.danger },
      warning: { main: brand.warning },
      info: { main: brand.info },
      background: {
        default: brand.canvas,
        paper: brand.paper,
      },
      text: {
        primary: brand.ink,
        secondary: brand.muted,
      },
      divider: brand.line,
    },
    typography: {
      fontFamily: brand.fontBody,
      h1: { fontFamily: brand.fontDisplay, fontWeight: 600, letterSpacing: '-0.02em' },
      h2: { fontFamily: brand.fontDisplay, fontWeight: 600, letterSpacing: '-0.02em' },
      h3: { fontFamily: brand.fontDisplay, fontWeight: 600, letterSpacing: '-0.015em' },
      h4: { fontFamily: brand.fontDisplay, fontWeight: 600, letterSpacing: '-0.015em', fontSize: '1.75rem' },
      h5: { fontFamily: brand.fontBody, fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontFamily: brand.fontBody, fontWeight: 700, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontFamily: brand.fontBody, fontWeight: 700, letterSpacing: '0.01em' },
      overline: {
        fontFamily: brand.fontBody,
        fontWeight: 700,
        letterSpacing: '0.12em',
        fontSize: '0.68rem',
      },
    },
    shape: { borderRadius: brand.radius },
    shadows: [
      'none',
      brand.shadowSoft,
      brand.shadowSoft,
      brand.shadowLift,
      brand.shadowLift,
      ...Array(20).fill(brand.shadowLift),
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: brand.canvas,
            color: brand.ink,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 10,
            fontWeight: 700,
            paddingInline: 18,
            paddingBlock: 9,
          },
          containedPrimary: {
            background: `linear-gradient(165deg, ${brand.navyMid} 0%, ${brand.navy} 55%, ${brand.navyDeep} 100%)`,
            '&:hover': {
              background: `linear-gradient(165deg, ${brand.royal} 0%, ${brand.navy} 100%)`,
            },
          },
          containedSecondary: {
            color: brand.navy,
            background: `linear-gradient(165deg, ${brand.goldSoft} 0%, ${brand.gold} 100%)`,
            '&:hover': { background: brand.goldDark, color: '#fff' },
          },
          outlined: {
            borderColor: brand.lineStrong,
            '&:hover': {
              borderColor: brand.navy,
              backgroundColor: 'rgba(11,31,59,0.04)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: brand.radius,
            border: `1px solid ${brand.line}`,
            boxShadow: brand.shadowSoft,
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          outlined: {
            borderColor: brand.line,
          },
          elevation1: {
            boxShadow: brand.shadowSoft,
            border: `1px solid ${brand.line}`,
          },
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: 'rgba(255,255,255,0.72)',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(11,31,59,0.28)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: brand.navy,
              borderWidth: 1.5,
            },
          },
          notchedOutline: {
            borderColor: brand.lineStrong,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 700,
            borderRadius: 8,
          },
          sizeSmall: {
            height: 24,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              fontWeight: 700,
              color: brand.muted,
              backgroundColor: 'rgba(11,31,59,0.03)',
              borderBottom: `1px solid ${brand.line}`,
              fontSize: '0.75rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: brand.line,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: 3,
            backgroundColor: brand.gold,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 700,
            minHeight: 44,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${brand.line}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${brand.line}`,
            boxShadow: brand.shadowLift,
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 99,
            backgroundColor: brand.mist,
          },
          bar: {
            borderRadius: 99,
            background: `linear-gradient(90deg, ${brand.navy}, ${brand.gold})`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      ...solidTooltipMenuOverrides,
    },
  });
}
