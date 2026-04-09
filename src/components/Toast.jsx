import { useEffect, useState } from 'react';

/**
 * Toast Component
 * Modern glass-morphism design matching Polydesk aesthetic
 * Phase 8.1 Implementation
 */

const TYPE_STYLES = {
  success: {
    icon: '✓',
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.3)',
    text: '#10b981',
  },
  error: {
    icon: '✕',
    bg: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.3)',
    text: '#ef4444',
  },
  warning: {
    icon: '⚠',
    bg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.3)',
    text: '#f59e0b',
  },
  info: {
    icon: 'ℹ',
    bg: 'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.3)',
    text: '#3b82f6',
  },
};

export const Toast = ({ toast, onClose, theme }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 200);
  };

  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  return (
    <div className={`toast-item ${isVisible && !isLeaving ? 'visible' : ''}`}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        transform: isVisible && !isLeaving ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        opacity: isVisible && !isLeaving ? 1 : 0,
        maxWidth: '320px',
        zIndex: 1000,
      }}
    >
      <span style={{ fontSize: '16px', fontWeight: '600' }}>{style.icon}</span>
      <span style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>{toast.message}</span>
      <button
        onClick={handleClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: style.text,
          cursor: 'pointer',
          fontSize: '16px',
          padding: '0',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.7,
          transition: 'opacity 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.opacity = 1}
        onMouseOut={(e) => e.currentTarget.style.opacity = 0.7}
      >
        ✕
      </button>
    </div>
  );
};

export default Toast;
