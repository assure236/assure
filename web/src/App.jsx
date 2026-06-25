import React, { lazy, Suspense } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import 'react-toastify/dist/ReactToastify.css';
import { getApiBaseUrl } from './config/env';
import { setupAxiosInterceptors } from './utils/setupAxios';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { ActiveMemberProvider } from './context/ActiveMemberContext';

// Eagerly loaded (always needed on first paint)
import Login from './pages/Auth/Login';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout/Layout';
import OnboardingGuard from './components/OnboardingGuard';
import AuthSessionWatcher from './components/AuthSessionWatcher';

// Lazy-loaded pages (code-split for smaller initial bundle)
const Register = lazy(() => import('./pages/Auth/Register'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const TotalInvestment = lazy(() => import('./pages/Dashboard/TotalInvestment'));
const ChitGroups = lazy(() => import('./pages/ChitGroups/ChitGroups'));
const ChitGroupDetails = lazy(() => import('./pages/ChitGroups/ChitGroupDetails'));
const ChitHistory = lazy(() => import('./pages/ChitGroups/ChitHistory'));
const Auctions = lazy(() => import('./pages/Auctions/Auctions'));
const AuctionRoom = lazy(() => import('./pages/Auctions/AuctionRoom'));
const Payments = lazy(() => import('./pages/Payments/Payments'));
const Profile = lazy(() => import('./pages/Profile/Profile'));
const Documents = lazy(() => import('./pages/Documents/Documents'));
const Referrals = lazy(() => import('./pages/Referrals/Referrals'));
const Help = lazy(() => import('./pages/Help/Help'));
const Notifications = lazy(() => import('./pages/Notifications/Notifications'));
const Analytics = lazy(() => import('./pages/Analytics/Analytics'));
const FamilyMembers = lazy(() => import('./pages/FamilyMembers/FamilyMembers'));
const Loans = lazy(() => import('./pages/Loans/Loans'));
const Support = lazy(() => import('./pages/Support/Support'));
const Goals = lazy(() => import('./pages/Goals/Goals'));
const KYC = lazy(() => import('./pages/KYC/KYC'));
const TransferChit = lazy(() => import('./pages/ChitGroups/TransferChit'));
const CancelChit = lazy(() => import('./pages/ChitGroups/CancelChit'));
const Terms = lazy(() => import('./pages/Legal/Legal').then((m) => ({ default: m.Terms })));
const PrivacyPolicy = lazy(() => import('./pages/Legal/Legal').then((m) => ({ default: m.PrivacyPolicy })));

// Onboarding wizard (full-screen, one container per step)
const DigiLockerStep = lazy(() => import('./pages/Onboarding/DigiLockerStep'));
const FaceStep = lazy(() => import('./pages/Onboarding/FaceStep'));
const BankStep = lazy(() => import('./pages/Onboarding/BankStep'));
const ChequeStep = lazy(() => import('./pages/Onboarding/ChequeStep'));
const AddressStep = lazy(() => import('./pages/Onboarding/AddressStep'));
const DoneStep = lazy(() => import('./pages/Onboarding/DoneStep'));

// Public pages
const About = lazy(() => import('./pages/About/About'));
const Contact = lazy(() => import('./pages/Contact/Contact'));
const ChitEducation = lazy(() => import('./pages/ChitEducation/ChitEducation'));

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

// Ensure API base URL is always set (fallback for when .env is not loaded)
axios.defaults.baseURL = getApiBaseUrl();
setupAxiosInterceptors();

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
        <ActiveMemberProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthSessionWatcher />
          <OnboardingGuard>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/chit-education" element={<ChitEducation />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Onboarding wizard — full-screen, no app shell */}
            <Route path="/onboarding" element={<PrivateRoute><Navigate to="/onboarding/digilocker" replace /></PrivateRoute>} />
            <Route path="/onboarding/digilocker" element={<PrivateRoute><DigiLockerStep /></PrivateRoute>} />
            <Route path="/onboarding/face" element={<PrivateRoute><FaceStep /></PrivateRoute>} />
            <Route path="/onboarding/bank" element={<PrivateRoute><BankStep /></PrivateRoute>} />
            <Route path="/onboarding/cheque" element={<PrivateRoute><ChequeStep /></PrivateRoute>} />
            <Route path="/onboarding/address" element={<PrivateRoute><AddressStep /></PrivateRoute>} />
            <Route path="/onboarding/done" element={<PrivateRoute><DoneStep /></PrivateRoute>} />

            {/* Protected Routes */}
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/total-investment" element={<TotalInvestment />} />
              <Route path="/chit-groups" element={<ChitGroups />} />
              <Route path="/chit-groups/:id" element={<ChitGroupDetails />} />
              <Route path="/chit-groups/history/:status" element={<ChitHistory />} />
              <Route path="/auctions" element={<Auctions />} />
              <Route path="/auctions/:id" element={<AuctionRoom />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/referrals" element={<Referrals />} />
              <Route path="/family-members" element={<FamilyMembers />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/help" element={<Help />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/loans" element={<Loans />} />
              <Route path="/support" element={<Support />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/kyc" element={<KYC />} />
              <Route path="/chit-groups/transfer" element={<TransferChit />} />
              <Route path="/chit-groups/cancel" element={<CancelChit />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            </Route>

            {/* Redirect /dashboard root if not authenticated handled by PrivateRoute */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          </OnboardingGuard>
        </Router>
        </ActiveMemberProvider>
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
