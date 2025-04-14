import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

// Load user data from localStorage
const loadUserFromStorage = () => {
    try {
        const userData = localStorage.getItem('user');
        if (userData) {
            const parsed = JSON.parse(userData);
            // Check if we have all required fields and token hasn't expired
            if (parsed.token && parsed.id && parsed.tokenExpiry && new Date().getTime() < parsed.tokenExpiry) {
                console.debug('Loaded user data from storage:', { 
                    hasToken: true,
                    userId: parsed.id,
                    role: parsed.role,
                    tokenExpiry: new Date(parsed.tokenExpiry).toISOString()
                });
                return parsed;
            } else {
                console.debug('Invalid or expired user data in storage');
                localStorage.removeItem('user');
            }
        }
    } catch (err) {
        console.error('Error loading user data:', err);
        localStorage.removeItem('user');
    }
    return null;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(loadUserFromStorage);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const login = useCallback(async (email, password) => {
        try {
            setLoading(true);
            setError(null);
            
            console.debug('AuthContext: Attempting login');
            
            console.debug('AuthContext: Full API URL', `${import.meta.env.VITE_API_URL}/api/auth/login`);
            
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': import.meta.env.VITE_APP_URL,
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Invalid credentials');
            }

            const data = await response.json();
            console.debug('AuthContext: Login response received', {
                hasToken: !!data.token,
                role: data.role
            });
            
            if (!data.token) {
                throw new Error('No token received from server');
            }

            const userData = {
                id: data.id,
                username: data.username,
                email: data.email,
                role: data.role,
                permissions: data.permissions,
                token: data.token,
                tokenExpiry: new Date().getTime() + (24 * 60 * 60 * 1000) // 24 hours from now
            };
            
            console.debug('AuthContext: Setting user data', {
                hasToken: !!userData.token,
                role: userData.role,
                tokenExpiry: new Date(userData.tokenExpiry).toISOString()
            });
            
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            
            return userData;
        } catch (err) {
            console.error('AuthContext: Login error:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshToken = useCallback(async () => {
        if (!user?.token) {
            console.debug('AuthContext: No token to refresh');
            throw new Error('No token available');
        }

        try {
            console.debug('AuthContext: Attempting token refresh');
            
            console.debug('AuthContext: Full refresh URL', `${import.meta.env.VITE_API_URL}/api/auth/refresh`);
            
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`,
                    'Origin': import.meta.env.VITE_APP_URL
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }

            const data = await response.json();
            console.debug('AuthContext: Token refresh response', {
                hasNewToken: !!data.token
            });
            
            if (!data.token) {
                throw new Error('No token received from refresh');
            }

            const updatedUser = {
                ...user,
                token: data.token,
                tokenExpiry: new Date().getTime() + (24 * 60 * 60 * 1000)
            };
            
            console.debug('AuthContext: Updating user with refreshed token', {
                hasToken: !!updatedUser.token,
                tokenExpiry: new Date(updatedUser.tokenExpiry).toISOString()
            });
            
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            
            return data.token;
        } catch (err) {
            console.error('AuthContext: Token refresh failed:', err);
            logout();
            throw err;
        }
    }, [user]);

    const logout = useCallback(() => {
        console.debug('AuthContext: Logging out user');
        setUser(null);
        localStorage.removeItem('user');
    }, []);

    // Auto refresh token before expiry
    useEffect(() => {
        if (user?.tokenExpiry) {
            const timeToRefresh = user.tokenExpiry - new Date().getTime() - (5 * 60 * 1000); // 5 minutes before expiry
            console.debug('AuthContext: Setting up token refresh timer', {
                currentTime: new Date().toISOString(),
                tokenExpiry: new Date(user.tokenExpiry).toISOString(),
                timeToRefresh: Math.floor(timeToRefresh / 1000) + ' seconds'
            });
            
            if (timeToRefresh > 0) {
                const refreshTimer = setTimeout(refreshToken, timeToRefresh);
                return () => clearTimeout(refreshTimer);
            } else {
                console.debug('AuthContext: Token expired, attempting immediate refresh');
                refreshToken().catch(() => {});
            }
        }
    }, [user?.tokenExpiry, refreshToken]);

    // Debug log whenever user state changes
    useEffect(() => {
        console.debug('AuthContext: User state updated', user ? {
            isLoggedIn: true,
            hasToken: !!user.token,
            role: user.role,
            tokenExpiry: user.tokenExpiry ? new Date(user.tokenExpiry).toISOString() : null
        } : {
            isLoggedIn: false
        });
    }, [user]);

    const value = {
        user,
        loading,
        error,
        login,
        logout,
        refreshToken,
        isAuthenticated: !!user?.token
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
