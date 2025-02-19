import React from 'react';
import { Link } from 'react-router-dom';
import { FaVideo } from 'react-icons/fa';

const Navbar = () => {
    return (
        <nav className="bg-gray-900 border-b border-gray-800">
            <div className="container mx-auto px-4">
                <div className="flex justify-between items-center h-16">
                    <Link to="/" className="flex items-center space-x-2">
                        <FaVideo className="text-2xl text-blue-500" />
                        <span className="text-xl font-bold text-white">iNube Claims</span>
                    </Link>
                    <div className="flex items-center space-x-4">
                        <Link
                            to="/login"
                            className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                        >
                            Login
                        </Link>
                        <Link
                            to="/login"
                            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
