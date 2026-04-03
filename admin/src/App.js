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
      main: '#1976d2',
      50: '#e3f2fd',
    },
    secondary: {
      main: '#ff9800',
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
