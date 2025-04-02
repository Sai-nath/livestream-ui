import React, { useState } from 'react';
import { FaSearch, FaTimes, FaClipboardList, FaUserPlus, FaVideo, FaCamera, FaInfoCircle } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import AssignInvestigatorModal from './AssignInvestigatorModal';
import './ClaimManagement.css';

const ClaimSearch = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [showAssignModal, setShowAssignModal] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        
        if (!searchQuery.trim()) {
            toast.info('Please enter a claim number to search');
            return;
        }
        
        setIsSearching(true);
        setHasSearched(true);
        
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/claims/search?query=${searchQuery}`, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to search claims');
            }
            
            const data = await response.json();
            
            // Debug the search results
            console.log('Search results:', data);
            if (data.length > 0) {
                console.log('First claim:', data[0]);
                console.log('Claim ID:', data[0].id);
            }
            
            setSearchResults(data);
            
            if (data.length === 0) {
                toast.info(`No claims found matching "${searchQuery}"`);
            } else {
                toast.success(`Found ${data.length} claim(s) matching "${searchQuery}"`);
            }
        } catch (error) {
            console.error('Error searching claims:', error);
            toast.error('Error searching claims');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setHasSearched(false);
    };

    const formatDate = (dateString) => {
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    const handleAssignClick = (claim) => {
        setSelectedClaim(claim);
        setShowAssignModal(true);
    };

    const handleAssignComplete = (updatedClaim) => {
        setSearchResults(prevClaims => 
            prevClaims.map(claim => 
                claim.id === updatedClaim.id ? updatedClaim : claim
            )
        );
        setShowAssignModal(false);
        setSelectedClaim(null);
        toast.success('Investigator assigned successfully');
    };

    const handleViewVideos = (claim) => {
        console.log('View videos - full claim object:', claim);
        
        // Use the claim ID directly from the search results
        const claimId = claim.ClaimId;
        console.log('Using claim ID for videos:', claimId);
        
        if (!claimId) {
            console.error('No valid claim ID found for videos');
            toast.error('Error: Cannot view videos - missing claim ID');
            return;
        }
        
        navigate(`/supervisor/claims/${claimId}/media/videos`);
    };

    const handleViewScreenshots = (claim) => {
        console.log('View screenshots - full claim object:', claim);
        
        // Use the claim ID directly from the search results
        const claimId = claim.ClaimId;
        console.log('Using claim ID for screenshots:', claimId);
        
        if (!claimId) {
            console.error('No valid claim ID found for screenshots');
            toast.error('Error: Cannot view screenshots - missing claim ID');
            return;
        }
        
        navigate(`/supervisor/claims/${claimId}/media/screenshots`);
    };

    return (
        <div className="claim-management">
            <div className="claims-page-header">
                <h1>Search Claims</h1>
            </div>
            
            <div className="claims-content">
                <div className="search-page-container">
                    <div className="search-card">
                        <div className="search-card-header">
                            <FaSearch className="search-icon" />
                            <h2>Find Claims by Number</h2>
                        </div>
                        <div className="search-card-body">
                            <form onSubmit={handleSearch} className="search-form-large">
                                <div className="search-container-large">
                                    <input
                                        type="text"
                                        placeholder="Enter claim number..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="search-input-large"
                                        autoFocus
                                    />
                                    {searchQuery && (
                                        <button 
                                            type="button" 
                                            className="clear-button"
                                            onClick={clearSearch}
                                            aria-label="Clear search"
                                        >
                                            <FaTimes />
                                        </button>
                                    )}
                                    <button 
                                        type="submit" 
                                        className="search-button-large"
                                        disabled={isSearching}
                                    >
                                        {isSearching ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                            </form>
                            <div className="search-tip">
                                <FaInfoCircle className="info-icon" />
                                <span>Enter a full or partial claim number to find matching claims.</span>
                            </div>
                        </div>
                    </div>

                    {hasSearched && (
                        <div className="search-results-container">
                            <div className="search-results-header">
                                <div className="header-left">
                                    <FaClipboardList className="results-icon" />
                                    <h2>Search Results</h2>
                                </div>
                                <span className="result-count">{searchResults.length} results for "{searchQuery}"</span>
                            </div>

                            {searchResults.length > 0 ? (
                                <div className="search-results-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Claim Number</th>
                                                <th>Status</th>
                                                <th>Vehicle</th>
                                                <th>Policy</th>
                                                <th>Insured</th>
                                                <th>Created</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {searchResults.map((claim, index) => (
                                                <tr key={claim.id || `claim-${index}`} className="result-row">
                                                    <td className="claim-number-cell">
                                                        {claim.claimNumber || claim.ClaimId || 'N/A'}
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${claim.status ? claim.status.toLowerCase() : 'unknown'}`}>
                                                            {claim.status || 'Unknown'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {claim.vehicle ? 
                                                            `${claim.vehicle.number} (${claim.vehicle.type})` : 
                                                            'N/A'}
                                                    </td>
                                                    <td>{claim.policy ? claim.policy.number : 'N/A'}</td>
                                                    <td>{claim.policy ? claim.policy.insuredName : 'N/A'}</td>
                                                    <td>{claim.createdAt ? formatDate(claim.createdAt) : 'N/A'}</td>
                                                    <td className="actions-cell">
                                                        <div className="action-buttons">
                                                            {/* For New claims, only show Assign button */}
                                                            {claim.status && claim.status.toLowerCase() === 'new' && (
                                                                <button 
                                                                    className="action-btn assign-btn"
                                                                    onClick={() => handleAssignClick(claim)}
                                                                    title="Assign Investigator"
                                                                >
                                                                    <FaUserPlus size={14} />
                                                                    <span>Assign</span>
                                                                </button>
                                                            )}
                                                            
                                                            {/* For non-New and non-Assigned claims, show Docs button */}
                                                            {claim.status && 
                                                             claim.status.toLowerCase() !== 'new' && 
                                                             claim.status.toLowerCase() !== 'assigned' && (
                                                                <button 
                                                                    className="action-btn view-docs-btn"
                                                                    onClick={() => navigate(`/supervisor/claims/${claim.ClaimId}/docs`, { state: { claimData: claim } })}
                                                                    title="View Documents"
                                                                >
                                                                    <FaClipboardList size={14} />
                                                                </button>
                                                            )}
                                                            
                                                            {/* Only show Videos and Photos for InvestigationCompleted status */}
                                                            {claim.status && claim.status.toLowerCase() === 'investigationcompleted' && (
                                                                <>
                                                                    <button 
                                                                        className="action-btn view-videos-btn"
                                                                        onClick={() => handleViewVideos(claim)}
                                                                        title="View Videos"
                                                                    >
                                                                        <FaVideo size={14} />
                                                                    </button>
                                                                    <button 
                                                                        className="action-btn view-screenshots-btn"
                                                                        onClick={() => handleViewScreenshots(claim)}
                                                                        title="View Screenshots"
                                                                    >
                                                                        <FaCamera size={14} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="no-results">
                                    <div className="no-results-content">
                                        <FaSearch className="no-results-icon" />
                                        <h3>No claims found</h3>
                                        <p>No claims found matching your search criteria.</p>
                                        <p>Try using a different claim number or check for typos.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Assign Investigator Modal */}
            {showAssignModal && selectedClaim && (
                <AssignInvestigatorModal
                    isOpen={showAssignModal}
                    onClose={() => {
                        setShowAssignModal(false);
                        setSelectedClaim(null);
                    }}
                    claim={selectedClaim}
                    onAssign={handleAssignComplete}
                />
            )}
        </div>
    );
};

export default ClaimSearch;
