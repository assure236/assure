const normalizeUrl = (value) => String(value || '').replace(/\/+$/, '');

const getBackendBaseUrl = (req) => {
  const fromEnv = normalizeUrl(process.env.BACKEND_URL);
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    if (req && typeof req.get === 'function') {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.get('host');
      if (host) return normalizeUrl(`${proto}://${host}`);
    }
    return '';
  }

  return `http://localhost:${process.env.PORT || 5000}`;
};

const getWebClientUrl = () => {
  const fromEnv = normalizeUrl(process.env.WEB_CLIENT_URL);
  if (fromEnv) return fromEnv;
  return process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';
};

const isLocalUrl = (url) => /(^https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(String(url || ''));

module.exports = {
  getBackendBaseUrl,
  getWebClientUrl,
  isLocalUrl,
};