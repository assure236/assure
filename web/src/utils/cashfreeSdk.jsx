let loadPromise = null;

export const ensureCashfreeSdk = () => {
  if (typeof window !== 'undefined' && window.Cashfree) {
    return Promise.resolve(window.Cashfree);
  }
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => resolve(window.Cashfree);
      script.onerror = () => {
        loadPromise = null;
        reject(new Error('Failed to load Cashfree SDK'));
      };
      document.head.appendChild(script);
    });
  }
  return loadPromise;
};
