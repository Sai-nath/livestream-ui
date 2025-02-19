import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

// Admin Dashboard Statistics Component
const StatCard = ({ title, value, icon: Icon }) => (
    <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-600">{title}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
                <Icon className="w-6 h-6 text-blue-600" />
            </div>
        </div>
    </div>
);

const AdminDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeClaims: 0,
        activeInvestigations: 0,
        pendingApprovals: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch dashboard statistics
    const fetchStats = async () => {
        try {
            const response = await fetch('/api/admin/dashboard/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch statistics');
            
            const data = await response.json();
            setStats(data);
        } catch (error) {
            toast.error('Error fetching dashboard statistics');
            console.error('Stats fetch error:', error);
        }
    };

    // Fetch recent activity
    const fetchRecentActivity = async () => {
        try {
            const response = await fetch('/api/admin/dashboard/activity', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch activity');
            
            const data = await response.json();
            setRecentActivity(data);
        } catch (error) {
            toast.error('Error fetching recent activity');
            console.error('Activity fetch error:', error);
        }
    };

    useEffect(() => {
        const loadDashboardData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchStats(),
                    fetchRecentActivity()
                ]);
            } finally {
                setLoading(false);
            }
        };

        loadDashboardData();
        
        // Set up real-time updates
        const updateInterval = setInterval(loadDashboardData, 300000); // Update every 5 minutes
        
        return () => clearInterval(updateInterval);
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-gray-900">
                    Welcome back, {user?.username}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                    Here's what's happening in your insurance claims platform
                </p>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    title="Total Users"
                    value={stats.totalUsers}
                    icon={(props) => (
                        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    )}
                />
                <StatCard
                    title="Active Claims"
                    value={stats.activeClaims}
                    icon={(props) => (
                        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    )}
                />
                <StatCard
                    title="Active Investigations"
                    value={stats.activeInvestigations}
                    icon={(props) => (
                        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    )}
                />
                <StatCard
                    title="Pending Approvals"
                    value={stats.pendingApprovals}
                    icon={(props) => (
                        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                />
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
                </div>
                <div className="divide-y divide-gray-200">
                    {recentActivity.map((activity) => (
                        <div key={activity.id} className="px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {activity.description}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {activity.user} • {activity.type}
                                    </p>
                                </div>
                                <p className="text-sm text-gray-500">
                                    {new Date(activity.timestamp).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
