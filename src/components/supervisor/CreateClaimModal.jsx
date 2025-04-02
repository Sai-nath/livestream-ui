import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import './CreateClaimModal.css';

const CreateClaimModal = ({ onClose, onCreated }) => {
    const [formData, setFormData] = useState({
        claimNumber: '',
        vehicleNumber: '',
        vehicleType: '',
        policyNumber: '',
        insuredName: '',
        supervisorNotes: ''
    });
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Generate a claim number if not provided
            if (!formData.claimNumber) {
                const date = new Date();
                const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                formData.claimNumber = `CLM-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${randomNum}`;
            }

            console.log('Submitting claim data:', formData);
            
            // Use the API URL from environment variables with fallback to our network IP
            const apiUrl = import.meta.env.VITE_API_URL || 'http://192.168.8.150:5000';
            
            const response = await fetch(`${apiUrl}/api/claims`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    ...formData,
                    supervisorId: user.id
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create claim');
            }

            const newClaim = await response.json();
            console.log('Claim created successfully:', newClaim);
            onCreated(newClaim);
            toast.success('Claim created successfully');
        } catch (error) {
            console.error('Create claim error:', error);
            toast.error(error.message || 'Error creating claim');
            // Don't close the modal on error so the user can try again
            return;
        } finally {
            setLoading(false);
        }
        
        // Only close the modal if we successfully created the claim
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Create New Claim</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="claimNumber">Claim Number</label>
                        <input
                            type="text"
                            id="claimNumber"
                            name="claimNumber"
                            value={formData.claimNumber}
                            onChange={handleChange}
                            required
                            placeholder="Enter claim number"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="vehicleNumber">Vehicle Number</label>
                        <input
                            type="text"
                            id="vehicleNumber"
                            name="vehicleNumber"
                            value={formData.vehicleNumber}
                            onChange={handleChange}
                            required
                            placeholder="Enter vehicle number"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="vehicleType">Vehicle Type</label>
                        <input
                            type="text"
                            id="vehicleType"
                            name="vehicleType"
                            value={formData.vehicleType}
                            onChange={handleChange}
                            required
                            placeholder="Enter vehicle type"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="policyNumber">Policy Number</label>
                        <input
                            type="text"
                            id="policyNumber"
                            name="policyNumber"
                            value={formData.policyNumber}
                            onChange={handleChange}
                            required
                            placeholder="Enter policy number"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="insuredName">Insured Name</label>
                        <input
                            type="text"
                            id="insuredName"
                            name="insuredName"
                            value={formData.insuredName}
                            onChange={handleChange}
                            required
                            placeholder="Enter insured name"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="supervisorNotes">Notes</label>
                        <textarea
                            id="supervisorNotes"
                            name="supervisorNotes"
                            value={formData.supervisorNotes}
                            onChange={handleChange}
                            placeholder="Enter any additional notes"
                            rows={4}
                        />
                    </div>

                    <div className="modal-actions">
                        <button 
                            type="button" 
                            className="cancel-btn"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="submit-btn"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Claim'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateClaimModal;
