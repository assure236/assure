import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout/Layout';

// Pages
import Login from './pages/Auth/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Users from './pages/Users/Users';
import ChitGroups from './pages/ChitGroups/ChitGroups';
import CreateChitGroup from './pages/ChitGroups/CreateChitGroup';
import ChitGroupDetail from './pages/ChitGroups/ChitGroupDetail';
import Auctions from './pages/Auctions/Auctions';
import Payments from './pages/Payments/Payments';
import Reports from './pages/Reports/Reports';
import Settings from './pages/Settings/Settings';
import Accounting from './pages/Accounting/Accounting';
import Defaulters from './pages/Defaulters/Defaulters';
import Documents from './pages/Documents/Documents';
import Communications from './pages/Communications/Communications';
import Branches from './pages/Branches/Branches';
import Support from './pages/Support/Support';
import Disbursals from './pages/Disbursals/Disbursals';
import PushNotifications from './pages/PushNotifications/PushNotifications';

const theme = createTheme({
  palette: {
    primary: {
      main: '#0B1F3B',
      light: '#1E3A8A',
      dark: '#071428',
      50: '#E8EDF5',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#D4AF37',
      light: '#E3C668',
      dark: '#B8960F',
      contrastText: '#0B1F3B',
    },
    success: { main: '#16A34A' },
    error: { main: '#DC2626' },
    warning: { main: '#F59E0B' },
    info: { main: '#1E3A8A' },
    background: {
      default: '#F8F9FB',
      paper: '#ffffff',
    },
    text: {
      primary: '#0B1F3B',
      secondary: '#475569',
    },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        containedPrimary: { '&:hover': { backgroundColor: '#1E3A8A' } },
        containedSecondary: { color: '#0B1F3B', '&:hover': { backgroundColor: '#E3C668' } },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 1px 3px rgba(11,31,59,0.08), 0 1px 2px rgba(11,31,59,0.06)' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(11,31,59,0.1)' },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/chit-groups" element={<ChitGroups />} />
              <Route path="/chit-groups/create" element={<CreateChitGroup />} />
              <Route path="/chit-groups/:id" element={<ChitGroupDetail />} />
              <Route path="/auctions" element={<Auctions />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              {/* New pages */}
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/defaulters" element={<Defaulters />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/communications" element={<Communications />} />
              <Route path="/push-notifications" element={<PushNotifications />} />
              <Route path="/branches" element={<Branches />} />
              <Route path="/support" element={<Support />} />
              <Route path="/disbursals" element={<Disbursals />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
        <ToastContainer position="top-right" autoClose={3000} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
