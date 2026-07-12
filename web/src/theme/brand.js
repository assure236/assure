/** Assure ChitFunds brand tokens — shared by theme + UI kit. */
export const brand = {
  navy: '#0B1F3B',
  navyDeep: '#071428',
  navyMid: '#132A4A',
  royal: '#1E3A8A',
  gold: '#C9A227',
  goldSoft: '#E8D48A',
  goldDark: '#9A7B1A',
  ink: '#0B1F3B',
  muted: '#5B6B7C',
  line: 'rgba(11, 31, 59, 0.10)',
  lineStrong: 'rgba(11, 31, 59, 0.16)',
  paper: '#FFFFFF',
  canvas: '#F3F5F8',
  mist: '#E8EEF5',
  success: '#15803D',
  danger: '#C62828',
  warning: '#C47F0A',
  info: '#1E3A8A',
  // Fintech pair — Poppins headlines, Inter body/UI
  fontDisplay: "'Poppins', 'Helvetica Neue', Arial, sans-serif",
  fontBody: "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  shadowSoft: '0 1px 0 rgba(11,31,59,0.04), 0 12px 32px rgba(11,31,59,0.06)',
  shadowLift: '0 8px 28px rgba(11,31,59,0.10)',
  radius: 12,
  drawerWidth: 268,
};

export const fmtINR = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN')}`;
