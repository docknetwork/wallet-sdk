/**
 * Development server for the react-native webview bundle.
 * For android devices you need to run: adb reverse tcp:8080 tcp:8080
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '../public');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
  '.css': 'text/css',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const filePath = path.join(
    publicDir,
    req.url === '/' ? 'index.html' : req.url,
  );
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
  console.log(`Serving ${publicDir}`);
});
