import { BlobServiceClient } from '@azure/storage-blob';

// Azure Storage configuration 
const storageConfig = {
  accountName: 'lvsdemo',
  accountKey: 'XdeuQtdqeM5uCjsl8J7YUeSJOZyawhdjkc4zRVAGg+RNyveFK5lTpeFrFM0FuCxGJkYFA1bODbiC+AStA/HsgQ==',
  endpoint: 'http://lvsdemo.blob.core.windows.net',
  screenshotsContainer: 'claims-screenshots',
  videosContainer: 'claims-recordings'
};

// Create the BlobServiceClient with connection string instead of SharedKeyCredential
const createBlobServiceClient = () => {
  const connectionString = `DefaultEndpointsProtocol=http;AccountName=${storageConfig.accountName};AccountKey=${storageConfig.accountKey};EndpointSuffix=core.windows.net`;
  return BlobServiceClient.fromConnectionString(connectionString);
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
    // Create blob service client
    const blobServiceClient = createBlobServiceClient();
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(storageConfig.screenshotsContainer);
    
    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob' // Allow public read access at blob level
    });
    
    // Generate a unique blob name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blobName = `claim-${claimNumber}/call-${callId}/${timestamp}.jpg`;
    
    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Convert data URL to Blob
    const base64Data = screenshotDataUrl.split(',')[1];
    const byteArray = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    // Prepare metadata
    const blobMetadata = {
      claimNumber,
      callId,
      timestamp: metadata.timestamp || new Date().toISOString(),
      capturedBy: metadata.capturedBy || 'unknown',
      ...metadata.location && {
        latitude: metadata.location.latitude.toString(),
        longitude: metadata.location.longitude.toString(),
        accuracy: metadata.location.accuracy.toString()
      }
    };
    
    // Upload the blob
    await blockBlobClient.uploadData(blob, {
      blobHTTPHeaders: {
        blobContentType: 'image/jpeg',
      },
      metadata: blobMetadata
    });
    
    // Return the URL of the blob
    return blockBlobClient.url;
  } catch (error) {
    console.error('Error uploading screenshot to Azure:', error);
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
  // Prepare recording state
  const recordingState = {
    isRecording: false,
    startTime: null,
    mediaRecorder: null,
    recordedChunks: [],
    blobName: '',
    stopRecording: null
  };

  try {
    // Create unique recording ID and path in storage
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    recordingState.blobName = `claim-${claimNumber}/call-${callId}/${timestamp}.webm`;
    recordingState.startTime = new Date();

    // Set up MediaRecorder with WebM format 
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    recordingState.mediaRecorder = new MediaRecorder(mediaStream, options);
    
    // Collect recorded chunks
    recordingState.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordingState.recordedChunks.push(event.data);
      }
    };
    
    // Create function to stop recording and upload to Azure
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
              // Get blob from recorded chunks
              const recordedBlob = new Blob(recordingState.recordedChunks, { type: 'video/webm' });
              
              // Upload to Azure
              const blobUrl = await uploadRecordingBlob(
                claimNumber, 
                callId, 
                recordingState.blobName, 
                recordedBlob, 
                {
                  startTime: recordingState.startTime.toISOString(),
                  endTime: new Date().toISOString(),
                  duration: (new Date() - recordingState.startTime) / 1000
                }
              );
              
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
 * Upload recorded video blob to Azure Storage
 * @param {string} claimNumber - The claim number
 * @param {string} callId - The call ID
 * @param {string} blobName - The name to use for the blob
 * @param {Blob} videoBlob - The video blob to upload
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<string>} - URL of the uploaded blob
 */
async function uploadRecordingBlob(claimNumber, callId, blobName, videoBlob, metadata = {}) {
  try {
    // Create blob service client
    const blobServiceClient = createBlobServiceClient();
    
    // Get container client
    const containerClient = blobServiceClient.getContainerClient(storageConfig.videosContainer);
    
    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob' // Allow public read access at blob level
    });
    
    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    // Prepare metadata
    const blobMetadata = {
      claimNumber,
      callId,
      ...metadata
    };
    
    // Upload the blob
    await blockBlobClient.uploadData(videoBlob, {
      blobHTTPHeaders: {
        blobContentType: 'video/webm',
      },
      metadata: blobMetadata
    });
    
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