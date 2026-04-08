import React from 'react';

/**
 * CardHeader - Clean, modern card header component
 * Props:
 * - title: string - Main header title (required)
 * - subtitle: string - Optional subtitle/description
 * - theme: object - Theme with colors
 * - action: ReactNode - Optional action element (button, link, etc.) to display on right
 * - variant: string - 'default' | 'compact' for spacing variations
 */

const CardHeader = ({ title, subtitle, theme, action, variant = 'default' }) => {
  const B = theme?.B || {
    text: '#0F1623',
    muted: '#718096'
  };

  const spacing = variant === 'compact' ? '14px 16px' : '18px 20px';

  return (
    <div
      style={{
        padding: `${spacing} 0`,
        marginBottom: variant === 'compact' ? 10 : 14,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: variant === 'compact' ? 12 : 14,
            fontWeight: 600,
            color: B.text,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: variant === 'compact' ? 10 : 11,
              color: B.muted,
              lineHeight: 1.4,
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
};

export default CardHeader;
