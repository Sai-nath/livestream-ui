import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import { FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';

const DashboardLayout = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        
        if (!searchQuery.trim()) {
            toast.info('Please enter a claim number to search');
            return;
        }
        
        setIsSearching(true);
        
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
            
            if (data.length === 0) {
                toast.info(`No claims found matching "${searchQuery}"`);
            } else {
                // Navigate to the claims page with the search results
                navigate('/supervisor/claims', { 
                    state: { 
                        searchResults: data,
                        searchQuery: searchQuery
                    } 
                });
                toast.success(`Found ${data.length} claim(s) matching "${searchQuery}"`);
            }
        } catch (error) {
            console.error('Error searching claims:', error);
            toast.error('Error searching claims');
        } finally {
            setIsSearching(false);
        }
    };

    const getNavLinks = () => {
        switch (user.role) {
            case 'Supervisor':
                return [
                    {
                        to: '/supervisor/claims',
                        label: 'Claims Management',
                        permission: 'CLAIM_CREATE'
                    },
                    {
                        to: '/supervisor/search',
                        label: 'Search',
                        permission: 'CLAIM_CREATE'
                    }
                ];
            case 'Investigator':
                return [
                    {
                        to: '/investigator/claims',
                        label: 'Assigned Claims',
                        permission: 'VIEW_ASSIGNED_CLAIMS'
                    }
                ];
            case 'Officer':
                return [
                    {
                        to: '/officer/streams',
                        label: 'Investigation Streams',
                        permission: 'JOIN_STREAM'
                    }
                ];
            default:
                return [];
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            {/* Logo */}
                            <div className="flex-shrink-0 flex items-center">
                                <Link to="/" className="text-xl font-bold text-blue-600">
                                    iNube Claims
                                </Link>
                            </div>

                            {/* Navigation Links */}
                            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                {getNavLinks().map((link, index) => (
                                    user.permissions.includes(link.permission) && (
                                        <React.Fragment key={link.to}>
                                            <Link
                                                to={link.to}
                                                className={`${
                                                    location.pathname === link.to
                                                        ? 'border-blue-500 text-gray-900'
                                                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                                            >
                                                {link.label}
                                            </Link>
                                            
                                            {/* Add search bar next to Claims Management */}
                                            {link.label === 'Claims Management' && (
                                                <form onSubmit={handleSearch} className="inline-flex items-center ml-4">
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="text"
                                                            placeholder="Search by claim number..."
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            className="border border-gray-300 rounded-md py-1 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-48"
                                                        />
                                                        <button 
                                                            type="submit" 
                                                            className="absolute right-0 top-0 h-full px-2 text-gray-500 hover:text-blue-500"
                                                            disabled={isSearching}
                                                        >
                                                            <FaSearch />
                                                        </button>
                                                    </div>
                                                </form>
                                            )}
                                        </React.Fragment>
                                    )
                                ))}
                            </nav>
                        </div>

                        {/* User Menu */}
                        <div className="flex items-center">
                            <div className="hidden sm:flex sm:items-center sm:ml-6">
                                <div className="flex items-center space-x-4">
                                    <ThemeToggle />
                                    <div className="text-sm">
                                        <span className="text-gray-500">Logged in as </span>
                                        <span className="text-gray-900 font-medium">
                                            {user.username}
                                        </span>
                                        <span className="ml-2 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-full">
                                            {user.role}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Navigation */}
            <nav className="sm:hidden bg-white border-t border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col space-y-2 py-3">
                        {getNavLinks().map((link) => (
                            user.permissions.includes(link.permission) && (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className={`${
                                        location.pathname === link.to
                                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                                            : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                                    } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                                >
                                    {link.label}
                                </Link>
                            )
                        ))}
                        <button
                            onClick={handleLogout}
                            className="block w-full text-left pl-3 pr-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <Outlet />
            </main>
        </div>
    );
};

export default DashboardLayout;
