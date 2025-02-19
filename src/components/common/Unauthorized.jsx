import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Unauthorized = () => {
    const { user } = useAuth();

    const getHomeLink = () => {
        switch (user?.role) {
            case 'Supervisor':
                return '/supervisor/claims';
            case 'Investigator':
                return '/investigator/claims';
            case 'Officer':
                return '/officer/streams';
            default:
                return '/login';
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                <div className="text-6xl text-red-500 mb-4">
                    403
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    Access Denied
                </h1>
                <p className="text-gray-600 mb-8">
                    You don't have permission to access this page. Please contact your supervisor
                    if you believe this is a mistake.
                </p>
                <Link
                    to={getHomeLink()}
                    className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                    Return to Home
                </Link>
            </div>
        </div>
    );
};

export default Unauthorized;
