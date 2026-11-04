// Zero-dependency static server for the Barkada House site (supports video range requests).
// Usage: node server.mjs [--open] [--port 5173]
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const wantOpen = args.includes('--open');
let port = Number(args[args.indexOf('--port') + 1]) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.join(root, urlPath);
  if (path.relative(root, file).startsWith('..')) {
    res.writeHead(403).end();
    return;
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': ext === '.mp4' || ext === '.webp' ? 'public, max-age=86400' : 'no-cache',
    };
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      let start, end;
      if (range[1] === '') {
        start = Math.max(0, st.size - Number(range[2]));
        end = st.size - 1;
      } else {
        start = Number(range[1]);
        end = range[2] === '' ? st.size - 1 : Math.min(Number(range[2]), st.size - 1);
      }
      if (start >= st.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end();
        return;
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    }
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port < 5199) {
    port += 1;
    server.listen(port, '0.0.0.0');
  } else {
    console.error(e.message);
    process.exit(1);
  }
});

server.on('listening', () => {
  const local = `http://localhost:${port}/`;
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${port}/`);
  console.log('\n  Barkada House is running\n');
  console.log(`  On this computer:  ${local}`);
  lan.forEach((u) => console.log(`  On your phone:     ${u}   (same Wi-Fi)`));
  console.log('\n  Close this window to stop the server.\n');
  if (wantOpen) {
    const cmd = process.platform === 'win32' ? `start "" "${local}"` : process.platform === 'darwin' ? `open "${local}"` : `xdg-open "${local}"`;
    exec(cmd);
  }
});

server.listen(port, '0.0.0.0');
