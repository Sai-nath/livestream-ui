import React from 'react';
import { Link } from 'react-router-dom';
import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import BenefitsSection from './BenefitsSection';
import SecuritySection from './SecuritySection';
import CTASection from './CTASection';
import Navbar from './common/Navbar';
import Footer from './common/Footer';

const LandingPage = () => {
    return (
        <div className="min-h-screen bg-gray-900">
            <Navbar />
            <main>
                <HeroSection />
                <FeaturesSection />
                <BenefitsSection />
                <SecuritySection />
                <CTASection />
            </main>
            <Footer />
        </div>
    );
};

export default LandingPage;
