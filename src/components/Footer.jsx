import React from 'react'
import { FaTwitter, FaLinkedin } from 'react-icons/fa'

const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-background-darker border-t border-background-card py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-2xl font-bold text-text-primary mb-4">iNube LiveStream</h3>
            <p className="text-text-secondary mb-6 max-w-md">
              Enterprise-grade live streaming platform for insurance claims investigation. Trusted by leading insurance companies worldwide.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-text-secondary hover:text-accent-pink transition-colors">
                <FaTwitter size={24} />
              </a>
              <a href="#" className="text-text-secondary hover:text-accent-pink transition-colors">
                <FaLinkedin size={24} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-text-primary mb-4">Solutions</h4>
            <ul className="space-y-3">
              <li><a href="#claims" className="footer-link">Claims Investigation</a></li>
              <li><a href="#assessment" className="footer-link">Remote Assessment</a></li>
              <li><a href="#enterprise" className="footer-link">Enterprise Security</a></li>
              <li><a href="#compliance" className="footer-link">Compliance</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold text-text-primary mb-4">Company</h4>
            <ul className="space-y-3">
              <li><a href="#about" className="footer-link">About Us</a></li>
              <li><a href="#contact" className="footer-link">Contact Sales</a></li>
              <li><a href="#security" className="footer-link">Security</a></li>
              <li><a href="#legal" className="footer-link">Legal</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background-card mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-text-secondary text-sm">
              {currentYear} iNube LiveStream. Enterprise-Grade Video Solutions.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#privacy" className="footer-link text-sm">Privacy Policy</a>
              <a href="#terms" className="footer-link text-sm">Terms of Service</a>
              <a href="#security" className="footer-link text-sm">Security</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
