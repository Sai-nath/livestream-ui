import React from 'react';
import { Link } from 'react-router-dom';
import { FaVideo, FaTwitter, FaLinkedin, FaGithub } from 'react-icons/fa';

const Footer = () => {
    return (
        <footer className="bg-gray-900 border-t border-gray-800 text-gray-300">
            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="space-y-4">
                        <Link to="/" className="flex items-center space-x-2">
                            <FaVideo className="text-2xl text-blue-500" />
                            <span className="text-xl font-bold text-white">iNube Claims</span>
                        </Link>
                        <p className="text-sm">
                            Revolutionizing insurance claims with real-time video investigations
                        </p>
                    </div>

                    {/* Product */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Product</h3>
                        <ul className="space-y-2">
                            <li><Link to="/features" className="hover:text-white">Features</Link></li>
                            <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                            <li><Link to="/security" className="hover:text-white">Security</Link></li>
                            <li><Link to="/enterprise" className="hover:text-white">Enterprise</Link></li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Company</h3>
                        <ul className="space-y-2">
                            <li><Link to="/about" className="hover:text-white">About</Link></li>
                            <li><Link to="/careers" className="hover:text-white">Careers</Link></li>
                            <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
                            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
                        </ul>
                    </div>

                    {/* Social */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Connect</h3>
                        <div className="flex space-x-4">
                            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                                <FaTwitter className="text-xl" />
                            </a>
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                                <FaLinkedin className="text-xl" />
                            </a>
                            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                                <FaGithub className="text-xl" />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-800 text-sm">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <p>&copy; 2024 iNube Claims. All rights reserved.</p>
                        <div className="flex space-x-4 mt-4 md:mt-0">
                            <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
                            <Link to="/terms" className="hover:text-white">Terms of Service</Link>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
