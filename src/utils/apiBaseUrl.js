/** Backend API origin. CRA inlines REACT_APP_* at build time (set in Vercel env for production). */
const PRODUCTION_API_FALLBACK = 'https://share-crop-backend-org.vercel.app';

export function getApiBaseUrl() {
  const fromEnv = (process.env.REACT_APP_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:5050';
    }
  }

  // Never use the frontend domain (sharecrop.farm) as the API host.
  return PRODUCTION_API_FALLBACK;
}
