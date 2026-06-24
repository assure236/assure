const normalizeUrl = (value) => {
  if (!value) return '';
  return value.replace(/\/+$/, '');
};

const getWindowOrigin = () => {
  if (typeof window === 'undefined') return '';
  return normalizeUrl(window.location.origin);
};

const isLocalHost = (host) => host === 'localhost' || host === '127.0.0.1';

export const getApiBaseUrl = () => {
  const envUrl = normalizeUrl(process.env.REACT_APP_API_URL);
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (isLocalHost(host)) return 'http://localhost:5000/api/v1';
    const origin = getWindowOrigin();
    if (origin) return `${origin}/api/v1`;
  }

  return 'http://localhost:5000/api/v1';
};

export const getSocketUrl = () => {
  const envUrl = normalizeUrl(process.env.REACT_APP_WS_URL);
  if (envUrl) return envUrl;
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/\/api\/v1$/, '');
};
