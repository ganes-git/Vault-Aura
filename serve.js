import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  console.log(`[Request] ${req.method} ${req.url}`);

  // Normalize and resolve path
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);

  // Guard against directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('403 Forbidden');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                 VAULTAURA LOCAL DEVELOPMENT SERVER            ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║                                                               ║
  ║  Status:    🚀 Active and Serving                             ║
  ║  Directory: ✅ dist/                                        ║
  ║  URL:       🔗 http://localhost:${PORT}                       ║
  ║                                                               ║
  ║  Press Ctrl+C inside the terminal to terminate server.         ║
  ╚═══════════════════════════════════════════════════════════════╝
  `);
});
