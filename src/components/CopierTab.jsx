import React, { useState, useMemo } from "react";
import Card from "./Card";
import CardHeader from "./CardHeader";
import StatusBadge from "./StatusBadge";
import ChartTip from "./ChartTip";
import TradeTable from "./TradeTable";

export default function CopierTab({ theme = DARK, trades = [] }) {
  const [leaderboardData] = useState([
    { rank: 1, name: "WhaleMaster", address: "0x742d...A3b9", roi: 127, copiers: 284, copied: 89200, maxDrawdown: "-8.2%", avgTrade: "4.2h", winRate: 68, risk: "high", following: false },
    { rank: 2, name: "DeFi_Sniper", address: "0x8ba...C7f2", roi: 89, copiers: 156, copied: 54700, maxDrawdown: "-5.1%", avgTrade: "2.1h", winRate: 74, risk: "medium", following: false },
    { rank: 3, name: "Arbitrage_Pro", address: "0x9cd...E8a3", roi: 65, copiers: 98, copied: 42300, maxDrawdown: "-3.8%", avgTrade: "8.5h", winRate: 82, risk: "low", following: false },
    { rank: 4, name: "Bot_Runner", address: "0x3ef...F1b4", roi: 54, copiers: 72, copied: 31800, maxDrawdown: "-6.7%", avgTrade: "12.3h", winRate: 71, risk: "medium", following: false },
    { rank: 5, name: "Quick_Flip", address: "0xa1b...D9c5", roi: 43, copiers: 45, copied: 27900, maxDrawdown: "-4.2%", avgTrade: "1.8h", winRate: 76, risk: "medium", following: false },
    { rank: 6, name: "Yield_Hunter", address: "0x7c2...G6d7", roi: 38, copiers: 38, copied: 23400, maxDrawdown: "-2.4%", avgTrade: "24.1h", winRate: 69, risk: "low", following: false }
  ]);

  const [selectedTrader, setSelectedTrader] = useState(null);
  const [copiedTrades, setCopiedTrades] = useState([]);
  const [filterRisk, setFilterRisk] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredLeaderboard = useMemo(() => {
    return leaderboardData.filter(trader => {
      const matchesRisk = filterRisk === "all" || trader.risk === filterRisk;
      const matchesSearch = searchQuery === "" || 
        trader.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trader.address.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRisk && matchesSearch;
    });
  }, [leaderboardData, filterRisk, searchQuery]);

  const following = useMemo(() => {
    return leaderboardData.filter(t => t.following);
  }, [leaderboardData]);

  const onFollowTrader = (trader) => {
    const updated = leaderboardData.map(t => 
      t.address === trader.address ? { ...t, following: !t.following } : t
    );
    setSelectedTrader(trader);
  };

  const onCopyTrade = (trader, allocation) => {
    console.log(`Copying ${trader.name} with ${allocation}% allocation`);
  };

  const onViewStrategy = (trader) => {
    console.log(`Viewing strategy for ${trader.name}`);
  };

  const copiedTradeColumns = [
    { key: "timestamp", label: "Time", render: (v) => new Date(v).toLocaleString() },
    { key: "trader", label: "Trader" },
    { key: "symbol", label: "Asset" },
    { key: "type", label: "Type", render: (v) => v.toUpperCase() },
    { key: "pnl", label: "P&L", render: (v) => `$${v.toFixed(2)}` },
    { key: "status", label: "Status", render: (v) => <StatusBadge theme={theme} status={v} /> }
  ];

  return (
    <div className="copier-container" style={{ color: theme.text }}>
      <style jsx>{`
        .copier-container {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }
        .leaderboard-header {
          background: linear-gradient(135deg, ${theme.blueSoft}, ${theme.purpleSoft});
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 32px;
          position: relative;
          overflow: hidden;
        }
        .header-title {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 8px;
          color: ${theme.text};
        }
        .header-subtitle {
          font-size: 16px;
          color: ${theme.subtext};
          max-width: 600px;
        }
        .controls {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          align-items: center;
        }
        .search-box {
          flex: 1;
          max-width: 400px;
          position: relative;
        }
        .search-input {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border: 1px solid ${theme.border};
          background: ${theme.surf};
          color: ${theme.text};
          border-radius: 12px;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .search-input:focus {
          outline: none;
          border-color: ${theme.blue};
          background: ${theme.surf2};
        }
        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: ${theme.muted};
        }
        .filter-group {
          display: flex;
          gap: 8px;
          background: ${theme.surf};
          border: 1px solid ${theme.border};
          border-radius: 12px;
          padding: 4px;
        }
        .filter-btn {
          padding: 8px 16px;
          border: none;
          background: transparent;
          color: ${theme.subtext};
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .filter-btn.active {
          background: ${theme.blueSoft};
          color: ${theme.blue};
        }
        .leaderboard-table {
          background: ${theme.surf};
          border: 1px solid ${theme.border};
          border-radius: 16px;
          overflow: hidden;
          margin-bottom: 32px;
        }
        .table-header {
          display: grid;
          grid-template-columns: 60px 300px 120px 120px 120px 120px 120px 100px;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid ${theme.border};
          background: ${theme.surf2};
        }
        .table-header-cell {
          font-size: 13px;
          font-weight: 600;
          color: ${theme.muted};
          text-transform: uppercase;
        }
        .trader-row {
          display: grid;
          grid-template-columns: 60px 300px 120px 120px 120px 120px 120px 100px;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid ${theme.border};
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .trader-row:hover {
          background: ${theme.surf2};
          transform: translateX(4px);
        }
        .trader-row:last-child {
          border-bottom: none;
        }
        .rank {
          font-size: 18px;
          font-weight: 700;
          color: ${theme.muted};
        }
        .rank-1 { color: #FFD700; }
        .rank-2 { color: #C0C0C0; }
        .rank-3 { color: #CD7F32; }
        .trader-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .trader-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${theme.blueSoft}, ${theme.purpleSoft});
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          color: ${theme.text};
        }
        .trader-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .trader-name {
          font-size: 15px;
          font-weight: 600;
          color: ${theme.text};
        }
        .trader-address {
          font-size: 13px;
          color: ${theme.subtext};
          font-family: monospace;
        }
        .roi {
          font-size: 18px;
          font-weight: 700;
        }
        .roi.positive { color: ${theme.green}; }
        .roi.negative { color: ${theme.red}; }
        .metric {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .metric-value {
          font-size: 16px;
          font-weight: 600;
          color: ${theme.text};
        }
        .metric-label {
          font-size: 12px;
          color: ${theme.muted};
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        .action-btn {
          padding: 8px 12px;
          border: 1px solid ${theme.border};
          background: ${theme.surf};
          color: ${theme.text};
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          background: ${theme.surf2};
          border-color: ${theme.borderHover};
        }
        .btn-primary {
          background: ${theme.blueSoft};
          border-color: ${theme.blue};
          color: ${theme.blue};
        }
        .btn-success {
          background: ${theme.greenSoft};
          border-color: ${theme.green};
          color: ${theme.green};
        }
        .btn-danger {
          background: ${theme.redSoft};
          border-color: ${theme.red};
          color: ${theme.red};
        }
        .copied-section {
          margin-top: 32px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 16px;
          color: ${theme.text};
        }
        .following-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .following-card {
          background: ${theme.surf};
          border: 1px solid ${theme.border};
          border-radius: 12px;
          padding: 20px;
          transition: all 0.2s ease;
        }
        .following-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
          border-color: ${theme.borderHover};
        }
        .following-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .following-name {
          font-size: 16px;
          font-weight: 600;
          color: ${theme.text};
        }
        .alloc-progress {
          height: 4px;
          background: ${theme.dim};
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .alloc-fill {
          height: 100%;
          background: ${theme.blue};
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .following-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .following-stat {
          text-align: center;
        }
        .following-stat-value {
          font-size: 16px;
          font-weight: 600;
          color: ${theme.text};
        }
        .following-stat-label {
          font-size: 12px;
          color: ${theme.muted};
        }
        .risk-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
        }
        .risk-high { background: ${theme.redSoft}; color: ${theme.red}; }
        .risk-medium { background: ${theme.amberSoft}; color: ${theme.amber}; }
        .risk-low { background: ${theme.greenSoft}; color: ${theme.green}; }
        @media (max-width: 1200px) {
          .table-header,
          .trader-row {
            grid-template-columns: 60px 250px 100px 100px 100px 100px 100px 100px;
          }
        }
        @media (max-width: 968px) {
          .table-header,
          .trader-row {
            grid-template-columns: 60px 1fr 100px 100px 80px;
          }
          .table-header-cell:nth-child(4),
          .table-header-cell:nth-child(5),
          .table-header-cell:nth-child(6),
          .metric:nth-child(3),
          .metric:nth-child(4),
          .metric:nth-child(5) {
            display: none;
          }
        }
      `}</style>
      
      <div className="header-section">
        <div>
          <div className="title" style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: theme.text }}>
            Whale Copy Trading
          </div>
          <div className="subtitle" style={{ color: theme.subtext, fontSize: "16px" }}>
            Follow and copy successful traders automatically
          </div>
        </div>
      </div>

      <div className="leaderboard-header">
        <div className="header-title">🏆 Top Performing Traders</div>
        <div className="header-subtitle">
          Discover the most successful traders in the ecosystem. Analyze their strategies, performance metrics, and copy their trades automatically.
        </div>
        <ChartTip theme={theme} align="right">
          <strong>Leaderboard Metrics</strong><br/>
          ROI: Return on Investment (30d)<br/>
          Copiers: Number of followers<br/>
          Copied: Total volume copied ($)<br/>
          Max DD: Maximum drawdown<br/>
          Win Rate: Percentage of profitable trades
        </ChartTip>
      </div>

      <div className="controls">
        <div className="search-box">
          <div className="search-icon">🔍</div>
          <input
            type="text"
            className="search-input"
            placeholder="Search traders by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filter-group">
          <button 
            className={`filter-btn ${filterRisk === "all" ? "active" : ""}`}
            onClick={() => setFilterRisk("all")}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filterRisk === "low" ? "active" : ""}`}
            onClick={() => setFilterRisk("low")}
          >
            Low Risk
          </button>
          <button 
            className={`filter-btn ${filterRisk === "medium" ? "active" : ""}`}
            onClick={() => setFilterRisk("medium")}
          >
            Medium Risk
          </button>
          <button 
            className={`filter-btn ${filterRisk === "high" ? "active" : ""}`}
            onClick={() => setFilterRisk("high")}
          >
            High Risk
          </button>
        </div>
      </div>

      <div className="leaderboard-table">
        <div className="table-header">
          <div className="table-header-cell">Rank</div>
          <div className="table-header-cell">Trader</div>
          <div className="table-header-cell">30d ROI</div>
          <div className="table-header-cell">Copiers</div>
          <div className="table-header-cell">Copied ($)</div>
          <div className="table-header-cell">Max Drawdown</div>
          <div className="table-header-cell">Win Rate</div>
          <div className="table-header-cell">Actions</div>
        </div>

        {filteredLeaderboard.map((trader) => (
          <div 
            key={trader.address}
            className="trader-row"
            onClick={() => setSelectedTrader(trader)}
            style={{ animationDelay: `${trader.rank * 0.1}s` }}
          >
            <div className={`rank rank-${trader.rank}`}>{trader.rank}</div>
            
            <div className="trader-info">
              <div className="trader-avatar">
                {trader.name.charAt(0)}
              </div>
              <div className="trader-details">
                <div className="trader-name">{trader.name}</div>
                <div className="trader-address">{trader.address}</div>
              </div>
            </div>

            <div className={`roi ${trader.roi >= 0 ? 'positive' : 'negative'}`}>
              {trader.roi >= 0 ? '+' : ''}{trader.roi}%
            </div>

            <div className="metric">
              <div className="metric-value">{trader.copiers.toLocaleString()}</div>
              <div className="metric-label">copiers</div>
            </div>

            <div className="metric">
              <div className="metric-value">${(trader.copied / 1000).toFixed(1)}K</div>
              <div className="metric-label">copied</div>
            </div>

            <div className="metric">
              <div className="metric-value">{trader.maxDrawdown}</div>
              <div className="metric-label">max dd</div>
            </div>

            <div className="metric">
              <div className="risk-badge risk-{trader.risk}">{trader.risk}</div>
              <div className="metric-value">{trader.winRate}%</div>
              <div className="metric-label">win rate</div>
            </div>

            <div className="actions">
              <button 
                className="action-btn btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewStrategy(trader);
                }}
              >
                👁️ View
              </button>
              {trader.following ? (
                <button 
                  className="action-btn btn-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFollowTrader(trader);
                  }}
                >
                  ➖ Unfollow
                </button>
              ) : (
                <button 
                  className="action-btn btn-success"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFollowTrader(trader);
                  }}
                >
                  ➕ Follow
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {following.length > 0 && (
        <div className="copied-section">
          <h2 className="section-title">Following ({following.length})</h2>
          <div className="following-grid">
            {following.slice(0, 3).map((trader) => (
              <div className="following-card" key={`following-${trader.address}`}>
                <div className="following-header">
                  <div className="following-name">{trader.name}</div>
                  <div className={`roi positive`}>+{trader.roi}%</div>
                </div>
                
                <div className="metric">
                  <div className="metric-label">Allocation</div>
                  <div className="alloc-progress">
                    <div className="alloc-fill" style={{ width: `${Math.min(trader.roi * 0.8, 100)}%` }}></div>
                  </div>
                </div>
                
                <div className="following-stats">
                  <div className="following-stat">
                    <div className="following-stat-value">{trader.winRate}%</div>
                    <div className="following-stat-label">Win Rate</div>
                  </div>
                  <div className="following-stat">
                    <div className="following-stat-value">${(trader.copied / 1000).toFixed(1)}K</div>
                    <div className="following-stat-label">Copied</div>
                  </div>
                  <div className="following-stat">
                    <div className="following-stat-value">{trader.copiers}</div>
                    <div className="following-stat-label">Copiers</div>
                  </div>
                  <div className="following-stat">
                    <div className="following-stat-value">{trader.avgTrade}</div>
                    <div className="following-stat-label">Avg Trade</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="copied-section">
        <h2 className="section-title">Copied Trades</h2>
        {copiedTrades.length === 0 ? (
          <Card theme={theme}>
            <div style={{ textAlign: "center", padding: "40px", color: theme.muted }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>🐋</div>
              <h3 style={{ color: theme.text, marginBottom: "8px" }}>No Copied Trades Yet</h3>
              <p>Start following traders to automatically copy their trades</p>
            </div>
          </Card>
        ) : (
          <TradeTable 
            trades={copiedTrades}
            columns={copiedTradeColumns}
            theme={theme}
          />
        )}
      </div>

      {selectedTrader && (
        <div className="strategy-modal-backdrop">
          <div className="strategy-modal">
            <div className="modal-header">
              <div className="trader-info">
                <div className="trader-avatar">{selectedTrader.name.charAt(0)}</div>
                <div>
                  <div className="trader-name">{selectedTrader.name}</div>
                  <div className="trader-address">{selectedTrader.address}</div>
                </div>
              </div>
              <button 
                className="close-btn"
                onClick={() => setSelectedTrader(null)}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}