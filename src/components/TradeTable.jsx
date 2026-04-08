import React from 'react';
import StatusBadge from './StatusBadge';
import { fmt } from '../utils/format';

/**
 * TradeTable - Modern trade history table with sorting
 * Props:
 * - trades: array - Trade objects from orchestrator
 * - theme: object - Theme with colors
 * - loading: boolean - Loading state
 * - onTradeClick: function - Callback when trade row clicked
 */

const TradeTable = ({ trades = [], theme, loading = false, onTradeClick }) => {
  const B = theme?.B || {
    surf: '#fff',
    surf2: '#f7f7f7',
    border: '#e0e0e0',
    text: '#000',
    muted: '#888',
    dim: '#999',
    subtext: '#666',
    green: '#00c87a',
    red: '#f05c5c',
    purple: '#9b87f5'
  };

  const T = theme?.T || {
    accentSoft: 'rgba(76,158,235,0.1)',
    accentText: '#4c9eeb'
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: B.muted }}>
        <div style={{ fontSize: 20, marginBottom: 12, animation: 'pulse 1s infinite' }}>⟳</div>
        <div style={{ fontSize: 12 }}>Loading trades...</div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: B.subtext, marginBottom: 6 }}>No trades yet</div>
        <div style={{ fontSize: 11, color: B.muted, lineHeight: 1.6 }}>Trades will appear here once bots start executing</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: `1px solid ${B.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: B.surf2, borderBottom: `1px solid ${B.border}`, position: 'sticky', top: 0, zIndex: 10 }}>
            {['Market', 'Side', 'Size', 'Entry', 'P&L', 'Status', 'Time'].map((col) => (
              <th key={col} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: B.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const isOpen = t.status === 'open';
            const pnl = t.pnl ?? t.profit ?? null;
            const side = t.side || '—';
            const sideColor = side === 'YES' || side === 'BUY' ? B.green : B.red;

            return (
              <tr
                key={t.id || i}
                onClick={() => onTradeClick?.(t)}
                style={{
                  background: isOpen ? T.accentSoft : (i % 2 === 0 ? B.surf : 'transparent'),
                  transition: 'all 0.15s ease',
                  cursor: onTradeClick ? 'pointer' : 'default',
                  borderBottom: `1px solid ${B.border}`,
                }}
              >
                <td style={{ padding: '14px 16px', color: B.text, fontWeight: 500 }}>
                  <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 250 }}>
                    {t.market || t.question || 'Trade'}
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${sideColor}18`,
                    color: sideColor
                  }}>
                    {side}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: B.text }}>{t.size != null ? fmt.usd(t.size, 0) : '—'}</td>
                <td style={{ padding: '14px 16px', color: B.subtext }}>{t.entry != null ? fmt.dec(t.entry, 2) : '—'}</td>
                <td style={{ padding: '14px 16px', color: isOpen ? T.accentText : (pnl > 0 ? B.green : pnl < 0 ? B.red : B.dim) }}>
                  {isOpen ? 'Open' : pnl != null ? fmt.pnl(pnl) : '—'}
                </td>
                <td style={{ padding: '14px 16px' }}><StatusBadge status={t.status || 'closed'} theme={theme} /></td>
                <td style={{ padding: '14px 16px', color: B.dim, fontSize: 10 }}>{t.time || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TradeTable;
