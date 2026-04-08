import React from 'react';
import Card from './Card';
import CardHeader from './CardHeader';
import StatusBadge from './StatusBadge';
import { fmt } from '../utils/format';

/**
 * BotCard - Modern bot display card component
 * Props:
 * - bot: object - Bot data with id, name, strategy, status, pnl, trades, etc.
 * - allocation: number - Allocated USD amount (default: 0)
 * - theme: object - Theme with colors
 * - onClick: function - Click handler for card
 * - onRemove: function - Remove bot handler (passes bot.id)
 */

const BotCard = ({
  bot,
  allocation = 0,
  theme,
  onClick,
  onRemove
}) => {
  const B = theme?.B || {
    surf: '#fff',
    surf2: '#f7f7f7',
    border: '#e0e0e0',
    text: '#000',
    muted: '#888',
    amber: '#F5A623',
    green: '#00C87A',
    red: '#F05C5C',
    subtext: '#666',
    dim: '#999'
  };

  const T = theme?.T || {
    accentText: '#4C9EEB',
    accentBorder: 'rgba(76,158,235,0.25)'
  };

  const botColor = bot.color || T.accentText;
  const hasAllocation = allocation > 0;
  const isLiveOrPaper = bot.status === 'live' || bot.status === 'paper';

  // Handle P&L coloring
  const pnlValue = bot.pnl || 0;
  const pnlColor = pnlValue >= 0 ? B.green : B.red;

  // Status-based border color
  const borderColor = !hasAllocation && bot.status !== 'planned'
    ? `${B.amber}40`
    : B.border;

  // Card click handler
  const handleCardClick = (e) => {
    if (e.target.closest('button')) return; // Don't trigger if clicking button
    onClick?.(bot);
  };

  // Stats data
  const stats = [
    [
      'Win',
      `${bot.win || 0}%`,
      (bot.win || 0) > 70 ? B.green : (bot.win || 0) > 50 ? B.amber : B.red
    ],
    ['Trades', fmt.num(bot.trades || 0), B.subtext],
    [
      'Ping',
      fmt.ms(bot.ping || 0),
      (bot.ping || 0) < 20 ? B.green : (bot.ping || 0) < 50 ? B.amber : B.red
    ]
  ];

  return (
    <div style={{ position: 'relative' }}>
      <Card
        theme={theme}
        style={{
          borderTop: `3px solid ${botColor}`,
          border: `1px solid ${borderColor}`,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
          ':hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          },
        }}
      >
        {/* No-allocation warning strip */}
        {!hasAllocation && bot.status !== 'planned' && (
          <div
            style={{
              background: `${B.amber}12`,
              borderBottom: `1px solid ${B.amber}25`,
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: B.amber,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              ⚠ NO FUNDS ALLOCATED
            </span>
          </div>
        )}

        {/* Internal padding wrapper */}
        <div style={{ padding: '18px 20px' }}>
          {/* Remove button */}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(bot.id);
              }}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 24,
                height: 24,
                borderRadius: 8,
                background: `${B.red}15`,
                border: `1px solid ${B.red}30`,
                color: B.red,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 5,
                lineHeight: 1,
                fontWeight: 700,
                transition: 'all 0.15s ease',
                ':hover': {
                  background: `${B.red}25`,
                },
              }}
              title="Remove bot"
            >
              ×
            </button>
          )}

          {/* Live indicator pulse */}
          {isLiveOrPaper && (
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 38,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: B.green,
                animation: 'pulse 2s infinite',
                boxShadow: `0 0 8px ${B.green}`,
              }}
            />
          )}

          {/* Bot info header */}
          <div
            style={{
              marginBottom: 12,
              paddingRight: 24,
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: B.text,
                marginBottom: 2,
                lineHeight: 1.3,
              }}
            >
              {bot.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: B.muted,
                lineHeight: 1.4,
              }}
            >
              {bot.strategy}
            </div>
          </div>

          {/* Status badge */}
          <div style={{ marginBottom: 12 }}>
            <StatusBadge
              status={bot.status}
              theme={theme}
            />
          </div>

          {/* P&L section */}
          <div
            style={{
              marginTop: 14,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: pnlColor,
                lineHeight: 1.1,
              }}
            >
              {fmt.pnl(pnlValue)}
            </div>
            <div
              style={{
                fontSize: 11,
                color: B.muted,
                marginTop: 2,
                lineHeight: 1.3,
              }}
            >
              {fmt.pct(bot.pct || 0)} return · {fmt.num(bot.tradesToday || 0)} today
            </div>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 8,
              marginTop: 14,
            }}
          >
            {stats.map(([label, value, color], idx) => (
              <div
                key={`${label}-${idx}`}
                style={{
                  background: B.surf2,
                  borderRadius: 8,
                  padding: '8px 10px',
                  border: `1px solid ${B.border}`,
                  transition: 'all 0.15s ease',
                  ':hover': {
                    background: 'rgba(0,0,0,0.03)',
                  },
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: B.dim,
                    letterSpacing: '0.08em',
                    marginBottom: 3,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {label}
                </div>
                <div
                  className="num"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: color,
                    lineHeight: 1.2,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Allocation display */}
          {hasAllocation && (
            <div
              style={{
                marginTop: 10,
                fontSize: 10,
                color: B.green,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: `${B.green}15`,
                borderRadius: 6,
                padding: '3px 8px',
                width: 'fit-content'
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: B.green,
                  display: 'inline-block',
                  boxShadow: `0 0 6px ${B.green}`,
                }}
              />
              ${allocation.toLocaleString()} allocated
            </div>
          )}

          {/* View trade log link */}
          <div
            style={{
              marginTop: 10,
              fontSize: 11,
              color: T.accentText,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: 'fit-content',
              ':hover': {
                gap: 7,
                color: T.accentText,
              },
            }}
          >
            <svg
              width={10}
              height={10}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            View trade log
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BotCard;
