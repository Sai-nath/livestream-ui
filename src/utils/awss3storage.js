import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CopyObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// AWS Configuration - use environment variables for security
const awsConfig = {
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY
  },
  bucket: import.meta.env.VITE_AWS_S3_BUCKET
};

// Create S3 client
const createS3Client = () => {
  return new S3Client({
    region: awsConfig.region,
    credentials: awsConfig.credentials
  });
};

/**
 * Upload a file to AWS S3 with progress tracking
 * @param {string} key - The S3 object key (path/filename)
 * @param {Blob|Uint8Array} fileData - The file data to upload
 * @param {Object} options - Upload options
 * @param {string} options.contentType - MIME type of the file
 * @param {Object} options.metadata - Additional metadata for the file
 * @param {Function} options.progressCallback - Optional callback for upload progress
 * @returns {Promise<string>} - URL of the uploaded object
 */
export const uploadToS3 = async (key, fileData, options = {}) => {
  try {
    console.log("Upload attempt:", {
      key,
      contentType: options.contentType,
      dataSize: fileData.size || fileData.length
    });

    // Validate input
    if (!key || !fileData) {
      throw new Error(
        "Invalid upload parameters: key and fileData are required"
      );
    }

    // Create S3 client
    const s3Client = createS3Client();

    // Prepare upload command
    const uploadCommand = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      Body: fileData,
      ContentType: options.contentType || "application/octet-stream",
      Metadata: options.metadata || {}
    });

    // For small files (<10MB), use direct SDK upload
    if ((fileData.size || fileData.length) < 10 * 1024 * 1024) {
      await s3Client.send(uploadCommand);
      const objectUrl = `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${key}`;
      return objectUrl;
    }

    // For larger files, use presigned URL with progress tracking
    const signedUrl = await getSignedUrl(s3Client, uploadCommand, {
      expiresIn: 600 // URL valid for 10 minutes
    });

    // Use XMLHttpRequest for progress tracking
    if (options.progressCallback) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", event => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 100
            );
            options.progressCallback(percentComplete);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const objectUrl = `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${key}`;
            resolve(objectUrl);
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload aborted"));
        });

        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader(
          "Content-Type",
          options.contentType || "application/octet-stream"
        );

        // Add metadata headers if present
        if (options.metadata) {
          Object.entries(options.metadata).forEach(([key, value]) => {
            xhr.setRequestHeader(`x-amz-meta-${key}`, value.toString());
          });
        }

        xhr.send(fileData);
      });
    } else {
      // If no progress tracking needed, use fetch
      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        body: fileData,
        headers: {
          "Content-Type": options.contentType || "application/octet-stream",
          ...Object.entries(options.metadata || {}).reduce(
            (acc, [key, value]) => {
              acc[`x-amz-meta-${key}`] = value.toString();
              return acc;
            },
            {}
          )
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status: ${uploadResponse.status}`);
      }

      const objectUrl = `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${key}`;
      return objectUrl;
    }
  } catch (error) {
    console.error("Error uploading to S3:", {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Upload a screenshot to AWS S3
 * @param {string} claimNumber - The claim number associated with this session
 * @param {string} callId - The WebRTC call ID
 * @param {string} screenshotDataUrl - Screenshot data URL (base64)
 * @param {Object} metadata - Additional metadata for the screenshot
 * @param {Function} progressCallback - Optional callback for upload progress
 * @returns {Promise<string>} - URL of the uploaded screenshot
 */
export const uploadScreenshot = async (
  claimNumber,
  callId,
  screenshotDataUrl,
  metadata = {},
  progressCallback = null
) => {
  try {
    // Validate input
    if (!screenshotDataUrl) {
      throw new Error("Screenshot data URL is empty or undefined");
    }

    // Convert data URL to Blob
    const base64Prefix = "data:image/jpeg;base64,";
    if (!screenshotDataUrl.startsWith(base64Prefix)) {
      throw new Error("Invalid screenshot data URL format");
    }

    const base64Data = screenshotDataUrl.slice(base64Prefix.length);
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    // Generate unique blob name
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blobName = `screenshots/claim-${claimNumber}/call-${callId}/${timestamp}.jpg`;

    // Enhanced metadata
    const enhancedMetadata = {
      claimNumber,
      callId,
      timestamp: metadata.timestamp || new Date().toISOString(),
      capturedBy: metadata.capturedBy || "unknown",
      ...(metadata.location && {
        latitude: metadata.location.latitude.toString(),
        longitude: metadata.location.longitude.toString(),
        accuracy: metadata.location.accuracy.toString()
      })
    };

    // Upload using the generic function
    return uploadToS3(blobName, byteArray, {
      contentType: "image/jpeg",
      metadata: enhancedMetadata,
      progressCallback
    });
  } catch (error) {
    console.error("Error uploading screenshot:", error);
    throw error;
  }
};

/**
 * Upload a video recording to AWS S3
 * @param {string} claimNumber - The claim number
 * @param {string} callId - The call ID
 * @param {Blob} videoBlob - The video blob to upload
 * @param {Object} metadata - Additional metadata
 * @param {Function} progressCallback - Callback for tracking upload progress
 * @returns {Promise<string>} - URL of the uploaded recording
 */
export const uploadRecording = async (
  claimNumber,
  callId,
  videoBlob,
  metadata = {},
  progressCallback = null
) => {
  try {
    // Generate unique blob name
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const blobName = `recordings/claim-${claimNumber}/call-${callId}/${timestamp}.webm`;

    // Enhanced metadata
    const enhancedMetadata = {
      claimNumber,
      callId,
      startTime: metadata.startTime || new Date().toISOString(),
      endTime: metadata.endTime || new Date().toISOString(),
      duration: metadata.duration?.toString() || "0",
      recordedBy: metadata.recordedBy || "unknown"
    };

    // Upload using the generic function
    return uploadToS3(blobName, videoBlob, {
      contentType: "video/webm",
      metadata: enhancedMetadata,
      progressCallback
    });
  } catch (error) {
    console.error("Error uploading recording:", error);
    throw error;
  }
};

/**
 * Start recording a session to S3 storage
 * @param {string} claimNumber - The claim number associated with this session
 * @param {string} callId - The WebRTC call ID
 * @param {MediaStream} mediaStream - The MediaStream to record
 * @param {Object} options - Recording options
 * @param {Function} options.onProgressUpdate - Progress update callback
 * @returns {Object} - Recording control object
 */
export const startRecording = async (
  claimNumber,
  callId,
  mediaStream,
  options = {}
) => {
  try {
    // Create recorder instance
    const recordingState = {
      isRecording: false,
      startTime: null,
      mediaRecorder: null,
      recordedChunks: [],
      blobName: "",
      stopRecording: null
    };

    // Create unique recording ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    recordingState.blobName = `recordings/claim-${claimNumber}/call-${callId}/${timestamp}.webm`;
    recordingState.startTime = new Date();

    // Set up MediaRecorder with optimized settings
    const options = {
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    };
    recordingState.mediaRecorder = new MediaRecorder(mediaStream, options);

    // Create and show recording timer UI
    const timerElement = createRecordingTimerUI();
    document.body.appendChild(timerElement);

    // Start interval for updating timer
    const recordingInterval = setInterval(() => {
      const elapsedSeconds = Math.floor(
        (Date.now() - recordingState.startTime) / 1000
      );
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      timerElement.textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }, 1000);

    // Collect recorded chunks
    recordingState.mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        recordingState.recordedChunks.push(event.data);
      }
    };

    // Enhanced stopRecording function with upload progress
    recordingState.stopRecording = async () => {
      return new Promise((resolve, reject) => {
        try {
          if (!recordingState.isRecording) {
            resolve(null);
            return;
          }

          // Set up handler for when recording stops
          recordingState.mediaRecorder.onstop = async () => {
            try {
              // Clear timer UI
              clearInterval(recordingInterval);
              document.body.removeChild(timerElement);

              // Get blob from recorded chunks
              const recordedBlob = new Blob(recordingState.recordedChunks, {
                type: "video/webm"
              });

              // Show upload progress UI
              const progressElement = createUploadProgressUI();
              document.body.appendChild(progressElement);

              // Upload with progress tracking
              const blobUrl = await uploadRecording(
                claimNumber,
                callId,
                recordedBlob,
                {
                  startTime: recordingState.startTime.toISOString(),
                  endTime: new Date().toISOString(),
                  duration: (new Date() - recordingState.startTime) / 1000
                },
                progress => {
                  updateUploadProgress(progressElement, progress);
                  if (options.onProgressUpdate) {
                    options.onProgressUpdate(progress);
                  }
                }
              );

              // Remove progress UI when done
              document.body.removeChild(progressElement);

              recordingState.isRecording = false;
              resolve(blobUrl);
            } catch (error) {
              console.error("Error handling recording stop:", error);
              reject(error);
            }
          };

          // Stop the recorder
          recordingState.mediaRecorder.stop();
        } catch (error) {
          console.error("Error stopping recording:", error);
          reject(error);
        }
      });
    };

    // Start recording
    recordingState.mediaRecorder.start(1000); // Save in 1-second chunks
    recordingState.isRecording = true;

    return recordingState;
  } catch (error) {
    console.error("Error starting recording:", error);
    throw error;
  }
};

// UI helper functions
const createRecordingTimerUI = () => {
  const timerElement = document.createElement("div");
  timerElement.className = "recording-timer";
  timerElement.textContent = "00:00";
  timerElement.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px 12px;
    border-radius: 50px;
    font-weight: bold;
    z-index: 1000;
    font-family: monospace;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  // Add recording icon
  const recordingDot = document.createElement("div");
  recordingDot.style.cssText = `
    width: 10px;
    height: 10px;
    background-color: #ff3b30;
    border-radius: 50%;
    animation: blink 1s infinite;
  `;
  timerElement.prepend(recordingDot);

  return timerElement;
};

const createUploadProgressUI = () => {
  const element = document.createElement("div");
  element.className = "upload-progress-container";
  element.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.8);
    border-radius: 12px;
    padding: 20px;
    color: white;
    text-align: center;
    min-width: 250px;
    z-index: 2000;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  `;

  element.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 15px;">Uploading Recording</h3>
    <div class="progress-bar-container" style="
      background-color: rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      height: 10px;
      overflow: hidden;
      margin-bottom: 10px;
    ">
      <div class="progress-bar" style="
        height: 100%;
        width: 0%;
        background-color: #4cd964;
        transition: width 0.3s ease;
      "></div>
    </div>
    <div class="progress-text">0%</div>
  `;

  return element;
};

const updateUploadProgress = (element, progress) => {
  const progressBar = element.querySelector(".progress-bar");
  const progressText = element.querySelector(".progress-text");

  if (progressBar && progressText) {
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
  }
};

/**
 * Get a list of all screenshots for a specific claim
 * @param {string} claimNumber - The claim number to search for
 * @returns {Promise<Array>} - Array of screenshot metadata and URLs
 */
export const getClaimScreenshots = async claimNumber => {
  try {
    const s3Client = createS3Client();

    const listCommand = new ListObjectsV2Command({
      Bucket: awsConfig.bucket,
      Prefix: `screenshots/claim-${claimNumber}/`
    });

    const response = await s3Client.send(listCommand);

    // Process and return screenshot details with error handling
    const screenshots = await Promise.allSettled(
      (response.Contents || []).map(async item => {
        try {
          // Get object metadata
          const headCommand = new HeadObjectCommand({
            Bucket: awsConfig.bucket,
            Key: item.Key
          });

          const metadata = await s3Client.send(headCommand);

          return {
            url: `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${item.Key}`,
            name: item.Key,
            timestamp: metadata.Metadata?.timestamp || null,
            metadata: metadata.Metadata || {},
            contentLength: item.Size,
            contentType: metadata.ContentType,
            lastModified: item.LastModified
          };
        } catch (error) {
          console.warn(`Error fetching metadata for ${item.Key}:`, error);
          // Return basic info without metadata if fetch failed
          return {
            url: `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${item.Key}`,
            name: item.Key,
            contentLength: item.Size,
            lastModified: item.LastModified,
            error: error.message
          };
        }
      })
    ).then(results =>
      // Filter out failed promises and extract values from fulfilled ones
      results
        .filter(result => result.status === "fulfilled")
        .map(result => result.value)
        // Sort by timestamp (newest first)
        .sort((a, b) => {
          const dateA = a.timestamp
            ? new Date(a.timestamp)
            : new Date(a.lastModified);
          const dateB = b.timestamp
            ? new Date(b.timestamp)
            : new Date(b.lastModified);
          return dateB - dateA;
        })
    );

    return screenshots;
  } catch (error) {
    console.error("Error fetching claim screenshots:", error);
    throw error;
  }
};

/**
 * Get a list of all recordings for a specific claim
 * @param {string} claimNumber - The claim number to search for
 * @returns {Promise<Array>} - Array of recording metadata and URLs
 */
export const getClaimRecordings = async claimNumber => {
  try {
    const s3Client = createS3Client();

    const listCommand = new ListObjectsV2Command({
      Bucket: awsConfig.bucket,
      Prefix: `recordings/claim-${claimNumber}/`
    });

    const response = await s3Client.send(listCommand);

    // Process and return recording details with error handling
    const recordings = await Promise.allSettled(
      (response.Contents || []).map(async item => {
        try {
          // Get object metadata
          const headCommand = new HeadObjectCommand({
            Bucket: awsConfig.bucket,
            Key: item.Key
          });

          const metadata = await s3Client.send(headCommand);

          // Calculate duration from metadata or estimate from file size
          let duration = metadata.Metadata?.duration;
          if (!duration && item.Size) {
            // Rough estimate: 2MB per minute for WebM at medium quality
            duration = Math.round((item.Size / (2 * 1024 * 1024)) * 60);
          }

          return {
            url: `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${item.Key}`,
            name: item.Key,
            startTime: metadata.Metadata?.starttime || null,
            endTime: metadata.Metadata?.endtime || null,
            duration: duration,
            recordedBy: metadata.Metadata?.recordedby || "unknown",
            metadata: metadata.Metadata || {},
            contentLength: item.Size,
            contentType: metadata.ContentType,
            lastModified: item.LastModified
          };
        } catch (error) {
          console.warn(`Error fetching metadata for ${item.Key}:`, error);
          // Return basic info without metadata if fetch failed
          return {
            url: `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${item.Key}`,
            name: item.Key,
            contentLength: item.Size,
            lastModified: item.LastModified,
            error: error.message
          };
        }
      })
    ).then(results =>
      // Filter out failed promises and extract values from fulfilled ones
      results
        .filter(result => result.status === "fulfilled")
        .map(result => result.value)
        // Sort by timestamp (newest first)
        .sort((a, b) => {
          const dateA = a.startTime
            ? new Date(a.startTime)
            : new Date(a.lastModified);
          const dateB = b.startTime
            ? new Date(b.startTime)
            : new Date(b.lastModified);
          return dateB - dateA;
        })
    );

    return recordings;
  } catch (error) {
    console.error("Error fetching claim recordings:", error);
    throw error;
  }
};

/**
 * Generate a pre-signed URL for downloading a file
 * @param {string} key - S3 object key
 * @param {string} fileName - File name for download
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>} - Pre-signed URL
 */
export const getDownloadUrl = async (key, fileName, expiresIn = 3600) => {
  try {
    const s3Client = createS3Client();

    const command = new GetObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(
        fileName
      )}"`
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error("Error generating download URL:", error);
    throw error;
  }
};

