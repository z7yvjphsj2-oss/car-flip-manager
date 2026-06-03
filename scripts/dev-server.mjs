import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || process.env.PORT || 5173);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = join(root, requestedPath);
  const safePath = resolve(filePath);

  if (!safePath.startsWith(root) || !existsSync(safePath) || !statSync(safePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, { 'Content-Type': mimeTypes[extname(safePath)] || 'application/octet-stream' });
  createReadStream(safePath).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`Car Flip Manager is running at http://localhost:${port}`);
});
