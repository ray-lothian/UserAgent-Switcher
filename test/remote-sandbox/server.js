const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3030;
const ROOT = process.cwd();

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    return res.end("Method Not Allowed");
  }

  // Decode URL and remove query string
  const urlPath = decodeURIComponent(req.url.split("?")[0]);

  // Prevent path traversal
  const filePath = path.resolve(ROOT, "." + urlPath);

  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not Found");
    }

    // Serve index.html for directories
    const target = stats.isDirectory()
      ? path.join(filePath, "index.html")
      : filePath;

    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not Found");
      }

      const ext = path.extname(target).toLowerCase();
      res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");

      res.writeHead(200);

      if (req.method === "HEAD") {
        return res.end();
      }

      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`Serving ${ROOT}`);
  console.log(`http://localhost:${PORT}`);
});
