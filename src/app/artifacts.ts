import * as fs from "node:fs";
import * as path from "node:path";
import { loadRunManifest, saveRunManifest, type RunArtifactRecord } from "./cache";

export interface WriteRunArtifactOptions {
  name: string;
  extension: string;
  content: string;
}

export function writeRunArtifact(runDir: string, opts: WriteRunArtifactOptions): string {
  const artifactsDir = path.join(runDir, "artifacts");
  fs.mkdirSync(artifactsDir, { recursive: true });

  const fileName = `${opts.name}.${opts.extension}`;
  const artifactPath = path.join(artifactsDir, fileName);

  fs.writeFileSync(artifactPath, opts.content, "utf-8");

  const manifest = loadRunManifest(runDir);
  const artifactRecord: RunArtifactRecord = {
    fileName,
    relativePath: path.join("artifacts", fileName),
    format: opts.extension,
  };

  manifest.artifacts[opts.name] = artifactRecord;
  saveRunManifest(runDir, manifest);

  return artifactPath;
}

export function exportRunArtifact(runDir: string, artifactName: string, destinationPath: string): string {
  if (!destinationPath.trim()) {
    throw new Error("An explicit destination path is required for export.");
  }

  const manifest = loadRunManifest(runDir);
  const artifact = manifest.artifacts[artifactName];
  if (!artifact) {
    throw new Error(`Unknown artifact '${artifactName}'.`);
  }

  const sourcePath = path.join(runDir, artifact.relativePath);
  const resolvedDestination = path.resolve(destinationPath);

  fs.mkdirSync(path.dirname(resolvedDestination), { recursive: true });
  fs.copyFileSync(sourcePath, resolvedDestination);

  return resolvedDestination;
}