/**
 * Delete a file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
export const deleteFile = async key => {
  try {
    const s3Client = createS3Client();

    const command = new DeleteObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key
    });

    await s3Client.send(command);
    console.log(`File deleted successfully: ${key}`);
  } catch (error) {
    console.error(`Error deleting file ${key}:`, error);
    throw error;
  }
};

/**
 * Get details of a specific file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} - File details
 */
export const getFileDetails = async key => {
  try {
    const s3Client = createS3Client();

    const command = new HeadObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key
    });

    const response = await s3Client.send(command);

    return {
      key,
      url: `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${key}`,
      metadata: response.Metadata || {},
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified
    };
  } catch (error) {
    console.error(`Error getting details for file ${key}:`, error);
    throw error;
  }
};

/**
 * Create a multipart upload for large files
 * @param {string} key - S3 object key
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Multipart upload details
 */
export const createMultipartUpload = async (key, options = {}) => {
  try {
    const s3Client = createS3Client();

    const command = new CreateMultipartUploadCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      ContentType: options.contentType || "application/octet-stream",
      Metadata: options.metadata || {}
    });

    const multipartUpload = await s3Client.send(command);

    return {
      bucket: awsConfig.bucket,
      key,
      uploadId: multipartUpload.UploadId
    };
  } catch (error) {
    console.error("Error creating multipart upload:", error);
    throw error;
  }
};

