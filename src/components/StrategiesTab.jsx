import React, { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import Card from "./Card";
import CardHeader from "./CardHeader";
import StatusBadge from "./StatusBadge";
import ChartTip from "./ChartTip";
import PeriodSelector from "./PeriodSelector";

export default function StrategiesTab({ bots = [], trades = [], theme = DARK }) {
  const [period, setPeriod] = useState("24h");
  
  const strategies = useMemo(() => {
    const strategyMap = {};
    
    bots.forEach(bot => {
      if (bot.strategyName) {
        if (!strategyMap[bot.strategyName]) {
          strategyMap[bot.strategyName] = {
            name: bot.strategyName,
            tier: bot.tier || "TIER 4",
            status: bot.enabled ? "active" : "paused",
            bots: [],
            totalAllocation: 0,
            realizedPNL: 0,
            unrealizedPNL: 0,
            trades: 0,
            winRate: 0,
            avgTradeDuration: 0
          };
        }
        strategyMap[bot.strategyName].bots.push(bot);
        strategyMap[bot.strategyName].totalAllocation += bot.allocation || 0;
      }
    });
    
    trades.forEach(trade => {
      if (trade.strategy && strategyMap[trade.strategy]) {
        const strat = strategyMap[trade.strategy];
        strat.trades += 1;
        
        if (trade.realizedPNL !== undefined) {
          strat.realizedPNL += trade.realizedPNL;
        }
        if (trade.unrealizedPNL !== undefined) {
          strat.unrealizedPNL += trade.unrealizedPNL;
        }
      }
    });
    
    Object.values(strategyMap).forEach(strat => {
      if (strat.trades > 0) {
        strat.winRate = Math.round((strat.realizedPNL / strat.trades) * 100) / 100;
      }
    });
    
    return Object.values(strategyMap);
  }, [bots, trades]);
  
  const performanceData = useMemo(() => {
    const data = [
      { time: "00:00", ROI: 0 },
      { time: "04:00", ROI: 1.2 },
      { time: "08:00", ROI: 2.8 },
      { time: "12:00", ROI: 1.5 },
      { time: "16:00", ROI: 3.2 },
      { time: "20:00", ROI: 4.5 },
      { time: "24:00", ROI: 5.1 }
    ];
    
    return data;
  }, [period]);
  
  const totalAllocation = useMemo(() => {
    return strategies.reduce((sum, s) => sum + (s.totalAllocation || 0), 0);
  }, [strategies]);
  
  const totalRealized = useMemo(() => {
    return strategies.reduce((sum, s) => sum + (s.realizedPNL || 0), 0);
  }, [strategies]);
  
  const totalUnrealized = useMemo(() => {
    return strategies.reduce((sum, s) => sum + (s.unrealizedPNL || 0), 0);
  }, [strategies]);
  
  const avgWinRate = useMemo(() => {
    if (strategies.length === 0) return 0;
    const total = strategies.reduce((sum, s) => sum + (s.winRate || 0), 0);
    return Math.round((total / strategies.length) * 10) / 10;
  }, [strategies]);
  
  const onReallocate = (strategyName, newAllocation) => {
    console.log(`Reallocating ${strategyName}: ${newAllocation}%`);
  };
  
  const onPauseStrategy = (strategyName) => {
    console.log(`Pausing strategy: ${strategyName}`);
  };
  
  const onActivateStrategy = (strategyName) => {
    console.log(`Activating strategy: ${strategyName}`);
  };
  
  return (
    <div className="strategies-container" style={{ color: theme.text }}>
      <style jsx>{`
        .strategies-container {
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
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .metric-card {
          background: ${theme.surf};
          border: 1px solid ${theme.border};
          border-radius: 12px;
          padding: 20px;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .metric-card:hover {
          border-color: ${theme.borderHover};
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .metric-label {
          font-size: 13px;
          color: ${theme.muted};
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .metric-value {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .metric-change {
          font-size: 13px;
          font-weight: 500;
        }
        .positive { color: ${theme.green}; }
        .negative { color: ${theme.red}; }
        .neutral { color: ${theme.muted}; }
        .strategies-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 24px;
        }
        .strategy-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .performance-chart {
          background: linear-gradient(135deg, ${theme.blueSoft}, ${theme.purpleSoft});
          padding: 24px;
          border-radius: 16px;
          height: 400px;
          position: relative;
          overflow: hidden;
        }
        .chart-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .strategy-card {
          background: ${theme.surf};
          border: 1px solid ${theme.border};
          border-radius: 12px;
          padding: 20px;
          transition: all 0.2s ease;
        }
        .strategy-card:hover {
          border-color: ${theme.borderHover};
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        }
        .strategy-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .strategy-name {
          font-size: 18px;
          font-weight: 600;
        }
        .strategy-tier {
          font-size: 11px;
          background: ${theme.dim};
          padding: 4px 10px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .strategy-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }
        .stat {
          display: flex;
          flex-direction: column;
        }
        .stat-label {
          font-size: 12px;
          color: ${theme.muted};
          margin-bottom: 4px;
        }
        .stat-value {
          font-size: 16px;
          font-weight: 600;
        }
        .strategy-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        .action-btn {
          flex: 1;
          padding: 8px 16px;
          border: 1px solid ${theme.border};
          background: ${theme.surf};
          color: ${theme.text};
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          background: ${theme.surf2};
          border-color: ${theme.borderHover};
        }
        .primary-btn {
          background: ${theme.blueSoft};
          border-color: ${theme.blue};
          color: ${theme.blue};
        }
        .primary-btn:hover {
          background: ${theme.blue};
          color: ${theme.surf3};
        }
        .bg-green { background: ${theme.greenSoft}; }
        .bg-green .action-btn.primary-btn {
          background: ${theme.green};
          border-color: ${theme.green};
          color: ${theme.greenSoft};
        }
        .bg-green .action-btn.primary-btn:hover {
          background: ${theme.greenSoft};
          color: ${theme.green};
        }
        .bg-red { background: ${theme.redSoft}; }
        .bg-red .action-btn.primary-btn {
          background: ${theme.red};
          border-color: ${theme.red};
          color: ${theme.redSoft};
        }
        .bg-red .action-btn.primary-btn:hover {
          background: ${theme.redSoft};
          color: ${theme.red};
        }
        @media (max-width: 968px) {
          .strategies-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      
      <div className="header-section">
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px", color: theme.text }}>
            Strategy Portfolio
          </h1>
          <p style={{ color: theme.subtext, fontSize: "16px" }}>
            Monitor and manage your automated trading strategies
          </p>
        </div>
        <PeriodSelector
          theme={theme}
          value={period}
          onChange={setPeriod}
        />
      </div>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Allocation</div>
          <div className="metric-value">${totalAllocation.toLocaleString()}</div>
          <div className={`metric-change ${totalRealized + totalUnrealized >= 0 ? 'positive' : 'negative'}`}>
            ${Math.abs(totalRealized + totalUnrealized).toLocaleString()} total P&L
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Realized P&L</div>
          <div className={`metric-value ${totalRealized >= 0 ? 'positive' : 'negative'}`}>
            {totalRealized >= 0 ? '+' : '-'}${Math.abs(totalRealized).toLocaleString()}
          </div>
          <div className="metric-change neutral">From closed positions</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Unrealized P&L</div>
          <div className={`metric-value ${totalUnrealized >= 0 ? 'positive' : 'negative'}`}>
            {totalUnrealized >= 0 ? '+' : '-'}${Math.abs(totalUnrealized).toLocaleString()}
          </div>
          <div className="metric-change neutral">Open positions</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Avg Win Rate</div>
          <div className={`metric-value ${avgWinRate > 50 ? 'positive' : 'negative'}`}>
            {avgWinRate}%
          </div>
          <div className="metric-change neutral">Across all strategies</div>
        </div>
        
        <div className="metric-card">
          <div className="metric-label">Active Strategies</div>
          <div className="metric-value positive">
            {strategies.filter(s => s.status === 'active').length}/{strategies.length}
          </div>
          <div className="metric-change neutral">{strategies.length} total strategies</div>
        </div>
      </div>
      
      <div className="strategies-grid">
        <div className="strategy-list">
          {strategies.length === 0 ? (
            <Card theme={theme}>
              <div style={{ textAlign: "center", padding: "40px", color: theme.muted }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📊</div>
                <h3 style={{ color: theme.text, marginBottom: "8px" }}>No Strategy Data</h3>
                <p>Start by enabling bots with strategy assignments</p>
              </div>
            </Card>
          ) : (
            strategies.map((strategy, idx) => (
              <div 
                key={strategy.name}
                className="strategy-card"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="strategy-header">
                  <div className="strategy-name">{strategy.name}</div>
                  <div className="strategy-tier" style={{ background: theme.dim }}>
                    {strategy.tier}
                  </div>
                </div>
                
                <div className="strategy-stats">
                  <div className="stat">
                    <div className="stat-label">Allocation</div>
                    <div className="stat-value">
                      ${strategy.totalAllocation.toLocaleString()}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Bots</div>
                    <div className="stat-value">{strategy.bots.length}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Win Rate</div>
                    <div className={`stat-value ${strategy.winRate > 50 ? 'positive' : 'negative'}`}>
                      {strategy.winRate}%
                    </div>
                  </div>
                </div>
                
                <div className="strategy-stats">
                  <div className="stat">
                    <div className="stat-label">Realized P&L</div>
                    <div className={`stat-value ${strategy.realizedPNL >= 0 ? 'positive' : 'negative'}`}>
                      {strategy.realizedPNL >= 0 ? '+' : '-'}${Math.abs(strategy.realizedPNL).toLocaleString()}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Unrealized P&L</div>
                    <div className={`stat-value ${strategy.unrealizedPNL >= 0 ? 'positive' : 'negative'}`}>
                      {strategy.unrealizedPNL >= 0 ? '+' : '-'}${Math.abs(strategy.unrealizedPNL).toLocaleString()}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-label">Trades</div>
                    <div className="stat-value">{strategy.trades}</div>
                  </div>
                </div>
                
                <div className={`strategy-actions ${strategy.status === 'active' ? 'bg-green' : 'bg-red'}`}>
                  <button 
                    className="action-btn"
                    onClick={() => onReallocate(strategy.name, strategy.totalAllocation)}
                  >
                    Reallocate
                  </button>
                  {strategy.status === 'active' ? (
                    <button 
                      className="action-btn primary-btn"
                      onClick={() => onPauseStrategy(strategy.name)}
                    >
                      Pause Strategy
                    </button>
                  ) : (
                    <button 
                      className="action-btn primary-btn"
                      onClick={() => onActivateStrategy(strategy.name)}
                    >
                      Activate Strategy
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="performance-chart">
          <div className="chart-title" style={{ color: theme.text }}>
            Performance Overview
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={performanceData}>
              <defs>
                <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.blue} stopOpacity={0.6}/>
                  <stop offset="95%" stopColor={theme.blue} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis 
                dataKey="time" 
                stroke={theme.muted}
                tick={{ fill: theme.muted, fontSize: 12 }}
              />
              <YAxis 
                stroke={theme.muted}
                tick={{ fill: theme.muted, fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div style={{
                        background: theme.surf2,
                        border: `1px solid ${theme.border}`,
                        borderRadius: "8px",
                        padding: "12px",
                        color: theme.text
                      }}>
                        <div style={{ fontSize: "14px", marginBottom: "4px" }}>{label}</div>
                        <div style={{ fontSize: "16px", fontWeight: "600", color: theme.blue }}>
                          ROI: {payload[0].value}%
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey="ROI" 
                stroke={theme.blue} 
                strokeWidth={2}
                fill="url(#roiGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
          
          <ChartTip 
            theme={theme}
            align="right"
          >
            <strong>Performance Chart</strong><br/>
            Shows portfolio ROI progression over the selected period<br/>
            <strong>Tip:</strong> Click and drag to zoom into specific time ranges
          </ChartTip>
        </div>
      </div>
    </div>
  );
}