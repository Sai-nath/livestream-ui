import React from 'react';
import { motion } from 'framer-motion';

const CTASection = () => {
  return (
    <div className="section">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-8 max-w-4xl mx-auto"
        >
          <h2 className="text-4xl font-bold">
            Ready to Transform Your
            <span className="text-gradient"> Claims Investigation?</span>
          </h2>
          
          <p className="text-xl text-text-secondary">
            Join leading insurance companies in revolutionizing their claims process
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 my-12">
            <div className="stat-card">
              <h3 className="text-4xl font-bold text-accent-pink">30M+</h3>
              <p className="text-text-secondary">Claims Processed</p>
            </div>
            <div className="stat-card">
              <h3 className="text-4xl font-bold text-accent-blue">99.9%</h3>
              <p className="text-text-secondary">Uptime SLA</p>
            </div>
            <div className="stat-card">
              <h3 className="text-4xl font-bold text-accent-pink">24/7</h3>
              <p className="text-text-secondary">Enterprise Support</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <button className="btn-pink">
              Schedule Enterprise Demo
            </button>
            <button className="btn-secondary">
              Contact Sales Team
            </button>
          </div>

          <p className="text-sm text-text-secondary pt-4">
            Enterprise-grade security • Dedicated support • Custom integration
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default CTASection;
