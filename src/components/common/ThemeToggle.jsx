import React from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';
import { useTheme } from '../../contexts/ThemeContext';
import '../../styles/theme.css';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div className="theme-toggle-container" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      <label className="theme-toggle">
        <input 
          type="checkbox" 
          checked={theme === 'light'}
          onChange={toggleTheme}
        />
        <span className="toggle-slider">
          <div className="toggle-icons">
            <div className="sun-icon"><FaSun /></div>
            <div className="moon-icon"><FaMoon /></div>
          </div>
        </span>
      </label>
    </div>
  );
};

export default ThemeToggle;
