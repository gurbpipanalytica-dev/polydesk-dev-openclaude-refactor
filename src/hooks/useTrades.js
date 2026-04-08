import { useState, useEffect, useCallback } from "react";

// Constants from App.jsx
const BOT_KEY_MAP = ["bond_bot", "rebates_bot", "btc5m_bot", "copier_bot", "esports_bot"];

/**
 * Hook for managing trade data, fetching, filtering, and analytics
 * Extracted from App.jsx to centralize trade management logic
 */
export default function useTrades(orchestratorBase = "https://api.gurbcapital.com") {
  const [allTrades, setAllTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesError, setTradesError] = useState(null);
  const [period, setPeriod] = useState("1M"); // 1D, 7D, 1M, 3M, ALL
  const [selectedBot, setSelectedBot] = useState(null);
  const [tradesFilter, setTradesFilter] = useState("all"); // all, open, closed

  // Derived state
  const closedTrades = useMemo(() => {
    return allTrades.filter(t => t.pnl != null && t.status !== "open");
  }, [allTrades]);

  const openTrades = useMemo(() => {
    return allTrades.filter(t => t.status === "open");
  }, [allTrades]);

  const winningTrades = useMemo(() => {
    return closedTrades.filter(t => (t.pnl || 0) > 0);
  }, [closedTrades]);

  const losingTrades = useMemo(() => {
    return closedTrades.filter(t => (t.pnl || 0) < 0);
  }, [closedTrades]);

  const winRate = useMemo(() => {
    if (closedTrades.length === 0) return 0;
    return parseFloat(((winningTrades.length / closedTrades.length) * 100).toFixed(1));
  }, [closedTrades, winningTrades]);

  const totalPnl = useMemo(() => {
    return closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  }, [closedTrades]);

  // Poll trades every 60 seconds
  useEffect(() => {
    fetchAllTrades(); // Initial fetch
    
    const interval = setInterval(() => {
      fetchAllTrades();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [orchestratorBase]);

  /**
   * Fetch all trades from orchestrator
   */
  const fetchAllTrades = useCallback(async () => {
    setTradesLoading(true);
    setTradesError(null);
    
    try {
      const response = await fetch(`${orchestratorBase}/trades?limit=200`);
      
      if (response.ok) {
        const data = await response.json();
        if (data?.trades) {
          const sortedTrades = [...data.trades].sort((a, b) => 
            new Date(b.time || b.created_at || 0) - new Date(a.time || a.created_at || 0)
          );
          setAllTrades(sortedTrades);
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Failed to fetch trades:", error);
      setTradesError(error.message);
    } finally {
      setTradesLoading(false);
    }
  }, [orchestratorBase]);

  /**
   * Fetch trades for a specific bot
   * @param {string} botKey - Bot identifier (e.g., "bond_bot")
   * @param {number} limit - Maximum number of trades to fetch
   * @returns {Array} Trades array for the bot
   */
  const fetchBotTrades = useCallback(async (botKey, limit = 50) => {
    try {
      const response = await fetch(`${orchestratorBase}/trades?bot_key=${botKey}&limit=${limit}`);
      
      if (response.ok) {
        const data = await response.json();
        return data?.trades || [];
      }
      return [];
    } catch (error) {
      console.error(`Failed to fetch trades for ${botKey}:`, error);
      return [];
    }
  }, [orchestratorBase]);

  /**
   * Calculate statistics for a bot from trades
   * @param {string} botKey - Bot identifier (e.g., "bond_bot") 
   * @param {Array} trades - Trades array to calculate from
   * @returns {Object|null} Stats object or null if no trades
   */
  const calcBotStats = useCallback((botKey, trades) => {
    const botTrades = trades.filter(t => 
      t.bot === botKey ||
      t.bot_key === botKey ||
      (t.bot || "").includes(botKey.replace("_bot", ""))
    );
    
    if (botTrades.length === 0) return null;
    
    const closedTrades = botTrades.filter(t => t.status === "closed" || t.pnl != null);
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = closedTrades.filter(t => (t.pnl || 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length * 100) : 0;
    const today = new Date().toDateString();
    const todayTrades = botTrades.filter(t => 
      new Date(t.time || t.created_at || 0).toDateString() === today
    );
    
    return {
      pnl: parseFloat(totalPnl.toFixed(2)),
      win: parseFloat(winRate.toFixed(1)),
      trades: botTrades.length,
      tradesToday: todayTrades.length,
      openTrades: botTrades.filter(t => t.status === "open").length,
    };
  }, []);

  /**
   * Get bot data merged with real stats
   * @param {Object} baseBot - Base bot object from botsRegistry
   * @param {string} mode - "live" or "demo"
   * @param {Object} liveData - Live data from orchestrator
   * @param {Array} allTrades - All trades for stats calculation
   * @returns {Object} Merged bot data
   */
  const getBotData = useCallback((baseBot, mode, liveData, allTrades) => {
    const key = BOT_KEY_MAP[baseBot.id - 1]; // Map bot ID to key
    const realStats = allTrades?.length > 0 ? calcBotStats(key, allTrades) : null;
    
    if (mode === "live" && liveData?.portfolio?.bot_states?.[key]) {
      const s = liveData.portfolio.bot_states[key];
      return {
        ...baseBot,
        pnl: s.pnl || 0,
        pct: s.pct || 0,
        win: s.win || 0,
        trades: s.trades || 0,
        ping: s.ping || 0,
        exec: s.exec || 0,
        rate: s.rate || 0,
      };
    }
    
    if (realStats) {
      return { ...baseBot, ...realStats, pct: 0 };
    }
    
    return baseBot;
  }, [calcBotStats]);

  /**
   * Build chart data for visualizations
   * @param {Array} trades - Trades to build from
   * @param {string} per - Period (1D, 7D, 1M, 3M, ALL)
   * @returns {Array|null} Chart data array or null
   */
  const buildChartData = useCallback((trades, per) => {
    if (!trades || trades.length === 0) return null;
    
    const closed = trades.filter(t => t.pnl != null && t.status !== "open");
    if (closed.length === 0) return null;
    
    const sorted = [...closed].sort((a, b) => 
      new Date(a.time || a.created_at || 0) - new Date(b.time || b.created_at || 0)
    );
    
    const now = new Date();
    const cutoff = {
      "1D": new Date(now - 86400000),
      "7D": new Date(now - 7 * 86400000),
      "1M": new Date(now - 30 * 86400000),
      "3M": new Date(now - 90 * 86400000),
      "ALL": new Date(0),
    }[per];
    
    const filtered = sorted.filter(t => new Date(t.time || t.created_at || 0) >= cutoff);
    
    if (filtered.length === 0) return null;
    
    let cumulative = 0;
    return filtered.map((t, i) => {
      cumulative += t.pnl || 0;
      return {
        x: new Date(t.time || t.created_at || 0).toLocaleDateString(),
        y: parseFloat(cumulative.toFixed(2)),
        trade: t,
        idx: i,
      };
    });
  }, []);

  /**
   * Build performance metadata
   * @param {Array} trades - Trades to analyze
   * @param {string} per - Period for filtering
   * @returns {Object} Metadata with metrics
   */
  const buildMeta = useCallback((trades, per) => {
    if (!trades || trades.length === 0) return null;
    
    const now = new Date();
    const cutoff = {
      "1D": new Date(now - 86400000),
      "7D": new Date(now - 7 * 86400000),
      "1M": new Date(now - 30 * 86400000),
      "3M": new Date(now - 90 * 86400000),
      "ALL": new Date(0),
    }[per];
    
    const filtered = trades.filter(t => new Date(t.time || t.created_at || 0) >= cutoff);
    const closed = filtered.filter(t => t.pnl != null && t.status !== "open");
    
    if (closed.length === 0) return null;
    
    const total = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const wins = closed.filter(t => (t.pnl || 0) > 0);
    const losses = closed.filter(t => (t.pnl || 0) < 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length : 0;
    const pnl = closed.map(t => t.pnl || 0);
    const maxDrawdown = Math.min(...pnl, 0);
    
    // Sharpe ratio (simplified: mean/std of daily returns)
    let sharpe = 0;
    if (pnl.length > 1) {
      const mean = pnl.reduce((a, b) => a + b, 0) / pnl.length;
      const variance = pnl.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pnl.length;
      const std = Math.sqrt(variance);
      sharpe = std > 0 ? (mean / std) * Math.sqrt(365) : 0;
    }
    
    return {
      pnl: closed.length,
      winRate,
      pnlCum: total,
      wins: wins.length,
      losses: losses.length,
      avgWin,
      avgLoss,
      sharpe,
      maxDrawdown,
      streak: calcStreak(closed),
    };
  }, []);

  /**
   * Calculate win/loss streak from trades
   * @param {Array} trades - Trades to analyze
   * @returns {Object} Streak data
   */
  const calcStreak = (trades) => {
    if (trades.length === 0) return null;
    
    const pnls = trades.map(t => t.pnl || 0);
    const results = pnls.map(p => p > 0);
    let currentStreak = 0;
    let longestStreak = 0;
    let lastResult = null;
    
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r === lastResult) {
        currentStreak++;
      } else {
        if (currentStreak > longestStreak) longestStreak = currentStreak;
        currentStreak = 1;
        lastResult = r;
      }
    }
    if (currentStreak > longestStreak) longestStreak = currentStreak;
    
    return {
      wins: results.filter(r => r).length,
      losses: results.filter(r => !r).length,
      current: currentStreak,
      longest: longestStreak,
      type: currentStreak > 0 ? "win" : "loss",
    };
  };

  /**
   * Build categories breakdown
   * @param {Array} trades - Trades to categorize
   * @returns {Array} Categories with metrics
   */
  const buildCategories = useCallback((trades) => {
    if (!trades || trades.length === 0) return [];
    
    const cats = {};
    trades.forEach(t => {
      const cat = (t.category || t.market || "").toLowerCase();
      if (!cats[cat]) {
        cats[cat] = { name: cat, trades: 0, pnl: 0, wins: 0, losses: 0 };
      }
      cats[cat].trades++;
      cats[cat].pnl += t.pnl || 0;
      if ((t.pnl || 0) > 0) cats[cat].wins++;
      else cats[cat].losses++;
    });
    
    const colors = ["#ef4444", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#6b7280", "#06b6d4", "#ec4899"];
    
    return Object.values(cats)
      .map((c, i) => ({
        ...c,
        color: colors[i % colors.length],
        winRate: c.trades > 0 ? (c.wins / c.trades) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, []);

  // Filter trades based on current filter
  const filteredTrades = useMemo(() => {
    switch (tradesFilter) {
      case "open":
        return openTrades;
      case "closed":
        return closedTrades;
      case "winning":
        return winningTrades;
      case "losing":
        return losingTrades;
      default:
        return allTrades;
    }
  }, [allTrades, tradesFilter, openTrades, closedTrades, winningTrades, losingTrades]);

  // Period-based trade filtering
  const getPeriodTrades = useCallback((trades, per) => {
    const cutoff = getPeriodCutoff(per);
    return trades.filter(t => new Date(t.time || t.created_at || 0) >= cutoff);
  }, []);

  const getPeriodCutoff = (per) => {
    const now = new Date();
    const periods = {
      "1D": new Date(now - 86400000),
      "7D": new Date(now - 7 * 86400000),
      "1M": new Date(now - 30 * 86400000),
      "3M": new Date(now - 90 * 86400000),
      "ALL": new Date(0),
    };
    return periods[per] || periods["1M"];
  };

  return {
    allTrades,
    closedTrades,
    openTrades,
    winningTrades,
    losingTrades,
    filteredTrades,
    tradesLoading,
    tradesError,
    period,
    selectedBot,
    tradesFilter,
    winRate,
    totalPnl,
    setAllTrades,
    setTradesLoading,
    setTradesError,
    setPeriod,
    setSelectedBot,
    setTradesFilter,
    fetchAllTrades,
    fetchBotTrades,
    calcBotStats,
    getBotData,
    buildChartData,
    buildMeta,
    buildCategories,
    getPeriodTrades,
    getPeriodCutoff,
  };
}