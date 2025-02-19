import React from 'react';
import { Link } from 'react-router-dom';
import { FaLock } from 'react-icons/fa';

const Unauthorized = () => {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full text-center">
                <FaLock className="mx-auto text-6xl text-red-500 mb-6" />
                <h1 className="text-4xl font-bold text-white mb-4">
                    Access Denied
                </h1>
                <p className="text-gray-400 mb-8">
                    You don't have permission to access this page. Please contact your administrator if you believe this is a mistake.
                </p>
                <Link
                    to="/"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                    Return Home
                </Link>
            </div>
        </div>
    );
};

export default Unauthorized;
