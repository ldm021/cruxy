import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // El service worker cachea /assets/* con hash, asi que la invalidacion
    // depende de que Vite siga generando nombres con hash (comportamiento por defecto).
    sourcemap: false,
    rollupOptions: {
      output: {
        // El SDK de Firebase pesa mucho mas que nuestro codigo y cambia mucho
        // menos: en un chunk aparte sobrevive a cada deploy en el cache.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@firebase') || id.includes('/firebase/')) return 'firebase';
          if (id.includes('react')) return 'react';
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
