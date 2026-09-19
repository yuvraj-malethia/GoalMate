import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

// The client lives in /client. In development the Express server mounts Vite as
// middleware (see server/src/index.js), so there is only ever one port to open.
export default defineConfig({
  root: r('./client'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': r('./client/src'),
      '@shared': r('./shared'),
    },
  },
  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Keep the heavy editor and chart code out of the landing-page bundle.
        manualChunks: {
          editor: ['@blocknote/core', '@blocknote/react', '@blocknote/mantine', '@mantine/core'],
          charts: ['recharts'],
        },
      },
    },
  },
});
