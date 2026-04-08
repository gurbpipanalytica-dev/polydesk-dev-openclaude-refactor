import React from 'react';

/**
 * StatusBadge - Modern status indicator component
 * Props:
 * - status: string - One of: live, paper, paused, error, open, closed, planned
 * - theme: object - Theme object with color definitions
 */

const StatusBadge = ({ status, theme }) => {
  const B = theme?.B || {
    green: '#00C87A',
    blue: '#4C9EEB',
    amber: '#F5A623',
    red: '#F05C5C',
    muted: '#8892A4'
  };

  const statusMap = {
    live: { bg: 'rgba(0,200,122,0.1)', color: B.green, label: 'Live', pulse: true },
    open: { bg: 'rgba(76,158,235,0.1)', color: B.blue, label: 'Open', pulse: true },
    paper: { bg: 'rgba(76,158,235,0.1)', color: B.blue, label: 'Paper' },
    paused: { bg: 'rgba(245,166,35,0.1)', color: B.amber, label: 'Paused' },
    error: { bg: 'rgba(240,92,92,0.1)', color: B.red, label: 'Error' },
    closed: { bg: 'rgba(136,146,164,0.1)', color: B.muted, label: 'Closed' },
    planned: { bg: 'rgba(136,146,164,0.1)', color: B.muted, label: 'Planned' },
  };

  const config = statusMap[status] || {
    bg: 'rgba(136,146,164,0.1)',
    color: B.muted,
    label: status || 'Unknown'
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: config.bg,
        color: config.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.06em',
        padding: '4px 12px',
        borderRadius: 16,
        textTransform: 'uppercase',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        border: `1px solid ${config.color}20`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {config.pulse && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: config.color,
            display: 'inline-block',
            animation: 'pulse 2s infinite',
            boxShadow: `0 0 8px ${config.color}80`,
          }}
        />
      )}
      {config.label}
    </span>
  );
};

export default StatusBadge;
