import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const assetDir = path.join(repoRoot, "site", "launch", "assets");

const browserCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const assets = [
  { html: "thumbnail.html", png: "thumbnail.png", width: 1200, height: 1200 },
  { html: "gallery-01-problem.html", png: "gallery-01-problem.png", width: 1270, height: 760 },
  { html: "gallery-02-workflow.html", png: "gallery-02-workflow.png", width: 1270, height: 760 },
  { html: "gallery-03-analyze.html", png: "gallery-03-analyze.png", width: 1270, height: 760 },
  { html: "gallery-04-packet.html", png: "gallery-04-packet.png", width: 1270, height: 760 },
  { html: "gallery-05-proof.html", png: "gallery-05-proof.png", width: 1270, height: 760 },
  { html: "gallery-06-distribution.html", png: "gallery-06-distribution.png", width: 1270, height: 760 },
];

async function main() {
  const browser = await findBrowser();
  if (!browser) {
    throw new Error("Could not find Chrome or Edge for headless asset rendering.");
  }

  await mkdir(assetDir, { recursive: true });

  for (const asset of assets) {
    const htmlPath = path.join(assetDir, asset.html);
    const pngPath = path.join(assetDir, asset.png);
    const url = pathToFileURL(htmlPath).href;
    await render(browser, url, pngPath, asset.width, asset.height);
    process.stdout.write(`Rendered ${asset.png}\n`);
  }
}

async function findBrowser() {
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

function render(browser, url, outputPath, width, height) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      url,
    ];

    const child = spawn(browser, args, {
      cwd: repoRoot,
      stdio: "ignore",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Headless browser exited with code ${code} while rendering ${outputPath}`));
    });
  });
}

function pathToFileURL(filePath) {
  const resolved = path.resolve(filePath).replace(/\\/g, "/");
  return new URL(`file:///${resolved}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
