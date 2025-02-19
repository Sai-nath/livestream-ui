import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { FaCarSide, FaCalendarAlt, FaMapMarkerAlt, FaFileAlt, FaTimes } from 'react-icons/fa';
import { useLoadScript, StandaloneSearchBox } from '@react-google-maps/api';
import { API_URL, GOOGLE_MAPS_API_KEY, ENDPOINTS } from '../../config';

const libraries = ['places'];

const CreateClaimForm = ({ onClose, onClaimCreated }) => {
    const [loading, setLoading] = useState(false);
    const { user, refreshToken } = useAuth();
    const { trackActivity } = useSocket();
    const navigate = useNavigate();
    const [searchBox, setSearchBox] = useState(null);
    const [formData, setFormData] = useState({
        policyNumber: '',
        vehicleMake: '',
        vehicleModel: '',
        vehicleYear: '',
        registrationNumber: '',
        incidentDate: '',
        location: '',
        description: '',
        priority: 'MEDIUM'
    });

    const { isLoaded } = useLoadScript({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries
    });

    const onPlacesChanged = () => {
        if (searchBox) {
            const places = searchBox.getPlaces();
            if (places && places.length > 0) {
                const place = places[0];
                setFormData(prev => ({
                    ...prev,
                    location: place.formatted_address
                }));
            }
        }
    };

    const onSearchBoxLoad = useCallback(ref => {
        setSearchBox(ref);
    }, []);

    const handleInputChange = (e) => {
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
            const date = new Date();
            const claimNumber = `CLM-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

            const currentToken = user?.token;
            if (!currentToken) {
                throw new Error('No authentication token found');
            }

            const claimData = {
                policyNumber: formData.policyNumber,
                vehicleInfo: {
                    registrationNumber: formData.registrationNumber,
                    make: formData.vehicleMake,
                    model: formData.vehicleModel,
                    year: formData.vehicleYear
                },
                claimDetails: {
                    incidentDate: formData.incidentDate,
                    location: formData.location,
                    description: formData.description,
                    priority: formData.priority
                },
                claimNumber
            };

            console.debug('Sending claim creation request:', {
                url: `${API_URL}${ENDPOINTS.CLAIMS.CREATE}`,
                method: 'POST',
                hasToken: !!currentToken
            });

            const response = await fetch(`${API_URL}${ENDPOINTS.CLAIMS.CREATE}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`
                },
                body: JSON.stringify(claimData),
                credentials: 'include'
            });

            if (!response.ok) {
                console.error('Claim creation failed:', {
                    status: response.status,
                    statusText: response.statusText
                });

                if (response.status === 401) {
                    toast.error('Session expired. Please login again.');
                    navigate('/login');
                    return;
                }

                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to create claim: ${response.status}`);
            }

            const data = await response.json();
            console.debug('Claim created successfully:', data);
            
            toast.success('Claim created successfully');
            trackActivity('CLAIM_CREATED', { claimId: data.ClaimId });
            onClaimCreated(data);
            onClose();
        } catch (error) {
            console.error('Error creating claim:', error);
            toast.error(`Error creating claim: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-background-card w-full max-w-2xl rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 border-b border-background">
                    <h2 className="text-2xl font-bold text-text-primary">Create New Claim</h2>
                    <button
                        onClick={onClose}
                        className="text-text-secondary hover:text-text-primary transition-colors"
                    >
                        <FaTimes size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
                    <div className="p-6 space-y-6">
                        {/* Policy Information */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Policy Number
                                </label>
                                <input
                                    type="text"
                                    name="policyNumber"
                                    value={formData.policyNumber}
                                    onChange={(e) => handleInputChange(e)}
                                    className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                                    required
                                />
                            </div>
                        </div>

                        {/* Vehicle Information */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-text-primary flex items-center">
                                <FaCarSide className="mr-2" /> Vehicle Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Make
                                    </label>
                                    <input
                                        type="text"
                                        name="vehicleMake"
                                        value={formData.vehicleMake}
                                        onChange={(e) => handleInputChange(e)}
                                        className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Model
                                    </label>
                                    <input
                                        type="text"
                                        name="vehicleModel"
                                        value={formData.vehicleModel}
                                        onChange={(e) => handleInputChange(e)}
                                        className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Year
                                    </label>
                                    <input
                                        type="number"
                                        name="vehicleYear"
                                        value={formData.vehicleYear}
                                        onChange={(e) => handleInputChange(e)}
                                        className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Registration Number
                                    </label>
                                    <input
                                        type="text"
                                        name="registrationNumber"
                                        value={formData.registrationNumber}
                                        onChange={(e) => handleInputChange(e)}
                                        className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Claim Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-text-primary flex items-center">
                                <FaFileAlt className="mr-2" /> Claim Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center">
                                        <FaCalendarAlt className="mr-2" /> Date of Incident
                                    </label>
                                    <input
                                        type="date"
                                        name="incidentDate"
                                        value={formData.incidentDate}
                                        onChange={(e) => handleInputChange(e)}
                                        className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1 flex items-center">
                                        <FaMapMarkerAlt className="mr-2" /> Location
                                    </label>
                                    {isLoaded ? (
                                        <StandaloneSearchBox
                                            onLoad={onSearchBoxLoad}
                                            onPlacesChanged={onPlacesChanged}
                                        >
                                            <input
                                                type="text"
                                                placeholder="Search for a location"
                                                value={formData.location}
                                                onChange={(e) => handleInputChange(e)}
                                                name="location"
                                                className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                                                required
                                            />
                                        </StandaloneSearchBox>
                                    ) : (
                                        <div>Loading Google Places...</div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={(e) => handleInputChange(e)}
                                    rows="4"
                                    className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
                                    required
                                />
                            </div>
                        </div>

                        {/* Priority Selection */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                                Priority
                            </label>
                            <select
                                name="priority"
                                value={formData.priority}
                                onChange={(e) => handleInputChange(e)}
                                className="w-full bg-background border border-background-card rounded-md px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
                                required
                            >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>
                        </div>
                    </div>

                    {/* Submit Button - Fixed at bottom */}
                    <div className="sticky bottom-0 bg-background-card border-t border-background px-6 py-4 flex justify-end space-x-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border border-background-card rounded-md text-text-secondary hover:text-text-primary transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-3 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl"
                        >
                            {loading ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-5 h-5 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                                    <span>Creating...</span>
                                </div>
                            ) : (
                                'Create Claim'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </motion.div>
    );
};

export default CreateClaimForm;
