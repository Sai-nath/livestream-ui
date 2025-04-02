import {
  S3Client,
  PutObjectCommand
} from "@aws-sdk/client-s3";

// AWS Configuration
const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
  bucket: import.meta.env.VITE_AWS_S3_BUCKET,
};

// Create S3 client
const createS3Client = () => {
  return new S3Client({
    region: awsConfig.region,
    credentials: awsConfig.credentials,
  });
};

// Screenshot upload function
export const uploadScreenshot = async (claimNumber, callId, screenshotDataUrl, metadata = {}, progressCallback = null) => {
  try {
    if (!screenshotDataUrl) {
      throw new Error("Screenshot data URL is empty or undefined");
    }

    // More flexible base64 image detection
    const dataUrlRegex = /^data:image\/(png|jpeg|jpg|webp);base64,/;
    const match = screenshotDataUrl.match(dataUrlRegex);

    if (!match) {
      console.error("Invalid data URL format:", screenshotDataUrl.substring(0, 50) + "...");
      throw new Error("Invalid screenshot data URL format. Expected image/jpeg, image/png, or image/webp with base64 encoding");
    }

    // Extract the base64 data after the prefix
    const base64Data = screenshotDataUrl.split(',')[1];
    if (!base64Data) {
      throw new Error("No base64 data found in data URL");
    }

    try {
      // Convert base64 to binary data
      const binaryData = atob(base64Data);
      const array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const key = `screenshots/claim-${claimNumber}/call-${callId}/${timestamp}.jpg`;

      if (progressCallback) {
        progressCallback(0);
      }

      const s3Client = createS3Client();
      const command = new PutObjectCommand({
        Bucket: awsConfig.bucket,
        Key: key,
        Body: array,
        ContentType: "image/jpeg",
        Metadata: {
          claimNumber,
          callId,
          timestamp: metadata.timestamp || new Date().toISOString(),
          capturedBy: metadata.capturedBy || "unknown",
          ...(metadata.location && {
            latitude: metadata.location.latitude.toString(),
            longitude: metadata.location.longitude.toString(),
            accuracy: metadata.location.accuracy.toString(),
          }),
        }
      });

      await s3Client.send(command);

      if (progressCallback) {
        progressCallback(100);
      }

      // Construct the S3 URL
      const objectUrl = 'https://' + awsConfig.bucket + '.s3.' + awsConfig.region + '.amazonaws.com/' + key;
      return objectUrl;

    } catch (conversionError) {
      console.error("Error processing base64 data:", conversionError);
      throw new Error("Failed to process screenshot data: " + conversionError.message);
    }
  } catch (error) {
    console.error("Error uploading screenshot:", error);
    throw error;
  }
};

// Recording upload function
export const uploadRecording = async (claimNumber, callId, videoBlob, metadata = {}, progressCallback = null) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `recordings/claim-${claimNumber}/call-${callId}/${timestamp}.webm`;

    if (progressCallback) {
      progressCallback(0);
    }

    const arrayBuffer = await videoBlob.arrayBuffer();
    const binaryData = new Uint8Array(arrayBuffer);

    const s3Client = createS3Client();
    const command = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      Body: binaryData,
      ContentType: "video/webm",
      Metadata: {
        claimNumber,
        callId,
        startTime: metadata.startTime || new Date().toISOString(),
        endTime: metadata.endTime || new Date().toISOString(),
        duration: metadata.duration ? metadata.duration.toString() : "0",
        recordedBy: metadata.recordedBy || "unknown",
      }
    });

    await s3Client.send(command);

    if (progressCallback) {
      progressCallback(100);
    }

    // Construct the S3 URL
    const objectUrl = 'https://' + awsConfig.bucket + '.s3.' + awsConfig.region + '.amazonaws.com/' + key;
    return objectUrl;

  } catch (error) {
    console.error("Error uploading recording:", error);
    throw error;
  }
};

// Document upload function
export const uploadDocument = async (claimNumber, file, category, metadata = {}, progressCallback = null) => {
  try {
    if (!file) {
      throw new Error("Document file is empty or undefined");
    }

    // Get file extension and determine content type
    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    let contentType;

    switch (fileExtension) {
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'png':
        contentType = 'image/png';
        break;
      case 'doc':
        contentType = 'application/msword';
        break;
      case 'docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
      case 'xls':
        contentType = 'application/vnd.ms-excel';
        break;
      case 'xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      default:
        contentType = 'application/octet-stream';
    }

    // Create a timestamp-based key for the file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `documents/claim-${claimNumber}/${category}/${timestamp}-${sanitizedFileName}`;

    if (progressCallback) {
      progressCallback(0);
    }

    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    const binaryData = new Uint8Array(arrayBuffer);

    const s3Client = createS3Client();
    const command = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      Body: binaryData,
      ContentType: contentType,
      Metadata: {
        claimNumber,
        category,
        fileName: sanitizedFileName,
        fileSize: file.size.toString(),
        fileType: contentType,
        uploadedBy: metadata.uploadedBy || "unknown",
        uploadTimestamp: metadata.uploadTimestamp || new Date().toISOString(),
        description: metadata.description || "",
        ...metadata
      }
    });

    await s3Client.send(command);

    if (progressCallback) {
      progressCallback(100);
    }

    // Construct the S3 URL
    const objectUrl = 'https://' + awsConfig.bucket + '.s3.' + awsConfig.region + '.amazonaws.com/' + key;
    
    return {
      url: objectUrl,
      key: key,
      fileName: sanitizedFileName,
      fileType: contentType,
      fileSize: file.size,
      category: category,
      uploadedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error("Error uploading document:", error);
    throw error;
  }
};

// Start recording function
export const startRecording = async (claimNumber, callId, mediaStream, options = {}) => {
  try {
    const videoTracks = mediaStream.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new Error("No video track available");
    }

    const mediaRecorder = new MediaRecorder(mediaStream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ?
        "video/webm;codecs=vp9,opus" :
        "video/webm",
      videoBitsPerSecond: 2500000,
    });

    const chunks = [];
    const startTime = new Date();

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.start(1000);

    return {
      async stop() {
        return new Promise((resolve, reject) => {
          mediaRecorder.onstop = async () => {
            try {
              const blob = new Blob(chunks, {
                type: "video/webm"
              });
              const url = await uploadRecording(
                claimNumber,
                callId,
                blob, {
                  startTime: startTime.toISOString(),
                  endTime: new Date().toISOString(),
                  duration: (new Date() - startTime) / 1000,
                },
                options.progressCallback
              );
              resolve(url);
            } catch (error) {
              reject(error);
            }
          };
          mediaRecorder.stop();
        });
      },
      pause() {
        mediaRecorder.pause();
      },
      resume() {
        mediaRecorder.resume();
      },
    };
  } catch (error) {
    console.error("Error starting recording:", error);
    throw error;
  }
};