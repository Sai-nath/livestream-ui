import { BlobServiceClient } from '@azure/storage-blob';

// Polyfill for Buffer-like functionality in browser
const base64ToArrayBuffer = (base64) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// Azure Storage configuration 
const storageConfig = {
  accountName: import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME,
  accountKey: import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_KEY,
  endpoint: import.meta.env.VITE_AZURE_STORAGE_ENDPOINT,
  screenshotsContainer: import.meta.env.VITE_AZURE_SCREENSHOTS_CONTAINER,
  videosContainer: import.meta.env.VITE_AZURE_VIDEOS_CONTAINER
};

// Create the BlobServiceClient with connection string
const createBlobServiceClient = () => {
  try {
    // Use the full endpoint URL
    const client = new BlobServiceClient(
      `${storageConfig.endpoint}`,
      {
        credential: {
          getToken: () => ({
            token: storageConfig.accountKey,
            expiresOn: new Date(Date.now() + 86400000) // 24 hours from now
          })
        }
      }
    );
    
    return client;
  } catch (error) {
    console.error('Error creating BlobServiceClient:', error);
    throw error;
  }
};

/**
 * Upload a screenshot to Azure Blob Storage
 * @param {string} claimNumber - The claim number associated with this session
 * @param {string} callId - The WebRTC call ID
 * @param {string} screenshotDataUrl - Screenshot data URL (base64)
 * @param {Object} metadata - Additional metadata for the screenshot
 * @returns {Promise<string>} - URL of the uploaded blob
 */
