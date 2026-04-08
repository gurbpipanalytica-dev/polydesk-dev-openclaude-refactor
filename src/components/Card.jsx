import React from 'react';

/**
 * Card - Clean, modern card container component
 * Props:
 * - children: ReactNode - Content to display in the card
 * - theme: object - Theme with surf and border colors
 * - style: object - Optional inline styles to override defaults
 * - variant: string - 'default' | 'elevated' for different shadow styles
 */

const Card = ({ children, theme, style = {}, variant = 'default' }) => {
  const B = theme?.B || {
    surf: '#ffffff',
    border: 'rgba(0,0,0,0.1)'
  };

  const isDark = theme?.isDark || false;

  const cardStyle = {
    background: B.surf,
    border: `1px solid ${B.border}`,
    borderRadius: '14px',
    boxShadow: isDark 
      ? '0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.10)'
      : '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    ...style,
  };

  return <div style={cardStyle}>{children}</div>;
};

declare module 'react' {
  interface CSSProperties {
    // Allow CSS custom properties
    [key: `--${string}`]: string | number;
  }
}

export default Card;
