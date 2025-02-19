import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const SystemSettings = () => {
    const [settings, setSettings] = useState({
        streamingQuality: 'HD',
        maxStreamDuration: 120,
        autoCloseInactiveStreams: true,
        locationTrackingInterval: 30,
        retentionPeriod: 30,
        maxParticipantsPerStream: 5,
        notificationSettings: {
            email: true,
            inApp: true,
            sms: false
        },
        securitySettings: {
            twoFactorAuth: true,
            passwordExpiry: 90,
            sessionTimeout: 30
        }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Fetch settings from the database
    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch settings');
            
            const data = await response.json();
            setSettings(data);
        } catch (error) {
            toast.error('Error fetching system settings');
            console.error('Settings fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Save settings to the database
    const saveSettings = async () => {
        setSaving(true);
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(settings)
            });
            
            if (!response.ok) throw new Error('Failed to save settings');
            
            toast.success('Settings saved successfully');
        } catch (error) {
            toast.error('Error saving settings');
            console.error('Settings save error:', error);
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const handleChange = (section, key, value) => {
        if (section) {
            setSettings(prev => ({
                ...prev,
                [section]: {
                    ...prev[section],
                    [key]: value
                }
            }));
        } else {
            setSettings(prev => ({
                ...prev,
                [key]: value
            }));
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">System Settings</h1>
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ${
                        saving ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="space-y-6">
                {/* Streaming Settings */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Streaming Settings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Streaming Quality
                            </label>
                            <select
                                value={settings.streamingQuality}
                                onChange={(e) => handleChange(null, 'streamingQuality', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                                <option value="SD">SD (480p)</option>
                                <option value="HD">HD (720p)</option>
                                <option value="FHD">Full HD (1080p)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Max Stream Duration (minutes)
                            </label>
                            <input
                                type="number"
                                value={settings.maxStreamDuration}
                                onChange={(e) => handleChange(null, 'maxStreamDuration', parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Location Tracking Interval (seconds)
                            </label>
                            <input
                                type="number"
                                value={settings.locationTrackingInterval}
                                onChange={(e) => handleChange(null, 'locationTrackingInterval', parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Max Participants Per Stream
                            </label>
                            <input
                                type="number"
                                value={settings.maxParticipantsPerStream}
                                onChange={(e) => handleChange(null, 'maxParticipantsPerStream', parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Security Settings */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.securitySettings.twoFactorAuth}
                                    onChange={(e) => handleChange('securitySettings', 'twoFactorAuth', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Enable Two-Factor Authentication</span>
                            </label>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Password Expiry (days)
                            </label>
                            <input
                                type="number"
                                value={settings.securitySettings.passwordExpiry}
                                onChange={(e) => handleChange('securitySettings', 'passwordExpiry', parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Session Timeout (minutes)
                            </label>
                            <input
                                type="number"
                                value={settings.securitySettings.sessionTimeout}
                                onChange={(e) => handleChange('securitySettings', 'sessionTimeout', parseInt(e.target.value))}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Notification Settings */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.notificationSettings.email}
                                    onChange={(e) => handleChange('notificationSettings', 'email', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">Email Notifications</span>
                            </label>
                        </div>
                        <div>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.notificationSettings.inApp}
                                    onChange={(e) => handleChange('notificationSettings', 'inApp', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">In-App Notifications</span>
                            </label>
                        </div>
                        <div>
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={settings.notificationSettings.sms}
                                    onChange={(e) => handleChange('notificationSettings', 'sms', e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">SMS Notifications</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;
