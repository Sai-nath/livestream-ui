import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FaTimes, FaPlay, FaDownload, FaExclamationCircle, FaChevronLeft, FaChevronRight, FaSpinner } from 'react-icons/fa';
import { extractS3KeyFromUrl, getPresignedUrl } from '../../utils/mediaLoader';
import './MediaViewer.css';

const MediaViewer = ({ claimId, mediaType, onClose }) => {
  const { user } = useAuth();
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  useEffect(() => {
    fetchMedia();
  }, [claimId, mediaType]);

  const [presignedUrls, setPresignedUrls] = useState({});
  const [urlsLoading, setUrlsLoading] = useState({});
  const [urlsError, setUrlsError] = useState({});

  const fetchMedia = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims/${claimId}/${mediaType}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${mediaType}: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`Loaded ${data.length} ${mediaType} items`);
      
      // Initialize presigned URLs for all media items
      const initialUrlsLoading = {};
      data.forEach(item => {
        initialUrlsLoading[item.MediaId] = true;
      });
      setUrlsLoading(initialUrlsLoading);
      
      setMediaItems(data);
      
      // Generate presigned URLs for all media items
      for (const item of data) {
        try {
          const s3Key = extractS3KeyFromUrl(item.MediaUrl);
          if (s3Key) {
            const presignedUrl = await getPresignedUrl(s3Key);
            setPresignedUrls(prev => ({
              ...prev,
              [item.MediaId]: presignedUrl
            }));
          } else {
            // If not an S3 URL, use the original URL
            setPresignedUrls(prev => ({
              ...prev,
              [item.MediaId]: item.MediaUrl
            }));
          }
        } catch (urlErr) {
          console.error(`Error generating presigned URL for ${item.MediaId}:`, urlErr);
          setUrlsError(prev => ({
            ...prev,
            [item.MediaId]: urlErr.message
          }));
        } finally {
          setUrlsLoading(prev => ({
            ...prev,
            [item.MediaId]: false
          }));
        }
      }
    } catch (err) {
      console.error(`Error fetching ${mediaType}:`, err);
      setError(`Failed to load ${mediaType}. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openLightbox = (index) => {
    setCurrentIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const navigateLightbox = (direction) => {
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < mediaItems.length) {
      setCurrentIndex(newIndex);
    }
  };

  const handleDownload = async (e, mediaUrl, mediaId) => {
    e.stopPropagation();
    
    // Prevent the click from triggering the lightbox
    e.preventDefault();
    
    // If we don't have a presigned URL yet, generate one
    if (!presignedUrls[mediaId] && !urlsLoading[mediaId]) {
      try {
        // Find the media item
        const mediaItem = mediaItems.find(item => item.MediaId === mediaId);
        if (!mediaItem) {
          throw new Error('Media item not found');
        }
        
        // Extract the S3 key and generate a presigned URL
        const s3Key = extractS3KeyFromUrl(mediaItem.MediaUrl);
        if (s3Key) {
          setUrlsLoading(prev => ({...prev, [mediaId]: true}));
          const presignedUrl = await getPresignedUrl(s3Key);
          setPresignedUrls(prev => ({...prev, [mediaId]: presignedUrl}));
          setUrlsLoading(prev => ({...prev, [mediaId]: false}));
          mediaUrl = presignedUrl;
        }
      } catch (err) {
        console.error('Error generating presigned URL for download:', err);
        setUrlsError(prev => ({...prev, [mediaId]: err.message}));
        setUrlsLoading(prev => ({...prev, [mediaId]: false}));
        alert(`Failed to generate download URL: ${err.message}`);
        return;
      }
    }
    
    try {
      // Determine file extension based on media type
      const extension = mediaType === 'videos' ? 'webm' : 'jpg';
      const filename = `${mediaType.slice(0, -1)}-${mediaId}.${extension}`;
      
      // Fetch the file using the presigned URL
      const response = await fetch(mediaUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      
      // Convert response to blob
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger download
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading media:', err);
      alert(`Failed to download: ${err.message}`);
    }
  };

  const renderVideoGrid = () => {
    return (
      <div className="media-grid video-grid">
        {mediaItems.map((item, index) => {
          const mediaId = item.MediaId;
          const isLoading = urlsLoading[mediaId];
          const hasError = urlsError[mediaId];
          const presignedUrl = presignedUrls[mediaId];
          
          return (
            <div key={mediaId} className="media-item video-item">
              <div className="video-thumbnail" onClick={() => openLightbox(index)}>
                {isLoading ? (
                  <div className="loading-overlay">
                    <FaSpinner className="spinner" />
                    <span>Loading...</span>
                  </div>
                ) : hasError ? (
                  <div className="error-overlay">
                    <FaExclamationCircle />
                    <span>Error loading video</span>
                  </div>
                ) : (
                  <>
                    <div className="video-preview">
                      <video 
                        src={presignedUrl} 
                        preload="metadata" 
                        poster="" 
                        crossOrigin="anonymous"
                        onMouseOver={(e) => {
                          e.target.play().catch(err => console.log('Preview play prevented:', err));
                        }}
                        onMouseOut={(e) => {
                          e.target.pause();
                          e.target.currentTime = 0;
                        }}
                      />
                    </div>
                    <div className="video-overlay">
                      <div className="play-button">
                        <FaPlay className="play-icon" />
                      </div>
                    </div>
                    {item.Duration && <div className="media-duration">{item.Duration}</div>}
                  </>
                )}
              </div>
              
              <div className="media-info">
                <div className="media-details">
                  <div className="media-title">Video {index + 1}</div>
                  <div className="media-timestamp">{formatDate(item.Timestamp)}</div>
                </div>
                <button 
                  className="download-button"
                  onClick={(e) => handleDownload(e, presignedUrl, mediaId)}
                  disabled={isLoading || hasError}
                  title="Download video"
                >
                  <FaDownload />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderScreenshotGrid = () => {
    return (
      <div className="media-grid screenshot-grid">
        {mediaItems.map((item, index) => {
          const mediaId = item.MediaId;
          const isLoading = urlsLoading[mediaId];
          const hasError = urlsError[mediaId];
          const presignedUrl = presignedUrls[mediaId];
          
          return (
            <div key={mediaId} className="media-item">
              <div className="screenshot-preview" onClick={() => openLightbox(index)}>
                {isLoading ? (
                  <div className="loading-overlay">
                    <FaSpinner className="spinner" />
                    <span>Loading...</span>
                  </div>
                ) : hasError ? (
                  <div className="error-overlay">
                    <FaExclamationCircle />
                    <span>Error loading screenshot</span>
                  </div>
                ) : (
                  <>
                    <img 
                      className="screenshot-thumbnail" 
                      src={presignedUrl} 
                      alt={`Screenshot ${index + 1}`}
                      loading="lazy"
                      crossOrigin="anonymous"
                    />
                    <div className="screenshot-overlay">
                      <div className="view-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" width="24" height="24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="media-info">
                <div className="media-details">
                  <div className="media-title">Screenshot {index + 1}</div>
                  <div className="media-timestamp">{formatDate(item.Timestamp)}</div>
                </div>
                <button 
                  className="download-button"
                  onClick={(e) => handleDownload(e, presignedUrl, mediaId)}
                  disabled={isLoading || hasError}
                  title="Download screenshot"
                >
                  <FaDownload />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLightbox = () => {
    if (!lightboxOpen || mediaItems.length === 0) return null;
    
    const currentItem = mediaItems[currentIndex];
    const mediaId = currentItem.MediaId;
    const isLoading = urlsLoading[mediaId];
    const hasError = urlsError[mediaId];
    const presignedUrl = presignedUrls[mediaId];
    
    return (
      <div className="lightbox">
        <div className="lightbox-overlay" onClick={closeLightbox}></div>
        <div className="lightbox-content">
          <button className="lightbox-close" onClick={closeLightbox} title="Close">
            <FaTimes />
          </button>
          
          {currentIndex > 0 && (
            <button 
              className="nav-button lightbox-prev" 
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(-1);
              }}
              title="Previous"
            >
              <FaChevronLeft />
            </button>
          )}
          
          {currentIndex < mediaItems.length - 1 && (
            <button 
              className="nav-button lightbox-next" 
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox(1);
              }}
              title="Next"
            >
              <FaChevronRight />
            </button>
          )}
          
          <div className="lightbox-media-container">
            {isLoading ? (
              <div className="lightbox-loading">
                <FaSpinner className="spinner" />
                <p>Loading secure media...</p>
              </div>
            ) : hasError ? (
              <div className="lightbox-error">
                <FaExclamationCircle size={48} />
                <p>Error loading media: {urlsError[mediaId]}</p>
                <button 
                  className="retry-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Attempt to reload the presigned URL
                    fetchMedia();
                  }}
                >
                  Try Again
                </button>
              </div>
            ) : mediaType === 'videos' ? (
              <div className="video-player-container">
                <video 
                  className="lightbox-video" 
                  controls 
                  autoPlay
                  src={presignedUrl || currentItem.MediaUrl}
                  crossOrigin="anonymous"
                  controlsList="nodownload"
                  onError={(e) => console.error('Video error:', e)}
                />
              </div>
            ) : (
              <div className="lightbox-image-container">
                <img 
                  className="lightbox-image" 
                  src={presignedUrl || currentItem.MediaUrl}
                  alt={`Media ${currentIndex + 1}`}
                  crossOrigin="anonymous"
                  onError={(e) => console.error('Image error:', e)}
                />
              </div>
            )}
          </div>
          
          <div className="lightbox-info">
            <div className="lightbox-details">
              <h3 className="lightbox-title">{mediaType === 'videos' ? 'Video' : 'Screenshot'} {currentIndex + 1}</h3>
              <div className="lightbox-timestamp">{formatDate(currentItem.Timestamp)}</div>
              {currentItem.Latitude && currentItem.Longitude && (
                <div className="lightbox-location">
                  <span>Location: {currentItem.Latitude.toFixed(6)}, {currentItem.Longitude.toFixed(6)}</span>
                </div>
              )}
            </div>
            
            <div className="lightbox-counter">
              {currentIndex + 1} of {mediaItems.length}
            </div>
          </div>
          
          <div className="lightbox-footer">
            <button 
              className="lightbox-download"
              onClick={(e) => handleDownload(e, presignedUrl || currentItem.MediaUrl, currentItem.MediaId)}
              disabled={isLoading || hasError}
              title="Download media"
            >
              <FaDownload /> Download {mediaType === 'videos' ? 'Video' : 'Screenshot'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLoading = () => (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading {mediaType}...</p>
    </div>
  );

  const renderError = () => (
    <div className="error-container">
      <FaExclamationCircle size={40} color="#e11d48" />
      <p className="error-message">{error}</p>
      <button 
        className="retry-button"
        onClick={fetchMedia}
      >
        Try Again
      </button>
    </div>
  );

  const renderEmptyState = () => (
    <div className="empty-state">
      {mediaType === 'videos' ? (
        <FaPlay className="empty-icon" />
      ) : (
        <FaDownload className="empty-icon" />
      )}
      <h3>No {mediaType} found</h3>
      <p>There are no {mediaType} available for this claim.</p>
    </div>
  );

  return (
    <div className="media-viewer">
      <div className="media-viewer-header">
        <h3>{mediaType === 'videos' ? 'Videos' : 'Screenshots'} for Claim #{claimId}</h3>
        <button className="close-button" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      
      <div className="media-viewer-content">
        {loading ? (
          renderLoading()
        ) : error ? (
          renderError()
        ) : mediaItems.length === 0 ? (
          renderEmptyState()
        ) : (
          mediaType === 'videos' ? renderVideoGrid() : renderScreenshotGrid()
        )}
      </div>
      
      {renderLightbox()}
    </div>
  );
};

export default MediaViewer;
