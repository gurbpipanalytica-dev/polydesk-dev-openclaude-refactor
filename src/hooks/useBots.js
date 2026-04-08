import { useState, useEffect, useCallback } from "react";

// Constants extracted from App.jsx
const BOTS = [
  { id: 1, name: "Bond Bot", file: "polydesk_bond_bot.py", strategy: "Bond / Near-Certainty", status: "live", pnl: 0, pct: 0, win: 0, trades: 0, ping: 0, exec: 0, rate: 0, color: "#10b981" },
  { id: 2, name: "Maker Rebates", file: "polydesk_maker_rebates_bot.py", strategy: "Market Making", status: "live", pnl: 0, pct: 0, win: 0, trades: 0, ping: 0, exec: 0, rate: 0, color: "#3b82f6" },
  { id: 3, name: "BTC 5-Min Bot", file: "polydesk_btc5m_bot.py", strategy: "OFI + Gabagool (T1/T2/T3)", status: "live", pnl: 0, pct: 0, win: 0, trades: 0, ping: 0, exec: 0, rate: 0, color: "#8b5cf6" },
  { id: 4, name: "Whale Mirror", file: "copier_tab", strategy: "Copy Trading", status: "paused", pnl: 0, pct: 0, win: 0, trades: 0, ping: 0, exec: 0, rate: 0, color: "#f59e0b" },
  { id: 5, name: "Esports Oracle", file: "—", strategy: "Live Data Lag", status: "planned", pnl: 0, pct: 0, win: 0, trades: 0, ping: 0, exec: 0, rate: 0, color: "#64748b" },
];

const BOT_KEY_MAP = ["bond_bot", "rebates_bot", "btc5m_bot", "copier_bot", "esports_bot"];

// Default allocations
const DEFAULT_ALLOCATIONS = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

/**
 * Hook for managing bot state, allocations, and operations
 * Extracted from App.jsx to centralize bot management logic
 */
export default function useBots(orchestratorBase = "https://api.gurbcapital.com") {
  const [botsRegistry, setBotsRegistry] = useState([...BOTS]);
  const [botAllocations, setBotAllocations] = useState({ ...DEFAULT_ALLOCATIONS });
  const [showAddBotModal, setShowAddBotModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load bot allocations from orchestrator on mount
  useEffect(() => {
    const loadAllocations = async () => {
      setLoading(true);
      try {
        // Load demo allocations
        const response = await fetch(`${orchestratorBase}/app-state?key=demo_allocations`);
        const data = await response.json();
        
        if (data?.value && typeof data.value === "object") {
          setBotAllocations(prev => ({ ...prev, ...data.value }));
        }
      } catch (err) {
        console.error("Failed to load bot allocations:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadAllocations();
  }, [orchestratorBase]);

  /**
   * Add a new bot to the registry
   * @param {Object} newBot - Bot object with name, strategy, file, etc.
   * @returns {Object} The added bot with generated ID
   */
  const addBot = useCallback((newBot) => {
    const botWithId = {
      ...newBot,
      id: newBot.id || Date.now(), // Generate ID if not provided
      pnl: 0,
      pct: 0,
      win: 0,
      trades: 0,
      ping: 0,
      exec: 0,
      rate: 0,
      status: newBot.status || "paused",
      color: newBot.color || "#64748b",
    };

    setBotsRegistry(prev => [...prev, botWithId]);
    setBotAllocations(prev => ({ ...prev, [botWithId.id]: 0 }));
    setShowAddBotModal(false);
    
    return botWithId;
  }, []);

  /**
   * Remove a bot from the registry
   * @param {number|string} botId - ID of bot to remove
   */
  const removeBot = useCallback((botId) => {
    setBotsRegistry(prev => prev.filter(bot => bot.id !== botId));
    setBotAllocations(prev => {
      const newAllocations = { ...prev };
      delete newAllocations[botId];
      return newAllocations;
    });
  }, []);

  /**
   * Reallocate capital to a bot
   * @param {number|string} botId - ID of bot to reallocate
   * @param {number} allocation - New allocation amount in USD
   */
  const reallocateBot = useCallback((botId, allocation) => {
    setBotAllocations(prev => ({ ...prev, [botId]: allocation }));
    
    // Save to orchestrator
    if (orchestratorBase) {
      fetch(`${orchestratorBase}/save-state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "demo_allocations",
          value: { ...botAllocations, [botId]: allocation },
        }),
      }).catch(err => console.error("Failed to save allocation:", err));
    }
  }, [botAllocations, orchestratorBase]);

  /**
   * Enable a bot (set status to "live")
   * @param {number|string} botId - ID of bot to enable
   */
  const enableBot = useCallback((botId) => {
    setBotsRegistry(prev => prev.map(bot => 
      bot.id === botId ? { ...bot, status: "live" } : bot
    ));
  }, []);

  /**
   * Disable a bot (set status to "paused")
   * @param {number|string} botId - ID of bot to disable
   */
  const disableBot = useCallback((botId) => {
    setBotsRegistry(prev => prev.map(bot => 
      bot.id === botId ? { ...bot, status: "paused" } : bot
    ));
  }, []);

  /**
   * Edit bot properties
   * @param {number|string} botId - ID of bot to edit
   * @param {Object} updates - Updated properties
   */
  const editBot = useCallback((botId, updates) => {
    setBotsRegistry(prev => prev.map(bot => 
      bot.id === botId ? { ...bot, ...updates } : bot
    ));
  }, []);

  /**
   * Subscribe to bot events
   * @param {number|string} botId - ID of bot to subscribe to
   */
  const subscribeToBot = useCallback((botId) => {
    enableBot(botId);
  }, [enableBot]);

  /**
   * Unsubscribe from bot events
   * @param {number|string} botId - ID of bot to unsubscribe from
   */
  const unsubscribeFromBot = useCallback((botId) => {
    disableBot(botId);
    setBotAllocations(prev => ({ ...prev, [botId]: 0 }));
  }, [disableBot]);

  /**
   * Calculate statistics for a bot from trades
   * @param {string} botKey - Bot identifier (e.g., "bond_bot")
   * @param {Array} trades - Array of trade objects
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
   * Get bot data (live or mock)
   * @param {number} botIndex - Index in botsRegistry
   * @param {string} mode - "live" or "demo"
   * @param {Object} liveData - Live data from orchestrator
   * @param {Array} allTrades - All trades for stats calculation
   * @returns {Object} Bot data object
   */
  const getBotData = useCallback((botIndex, mode, liveData, allTrades) => {
    const key = BOT_KEY_MAP[botIndex];
    const base = botsRegistry[botIndex];
    const realStats = allTrades?.length > 0 ? calcBotStats(key, allTrades) : null;
    
    if (mode === "live" && liveData?.portfolio?.bot_states?.[key]) {
      const s = liveData.portfolio.bot_states[key];
      return {
        ...base,
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
      return { ...base, ...realStats, pct: 0 };
    }
    
    return base;
  }, [botsRegistry, calcBotStats]);

  // Return everything
  return {
    botsRegistry,
    botAllocations,
    showAddBotModal,
    loading,
    error,
    setBotsRegistry,
    setBotAllocations,
    setShowAddBotModal,
    addBot,
    removeBot,
    reallocateBot,
    enableBot,
    disableBot,
    editBot,
    subscribeToBot,
    unsubscribeFromBot,
    calcBotStats,
    getBotData,
    setLoading,
    setError
  };
}