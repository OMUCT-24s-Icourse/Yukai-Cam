import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4175);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const publicFiles = new Set(['index.html', 'style.css', 'app.js', 'assets/missing-poster.png', 'assets/favicon.svg', 'assets/yukai-chan.png', 'assets/school-corridor.jpg', 'assets/school-classroom.jpg']);
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const name = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!publicFiles.has(name)) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(500); res.end('Could not load file'); }
}).listen(port, '127.0.0.1', () => console.log(`Yukai Camera: http://127.0.0.1:${port}`));
