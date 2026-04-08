import React from 'react';

/**
 * Popup - Modern modal/overlay component
 * Props:
 * - children: ReactNode - Modal content
 * - onClose: function - Close callback function
 * - theme: object - Theme with colors
 * - size: string - 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 * - title: string - Optional header title
 * - icon: ReactNode - Optional header icon (emoji, svg, etc.)
 * - showClose: boolean - Show close button (default: true)
 * - backdropClick: boolean - Close on backdrop click (default: true)
 * - maxHeight: string - Max height CSS (default: '90vh')
 */

const Popup = ({
  children,
  onClose,
  theme,
  size = 'md',
  title,
  icon,
  showClose = true,
  backdropClick = true,
  maxHeight = '90vh',
}) => {
  const B = theme?.B || {
    surf: '#ffffff',
    border: 'rgba(0,0,0,0.1)',
    text: '#000',
    muted: '#888'
  };

  const T = theme?.T || {
    accentBorder: 'rgba(76,158,235,0.25)',
    accentSoft: 'rgba(76,158,235,0.1)'
  };

  const sizeConfig = {
    sm: { width: 400 },
    md: { width: 480 },
    lg: { width: 640 },
    xl: { width: 800 }
  };

  const maxWidth = sizeConfig[size]?.width || sizeConfig.md.width;

  const handleBackdropClick = (e) => {
    if (backdropClick && e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdropClick}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 999,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Modal Container */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: maxWidth,
          maxHeight: maxHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
          background: B.surf,
          border: `1px solid ${T.accentBorder}`,
          borderRadius: 16,
          zIndex: 1000,
          fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif",
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s ease, opacity 0.2s ease',
        }}
      >
        {/* Header (if title or icon provided) */}
        {(title || icon) && (
          <div
            style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${B.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {icon && (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: T.accentSoft,
                    border: `1px solid ${T.accentBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    transition: 'transform 0.2s ease',
                  }}
                >
                  {icon}
                </div>
              )}
              <div>
                {title && (
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: B.text,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {title}
                  </div>
                )}
              </div>
            </div>
            {showClose && (
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: B.muted,
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 8,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 32,
                  minHeight: 32,
                  ':hover': {
                    background: 'rgba(0,0,0,0.05)',
                    color: B.text,
                  },
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div
          style={{
            padding: (title || icon) ? '20px 24px' : '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

export default Popup;
