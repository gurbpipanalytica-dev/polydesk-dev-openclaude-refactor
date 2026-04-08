import React, { useState } from 'react';

/**
 * PeriodSelector - Modern period selection component with date picker
 * Props:
 * - period: string - Current selected period (1D, 7D, 1M, 3M, ALL, Custom)
 * - setPeriod: function - Callback to update period
 * - customRange: object - {from, to} dates for custom range
 * - setCustomRange: function - Callback to update custom date range
 * - theme: object - Theme with colors
 */

const PERIODS = ["1D", "7D", "1M", "3M", "ALL", "Custom"];

const PeriodSelector = ({ 
  period, 
  setPeriod, 
  customRange = { from: "", to: "" }, 
  setCustomRange, 
  theme 
}) => {
  const B = theme?.B || {
    surf2: '#f7f7f7',
    border: '#e2e2e2',
    muted: '#999',
    text: '#000'
  };
  
  const T = theme?.T || {
    accentSoft: 'rgba(76,158,235,0.1)',
    accentBorder: 'rgba(76,158,235,0.25)',
    accentText: '#4C9EEB'
  };

  const [showCustom, setShowCustom] = useState(period === "Custom");

  const handlePeriodClick = (p) => {
    setPeriod(p);
    if (p !== "Custom") {
      setShowCustom(false);
    }
  };

  const handleCustomClick = () => {
    setPeriod("Custom");
    setShowCustom(s => !s);
  };

  const buttonBaseStyle = {
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 500,
    border: 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    letterSpacing: '0.06em',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    outline: 'none',
    position: 'relative',
    overflow: 'hidden',
  };

  const isActive = (p) => period === p;

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8, 
      flexWrap: 'wrap' 
    }}>
      <div style={{
        display: 'flex',
        background: B.surf2,
        border: `1px solid ${B.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}>
        {PERIODS.filter(p => p !== "Custom").map(p => (
          <button
            key={p}
            onClick={() => handlePeriodClick(p)}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            style={{
              ...buttonBaseStyle,
              background: isActive(p) ? T.accentSoft : 'transparent',
              color: isActive(p) ? T.accentText : B.muted,
              borderRight: `1px solid ${B.border}`,
              fontWeight: isActive(p) ? 600 : 500,
              borderRadius: 0,
              ':hover': {
                background: isActive(p) ? T.accentSoft : 'rgba(0,0,0,0.05)',
              },
              ':last-child': {
                borderRight: 'none',
              },
            }}
          >
            {p}
          </button>
        ))}
        <button
          onClick={handleCustomClick}
          style={{
            ...buttonBaseStyle,
            background: isActive("Custom") ? T.accentSoft : 'transparent',
            color: isActive("Custom") ? T.accentText : B.muted,
            fontWeight: isActive("Custom") ? 600 : 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg 
            width={14} 
            height={14} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={2}
            style={{ opacity: 0.8 }}
          >
            <rect x={3} y={4} width={18} height={18} rx={2} />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Custom
        </button>
      </div>

      {showCustom && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: B.surf2,
          border: `1px solid ${T.accentBorder}`,
          borderRadius: 10,
          padding: '6px 10px',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}>
          <input
            type="date"
            value={customRange.from}
            onChange={e => setCustomRange?.(r => ({ ...r, from: e.target.value }))}
            style={{
              background: 'transparent',
              border: 'none',
              color: B.text,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
              padding: '4px 8px',
              borderRadius: 6,
              ':focus': {
                background: 'rgba(76,158,235,0.05)',
              },
            }}
          />
          <span style={{
            color: B.muted,
            fontSize: 12,
            fontWeight: 500
          }}>→</span>
          <input
            type="date"
            value={customRange.to}
            onChange={e => setCustomRange?.(r => ({ ...r, to: e.target.value }))}
            style={{
              background: 'transparent',
              border: 'none',
              color: B.text,
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
              padding: '4px 8px',
              borderRadius: 6,
              ':focus': {
                background: 'rgba(76,158,235,0.05)',
              },
            }}
          />
          <button
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: T.accentSoft,
              border: `1px solid ${T.accentBorder}`,
              color: T.accentText,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              ':hover': {
                background: T.accentSoft + '80',
              },
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
};

export default PeriodSelector;
