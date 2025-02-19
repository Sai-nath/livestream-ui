import React from 'react'
import { motion } from 'framer-motion'
import { FaUserTie, FaUserCog, FaUserShield, FaUsers, FaUserCheck, FaChartLine } from 'react-icons/fa'

const RolesSection = () => {
  const roles = [
    {
      icon: <FaUserTie className="text-4xl text-accent-pink" />,
      title: "Claims Manager",
      permissions: [
        "Full administrative control",
        "Audit log access",
        "Team management",
        "Analytics dashboard"
      ]
    },
    {
      icon: <FaUserCog className="text-4xl text-accent-blue" />,
      title: "Claims Adjuster",
      permissions: [
        "Investigation initiation",
        "Live stream control",
        "Report generation",
        "Document management"
      ]
    },
    {
      icon: <FaUserShield className="text-4xl text-accent-pink" />,
      title: "Compliance Officer",
      permissions: [
        "Compliance monitoring",
        "Policy enforcement",
        "Audit trail review",
        "Risk assessment"
      ]
    },
    {
      icon: <FaUsers className="text-4xl text-accent-blue" />,
      title: "Investigation Team",
      permissions: [
        "Stream participation",
        "Evidence collection",
        "Collaboration tools",
        "Case documentation"
      ]
    },
    {
      icon: <FaUserCheck className="text-4xl text-accent-pink" />,
      title: "Quality Assurance",
      permissions: [
        "Review workflows",
        "Quality metrics",
        "Process validation",
        "Performance tracking"
      ]
    },
    {
      icon: <FaChartLine className="text-4xl text-accent-blue" />,
      title: "Analytics Team",
      permissions: [
        "Data analysis",
        "Report generation",
        "Trend monitoring",
        "KPI tracking"
      ]
    }
  ]

  const enterpriseFeatures = [
    {
      title: "Custom Roles",
      description: "Create custom roles with granular permissions to match your organization's structure"
    },
    {
      title: "Role Hierarchy",
      description: "Implement hierarchical access control with inheritance and delegation"
    },
    {
      title: "Department Isolation",
      description: "Ensure data segregation between departments and business units"
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
            Role-Based <span className="text-gradient">Access Control</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            Enterprise-grade permission management tailored for insurance workflows
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {roles.map((role, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="role-card"
            >
              <div className="mb-6">{role.icon}</div>
              <h3 className="text-xl font-bold text-text-primary mb-4">{role.title}</h3>
              <ul className="space-y-2">
                {role.permissions.map((permission, pIndex) => (
                  <li key={pIndex} className="flex items-center text-text-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-pink mr-2"></span>
                    {permission}
                  </li>
                ))}
              </ul>
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
            <h3 className="text-2xl font-bold text-text-primary mb-4">Enterprise Features</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {enterpriseFeatures.map((feature, index) => (
              <div key={index} className="text-center">
                <h4 className="text-xl font-bold text-accent-pink mb-2">{feature.title}</h4>
                <p className="text-text-secondary">{feature.description}</p>
              </div>
            ))}
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
              "The granular role-based access control allows us to maintain strict compliance while streamlining our workflows."
            </p>
            <p className="text-text-secondary">
              - Head of Claims, Leading Insurance Provider
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default RolesSection
