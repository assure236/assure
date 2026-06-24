import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // SECURITY FIX: keep existing process.env.REACT_APP_* usage without exposing server-only secrets.
    define: {
      'process.env': JSON.stringify({
        ...env,
        NODE_ENV: mode === 'production' ? 'production' : 'development',
      }),
    },
    build: {
      sourcemap: false,
    },
  };
});
