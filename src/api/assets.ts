import { existsSync, mkdirSync } from "fs";
import * as path from "path";

import type { ApiConfig } from "../config";

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}


export function getFileExtension(mediaType: string) {
  const parts = mediaType.split("/");
    if (parts.length !== 2){
      return "bin";
    }
    return parts[1];
  }


export function getAssetPath(cfg: ApiConfig, fileName: string){
  return path.join(cfg.assetsRoot, fileName);
}

export function getFileURL(cfg: ApiConfig, fileName: string) {
  return `http://localhost:${cfg.port}/assets/${fileName}`;
}