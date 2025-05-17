import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import { S3Client, type BunRequest } from "bun";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getFileExtension, getFileName, getVideoAspectRatio, processVideoForFastStart } from "./assets";
import path from "path";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const MAX_UPLOAD_SIZE = 1 << 30;

  const { videoId } = req.params as { videoId?: string};

    if (!videoId) {
      throw new BadRequestError("Invalid video ID");
    }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);
  
  let videoDetails = getVideo(cfg.db, videoId);

  if (!videoDetails){
    throw new NotFoundError("Video not found");
  }

  if (videoDetails.userID !== userID){
    throw new UserForbiddenError("Not the owner of the video");
  }

  const formData = await req.formData();

  const file = formData.get("video");

  if (!(file instanceof File)) {
    throw new BadRequestError("Invalid video file");
  }

  const fileSize = file.size;

  if (fileSize > MAX_UPLOAD_SIZE){
    throw new BadRequestError("File too large");
  }

  const mediaType = file.type;

  if (mediaType !== "video/mp4"){
    throw new BadRequestError(`Invalid file type: ${mediaType}`);
  }

  const fileBuffer = await file.arrayBuffer();


  const fileExtension = getFileExtension(mediaType);

  const fileName = getFileName(fileExtension)

  const filePath = path.join(cfg.assetsRoot, fileName);

  
  let tempFile: Bun.BunFile | null = null;
  
  try {

  await Bun.write(filePath, fileBuffer);
  
  

  const aspectRatio = await getVideoAspectRatio(filePath);

  const processedFile = await processVideoForFastStart(filePath);

  tempFile = Bun.file(processedFile);
    
  const s3FileName = `${aspectRatio}/${fileName}`

  const s3File = cfg.s3Client.file(s3FileName, {type: mediaType});

  const s3Buffer = await tempFile.arrayBuffer();

  await s3File.write(s3Buffer);




  const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${s3File.name}`;

  videoDetails.videoURL = videoURL;

  updateVideo(cfg.db, videoDetails);

  return respondWithJSON(200, videoDetails);
  } catch (error) {
    if (error instanceof Error){
      throw new BadRequestError(`Upload failed: ${error.message}`);
    }
  } finally {
  if (tempFile){
  await tempFile.delete();
  }
  }


}
