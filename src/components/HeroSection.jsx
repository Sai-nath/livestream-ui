import React from 'react';
import { Link } from 'react-router-dom';
import { FaVideo, FaArrowRight } from 'react-icons/fa';

const HeroSection = () => {
    const clients = [
        {
            name: "Chola MS",
            description: "Accelerating motor claims with instant video assessment"
        },
        {
            name: "USGI",
            description: "Real-time motor damage evaluation through live video"
        },
        {
            name: "ZUNO",
            description: "Fast-track motor claims with remote video inspection"
        },
        {
            name: "TAKAFUL OMAN",
            description: "Digital motor claims processing with live streaming"
        }
    ];

    return (
        <section className="relative bg-gray-900 py-20 overflow-hidden">
            <div className="container mx-auto px-4">
                <div className="flex flex-col lg:flex-row items-center justify-between">
                    {/* Hero Content */}
                    <div className="lg:w-1/2 mb-12 lg:mb-0">
                        <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6">
                            Transform Insurance Claims with Live Video
                        </h1>
                        <p className="text-xl text-gray-400 mb-8">
                            Streamline your claims process with real-time video investigations, 
                            instant assessments, and secure collaboration.
                        </p>
                        <div className="flex space-x-4">
                            <Link
                                to="/login"
                                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Get Started
                                <FaArrowRight className="ml-2" />
                            </Link>
                            <Link
                                to="/demo"
                                className="inline-flex items-center px-6 py-3 border border-gray-600 text-white rounded-lg hover:border-gray-500 transition-colors"
                            >
                                Watch Demo
                            </Link>
                        </div>
                    </div>

                    {/* Clients Section */}
                    <div className="lg:w-1/2">
                        <div className="grid grid-cols-2 gap-6">
                            {clients.map((client, index) => (
                                <div 
                                    key={client.name}
                                    className="bg-gray-800 p-6 rounded-lg"
                                >
                                    <h3 className="text-lg font-semibold text-white mb-2">
                                        {client.name}
                                    </h3>
                                    <p className="text-gray-400 text-sm">
                                        {client.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;
