const HIDDEN_AUTH_STORAGE_KEY = 'assure_hidden_auth_access_v1';
const HIDDEN_AUTH_PASSWORD_HASH = '050859e27e896ddf83679c9fffa9831762d0ec6b969aebca88a15aa001a1f9a4';

async function sha256Hex(input) {
  if (!window.crypto?.subtle) return '';
  const bytes = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyHiddenAuthPassword(password) {
  const digest = await sha256Hex((password || '').trim());
  return digest === HIDDEN_AUTH_PASSWORD_HASH;
}

export function unlockHiddenAuthGate() {
  try {
    sessionStorage.setItem(HIDDEN_AUTH_STORAGE_KEY, '1');
  } catch (_) {
    // no-op if storage is unavailable
  }
}

export function isHiddenAuthGateUnlocked() {
  try {
    return sessionStorage.getItem(HIDDEN_AUTH_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}
