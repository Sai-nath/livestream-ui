import React from 'react'
import { motion } from 'framer-motion'
import { FaVideo, FaLock, FaChartLine, FaShieldAlt } from 'react-icons/fa'

const FeaturesSection = () => {
  const features = [
    {
      icon: <FaVideo className="text-4xl text-accent-pink" />,
      title: "HD Live Streaming",
      description: "Enterprise-grade video quality with ultra-low latency for real-time claims assessment"
    },
    {
      icon: <FaLock className="text-4xl text-accent-blue" />,
      title: "End-to-End Encryption",
      description: "Bank-grade security protocols ensuring complete data protection and privacy"
    },
    {
      icon: <FaShieldAlt className="text-4xl text-accent-pink" />,
      title: "Compliance Ready",
      description: "Built-in compliance with insurance industry regulations and data protection standards"
    },
    {
      icon: <FaChartLine className="text-4xl text-accent-blue" />,
      title: "Advanced Analytics",
      description: "Comprehensive reporting and insights for better decision-making"
    }
  ]

  return (
    <div className="section bg-background-darker">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold mb-6 section-title">
            Enterprise-Grade <span className="text-gradient">Key Features</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto section-subtitle">
            Advanced capabilities designed for insurance industry leaders
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 section-grid-4">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="feature-card"
            >
              <div className="mb-6">{feature.icon}</div>
              <h3 className="text-xl font-bold text-text-primary mb-4">{feature.title}</h3>
              <p className="text-text-secondary">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FeaturesSection
