import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaVideo, FaClipboardList, FaSignOutAlt, FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './Navbar.css';

const Navbar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const isActive = (path) => {
        return location.pathname.includes(path);
    };

    const handleLogout = () => {
        logout();
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

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/" className="brand-link">
                    <span className="brand-icon">🎥</span>
                    <span className="brand-text">iNube</span>
                </Link>
            </div>

            {user && (
                <div className="navbar-content">
                    <div className="nav-section">
                        <span className="section-title">
                            {user.role === 'SUPERVISOR' ? 'Supervisor Dashboard' : 'Investigator Dashboard'}
                        </span>
                        <div className="nav-links">
                            {user.role === 'SUPERVISOR' && (
                                <>
                                    <div className="nav-group">
                                        <Link 
                                            to="/supervisor/claims" 
                                            className={`nav-link ${isActive('/claims') ? 'active' : ''}`}
                                        >
                                            <FaClipboardList />
                                            <span>Claims Management</span>
                                        </Link>
                                        
                                        <form onSubmit={handleSearch} className="global-search">
                                            <div className="search-container">
                                                <input
                                                    type="text"
                                                    placeholder="Search by claim number..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="search-input"
                                                />
                                                <button 
                                                    type="submit" 
                                                    className="search-button"
                                                    disabled={isSearching}
                                                >
                                                    <FaSearch />
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                    
                                    <Link 
                                        to="/supervisor/monitoring" 
                                        className={`nav-link ${isActive('/monitoring') ? 'active' : ''}`}
                                    >
                                        <FaVideo />
                                        <span>Live Monitoring</span>
                                    </Link>
                                </>
                            )}
                            {user.role === 'INVESTIGATOR' && (
                                <>
                                    <Link 
                                        to="/investigator/claims" 
                                        className={`nav-link ${isActive('/claims') ? 'active' : ''}`}
                                    >
                                        <FaClipboardList />
                                        <span>My Claims</span>
                                    </Link>
                                    <Link 
                                        to="/investigator/stream" 
                                        className={`nav-link ${isActive('/stream') ? 'active' : ''}`}
                                    >
                                        <FaVideo />
                                        <span>Live Stream</span>
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="user-section">
                        <div className="user-info">
                            <span className="welcome-text">Welcome, {user.username}</span>
                            <button className="logout-btn" onClick={handleLogout}>
                                <FaSignOutAlt />
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
