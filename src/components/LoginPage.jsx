import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // TODO: Implement actual login logic here
      console.log('Login attempt with:', formData);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background-darker">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded-lg bg-[#1a1f2e]"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Sign in to your account
          </h2>
          <p className="text-sm text-gray-400">
            Access your video streaming dashboard
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email address"
              className="w-full px-4 py-3 rounded bg-[#12151f] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          
          <div>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Password"
              className="w-full px-4 py-3 rounded bg-[#12151f] border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center text-gray-400">
              <input
                type="checkbox"
                className="mr-2 w-4 h-4 rounded border-gray-700 bg-[#12151f]"
              />
              Remember me
            </label>
            <a href="#" className="text-blue-500 hover:text-blue-400">
              Forgot your password?
            </a>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
          >
            Sign in
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default LoginPage;
