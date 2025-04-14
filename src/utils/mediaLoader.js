import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// AWS Configuration from environment variables
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

/**
 * Generate a pre-signed URL for an S3 object
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 seconds = 1 hour)
 * @returns {Promise<string>} - The pre-signed URL
 */
const getPresignedUrl = async (key, expiresIn = 3600) => {
  try {
    const s3Client = createS3Client();
    const command = new GetObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    throw error;
  }
};

/**
 * Extract S3 key from a full S3 URL
 * @param {string} url - The full S3 URL
 * @returns {string|null} - The extracted key or null if not an S3 URL
 */
const extractS3KeyFromUrl = (url) => {
  try {
    if (!url) return null;
    
    // Check if it's an S3 URL
    const bucketPattern = new RegExp(`https?://${awsConfig.bucket}\.s3\.${awsConfig.region}\.amazonaws\.com/(.+)`);
    const match = url.match(bucketPattern);
    
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting S3 key:", error);
    return null;
  }
};

// Export all functions for use in other components
export { createS3Client, awsConfig, getPresignedUrl, extractS3KeyFromUrl };