/**
 * Upload a part in a multipart upload
 * @param {Object} params - Upload parameters
 * @param {string} params.key - S3 object key
 * @param {string} params.uploadId - Multipart upload ID
 * @param {number} params.partNumber - Part number (1-10000)
 * @param {Blob|Uint8Array} params.body - Part data
 * @param {Function} params.progressCallback - Progress callback
 * @returns {Promise<Object>} - Part details including ETag
 */
export const uploadPart = async ({
  key,
  uploadId,
  partNumber,
  body,
  progressCallback
}) => {
  try {
    const s3Client = createS3Client();

    const command = new UploadPartCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body
    });

    // Get signed URL for this part
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600
    });

    // Use XMLHttpRequest for progress tracking
    if (progressCallback) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", event => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 100
            );
            progressCallback(percentComplete, partNumber);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Get ETag from response headers
            const etag = xhr.getResponseHeader("ETag");
            resolve({
              PartNumber: partNumber,
              ETag: etag
            });
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Network error during upload"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Upload aborted"));
        });

        xhr.open("PUT", signedUrl);
        xhr.send(body);
      });
    } else {
      // If no progress tracking needed, use fetch
      const response = await fetch(signedUrl, {
        method: "PUT",
        body
      });

      if (!response.ok) {
        throw new Error(`Part upload failed with status: ${response.status}`);
      }

      const etag = response.headers.get("ETag");
      return {
        PartNumber: partNumber,
        ETag: etag
      };
    }
  } catch (error) {
    console.error(`Error uploading part ${partNumber}:`, error);
    throw error;
  }
};

