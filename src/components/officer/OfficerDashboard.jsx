import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import StreamParticipation from './StreamParticipation';
import DashboardLayout from '../common/DashboardLayout';

const OfficerDashboard = () => {
    const { user } = useAuth();

    // Verify officer role
    if (user?.role !== 'OFFICER') {
        return <Navigate to="/login" />;
    }

    const menuItems = [
        {
            title: 'Active Streams',
            path: '/officer/streams',
            icon: 'video',
            permission: 'JOIN_STREAM'
        }
    ];

    return (
        <DashboardLayout 
            title="Officer Dashboard"
            menuItems={menuItems}
        >
            <Routes>
                <Route path="streams" element={<StreamParticipation />} />
                <Route path="/" element={<Navigate to="streams" replace />} />
            </Routes>
        </DashboardLayout>
    );
};

export default OfficerDashboard;
