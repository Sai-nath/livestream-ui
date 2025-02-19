import React from 'react'
import { motion } from 'framer-motion'
import { FaClock, FaChartLine, FaShieldAlt, FaUserLock } from 'react-icons/fa'

const BenefitsSection = () => {
  const benefits = [
    {
      icon: <FaClock className="text-4xl text-accent-pink" />,
      title: "50% Faster Resolution",
      description: "Significantly reduce claim processing time with real-time investigation"
    },
    {
      icon: <FaChartLine className="text-4xl text-accent-blue" />,
      title: "30% Cost Reduction",
      description: "Lower operational costs through efficient remote assessment capabilities"
    },
    {
      icon: <FaShieldAlt className="text-4xl text-accent-pink" />,
      title: "Enhanced Accuracy",
      description: "Improve claim assessment accuracy with high-quality video evidence"
    },
    {
      icon: <FaUserLock className="text-4xl text-accent-blue" />,
      title: "Risk Mitigation",
      description: "Reduce fraud risk with secure, documented investigation processes"
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
          <h2 className="text-4xl font-bold mb-6">
            Measurable <span className="text-gradient">Business Benefits</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            Delivering tangible ROI for enterprise insurance operations
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="benefit-card"
            >
              <div className="mb-6">{benefit.icon}</div>
              <h3 className="text-xl font-bold text-text-primary mb-4">{benefit.title}</h3>
              <p className="text-text-secondary">{benefit.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-block p-6 bg-background-card rounded-xl border border-background-darker/20">
            <p className="text-xl text-text-primary mb-4">
              "iNube has revolutionized our claims investigation process, delivering substantial time and cost savings."
            </p>
            <p className="text-text-secondary">
              - Chief Claims Officer, Leading Insurance Provider
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default BenefitsSection