/**
 * Complete a multipart upload
 * @param {Object} params - Parameters
 * @param {string} params.key - S3 object key
 * @param {string} params.uploadId - Multipart upload ID
 * @param {Array} params.parts - Array of { PartNumber, ETag } objects
 * @returns {Promise<string>} - URL of the completed object
 */
export const completeMultipartUpload = async ({ key, uploadId, parts }) => {
  try {
    const s3Client = createS3Client();

    const command = new CompleteMultipartUploadCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts }
    });

    await s3Client.send(command);

    return `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${key}`;
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    throw error;
  }
};

/**
 * Abort a multipart upload
 * @param {string} key - S3 object key
 * @param {string} uploadId - Multipart upload ID
 * @returns {Promise<void>}
 */
export const abortMultipartUpload = async (key, uploadId) => {
  try {
    const s3Client = createS3Client();

    const command = new AbortMultipartUploadCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      UploadId: uploadId
    });

    await s3Client.send(command);
    console.log(`Multipart upload aborted for ${key}`);
  } catch (error) {
    console.error("Error aborting multipart upload:", error);
    throw error;
  }
};

/**
 * Upload a large file using multipart upload
 * @param {string} key - S3 object key
 * @param {File|Blob} file - File to upload
 * @param {Object} options - Upload options
 * @param {number} options.partSize - Size of each part in bytes (default: 5MB)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<string>} - URL of the uploaded object
 */
