import React, { useState } from 'react';
import Card from './Card';
import CardHeader from './CardHeader';
import StatusBadge from './StatusBadge';

/**
 * CommandPanel - Bot command and control interface
 * Props:
 * - bot: object - Bot data {id, name, strategy, status, pnl, trades, win, ping, ...}
 * - allocation: number - Allocated amount
 * - theme: object - Theme with colors
 * - onStart: function - Start bot callback (bot.id)
 * - onStop: function - Stop bot callback (bot.id)
 * - onPause: function - Pause bot callback (bot.id)
 * - onSetAllocation: function - Set allocation callback (bot.id, amount)
 * - onSetParams: function - Set bot parameters callback (bot.id, params)
 */

const CommandPanel = ({
  bot,
  allocation = 0,
  theme,
  onStart,
  onStop,
  onPause,
  onSetAllocation,
  onSetParams
}) => {
  const B = theme?.B || {
    surf: '#fff',
    surf2: '#f7f7f7',
    border: '#e0e0e0',
    text: '#000',
    muted: '#888',
    amber: '#f59e0b',
    green: '#00c87a',
    red: '#f05c5c',
    blue: '#4c9eeb',
    subtext: '#666',
    dim: '#999'
  };

  const T = theme?.T || {
    accentSoft: 'rgba(76,158,235,0.1)',
    accentBorder: 'rgba(76,158,235,0.25)',
    accentText: '#4c9eeb'
  };

  // Local state for input fields
  const [allocInput, setAllocInput] = useState(allocation || 0);
  const [riskLimit, setRiskLimit] = useState(20); // Default 20% stop loss
  const [showConfirm, setShowConfirm] = useState(null); // 'start' | 'stop' | 'pause'
  const [isExecuting, setIsExecuting] = useState(false);

  // Validation
  const isValidAllocation = allocInput >= 5 && allocInput <= 10000;
  const canStart = bot.status !== 'live' && bot.status !== 'paper' && !isExecuting;
  const canStop = (bot.status === 'live' || bot.status === 'paper') && !isExecuting;
  const canPause = bot.status === 'live' && !isExecuting;

  // Handle action with confirmation
  const handleAction = async (action) => {
    setShowConfirm(action);
  };

  const confirmAction = async () => {
    setIsExecuting(true);
    setShowConfirm(null);

    try {
      switch (showConfirm) {
        case 'start':
          await onStart?.(bot.id);
          break;
        case 'stop':
          await onStop?.(bot.id);
          break;
        case 'pause':
          await onPause?.(bot.id);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Failed to ${showConfirm} bot:`, error);
    } finally {
      setIsExecuting(false);
    }
  };

  const isActive = bot.status === 'live' || bot.status === 'paper';

  return (
    <Card
      theme={theme}
      style={{
        padding: 0,
        border: `1px solid ${isActive ? T.accentBorder : B.border}`,
        boxShadow: isActive
          ? `0 4px 12px ${T.accentSoft}, 0 0 20px ${T.accentSoft}`
          : `${B.surf2} 0 4px 12px`,
      }}
    >
      {/* Header with bot info */}
      <CardHeader
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isActive ? B.green : B.muted,
              display: 'inline-block',
              boxShadow: isActive ? `0 0 8px ${B.green}` : 'none',
              animation: isActive ? 'pulse 2s infinite' : 'none',
            }}
          />
          {bot.name}
        </span>}
        sub={bot.strategy}
        right={<StatusBadge status={bot.status} theme={theme} />}
        theme={theme}
      />

      <div style={{ padding: '20px 24px' }}>
        {/* Quick stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            ['P&L', `${bot.pnl || 0}`],
            ['Win Rate', `${bot.win || 0}%`],
            ['Trades', `${bot.trades || 0}`],
          ].map(([label, value], idx) => (
            <div
              key={idx}
              style={{
                background: B.surf2,
                borderRadius: 8,
                padding: '10px 12px',
                border: `1px solid ${B.border}`,
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
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: B.text,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginBottom: 20,
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={() => handleAction('start')}
            disabled={!canStart}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: canStart ? `${B.green}15` : B.surf2,
              border: `1px solid ${canStart ? B.green : B.border}`,
              color: canStart ? B.green : B.muted,
              cursor: canStart ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              opacity: canStart ? 1 : 0.5,
              ':hover': canStart ? {
                background: `${B.green}25`,
              } : {},
            }}
          >
            {isExecuting && showConfirm === 'start' ? '⟳' : '▶'} Start
          </button>

          <button
            onClick={() => handleAction('pause')}
            disabled={!canPause}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: canPause ? `${B.amber}15` : B.surf2,
              border: `1px solid ${canPause ? B.amber : B.border}`,
              color: canPause ? B.amber : B.muted,
              cursor: canPause ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              opacity: canPause ? 1 : 0.5,
              ':hover': canPause ? {
                background: `${B.amber}25`,
              } : {},
            }}
          >
            {isExecuting && showConfirm === 'pause' ? '⟳' : '⏸'} Pause
          </button>

          <button
            onClick={() => handleAction('stop')}
            disabled={!canStop}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: canStop ? `${B.red}15` : B.surf2,
              border: `1px solid ${canStop ? B.red : B.border}`,
              color: canStop ? B.red : B.muted,
              cursor: canStop ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              opacity: canStop ? 1 : 0.5,
              ':hover': canStop ? {
                background: `${B.red}25`,
              } : {},
            }}
          >
            {isExecuting && showConfirm === 'stop' ? '⟳' : '⏹'} Stop
          </button>
        </div>

        {/* Parameters Section */}
        <div
          style={{
            borderTop: `1px solid ${B.border}`,
            paddingTop: 16,
            marginTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: B.muted,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Bot Parameters
          </div>

          {/* Allocation */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, color: B.subtext }}>Allocation (USD)</span>
              <span style={{ fontSize: 10, color: B.muted }}>Min: $5</span>
            </div>
            <input
              type="number"
              min={5}
              max={10000}
              step={5}
              value={allocInput}
              onChange={(e) => setAllocInput(parseInt(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${B.border}`,
                background: B.surf,
                color: B.text,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
                transition: 'all 0.15s ease',
                ':focus': {
                  borderColor: T.accentText,
                  boxShadow: `0 0 0 2px ${T.accentSoft}`,
                },
              }}
            />
          </div>

          {/* Risk Limit */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, color: B.subtext }}>Risk Limit (%)</span>
              <span style={{ fontSize: 10, color: B.muted }}>Stop loss</span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={riskLimit}
              onChange={(e) => setRiskLimit(parseInt(e.target.value))}
              style={{
                width: '100%',
                height: 6,
                background: B.surf2,
                borderRadius: 3,
                outline: 'none',
                appearance: 'none',
                '::-webkit-slider-thumb': {
                  appearance: 'none',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: T.accentText,
                  cursor: 'pointer',
                  boxShadow: `0 2px 4px rgba(0,0,0,0.2)`,
                },
              }}
            />
            <div
              style={{
                textAlign: 'right',
                fontSize: 10,
                color: B.muted,
                marginTop: 4,
              }}
            >
              {riskLimit}%
            </div>
          </div>

          {/* Apply Parameters Button */}
          <button
            onClick={() => {
              onSetParams?.(bot.id, {
                allocation: allocInput,
                riskLimit,
              });
              onSetAllocation?.(bot.id, allocInput);
            }}
            disabled={!isValidAllocation}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: isValidAllocation
                ? `${T.accentSoft}`
                : B.surf2,
              border: `1px solid ${isValidAllocation ? T.accentBorder : B.border}`,
              color: isValidAllocation ? T.accentText : B.muted,
              cursor: isValidAllocation ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              opacity: isValidAllocation ? 1 : 0.5,
              ':hover': isValidAllocation ? {
                background: `${T.accentSoft}80`,
              } : {},
            }}
          >
            Apply Parameters
          </button>
        </div>
      </div>

      {/* Confirmation Dialog (shown when action clicked) */}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: B.surf,
            border: `1px solid ${T.accentBorder}`,
            borderRadius: 12,
            padding: '20px',
            zIndex: 2000,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            minWidth: 280,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 10,
              color: B.text,
            }}
          >
            Confirm {showConfirm.charAt(0).toUpperCase() + showConfirm.slice(1)}
          </div>
          <div style={{ fontSize: 12, color: B.muted, marginBottom: 20 }}>
            Are you sure you want to {showConfirm} {bot.name}?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowConfirm(null)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 11,
                background: B.surf2,
                border: `1px solid ${B.border}`,
                color: B.muted,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmAction}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: `${T.accentSoft}`,
                border: `1px solid ${T.accentBorder}`,
                color: T.accentText,
                cursor: 'pointer',
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default CommandPanel;
