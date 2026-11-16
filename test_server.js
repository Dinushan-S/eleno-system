/**
 * Static Asset Integrity & Local Server Verification
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseDir = __dirname;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(baseDir, reqPath.replace(/^\//, ''));

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`File not found: ${reqPath}`);
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(4173, '127.0.0.1', async () => {
  console.log('HTTP Test Server active on http://127.0.0.1:4173');

  const filesToCheck = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sw.js',
    '/src/css/app.css',
    '/src/js/app.js',
    '/src/js/db.js',
    '/src/js/spi.js',
    '/src/js/map.js',
    '/src/js/weather.js',
    '/src/data/districts_sri_lanka.json',
    '/src/data/enso_baseline.json',
    '/src/assets/icon-192.png',
    '/src/assets/icon-512.png'
  ];

  let errors = 0;
  for (const uri of filesToCheck) {
    try {
      const resp = await fetch(`http://127.0.0.1:4173${uri}`);
      if (resp.status !== 200) {
        console.error(`❌ HTTP ${resp.status} for ${uri}`);
        errors++;
      } else {
        console.log(`✓ 200 OK: ${uri} (${resp.headers.get('content-type')})`);
      }
    } catch (e) {
      console.error(`❌ Fetch error for ${uri}:`, e.message);
      errors++;
    }
  }

  server.close(() => {
    if (errors === 0) {
      console.log('\n🎉 ALL STATIC ASSETS VERIFIED WITH HTTP 200!');
      process.exit(0);
    } else {
      console.error(`\n❌ Failed with ${errors} errors.`);
      process.exit(1);
    }
  });
});
