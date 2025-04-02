import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Check if theme preference is stored in localStorage
  const storedTheme = localStorage.getItem('theme');
  const [theme, setTheme] = useState(storedTheme || 'dark');
  
  // Update the theme class on both document element and body
  useEffect(() => {
    // Remove both theme classes first
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.body.classList.remove('theme-light', 'theme-dark');
    
    // Add the current theme class
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
    
    // Store the theme preference in localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
