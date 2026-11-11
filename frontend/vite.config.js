import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcAssets = path.resolve(__dirname, '../Website-Clone/assets');
const destAssets = path.resolve(__dirname, 'public/assets');

// Sync clone assets to public/assets automatically
try {
  if (fs.existsSync(srcAssets) && !fs.existsSync(destAssets)) {
    fs.cpSync(srcAssets, destAssets, { recursive: true });
  }
} catch (err) {
  console.warn('Vite asset sync warning:', err);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'serve-clone-assets',
      configureServer(server) {
        server.middlewares.use('/assets', (req, res, next) => {
          const cleanUrl = req.url.split('?')[0].replace(/^\//, '');
          const filePath = path.join(srcAssets, decodeURIComponent(cleanUrl));
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeMap = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.svg': 'image/svg+xml',
              '.webp': 'image/webp',
              '.js': 'application/javascript',
            };
            res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
            return fs.createReadStream(filePath).pipe(res);
          }
          next();
        });
      },
    },
  ],
});
