import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth, registerInactivityRedirect } from '../context/AuthContext';

const PUBLIC_PREFIXES = [
  '/',
  '/login',
  '/register',
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

const isPublicPath = (pathname) => {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some(
    (p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`))
  );
};

/** Keeps URL in sync when session ends (inactivity logout must land on /login immediately). */
const AuthSessionWatcher = () => {
  const { isAuthenticated, bootstrapDone } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const goLogin = () => {
      if (!isPublicPath(window.location.pathname)) {
        navigate('/login', { replace: true });
      }
    };
    registerInactivityRedirect(goLogin);
    return () => registerInactivityRedirect(null);
  }, [navigate]);

  useEffect(() => {
    if (!bootstrapDone) return;
    if (!isAuthenticated && !isPublicPath(location.pathname)) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, bootstrapDone, location.pathname, navigate]);

  return null;
};

export default AuthSessionWatcher;
