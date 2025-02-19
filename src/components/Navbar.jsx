import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaVideo, FaClipboardList, FaSignOutAlt } from 'react-icons/fa';
import './Navbar.css';

const Navbar = () => {
    const { user, logout } = useAuth();
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname.includes(path);
    };

    const handleLogout = () => {
        logout();
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
                                    <Link 
                                        to="/supervisor/claims" 
                                        className={`nav-link ${isActive('/claims') ? 'active' : ''}`}
                                    >
                                        <FaClipboardList />
                                        <span>Claims Management</span>
                                    </Link>
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
