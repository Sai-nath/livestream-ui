import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaPlay, FaCarSide, FaCircle, FaUser, FaCalendar, FaClipboard, FaFileAlt, FaPhone, FaUserPlus, FaCamera } from 'react-icons/fa';
import './AssignedClaims.css';

const ClaimCard = ({ 
  claim, 
  isUserOnline, 
  handleStartInvestigation, 
  activeCall,
  onAssignInvestigator 
}) => {
  const navigate = useNavigate();

  console.log('Claim object:', JSON.stringify(claim, null, 2));

  const supervisor = claim.supervisor || {};
  const vehicleInfo = claim.vehicleInfo || {};
  const claimDetails = claim.claimDetails || {};
  
  const supervisorOnline = supervisor.id ? 
    isUserOnline(supervisor.id) || supervisor.isOnline : 
    false;
  
  // Use ClaimNumber if available, fallback to generated value
  const claimNumber = claim.ClaimNumber || (claim.claimId ? `CLM-${claim.claimId}` : 'Unknown');

  const vehicleDisplay = vehicleInfo.make 
    ? `${vehicleInfo.make || ''} ${vehicleInfo.model || ''} ${vehicleInfo.registrationNumber ? `(${vehicleInfo.registrationNumber})` : ''}`
    : `${claim.VehicleType || ''} ${claim.VehicleNumber ? `(${claim.VehicleNumber})` : ''}`;

  const formatDate = (date) => date ? new Date(date).toLocaleString() : 'N/A';
  
  // Get claim status (handle both camelCase and PascalCase)
  const claimStatus = (claim.status || claim.ClaimStatus || '').toLowerCase();

  return (
    <div className="claim-card">
      <div className="claim-card-header">
        <div className="claim-primary-info">
          <div className="claim-number">{claimNumber}</div>
          <div className={`claim-status-badge ${claimStatus}`}>
            {claim.status || claim.ClaimStatus}
          </div>
        </div>

        <div className="claim-essential-info">
          {vehicleDisplay && (
            <div className="essential-item vehicle-info">
              <FaCarSide className="essential-icon" />
              <span>{vehicleDisplay.trim() || 'No Vehicle Info'}</span>
            </div>
          )}
          
          <div className="essential-item supervisor-status">
            <div className={`status-indicator ${supervisorOnline ? 'online' : 'offline'}`}></div>
            <span className="supervisor-name">{supervisor.name || 'Supervisor User'}</span>
            <span className="status-text">{supervisorOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>

      <div className="claim-details-section">
        <div className="detail-row">
          <div className="detail-item">
            <span className="detail-label">Insured</span>
            <span className="detail-value">{claimDetails.insuredName || claim.InsuredName || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Assigned At</span>
            <span className="detail-value">{formatDate(claim.assignedAt || claim.AssignedAt)}</span>
          </div>
        </div>

        <div className="detail-row">
          <div className="detail-item">
            <span className="detail-label">Policy #</span>
            <span className="detail-value">{claimDetails.policyNumber || claim.PolicyNumber || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Location</span>
            <span className="detail-value">{claimDetails.location || claim.IncidentLocation || 'N/A'}</span>
          </div>
        </div>

        {(claimDetails.supervisorNotes || claim.SupervisorNotes) && (
          <div className="detail-row description">
            <div className="detail-item">
              <span className="detail-label">Supervisor Notes</span>
              <span className="detail-value">{claimDetails.supervisorNotes || claim.SupervisorNotes}</span>
            </div>
          </div>
        )}

        {(claimDetails.description || claim.Description) && (
          <div className="detail-row description">
            <div className="detail-item">
              <span className="detail-label">Description</span>
              <span className="detail-value">{claimDetails.description || claim.Description}</span>
            </div>
          </div>
        )}
      </div>

      <div className="claim-actions">
        {claimStatus === 'new' && (
          <button
            className="action-btn assign"
            onClick={() => onAssignInvestigator && onAssignInvestigator(claim)}
            title="Assign an investigator to this claim"
          >
            <FaUserPlus />
            <span>Assign</span>
          </button>
        )}
        
        {/* Only show Docs button for non-New claims */}
        {claimStatus !== 'new' && (
          <button
            className="action-btn view"
            onClick={() => navigate(`/investigator/claims/${claim.claimId}/docs`, { state: { claimData: claim } })}
            title="View offline documents for this claim"
          >
            <FaFileAlt />
            <span>Docs</span>
          </button>
        )}
        
        {/* Only show Live button for non-New claims */}
        {claimStatus !== 'new' && (
          <button
            className={`action-btn start ${!supervisorOnline ? 'disabled' : ''}`}
            onClick={() => supervisorOnline && handleStartInvestigation(claim)}
            disabled={!supervisorOnline || activeCall !== null}
            title={supervisorOnline ? "Start live investigation" : "Supervisor is offline"}
          >
            <FaPhone />
            <span>{supervisorOnline ? 'Live' : 'Offline'}</span>
          </button>
        )}
        
        {/* Only show Videos and Photos for InvestigationCompleted status */}
        {claimStatus === 'investigationcompleted' && (
          <>
            <button
              className="action-btn videos"
              onClick={() => navigate(`/investigator/claims/${claim.claimId}/videos`)}
              title="View recorded videos for this claim"
            >
              <FaPlay />
              <span>Videos</span>
            </button>
            <button
              className="action-btn photos"
              onClick={() => navigate(`/investigator/claims/${claim.claimId}/photos`)}
              title="View photos for this claim"
            >
              <FaCamera />
              <span>Photos</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimCard;