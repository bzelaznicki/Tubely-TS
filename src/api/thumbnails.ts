import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();

  const file = formData.get("thumbnail");

  if (!(file instanceof File)) {
    throw new BadRequestError("Invalid thumbnail file");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;

  const fileSize = file.size;

  if (fileSize > MAX_UPLOAD_SIZE){
    throw new BadRequestError("File too large");
  }

  const mediaType = file.type;

  const fileBuffer = await file.arrayBuffer();


  let videoDetails = getVideo(cfg.db, videoId);

  if (!videoDetails){
    throw new NotFoundError("Video not found");
  }

  if (videoDetails.userID !== userID){
    throw new UserForbiddenError("Not the owner of the video");
  }

  const fileType = file.type;

  const fileExtension = fileType.split("/")[1];

  const fileName = `${videoId}.${fileExtension}`;

  const filePath = path.join(cfg.assetsRoot, fileName);

  await Bun.write(filePath, fileBuffer);

  const thumbnailUrl = `http://localhost:${cfg.port}/assets/${fileName}`;


  videoDetails.thumbnailURL = thumbnailUrl;
  updateVideo(cfg.db, videoDetails);


  return respondWithJSON(200, videoDetails);
}
