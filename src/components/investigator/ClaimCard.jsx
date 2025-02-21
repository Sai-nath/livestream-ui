import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaPlay, FaCarSide, FaCircle } from 'react-icons/fa';
import './AssignedClaims.css';

const ClaimCard = ({ 
  claim, 
  isUserOnline, 
  handleStartInvestigation, 
  activeCall 
}) => {
  const navigate = useNavigate();

  // Safely access nested supervisor data
  const supervisor = claim.supervisor || {};
  const supervisorOnline = supervisor.id ? 
    isUserOnline(supervisor.id) || supervisor.isOnline : 
    false;
  
  // Get vehicle info
  const vehicleInfo = claim.vehicleInfo || {};
  const hasVehicleInfo = Object.keys(vehicleInfo).length > 0;
  
  // Get direct fields as fallback
  const vehicleType = claim.VehicleType || ''; 
  const vehicleNumber = claim.VehicleNumber || '';
  
  // Format the claim number according to your screenshot
  const claimNumber = claim.ClaimNumber || claim.claimNumber || 
    (claim.claimId ? `CLM-${claim.claimId}` : 'Unknown');
  
  // Get shorter claim number for display
 
  // Formatted vehicle display based on your screenshot
  const vehicleDisplay = hasVehicleInfo 
    ? `${vehicleInfo.make} ${vehicleInfo.model} ${vehicleInfo.registrationNumber ? `(${vehicleInfo.registrationNumber})` : ''}`
    : vehicleType ? `${vehicleType} ${vehicleNumber ? `(${vehicleNumber})` : ''}` : '';

  return (
    <div className="claim-card">
      <div className="claim-card-header">
        <div className="claim-primary-info">
          <div className="claim-number">{claimNumber}</div>
          <div className={`claim-status-badge ${(claim.status || claim.ClaimStatus).toLowerCase()}`}>
            {claim.status || claim.ClaimStatus}
          </div>
        </div>
        
        {/* Essential info visible by default - matching your screenshot */}
        <div className="claim-essential-info">
          {vehicleDisplay && (
            <div className="essential-item vehicle-info">
              <FaCarSide className="essential-icon" />
              <span>{vehicleDisplay}</span>
            </div>
          )}
          
          <div className="essential-item supervisor-status">
            <div className={`status-indicator ${supervisorOnline ? 'online' : 'offline'}`}></div>
            <span className="supervisor-name">{supervisor.name || 'Supervisor User'}</span>
            <span className="status-text">{supervisorOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>
      
      {/* Action buttons - always visible */}
      <div className="claim-actions">
        <button
          className="action-btn view"
          onClick={() => navigate(`/claims/${claim.claimId}`)}
        >
          <FaEye /> View Details
        </button>
        <button
          className={`action-btn start ${!supervisorOnline ? 'disabled' : ''}`}
          onClick={() => supervisorOnline && handleStartInvestigation(claim)}
          disabled={!supervisorOnline || activeCall !== null}
        >
          <FaPlay />
          {supervisorOnline ? 'Start Investigation' : 'Supervisor Offline'}
        </button>
      </div>
    </div>
  );
};

export default ClaimCard;