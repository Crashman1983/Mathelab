import https from "https";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "dist-pwa");
const certDir = path.join(root, ".certs");

if (!fs.existsSync(path.join(certDir, "key.pem"))) {
  console.error("Keine SSL-Zertifikate. Erstelle mit:");
  console.error("  mkdir -p .certs && openssl req -x509 -newkey rsa:2048 -keyout .certs/key.pem -out .certs/cert.pem -days 365 -nodes -subj '/CN=Dev'");
  process.exit(1);
}

const mimeTypes = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".woff2": "font/woff2",
};

const server = https.createServer(
  { key: fs.readFileSync(path.join(certDir, "key.pem")), cert: fs.readFileSync(path.join(certDir, "cert.pem")) },
  (req, res) => {
    const url = req.url.split("?")[0];
    const filePath = path.join(dir, url === "/" ? "/index.html" : url);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(dir, "index.html"), (_e, d) => { res.writeHead(200, { "Content-Type": "text/html" }); res.end(d); });
        return;
      }
      if (url.endsWith("sw.js")) res.setHeader("Service-Worker-Allowed", "/");
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
      res.end(data);
    });
  }
);

const PORT = parseInt(process.env.PORT || "3000");
const ip = getLocalIP();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  🔢 Mathewerkstatt PWA (HTTPS)\n`);
  console.log(`  Lokal:    https://localhost:${PORT}`);
  console.log(`  Netzwerk: https://${ip}:${PORT}\n`);
  console.log(`  Beim ersten Aufruf: Zertifikatswarnung akzeptieren`);
  console.log(`  iPad: Teilen > Zum Home-Bildschirm`);
  console.log(`  Chrome: Install-Icon in der Adressleiste\n`);
});

function getLocalIP() {
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const cfg of iface) {
      if (cfg.family === "IPv4" && !cfg.internal) return cfg.address;
    }
  }
  return "0.0.0.0";
}