export const uploadLargeFile = async (key, file, options = {}) => {
  // Default part size: 5MB (minimum allowed by S3)
  const partSize = options.partSize || 5 * 1024 * 1024;
  const totalParts = Math.ceil(file.size / partSize);

  if (totalParts > 10000) {
    throw new Error(
      "File too large: would exceed maximum number of parts allowed (10,000)"
    );
  }

  try {
    // Start multipart upload
    const { uploadId } = await createMultipartUpload(key, {
      contentType:
        file.type || options.contentType || "application/octet-stream",
      metadata: options.metadata || {}
    });

    // Track overall progress
    let overallProgress = 0;
    const partProgresses = Array(totalParts).fill(0);

    // Upload parts in parallel with concurrency limit
    const uploadPartPromises = [];
    const concurrencyLimit = 3; // Upload 3 parts at a time
    let activeTasks = 0;
    let nextPartIndex = 0;

    const processQueue = async () => {
      while (nextPartIndex < totalParts && activeTasks < concurrencyLimit) {
        const partNumber = nextPartIndex + 1;
        const start = nextPartIndex * partSize;
        const end = Math.min(start + partSize, file.size);
        const partData = file.slice(start, end);

        activeTasks++;
        nextPartIndex++;

        // Helper to update progress
        const updateProgress = (partProgress, partNum) => {
          partProgresses[partNum - 1] = partProgress;

          // Calculate overall progress
          const totalProgress =
            partProgresses.reduce((sum, progress, idx) => {
              const partWeight =
                idx < totalParts - 1 || totalParts === 1
                  ? partSize
                  : file.size - partSize * (totalParts - 1);

              return sum + progress * partWeight;
            }, 0) / file.size;

          if (options.onProgress) {
            options.onProgress(Math.round(totalProgress * 100));
          }
        };

        // Start uploading the part
        const partPromise = uploadPart({
          key,
          uploadId,
          partNumber,
          body: partData,
          progressCallback: updateProgress
        }).finally(() => {
          activeTasks--;
          processQueue(); // Process next part when slot becomes available
        });

        uploadPartPromises.push(partPromise);
      }
    };

    // Start initial batch of uploads
    await processQueue();

    // Wait for all parts to complete
    const completedParts = await Promise.all(uploadPartPromises);

    // Sort parts by part number
    completedParts.sort((a, b) => a.PartNumber - b.PartNumber);

    // Complete the multipart upload
    return await completeMultipartUpload({
      key,
      uploadId,
      parts: completedParts
    });
  } catch (error) {
    console.error("Error in large file upload:", error);
    throw error;
  }
};

