import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Pages this guard does NOT redirect away from (public marketing + auth).
const ALLOWED_PATHS = [
  '/onboarding',
  '/login',
  '/register',
  '/',
  '/company',
  '/plans',
  '/auctions-info',
  '/tools',
  '/members',
  '/learn',
  '/support-center',
  '/terms',
  '/privacy-policy',
  '/about',
  '/contact',
  '/chit-education',
  '/faq',
  '/schemes',
  '/calculator',
  '/auction',
  '/refer',
];

function pathAllowed(pathname) {
  if (pathname === '/') return true;
  return ALLOWED_PATHS.some((p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`)));
}

const StepToPath = {
  digilocker: '/onboarding/digilocker',
  face_match: '/onboarding/face',
  bank: '/onboarding/bank',
  cheque: '/onboarding/cheque',
  address: '/onboarding/address',
  complete: '/onboarding/done',
};

export default function OnboardingGuard({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      setReady(true);
      return;
    }
    // Always re-check status on path changes inside /onboarding to update step.
    // For other paths, fetch once per session navigation.
    const isOnboardingPath = location.pathname.startsWith('/onboarding');
    if (fetched.current && !isOnboardingPath) {
      setReady(true);
      return;
    }
    fetched.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get('/onboarding/status');
        if (cancelled) return;
        const data = res.data?.data || {};
        if (!data.completed) {
          const target = StepToPath[data.next_step] || '/onboarding/digilocker';
          // If user is currently on an allowed (non-protected) path, leave them.
          if (!pathAllowed(location.pathname)) {
            navigate(target, { replace: true });
          } else if (location.pathname === '/onboarding' || location.pathname === '/onboarding/') {
            navigate(target, { replace: true });
          }
        } else if (location.pathname.startsWith('/onboarding') && location.pathname !== '/onboarding/done') {
          // Done — bounce to dashboard if they wander back.
          navigate('/dashboard', { replace: true });
        }
      } catch (_) {
        // ignore — let user proceed; backend will gate sensitive routes.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, loading, location.pathname, navigate]);

  if (!ready) return null;
  return children;
}
