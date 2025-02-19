import React from 'react'
import { motion } from 'framer-motion'
import { FaShieldAlt, FaLock, FaUserShield, FaFileAlt, FaServer, FaKey } from 'react-icons/fa'

const SecuritySection = () => {
  const securityFeatures = [
    {
      icon: <FaLock className="text-4xl text-accent-pink" />,
      title: "End-to-End Encryption",
      description: "AES-256 encryption for all data in transit and at rest"
    },
    {
      icon: <FaUserShield className="text-4xl text-accent-blue" />,
      title: "Multi-Factor Authentication",
      description: "Enterprise-grade MFA with biometric and hardware token support"
    },
    {
      icon: <FaFileAlt className="text-4xl text-accent-pink" />,
      title: "Audit Compliance",
      description: "SOC 2 Type II, HIPAA, and ISO 27001 certified processes"
    },
    {
      icon: <FaServer className="text-4xl text-accent-blue" />,
      title: "Data Residency",
      description: "Regional data centers ensuring compliance with local regulations"
    },
    {
      icon: <FaKey className="text-4xl text-accent-pink" />,
      title: "Access Control",
      description: "Role-based access control with granular permissions"
    },
    {
      icon: <FaShieldAlt className="text-4xl text-accent-blue" />,
      title: "Intrusion Prevention",
      description: "24/7 monitoring with AI-powered threat detection"
    }
  ]

  const certifications = [
    "ISO 27001", "SOC 2 Type II", "HIPAA", "GDPR", "PCI DSS"
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
          <h2 className="text-4xl font-bold mb-6">
            Enterprise-Grade <span className="text-gradient">Security</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            Bank-level security infrastructure protecting your sensitive claims data
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {securityFeatures.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="security-card"
            >
              <div className="mb-6">{feature.icon}</div>
              <h3 className="text-xl font-bold text-text-primary mb-4">{feature.title}</h3>
              <p className="text-text-secondary">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-background-card rounded-xl p-8 border border-background-darker/20"
        >
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-text-primary mb-4">Industry Certifications</h3>
            <div className="flex flex-wrap justify-center gap-4">
              {certifications.map((cert, index) => (
                <div 
                  key={index}
                  className="certification-badge"
                >
                  {cert}
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <h4 className="text-2xl font-bold text-accent-pink mb-2">99.99%</h4>
              <p className="text-text-secondary">Uptime SLA</p>
            </div>
            <div>
              <h4 className="text-2xl font-bold text-accent-blue mb-2">24/7/365</h4>
              <p className="text-text-secondary">Security Monitoring</p>
            </div>
            <div>
              <h4 className="text-2xl font-bold text-accent-pink mb-2">&lt;15min</h4>
              <p className="text-text-secondary">Incident Response</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <div className="inline-block p-6 bg-background-card rounded-xl border border-accent-pink/20">
            <p className="text-xl text-text-primary mb-4">
              "iNube's enterprise security infrastructure exceeds our stringent compliance requirements."
            </p>
            <p className="text-text-secondary">
              - CISO, Global Insurance Corporation
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default SecuritySection
