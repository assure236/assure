import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'REACT_APP_');
  return {
    plugins: [react()],
    define: {
      'process.env': JSON.stringify({
        ...env,
        NODE_ENV: mode === 'production' ? 'production' : 'development',
      }),
    },
    build: {
      outDir: 'build',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: 'index.vite.html',
      },
    },
  };
});