/**
 * Resume a failed multipart upload for a large file
 * @param {string} key - S3 object key
 * @param {string} uploadId - Existing upload ID
 * @param {File|Blob} file - File to upload
 * @param {Array} existingParts - Already uploaded parts
 * @param {Object} options - Upload options
 * @returns {Promise<string>} - URL of the uploaded object
 */
export const resumeMultipartUpload = async (
  key,
  uploadId,
  file,
  existingParts = [],
  options = {}
) => {
  // Implementation similar to uploadLargeFile but skips already uploaded parts
  // This would need to be implemented based on your specific requirements
  console.log("Resuming multipart upload", {
    key,
    uploadId,
    fileSize: file.size
  });

  // Logic to resume upload would go here
  // For now, we'll throw an error indicating this is not implemented yet
  throw new Error("Resume multipart upload functionality not implemented yet");
};

/**
 * Utility function to calculate optimal chunk size based on file size
 * @param {number} fileSize - Size of file in bytes
 * @returns {number} - Optimal chunk size in bytes
 */
export const calculateOptimalChunkSize = fileSize => {
  // Minimum chunk size is 5MB
  const minChunkSize = 5 * 1024 * 1024;

  // S3 allows maximum 10,000 parts
  const maxParts = 10000;

  // Calculate minimum required chunk size
  const minRequiredChunkSize = Math.ceil(fileSize / maxParts);

  // Use minimum required or 5MB, whichever is larger
  let chunkSize = Math.max(minRequiredChunkSize, minChunkSize);

  // Round up to nearest MB for cleaner chunks
  const megabyte = 1024 * 1024;
  chunkSize = Math.ceil(chunkSize / megabyte) * megabyte;

  return chunkSize;
};

/**
 * Check if a file exists in S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} - Whether the file exists
 */
export const fileExists = async key => {
  try {
    const s3Client = createS3Client();

    const command = new HeadObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === "NotFound") {
      return false;
    }
    throw error;
  }
};

/**
 * Copy a file within S3
 * @param {string} sourceKey - Source object key
 * @param {string} destinationKey - Destination object key
 * @returns {Promise<string>} - URL of the new object
 */
export const copyFile = async (sourceKey, destinationKey) => {
  try {
    const s3Client = createS3Client();

    const command = new CopyObjectCommand({
      Bucket: awsConfig.bucket,
      CopySource: `${awsConfig.bucket}/${sourceKey}`,
      Key: destinationKey
    });

    await s3Client.send(command);

    return `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${destinationKey}`;
  } catch (error) {
    console.error(
      `Error copying file from ${sourceKey} to ${destinationKey}:`,
      error
    );
    throw error;
  }
};

/**
 * Get a list of S3 objects by prefix
 * @param {string} prefix - Prefix to filter by
 * @param {Object} options - Additional options
 * @param {number} options.maxItems - Maximum number of items to return
 * @param {boolean} options.includeFolders - Whether to include folder objects
 * @returns {Promise<Array>} - Array of objects
 */
export const listObjects = async (prefix, options = {}) => {
  try {
    const s3Client = createS3Client();

    const command = new ListObjectsV2Command({
      Bucket: awsConfig.bucket,
      Prefix: prefix,
      MaxKeys: options.maxItems || 1000,
      Delimiter: options.includeFolders ? undefined : "/"
    });

    const response = await s3Client.send(command);

    // Combine normal objects and "common prefixes" (folders)
    let objects = [];

    // Process regular objects
    if (response.Contents) {
      objects = response.Contents.map(item => ({
        key: item.Key,
        url: `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${item.Key}`,
        size: item.Size,
        lastModified: item.LastModified,
        type: "file"
      }));
    }

    // Process "folders" (common prefixes)
    if (response.CommonPrefixes) {
      const folders = response.CommonPrefixes.map(prefix => ({
        key: prefix.Prefix,
        type: "folder"
      }));

      objects = [...objects, ...folders];
    }

    return objects;
  } catch (error) {
    console.error(`Error listing objects with prefix ${prefix}:`, error);
    throw error;
  }
};

