import React, { lazy, Suspense } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import 'react-toastify/dist/ReactToastify.css';
import { getApiBaseUrl } from './config/env';
import { setupAxiosInterceptors } from './utils/setupAxios';
import { createAppTheme } from './theme/createAppTheme';
import { brand } from './theme/brand';

import { AuthProvider } from './context/AuthContext';
import { ActiveMemberProvider } from './context/ActiveMemberContext';

import Login from './pages/Auth/Login';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout/Layout';
import OnboardingGuard from './components/OnboardingGuard';
import AuthSessionWatcher from './components/AuthSessionWatcher';
import MarketingLayout from './components/marketing/MarketingLayout';
import HiddenAuthRouteGate from './components/HiddenAuthRouteGate';

const Register = lazy(() => import('./pages/Auth/Register'));
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

const DigiLockerStep = lazy(() => import('./pages/Onboarding/DigiLockerStep'));
const FaceStep = lazy(() => import('./pages/Onboarding/FaceStep'));
const BankStep = lazy(() => import('./pages/Onboarding/BankStep'));
const ChequeStep = lazy(() => import('./pages/Onboarding/ChequeStep'));
const AddressStep = lazy(() => import('./pages/Onboarding/AddressStep'));
const DoneStep = lazy(() => import('./pages/Onboarding/DoneStep'));

const Home = lazy(() => import('./pages/marketing/Home'));
const CompanyIndex = lazy(() => import('./pages/marketing/CompanyIndex'));
const OurStory = lazy(() => import('./pages/marketing/OurStory'));
const WhyAssure = lazy(() => import('./pages/marketing/WhyAssure'));
const TrustCompliance = lazy(() => import('./pages/marketing/TrustCompliance'));
const ChitPlans = lazy(() => import('./pages/marketing/ChitPlans'));
const HowChitsWork = lazy(() => import('./pages/marketing/HowChitsWork'));
const AuctionGuide = lazy(() => import('./pages/marketing/AuctionGuide'));
const Calculator = lazy(() => import('./pages/marketing/Calculator'));
const LearnHub = lazy(() => import('./pages/marketing/LearnHub'));
const MemberJourney = lazy(() => import('./pages/marketing/MemberJourney'));
const ReferEarn = lazy(() => import('./pages/marketing/ReferEarn'));
const SupportIndex = lazy(() => import('./pages/marketing/SupportIndex'));
const FaqPage = lazy(() => import('./pages/marketing/FaqPage'));
const ContactPage = lazy(() => import('./pages/marketing/ContactPage'));
const AuctionsInfo = lazy(() => import('./pages/marketing/AuctionsInfo'));
const SchemeTier = lazy(() => import('./pages/marketing/SchemeTier'));
const GroupStatus = lazy(() => import('./pages/marketing/GroupStatus'));
const Dividends = lazy(() => import('./pages/marketing/Dividends'));
const BidTips = lazy(() => import('./pages/marketing/BidTips'));
const ToolsHub = lazy(() => import('./pages/marketing/ToolsHub'));
const MembersHub = lazy(() => import('./pages/marketing/MembersHub'));
const FamilyMarketing = lazy(() => import('./pages/marketing/FamilyMarketing'));

const PageLoader = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 1.5,
      minHeight: '60vh',
    }}
  >
    <CircularProgress sx={{ color: brand.navy }} />
    <Box
      component="span"
      sx={{
        fontFamily: brand.fontDisplay,
        fontSize: 14,
        color: brand.muted,
        letterSpacing: '0.04em',
      }}
    >
      Loading Assure…
    </Box>
  </Box>
);

axios.defaults.baseURL = getApiBaseUrl();
setupAxiosInterceptors();

const theme = createAppTheme();

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
            {/* Marketing site — multi-page with hover nav dropdowns */}
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/company" element={<CompanyIndex />} />
              <Route path="/company/our-story" element={<OurStory />} />
              <Route path="/company/why-assure" element={<WhyAssure />} />
              <Route path="/company/trust" element={<TrustCompliance />} />
              <Route path="/plans" element={<ChitPlans />} />
              <Route path="/plans/starter" element={<SchemeTier />} />
              <Route path="/plans/growth" element={<SchemeTier />} />
              <Route path="/plans/prime" element={<SchemeTier />} />
              <Route path="/plans/group-status" element={<GroupStatus />} />
              <Route path="/plans/how-chits-work" element={<HowChitsWork />} />
              <Route path="/plans/auction-guide" element={<AuctionGuide />} />
              <Route path="/plans/dividends" element={<Dividends />} />
              <Route path="/plans/bid-tips" element={<BidTips />} />
              <Route path="/plans/calculator" element={<Calculator />} />
              <Route path="/auctions-info" element={<AuctionsInfo />} />
              <Route path="/tools" element={<ToolsHub />} />
              <Route path="/members" element={<MembersHub />} />
              <Route path="/members/family" element={<FamilyMarketing />} />
              <Route path="/learn" element={<LearnHub />} />
              <Route path="/learn/member-journey" element={<MemberJourney />} />
              <Route path="/learn/refer" element={<ReferEarn />} />
              <Route path="/support-center" element={<SupportIndex />} />
              <Route path="/support-center/faq" element={<FaqPage />} />
              <Route path="/support-center/contact" element={<ContactPage />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            </Route>

            {/* Legacy public URLs → new pages */}
            <Route path="/react-app.html" element={<Navigate to="/" replace />} />
            <Route path="/about" element={<Navigate to="/company/our-story" replace />} />
            <Route path="/contact" element={<Navigate to="/support-center/contact" replace />} />
            <Route path="/chit-education" element={<Navigate to="/learn" replace />} />
            <Route path="/faq" element={<Navigate to="/support-center/faq" replace />} />
            <Route path="/schemes" element={<Navigate to="/plans" replace />} />
            <Route path="/schemes/*" element={<Navigate to="/plans" replace />} />
            <Route path="/calculator" element={<Navigate to="/plans/calculator" replace />} />
            <Route path="/auction" element={<Navigate to="/auctions-info" replace />} />
            <Route path="/auction/*" element={<Navigate to="/auctions-info" replace />} />
            <Route path="/refer" element={<Navigate to="/learn/refer" replace />} />
            <Route path="/refer/*" element={<Navigate to="/learn/refer" replace />} />

            <Route path="/login" element={<HiddenAuthRouteGate><Login /></HiddenAuthRouteGate>} />
            <Route path="/register" element={<HiddenAuthRouteGate><Register /></HiddenAuthRouteGate>} />

            <Route path="/onboarding" element={<PrivateRoute><Navigate to="/onboarding/digilocker" replace /></PrivateRoute>} />
            <Route path="/onboarding/digilocker" element={<PrivateRoute><DigiLockerStep /></PrivateRoute>} />
            <Route path="/onboarding/face" element={<PrivateRoute><FaceStep /></PrivateRoute>} />
            <Route path="/onboarding/bank" element={<PrivateRoute><BankStep /></PrivateRoute>} />
            <Route path="/onboarding/cheque" element={<PrivateRoute><ChequeStep /></PrivateRoute>} />
            <Route path="/onboarding/address" element={<PrivateRoute><AddressStep /></PrivateRoute>} />
            <Route path="/onboarding/done" element={<PrivateRoute><DoneStep /></PrivateRoute>} />

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
            </Route>

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
