import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaPlay, FaCarSide, FaCircle, FaUser, FaCalendar, FaClipboard } from 'react-icons/fa';
import './AssignedClaims.css';

const ClaimCard = ({ 
  claim, 
  isUserOnline, 
  handleStartInvestigation, 
  activeCall 
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

  return (
    <div className="claim-card">
      <div className="claim-card-header">
        <div className="claim-primary-info">
          <div className="claim-number">{claimNumber}</div>
          <div className={`claim-status-badge ${(claim.status || claim.ClaimStatus).toLowerCase()}`}>
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
            <FaUser className="detail-icon" />
            <div className="detail-content">
              <span className="detail-label">Insured</span>
              <span className="detail-value">{claimDetails.insuredName || claim.InsuredName || 'N/A'}</span>
            </div>
          </div>
          <div className="detail-item">
            <FaCalendar className="detail-icon" />
            <div className="detail-content">
              <span className="detail-label">Assigned At</span>
              <span className="detail-value">{formatDate(claim.assignedAt || claim.AssignedAt)}</span>
            </div>
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
            <span className="detail-label">Supervisor Notes</span>
            <span className="detail-value">{claimDetails.supervisorNotes || claim.SupervisorNotes}</span>
          </div>
        )}


        {(claimDetails.description || claim.Description) && (
          <div className="detail-row description">
            <span className="detail-label">Description</span>
            <span className="detail-value">{claimDetails.description || claim.Description}</span>
          </div>
        )}
      </div>

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