import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const files = new Map([
  ['/', { path: '../install/index.html', type: 'text/html; charset=utf-8' }],
  ['/app.js', { path: '../install/app.js', type: 'text/javascript; charset=utf-8' }],
  ['/rensa-mark-ink.png', { path: '../install/rensa-mark-ink.png', type: 'image/png' }],
]);

createServer(async (request, response) => {
  const file = request.method === 'GET' ? files.get(request.url ?? '') : undefined;
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  try {
    const body = await readFile(fileURLToPath(new URL(file.path, import.meta.url)));
    response.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Local installation page unavailable');
  }
}).listen(8000, '127.0.0.1', () => {
  process.stdout.write('Local Rensa Snap install page: http://localhost:8000\n');
});
