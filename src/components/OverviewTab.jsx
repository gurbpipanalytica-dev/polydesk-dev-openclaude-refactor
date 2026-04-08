import React from 'react';
import Card from './Card';
import CardHeader from './CardHeader';
import BotCard from './BotCard';
import Sparkline from './Sparkline';
import TradeTable from './TradeTable';
import PeriodSelector from './PeriodSelector';
import { fmt } from '../utils/format';

/**
 * OverviewTab - Main dashboard view
 * Props:
 * - bots: array - Bot registry from state
 * - allocations: object - Bot allocation amounts {id: amount}
 * - trades: array - Recent trades
 * - theme: object - Theme colors
 * - period: string - Selected period (1D, 7D, 1M, 3M, ALL, Custom)
 * - setPeriod: function - Set period callback
 * - onBotClick: function - Bot card click callback
 */

const OverviewTab = ({ bots = [], allocations = {}, trades = [], theme, period, setPeriod, onBotClick }) => {
  const B = theme?.B || {
    surf: '#fff',
    surf2: '#f7f7f7',
    border: '#e0e0e0',
    text: '#000',
    muted: '#888',
    subtext: '#666',
    green: '#00c87a',
    red: '#f05c5c',
    amber: '#f59e0b',
    blue: '#4c9eeb'
  };

  const T = theme?.T || {
    accentSoft: 'rgba(76,158,235,0.1)',
    accentText: '#4c9eeb',
    accentBorder: 'rgba(76,158,235,0.25)'
  };

  // Calculate total stats
  const totalPnl = bots.reduce((sum, b) => sum + (b.pnl || 0), 0);
  const avgWinRate = bots.length > 0 ? bots.reduce((sum, b) => sum + (b.win || 0), 0) / bots.length : 0;
  const activeBots = bots.filter(b => b.status === 'live' || b.status === 'paper').length;
  const totalTrades = bots.reduce((sum, b) => sum + (b.trades || 0), 0);

  // Recent trades (last 5)
  const recentTrades = trades.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header with period selector and stats */}
      <Card theme={theme}>
        <CardHeader
          title="Dashboard Overview"
          sub="Trading bots performance and recent activity"
          right={<PeriodSelector period={period} setPeriod={setPeriod} theme={theme} />}
          theme={theme}
        />

        <div style={{ padding: '20px 24px' }}>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total P&L', val: fmt.pnl(totalPnl), color: totalPnl >= 0 ? B.green : B.red, sub: 'all time' },
              { label: 'Avg Win Rate', val: `${avgWinRate.toFixed(1)}%`, color: avgWinRate > 50 ? B.green : B.amber, sub: 'across bots' },
              { label: 'Active Bots', val: activeBots, color: isActiveBots > 0 ? B.green : B.muted, sub: 'live/paper' },
              { label: 'Total Trades', val: fmt.num(totalTrades), color: B.text, sub: 'executed' }
            ].map((stat, i) => (
              <div key={i} style={{ background: B.surf2, borderRadius: 8, padding: '12px 16px', border: `1px solid ${B.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: B.dim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 600 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, marginBottom: 2 }}>
                  {stat.val}
                </div>
                <div style={{ fontSize: 9, color: B.dim }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* P&L Sparkline placeholder */}
          <div style={{ marginBottom: 24 }}>
            <CardHeader title="Performance Trend" sub={`${period} view`} theme={theme} />
            <div style={{ padding: '16px', background: B.surf, borderRadius: 8, border: `1px solid ${B.border}` }}>
              <Sparkline positive={totalPnl >= 0} theme={theme} data={[3, 5, 4, 7, 6, 8, 9, 8, 11, 10, 13, 12, 15, 14, 17, 20]} />
            </div>
          </div>
        </div>
      </Card>

      {/* Bot Cards Grid */}
      <Card theme={theme}>
        <CardHeader
          title="Active Bots"
          sub={`${activeBots} bots running · ${bots.length - activeBots} paused`}
          theme={theme}
        />
        
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {bots.map((bot) => (
              <div key={bot.id} onClick={() => onBotClick?.(bot)}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <BotCard
                  bot={bot}
                  allocation={allocations[bot.id] || 0}
                  theme={theme}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Recent Trades */}
      {recentTrades.length > 0 && (
        <Card theme={theme}>
          <CardHeader
            title="Recent Trades"
            sub={`Last ${recentTrades.length} trades`}
            theme={theme}
          />
          
          <div style={{ padding: '16px 24px' }}>
            <TradeTable trades={recentTrades} theme={theme} />
          </div>
        </Card>
      )}
    </div>
  );
};

export default OverviewTab;
