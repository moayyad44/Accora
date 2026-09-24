import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/**
 * Serves the built React SPA (with a history-API fallback to index.html,
 * since the app uses BrowserRouter) and proxies /api/* to the NestJS
 * server — the exact same shape as the Vite dev proxy in
 * apps/web/vite.config.ts, so the same production build works unmodified
 * whether it's served by `vite preview` or by this Electron-bundled server.
 */
export function startStaticServer(options: {
  webDistDir: string;
  apiPort: number;
  staticPort: number;
}): Promise<http.Server> {
  const { webDistDir, apiPort, staticPort } = options;

  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";

    if (url.startsWith("/api")) {
      const proxyReq = http.request(
        {
          host: "127.0.0.1",
          port: apiPort,
          path: url.replace(/^\/api/, "") || "/",
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      proxyReq.on("error", (err) => {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Backend unavailable", error: String(err) }));
      });
      req.pipe(proxyReq);
      return;
    }

    const requestedPath = url.split("?")[0];
    let filePath = path.join(webDistDir, decodeURIComponent(requestedPath));
    if (!filePath.startsWith(webDistDir)) {
      filePath = webDistDir;
    }

    fs.stat(filePath, (err, stats) => {
      const finalPath = !err && stats.isFile() ? filePath : path.join(webDistDir, "index.html");
      const ext = path.extname(finalPath);
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream" });
      fs.createReadStream(finalPath).pipe(res);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(staticPort, "127.0.0.1", () => resolve(server));
  });
}
