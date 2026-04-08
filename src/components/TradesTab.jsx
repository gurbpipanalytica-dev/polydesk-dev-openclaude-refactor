import React, { useState, useMemo } from 'react';
import Card from './Card';
import CardHeader from './CardHeader';
import TradeTable from './TradeTable';
import PeriodSelector from './PeriodSelector';
import StatusBadge from './StatusBadge';
import { fmt } from '../utils/format';

/**
 * TradesTab - Full trade history with filtering and search
 * Props:
 * - trades: array - All trades from orchestrator
 * - bots: array - Bot registry for filtering
 * - theme: object - Theme with colors
 * - period: string - Selected period
 * - setPeriod: function - Period change callback
 */

const TradesTab = ({ trades = [], bots = [], theme, period, setPeriod }) => {
  const B = theme?.B || {
    surf: '#fff',
    surf2: '#f7f7f7',
    border: '#e0e0e0',
    text: '#000',
    muted: '#888',
    subtext: '#666',
    dim: '#999',
    green: '#00c87a',
    red: '#f05c5c',
    amber: '#f59e0b',
    blue: '#4c9eeb'
  };

  // Filtering state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'open' | 'closed'
  const [botFilter, setBotFilter] = useState('all'); // 'all' or bot.id
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  // Bot names map for filtering
  const botNames = useMemo(() => {
    const map = {};
    bots.forEach(b => {
      const key = b.file?.replace('polydesk_', '').replace('.py', '') || `bot_${b.id}`;
      map[key] = b.name;
    });
    return map;
  }, [bots]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      // Search filter
      if (search && !JSON.stringify(t).toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && (t.status || 'closed') !== statusFilter) {
        return false;
      }
      // Bot filter
      if (botFilter !== 'all' && t.bot_id && t.bot_id !== botFilter) {
        return false;
      }
      return true;
    });
  }, [trades, search, statusFilter, botFilter]);

  // Paginated trades
  const pageCount = Math.max(1, Math.ceil(filteredTrades.length / itemsPerPage));
  const paginatedTrades = filteredTrades.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Stats calculations
  const totalPnl = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const closedTrades = filteredTrades.filter(t => t.status === 'closed');
  const winRate = closedTrades.length > 0 ? (closedTrades.filter(t => (t.pnl || 0) > 0).length / closedTrades.length) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header with controls */}
      <Card theme={theme}>
        <CardHeader
          title="Trade History"
          sub={`${filteredTrades.length} trades · ${bots.length} bots`}
          right={<PeriodSelector period={period} setPeriod={setPeriod} theme={theme} />}
          theme={theme}
        />

        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${B.border}` }}>
          {/* Search and filters */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type="text"
                placeholder="Search markets, IDs..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${B.border}`,
                  background: B.surf,
                  color: B.text,
                  fontSize: 12,
                  outline: 'none',
                  transition: 'all 0.15s ease',
                  ':focus': {
                    borderColor: T.accentText,
                    boxShadow: `0 0 0 2px ${T.accentSoft}`
                  }
                }}
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${B.border}`,
                background: B.surf,
                color: B.text,
                fontSize: 12,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>

            {/* Bot filter */}
            <select
              value={botFilter}
              onChange={(e) => { setBotFilter(e.target.value); setPage(1); }}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${B.border}`,
                background: B.surf,
                color: B.text,
                fontSize: 12,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: 'pointer',
                outline: 'none',
                minWidth: 140
              }}
            >
              <option value="all">All Bots</option>
              {bots.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); setBotFilter('all'); setPage(1); }}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${B.border}`,
                background: B.surf2,
                color: B.muted,
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                ':hover': { background: B.surf }
              }}
            >
              Clear
            </button>
          </div>

          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${B.border}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: B.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Total P&L</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: totalPnl >= 0 ? B.green : B.red }}>
                {fmt.pnl(totalPnl)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: B.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Win Rate</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: winRate > 50 ? B.green : B.amber }}>
                {winRate.toFixed(1)}%
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: B.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Trades</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>
                {fmt.num(filteredTrades.length)}
              </div>
            </div>
          </div>
        </div>

        {/* Trade list */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <TradeTable trades={paginatedTrades} theme={theme} />
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            borderTop: `1px solid ${B.border}`,
            fontSize: 11,
            color: B.muted
          }}>
            <div>Page {page} of {pageCount}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${B.border}`,
                  background: B.surf2,
                  color: B.muted,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(pageCount, page + 1))}
                disabled={page === pageCount}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${B.border}`,
                  background: B.surf2,
                  color: B.muted,
                  cursor: page === pageCount ? 'not-allowed' : 'pointer',
                  opacity: page === pageCount ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TradesTab;