/**
 * Create a "folder" in S3 (empty object with trailing slash)
 * @param {string} folderPath - Folder path (must end with '/')
 * @returns {Promise<void>}
 */
export const createFolder = async folderPath => {
  try {
    // Ensure path ends with a slash
    if (!folderPath.endsWith("/")) {
      folderPath += "/";
    }

    const s3Client = createS3Client();

    const command = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: folderPath,
      Body: ""
    });

    await s3Client.send(command);
    console.log(`Folder created: ${folderPath}`);
  } catch (error) {
    console.error(`Error creating folder ${folderPath}:`, error);
    throw error;
  }
};

/**
 * Calculate the total storage usage for a prefix
 * @param {string} prefix - Prefix to calculate storage for
 * @returns {Promise<Object>} - Storage statistics
 */
export const calculateStorageUsage = async prefix => {
  try {
    const s3Client = createS3Client();

    let totalSize = 0;
    let fileCount = 0;
    let continuationToken = undefined;
    let folderCount = 0;

    // Use a loop to handle pagination
    do {
      const command = new ListObjectsV2Command({
        Bucket: awsConfig.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      });

      const response = await s3Client.send(command);

      // Calculate size of all objects in this page
      if (response.Contents) {
        for (const item of response.Contents) {
          totalSize += item.Size;

          // Count folders (objects ending with /)
          if (item.Key.endsWith("/")) {
            folderCount++;
          } else {
            fileCount++;
          }
        }
      }

      // Check if there are more objects to fetch
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return {
      totalSizeBytes: totalSize,
      totalSizeMB: totalSize / (1024 * 1024),
      fileCount,
      folderCount
    };
  } catch (error) {
    console.error(`Error calculating storage usage for ${prefix}:`, error);
    throw error;
  }
};

/**
 * Get a pre-signed URL for uploading a file directly from browser
 * @param {string} key - S3 object key
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Signed URL and upload details
 */
export const getPresignedUploadUrl = async (key, options = {}) => {
  try {
    const s3Client = createS3Client();

    const command = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      ContentType: options.contentType || "application/octet-stream",
      Metadata: options.metadata || {}
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: options.expiresIn || 3600
    });

    return {
      uploadUrl: signedUrl,
      key,
      bucket: awsConfig.bucket,
      region: awsConfig.region,
      finalUrl: `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${key}`
    };
  } catch (error) {
    console.error("Error generating presigned upload URL:", error);
    throw error;
  }
};

/**
 * Upload a file directly from a URL to S3
 * @param {string} sourceUrl - URL of the file to upload
 * @param {string} destinationKey - S3 object key
 * @param {Object} options - Upload options
 * @returns {Promise<string>} - URL of the uploaded object
 */
