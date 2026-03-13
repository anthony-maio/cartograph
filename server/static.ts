import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Try multiple resolution strategies
  const candidates = [
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(__dirname, "public"),
    path.resolve(__dirname, "..", "dist", "public"),
  ];

  let distPath: string | null = null;
  for (const candidate of candidates) {
    console.log(`[static] Checking: ${candidate} -> exists: ${fs.existsSync(candidate)}`);
    if (fs.existsSync(candidate)) {
      distPath = candidate;
      break;
    }
  }

  if (!distPath) {
    console.error(`[static] cwd: ${process.cwd()}`);
    console.error(`[static] __dirname: ${__dirname}`);
    try {
      console.error(`[static] cwd contents: ${fs.readdirSync(process.cwd()).join(", ")}`);
      const distDir = path.resolve(process.cwd(), "dist");
      if (fs.existsSync(distDir)) {
        console.error(`[static] dist/ contents: ${fs.readdirSync(distDir).join(", ")}`);
      }
    } catch {}
    throw new Error(`Could not find build directory. Tried: ${candidates.join(", ")}`);
  }

  console.log(`[static] Serving from: ${distPath}`);
  console.log(`[static] Contents: ${fs.readdirSync(distPath).join(", ")}`);

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
