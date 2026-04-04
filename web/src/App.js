import React, { lazy, Suspense } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import 'react-toastify/dist/ReactToastify.css';

// Context Providers
import { AuthProvider } from './context/AuthContext';

// Eagerly loaded (always needed on first paint)
import Login from './pages/Auth/Login';
import Landing from './pages/Landing/Landing';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout/Layout';

// Lazy-loaded pages (code-split for smaller initial bundle)
const Register = lazy(() => import('./pages/Auth/Register'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const ChitGroups = lazy(() => import('./pages/ChitGroups/ChitGroups'));
const ChitGroupDetails = lazy(() => import('./pages/ChitGroups/ChitGroupDetails'));
const Auctions = lazy(() => import('./pages/Auctions/Auctions'));
const AuctionRoom = lazy(() => import('./pages/Auctions/AuctionRoom'));
const Payments = lazy(() => import('./pages/Payments/Payments'));
const Profile = lazy(() => import('./pages/Profile/Profile'));
const Documents = lazy(() => import('./pages/Documents/Documents'));
const Referrals = lazy(() => import('./pages/Referrals/Referrals'));
const Help = lazy(() => import('./pages/Help/Help'));
const Notifications = lazy(() => import('./pages/Notifications/Notifications'));
const Analytics = lazy(() => import('./pages/Analytics/Analytics'));

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

// Ensure API base URL is always set (fallback for when .env is not loaded)
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

// Theme configuration
const theme = createTheme({
  palette: {
    primary: {
      main: '#0B1F3B',
      light: '#1E3A8A',
      dark: '#071428',
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
      paper: '#ffffff'
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
    h6: { fontWeight: 600 }
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        containedPrimary: { '&:hover': { backgroundColor: '#1E3A8A' } },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 1px 3px rgba(11,31,59,0.08), 0 1px 2px rgba(11,31,59,0.06)' },
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
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Protected Routes */}
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/chit-groups" element={<ChitGroups />} />
              <Route path="/chit-groups/:id" element={<ChitGroupDetails />} />
              <Route path="/auctions" element={<Auctions />} />
              <Route path="/auctions/:id" element={<AuctionRoom />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/help" element={<Help />} />
              <Route path="/analytics" element={<Analytics />} />
            </Route>

            {/* Redirect /dashboard root if not authenticated handled by PrivateRoute */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Router>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