export const uploadScreenshot = async (claimNumber, callId, screenshotDataUrl, metadata = {}) => {
  try {
    console.log('Screenshot Upload Attempt:', {
      claimNumber,
      callId,
      screenshotDataUrlLength: screenshotDataUrl.length
    });

    // Validate input
    if (!screenshotDataUrl) {
      throw new Error('Screenshot data URL is empty or undefined');
    }

    // Create blob service client
    const blobServiceClient = createBlobServiceClient();
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(storageConfig.screenshotsContainer);
    
    // Silently handle container creation, ignore if already exists
    try {
      await containerClient.createIfNotExists({
        access: 'blob' // Allow public read access at blob level
      });
    } catch (containerError) {
      console.warn('Container likely already exists:', containerError.message);
    }
    
    // Generate a unique blob name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blobName = `claim-${claimNumber}/call-${callId}/${timestamp}.jpg`;
    
    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Convert data URL to ArrayBuffer
    const base64Prefix = 'data:image/jpeg;base64,';
    if (!screenshotDataUrl.startsWith(base64Prefix)) {
      throw new Error('Invalid screenshot data URL format');
    }
    
    const base64Data = screenshotDataUrl.slice(base64Prefix.length);
    const arrayBuffer = base64ToArrayBuffer(base64Data);
    
    console.log('ArrayBuffer created:', { 
      arrayBufferByteLength: arrayBuffer.byteLength 
    });

    // Prepare metadata
    const blobMetadata = {
      claimNumber,
      callId,
      timestamp: metadata.timestamp || new Date().toISOString(),
      capturedBy: metadata.capturedBy || 'unknown',
      ...(metadata.location && {
        latitude: metadata.location.latitude.toString(),
        longitude: metadata.location.longitude.toString(),
        accuracy: metadata.location.accuracy.toString()
      })
    };
    
    // Upload the blob
    try {
      await blockBlobClient.uploadData(arrayBuffer, {
        blobHTTPHeaders: {
          blobContentType: 'image/jpeg',
        },
        metadata: blobMetadata
      });
    } catch (uploadError) {
      console.error('Detailed upload error:', {
        message: uploadError.message,
        name: uploadError.name,
        stack: uploadError.stack
      });
      throw uploadError;
    }
    
    console.log('Screenshot uploaded successfully:', {
      blobUrl: blockBlobClient.url,
      blobName: blobName
    });

    // Return the URL of the blob
    return blockBlobClient.url;
  } catch (error) {
    console.error('Comprehensive error uploading screenshot to Azure:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Start recording a session to Azure storage
 * @param {string} claimNumber - The claim number associated with this session
 * @param {string} callId - The WebRTC call ID
 * @param {MediaStream} mediaStream - The MediaStream to record
 * @returns {Object} - Recording control object
 */
export const startRecording = async (claimNumber, callId, mediaStream) => {
  try {
    // Create recorder instances
    const recordingState = {
      isRecording: false,
      startTime: null,
      mediaRecorder: null,
      recordedChunks: [],
      blobName: '',
      stopRecording: null
    };

    // Create unique recording ID and path in storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    recordingState.blobName = `claim-${claimNumber}/call-${callId}/${timestamp}.webm`;
    recordingState.startTime = new Date();

    // Set up MediaRecorder with WebM format 
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    recordingState.mediaRecorder = new MediaRecorder(mediaStream, options);
    
    // Create and show recording timer UI
    const timerElement = createRecordingTimerUI();
    document.body.appendChild(timerElement);
    
    // Start interval for updating timer
    const recordingInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - recordingState.startTime) / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
    
    // Collect recorded chunks
    recordingState.mediaRecorder.ondataavailable = (event) => {
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
              const recordedBlob = new Blob(recordingState.recordedChunks, { type: 'video/webm' });
              
              // Show upload progress UI
              const progressElement = createUploadProgressUI();
              document.body.appendChild(progressElement);
              
              // Upload to Azure with progress tracking
              const blobUrl = await uploadRecordingWithProgress(
                claimNumber, 
                callId, 
                recordingState.blobName, 
                recordedBlob, 
                {
                  startTime: recordingState.startTime.toISOString(),
                  endTime: new Date().toISOString(),
                  duration: (new Date() - recordingState.startTime) / 1000
                },
                (progress) => updateUploadProgress(progressElement, progress)
              );
              
              // Remove progress UI when done
              document.body.removeChild(progressElement);
              
              recordingState.isRecording = false;
              resolve(blobUrl);
            } catch (error) {
              console.error('Error handling recording stop:', error);
              reject(error);
            }
          };
          
          // Stop the recorder
          recordingState.mediaRecorder.stop();
        } catch (error) {
          console.error('Error stopping recording:', error);
          reject(error);
        }
      });
    };
    
    // Start recording
    recordingState.mediaRecorder.start(1000); // Save in 1-second chunks
    recordingState.isRecording = true;
    
    return recordingState;
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
};

/**
 * Creates a recording timer UI element
 */