export const uploadFromUrl = async (
  sourceUrl,
  destinationKey,
  options = {}
) => {
  try {
    // Fetch the file from the URL
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file from URL: ${response.status} ${response.statusText}`
      );
    }

    // Get the file data as blob
    const fileData = await response.blob();

    // Upload to S3
    return uploadToS3(destinationKey, fileData, {
      contentType: fileData.type || options.contentType,
      metadata: options.metadata || {},
      progressCallback: options.progressCallback
    });
  } catch (error) {
    console.error(`Error uploading from URL ${sourceUrl}:`, error);
    throw error;
  }
};

/**
 * Download a file from S3 to the browser
 * @param {string} key - S3 object key
 * @param {string} filename - Filename to save as
 * @returns {Promise<void>}
 */
export const downloadFile = async (key, filename) => {
  try {
    // Get a pre-signed URL for the file
    const downloadUrl = await getDownloadUrl(key, filename);

    // Create a link and trigger download
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error(`Error downloading file ${key}:`, error);
    throw error;
  }
};

/**
 * Generate a thumbnail from video in S3
 * @param {string} videoKey - S3 object key for video
 * @param {string} thumbnailKey - S3 object key for thumbnail
 * @param {Object} options - Thumbnail options
 * @returns {Promise<string>} - URL of the thumbnail
 */
export const generateVideoThumbnail = async (
  videoKey,
  thumbnailKey,
  options = {}
) => {
  try {
    // Get a pre-signed URL for the video
    const s3Client = createS3Client();

    const getCommand = new GetObjectCommand({
      Bucket: awsConfig.bucket,
      Key: videoKey
    });

    const videoUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: 3600
    });

    // Create a video element
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";

    // Set the time to capture (default to 0 seconds)
    const captureTime = options.captureTime || 0;

    return new Promise((resolve, reject) => {
      // Set up event handlers
      video.onloadedmetadata = () => {
        // Seek to desired time
        video.currentTime = Math.min(captureTime, video.duration);
      };

      video.onseeked = async () => {
        try {
          // Create canvas for thumbnail
          const canvas = document.createElement("canvas");
          canvas.width = options.width || video.videoWidth;
          canvas.height = options.height || video.videoHeight;

          // Draw video frame to canvas
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Convert canvas to blob
          const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, "image/jpeg", options.quality || 0.8)
          );

          // Upload thumbnail to S3
          const thumbnailUrl = await uploadToS3(thumbnailKey, blob, {
            contentType: "image/jpeg",
            metadata: {
              sourceVideo: videoKey,
              captureTime: captureTime.toString(),
              width: canvas.width.toString(),
              height: canvas.height.toString()
            }
          });

          // Clean up
          video.remove();

          resolve(thumbnailUrl);
        } catch (error) {
          reject(error);
        }
      };

      video.onerror = () => {
        reject(new Error("Error loading video"));
      };

      // Start loading the video
      video.src = videoUrl;
    });
  } catch (error) {
    console.error(`Error generating thumbnail for ${videoKey}:`, error);
    throw error;
  }
};

/**
 * Batch upload multiple files to S3
 * @param {Array<Object>} files - Array of {file, key, options} objects
 * @param {Object} batchOptions - Options for the batch upload
 * @param {number} batchOptions.concurrency - Max concurrent uploads
 * @param {Function} batchOptions.onProgress - Overall progress callback
 * @param {Function} batchOptions.onFileComplete - Per-file completion callback
 * @returns {Promise<Array>} - Array of results for each file
 */
export const batchUpload = async (files, batchOptions = {}) => {
  const concurrency = batchOptions.concurrency || 3;
  const results = [];
  let completed = 0;
  let totalSize = 0;
  let uploadedSize = 0;

  // Calculate total size for progress tracking
  for (const { file } of files) {
    totalSize += file.size;
  }

  // Function to update overall progress
  const updateProgress = (fileIndex, fileProgress) => {
    const file = files[fileIndex].file;
    const fileContribution = (file.size / totalSize) * fileProgress;

    // Update uploadedSize based on file progress
    const newUploadedSize = files.reduce((sum, { file }, index) => {
      if (index < fileIndex) {
        // Completed files
        return sum + file.size;
      } else if (index === fileIndex) {
        // Current file
        return sum + file.size * (fileProgress / 100);
      }
      return sum;
    }, 0);

    uploadedSize = newUploadedSize;

    // Calculate and report overall progress
    const overallProgress = Math.round((uploadedSize / totalSize) * 100);
    if (batchOptions.onProgress) {
      batchOptions.onProgress(overallProgress, {
        completed,
        total: files.length,
        uploadedBytes: uploadedSize,
        totalBytes: totalSize
      });
    }
  };

  // Process uploads with limited concurrency
  const queue = [...files.map((file, index) => ({ ...file, index }))];
  const activeUploads = new Set();

  const processQueue = async () => {
    while (queue.length > 0 && activeUploads.size < concurrency) {
      const { file, key, options, index } = queue.shift();
      activeUploads.add(index);

      // Process individual file upload
      try {
        const progressCallback = progress => updateProgress(index, progress);

        const url = await uploadToS3(key, file, {
          ...options,
          progressCallback
        });

        results[index] = { success: true, key, url };

        if (batchOptions.onFileComplete) {
          batchOptions.onFileComplete(index, { success: true, key, url });
        }
      } catch (error) {
        console.error(`Error uploading file at index ${index}:`, error);
        results[index] = { success: false, key, error };

        if (batchOptions.onFileComplete) {
          batchOptions.onFileComplete(index, { success: false, key, error });
        }
      } finally {
        completed++;
        activeUploads.delete(index);
        processQueue(); // Process next item in queue
      }
    }
  };

  // Start initial batch of uploads
  await Promise.all(
    Array(Math.min(concurrency, files.length))
      .fill()
      .map(() => processQueue())
  );

  return results;
};
