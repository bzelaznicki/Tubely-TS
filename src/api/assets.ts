import { existsSync, mkdirSync } from "fs";
import * as path from "path";

import type { ApiConfig } from "../config";
import { randomBytes } from "crypto";

interface Stream {
  width: number;
  height: number;
}

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

export function getFileName(fileExtension: string){
  const filePrefix = randomBytes(32).toString("base64url");
  return `${filePrefix}.${fileExtension}`;
}

export async function getVideoAspectRatio(filePath: string){
  const ffprobe = Bun.spawn(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", filePath]);

  const videoData = await new Response(ffprobe.stdout).text();
  if (await ffprobe.exited !== 0){
    throw new Error(`Failed to decode file: ${videoData}`);
  }
  try {
  const { streams }: { streams: Stream[] } = JSON.parse(videoData);

  return getAspectRatio(streams[0].width, streams[0].height);
  } catch (error){
    throw new Error("Could not parse ffprobe output as JSON.");
  }
}


export function getAspectRatio(width: number, height: number): string {
  const ratio = width / height;
  const LANDSCAPE = 16 / 9;
  const PORTRAIT = 9 / 16;

  let aspectRatio = "other";

  if(Math.abs(ratio - LANDSCAPE) < 0.05){
    aspectRatio = "landscape";
  } else if (Math.abs(ratio - PORTRAIT) < 0.05){
    aspectRatio = "portrait";
  }

  return aspectRatio;
}

export async function processVideoForFastStart(inputFilePath: string){
  const outputFilePath = `${inputFilePath}.processed`;

  const ffmpeg = Bun.spawn(["ffmpeg", "-i", inputFilePath, "-movflags", "faststart", "-map_metadata", "0", "-codec", "copy", "-f", "mp4", outputFilePath],
    {
      stdout: "pipe",
      stderr: "pipe",
    },);
  const errorText = await new Response(ffmpeg.stderr).text();

  const exitCode = await ffmpeg.exited;

  if (exitCode !== 0){
    throw new Error(`ffmpeg error: ${errorText}`);
  }
  return outputFilePath;
}