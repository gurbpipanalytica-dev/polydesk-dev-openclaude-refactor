import { useState, useCallback } from 'react';

const DEFAULT_DURATION = 5000;

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const useNotifications = () => {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, type = 'info', duration = DEFAULT_DURATION) => {
    const id = generateId();
    
    setToasts(prev => [...prev, { id, message, type }]);
    
    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
    
    return id;
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Convenience methods
  const success = useCallback((message, duration) => 
    notify(message, 'success', duration), [notify]);
  
  const error = useCallback((message, duration) => 
    notify(message, 'error', duration), [notify]);
  
  const warning = useCallback((message, duration) => 
    notify(message, 'warning', duration), [notify]);
  
  const info = useCallback((message, duration) => 
    notify(message, 'info', duration), [notify]);

  return {
    toasts,
    notify,
    remove,
    success,
    error,
    warning,
    info
  };
};
