import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 127.0.0.1 — Windows дээр `localhost` заримдаа ::1 рүү эхэлж очдог.
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        configure: (proxy) => {
          // API асаагүй / tsx watch дахин ачаалж байх үед ECONNREFUSED-ийн
          // бүтэн stack асгарахын оронд цэвэрхэн 503 JSON буцаана.
          proxy.on('error', (_err, _req, res) => {
            console.warn('[proxy] API (127.0.0.1:4000) хариу өгсөнгүй — асаагүй эсвэл дахин ачаалж байна');
            if ('writeHead' in res) {
              if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ message: 'API сервер хариу өгөхгүй байна' }));
            } else {
              res.destroy();
            }
          });
        },
      },
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