const createRecordingTimerUI = () => {
  const timerElement = document.createElement('div');
  timerElement.className = 'recording-timer';
  timerElement.textContent = '00:00';
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
  const recordingDot = document.createElement('div');
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

/**
 * Creates a progress UI for the upload
 */
const createUploadProgressUI = () => {
  const element = document.createElement('div');
  element.className = 'upload-progress-container';
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

/**
 * Updates the upload progress UI
 */
const updateUploadProgress = (element, progress) => {
  const progressBar = element.querySelector('.progress-bar');
  const progressText = element.querySelector('.progress-text');
  
  if (progressBar && progressText) {
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.round(progress)}%`;
  }
};

/**
 * Upload recorded video blob to Azure Storage with progress tracking
 * @param {string} claimNumber - The claim number
 * @param {string} callId - The call ID
 * @param {string} blobName - The name to use for the blob
 * @param {Blob} videoBlob - The video blob to upload
 * @param {Object} metadata - Additional metadata
 * @param {Function} progressCallback - Callback for tracking upload progress
 * @returns {Promise<string>} - URL of the uploaded blob
 */
async function uploadRecordingWithProgress(claimNumber, callId, blobName, videoBlob, metadata = {}, progressCallback = null) {
  try {
    // Create blob service client
    const blobServiceClient = createBlobServiceClient();
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(storageConfig.videosContainer);
    
    // Silently handle container creation, ignore if already exists
    try {
      await containerClient.createIfNotExists({
        access: 'blob' // Allow public read access at blob level
      });
    } catch (containerError) {
      console.warn('Container likely already exists:', containerError.message);
    }
    
    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Prepare metadata
    const blobMetadata = {
      claimNumber,
      callId,
      ...metadata
    };
    
    // Upload the blob with progress monitoring
    if (progressCallback) {
      const totalBytes = videoBlob.size;
      let uploadedBytes = 0;
      
      // Upload in chunks to track progress
      const chunkSize = 256 * 1024; // 256 KB chunks
      const totalChunks = Math.ceil(totalBytes / chunkSize);
      const blockIds = [];
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, totalBytes);
        const chunk = videoBlob.slice(start, end);
        const blockId = btoa(`block-${i.toString().padStart(6, '0')}`);
        
        await blockBlobClient.stageBlock(blockId, chunk);
        blockIds.push(blockId);
        
        uploadedBytes += (end - start);
        const progress = (uploadedBytes / totalBytes) * 100;
        progressCallback(progress);
      }
      
      await blockBlobClient.commitBlockList(blockIds, {
        blobHTTPHeaders: {
          blobContentType: 'video/webm',
        },
        metadata: blobMetadata
      });
    } else {
      // Simple upload without progress tracking
      await blockBlobClient.uploadData(videoBlob, {
        blobHTTPHeaders: {
          blobContentType: 'video/webm',
        },
        metadata: blobMetadata
      });
    }
    
    // Return the URL of the blob
    return blockBlobClient.url;
  } catch (error) {
    console.error('Error uploading recording to Azure:', error);
    throw error;
  }
}

/**
 * Get a list of all screenshots for a specific claim
 * @param {string} claimNumber - The claim number to search for
 * @returns {Promise<Array>} - Array of screenshot metadata and URLs
 */
export const getClaimScreenshots = async (claimNumber) => {
  try {
    const blobServiceClient = createBlobServiceClient();
    const containerClient = blobServiceClient.getContainerClient(storageConfig.screenshotsContainer);
    
    // List all blobs with the claim number prefix
    const prefix = `claim-${claimNumber}/`;
    const screenshots = [];
    
    // Iterate through blobs
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      const blobClient = containerClient.getBlobClient(blob.name);
      const properties = await blobClient.getProperties();
      
      screenshots.push({
        url: blobClient.url,
        name: blob.name,
        timestamp: properties.metadata?.timestamp || null,
        metadata: properties.metadata || {},
        contentLength: properties.contentLength,
        contentType: properties.contentType
      });
    }
    
    return screenshots;
  } catch (error) {
    console.error('Error fetching claim screenshots:', error);
    throw error;
  }
};

/**
 * Get a list of all recordings for a specific claim
 * @param {string} claimNumber - The claim number to search for
 * @returns {Promise<Array>} - Array of recording metadata and URLs
 */
export const getClaimRecordings = async (claimNumber) => {
  try {
    const blobServiceClient = createBlobServiceClient();
    const containerClient = blobServiceClient.getContainerClient(storageConfig.videosContainer);
    
    // List all blobs with the claim number prefix
    const prefix = `claim-${claimNumber}/`;
    const recordings = [];
    
    // Iterate through blobs
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      const blobClient = containerClient.getBlobClient(blob.name);
      const properties = await blobClient.getProperties();
      
      recordings.push({
        url: blobClient.url,
        name: blob.name,
        startTime: properties.metadata?.startTime || null,
        endTime: properties.metadata?.endTime || null,
        duration: properties.metadata?.duration || null,
        metadata: properties.metadata || {},
        contentLength: properties.contentLength,
        contentType: properties.contentType
      });
    }
    
    return recordings;
  } catch (error) {
    console.error('Error fetching claim recordings:', error);
    throw error;
  }
};