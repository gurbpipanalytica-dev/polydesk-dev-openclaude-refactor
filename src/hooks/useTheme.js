import { useContext } from 'react';

// Theme context will be provided by App.jsx
export const ThemeCtx = {
  // Placeholder for the actual context
  // Will be set by App.jsx at runtime
};

// Add a setter for App.jsx to configure the context
export const setThemeContext = (ctx) => {
  ThemeCtx.context = ctx;
};

export const useTheme = () => {
  return useContext(ThemeCtx.context);
};
