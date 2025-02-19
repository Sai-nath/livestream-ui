import React from 'react'
import { motion } from 'framer-motion'
import { FaVideo, FaUserShield, FaChartBar, FaCheckCircle } from 'react-icons/fa'

const HowItWorksSection = () => {
  const steps = [
    {
      icon: <FaVideo className="text-4xl text-accent-pink" />,
      title: "Initiate Secure Session",
      description: "Claims adjuster initiates a secure, encrypted live streaming session with unique access codes"
    },
    {
      icon: <FaUserShield className="text-4xl text-accent-blue" />,
      title: "Multi-Party Authentication",
      description: "All stakeholders authenticate using enterprise-grade security protocols for session access"
    },
    {
      icon: <FaChartBar className="text-4xl text-accent-pink" />,
      title: "Real-Time Assessment",
      description: "Conduct thorough investigation with HD video streaming and collaborative tools"
    },
    {
      icon: <FaCheckCircle className="text-4xl text-accent-blue" />,
      title: "Secure Documentation",
      description: "Automatically generate encrypted reports with complete audit trails"
    }
  ]

  return (
    <div className="section">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-6 section-title">
            Enterprise-Grade <span className="text-gradient">Process</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto section-subtitle">
            Streamlined workflow designed for insurance industry compliance
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 section-grid-4">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="process-card relative"
            >
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-accent-pink text-white flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div className="mb-6">{step.icon}</div>
              <h3 className="text-xl font-bold text-text-primary mb-4">{step.title}</h3>
              <p className="text-text-secondary">{step.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 p-8 bg-background-card rounded-xl border border-background-darker/20"
        >
          <div className="grid md:grid-cols-3 gap-8 section-grid-3">
            <div className="text-center">
              <h4 className="text-2xl font-bold text-accent-pink mb-2">Enterprise SLA</h4>
              <p className="text-text-secondary">99.9% Uptime Guarantee</p>
            </div>
            <div className="text-center">
              <h4 className="text-2xl font-bold text-accent-blue mb-2">24/7 Support</h4>
              <p className="text-text-secondary">Dedicated Enterprise Team</p>
            </div>
            <div className="text-center">
              <h4 className="text-2xl font-bold text-accent-pink mb-2">ISO 27001</h4>
              <p className="text-text-secondary">Security Certified</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default HowItWorksSection
