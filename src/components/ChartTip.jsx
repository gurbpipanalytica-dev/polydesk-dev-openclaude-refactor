import React from 'react';

// The fmt utility is imported from the utils file
import { fmt } from '../utils/format';

const ChartTip = ({ active, payload, label, theme }) => {
  const B = theme?.B || { surf: '#fff', border: '#ccc', muted: '#999', text: '#000' }; // fallback
  
  if (!active || !payload?.length) return null;

  return (
    <div style={{
      background: B.surf,
      border: `1px solid ${B.border}`,
      borderRadius: 8,
      padding: "10px 14px",
      fontSize: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
    }}>
      <div style={{
        color: B.muted,
        marginBottom: 4,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace"
      }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            color: p.color || B.text,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace"
          }}
        >
          {p.name}: {typeof p.value === "number" ? fmt.usd(p.value) : p.value}
        </div>
      ))}
    </div>
  );
};

export default ChartTip;
