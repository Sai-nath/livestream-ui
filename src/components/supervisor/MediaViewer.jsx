import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  FaDownload, 
  FaPlay, 
  FaTimes, 
  FaChevronLeft, 
  FaChevronRight, 
  FaSearch,
  FaImage,
  FaVideo,
  FaExclamationCircle
} from 'react-icons/fa';
import './MediaViewer.css';

const MediaViewer = ({ claimId, mediaType, onClose }) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMedia();
  }, [claimId, mediaType]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims/${claimId}/${mediaType}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch ${mediaType}`);
      }
      
      const data = await response.json();
      
      // Sort by timestamp (newest first)
      const sortedData = [...data].sort((a, b) => 
        new Date(b.Timestamp) - new Date(a.Timestamp)
      );
      
      // Process the media URLs to use our direct download endpoint with authentication
      const processedData = sortedData.map(item => {
        return {
          ...item,
          // Create proxy URL for the media
          MediaUrl: `${import.meta.env.VITE_API_URL}/api/media/download/${item.MediaId}?token=${encodeURIComponent(user.token)}`
        };
      });
      
      setMediaItems(processedData);
    } catch (err) {
      console.error(`Error fetching ${mediaType}:`, err);
      setError(err.message);
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

  const openLightbox = (item, index) => {
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
    
    try {
      // Determine file extension based on media type
      const extension = mediaType === 'videos' ? 'mp4' : 'jpg';
      const filename = `${mediaType.slice(0, -1)}-${mediaId}.${extension}`;
      
      // We're already using the proxy URL from the MediaUrl property
      const response = await fetch(mediaUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      
      // Convert response to blob
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error(`Error downloading ${mediaType}:`, err);
      setError(`Failed to download: ${err.message}`);
    }
  };

  const renderVideoGrid = () => {
    return (
      <div className="media-grid video-grid">
        {mediaItems.map((video, index) => (
          <div key={video.MediaId} className="media-item video-item">
            <div className="video-preview">
              <video 
                src={video.MediaUrl} 
                controls={false} 
                preload="metadata"
                poster="/video-placeholder.png"
              />
              <div className="video-overlay" onClick={() => openLightbox(video, index)}>
                <div className="play-button">
                  <FaPlay className="play-icon" />
                </div>
                <div className="media-duration">
                  {video.Duration ? `${Math.floor(video.Duration / 60)}:${(video.Duration % 60).toString().padStart(2, '0')}` : '00:00'}
                </div>
              </div>
            </div>
            <div className="media-info">
              <div className="media-details">
                <div className="media-title">Video {index + 1}</div>
                <div className="media-timestamp">{formatDate(video.Timestamp)}</div>
              </div>
              <button 
                className="download-button"
                onClick={(e) => handleDownload(e, video.MediaUrl, video.MediaId)}
                title="Download video"
              >
                <FaDownload />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderScreenshotGrid = () => {
    return (
      <div className="media-grid screenshot-grid">
        {mediaItems.map((screenshot, index) => (
          <div 
            key={screenshot.MediaId} 
            className="media-item screenshot-item"
          >
            <div className="screenshot-preview" onClick={() => openLightbox(screenshot, index)}>
              <img 
                src={screenshot.MediaUrl} 
                alt={`Screenshot ${index + 1}`} 
                className="screenshot-thumbnail"
                loading="lazy" 
                onError={(e) => {
                  console.error(`Error loading screenshot ${index + 1}:`, e);
                  e.target.src = '/image-placeholder.png'; 
                }}
              />
              <div className="screenshot-overlay">
                <div className="view-icon">
                  <FaSearch className="search-icon" />
                </div>
              </div>
            </div>
            <div className="media-info">
              <div className="media-details">
                <div className="media-title">Screenshot {index + 1}</div>
                <div className="media-timestamp">{formatDate(screenshot.Timestamp)}</div>
              </div>
              <button 
                className="download-button"
                onClick={(e) => handleDownload(e, screenshot.MediaUrl, screenshot.MediaId)}
                title="Download screenshot"
              >
                <FaDownload />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLightbox = () => {
    if (!lightboxOpen) return null;
    
    const currentItem = mediaItems[currentIndex];
    
    return (
      <div className="lightbox">
        <div className="lightbox-header">
          <h3>
            {mediaType === 'videos' ? 'Video' : 'Screenshot'} {currentIndex + 1} of {mediaItems.length}
          </h3>
          <button className="lightbox-close" onClick={closeLightbox}>
            <FaTimes />
          </button>
        </div>
        
        <div className="lightbox-content">
          {mediaType === 'videos' ? (
            <video 
              src={currentItem.MediaUrl} 
              controls 
              autoPlay 
              className="lightbox-media lightbox-video"
            />
          ) : (
            <div className="lightbox-image-container">
              <img 
                src={currentItem.MediaUrl} 
                alt={`Screenshot ${currentIndex + 1}`} 
                className="lightbox-media lightbox-image"
                onError={(e) => {
                  console.error(`Error loading lightbox image:`, e);
                  e.target.src = '/image-placeholder.png'; // Fallback image
                }}
              />
            </div>
          )}
          
          <div className="lightbox-nav">
            <button 
              className="nav-button"
              onClick={() => navigateLightbox(-1)}
              disabled={currentIndex === 0}
            >
              <FaChevronLeft />
            </button>
            <button 
              className="nav-button"
              onClick={() => navigateLightbox(1)}
              disabled={currentIndex === mediaItems.length - 1}
            >
              <FaChevronRight />
            </button>
          </div>
        </div>
        
        <div className="lightbox-footer">
          <button 
            className="lightbox-download"
            onClick={(e) => handleDownload(e, currentItem.MediaUrl, currentItem.MediaId)}
          >
            <FaDownload /> Download {mediaType === 'videos' ? 'Video' : 'Screenshot'}
          </button>
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
        <FaVideo className="empty-icon" />
      ) : (
        <FaImage className="empty-icon" />
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
