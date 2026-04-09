/**
 * Sample trades data for development
 * Each trade has: id, timestamp, type, pair, price, size, profit, status, botId
 */

export const sampleTrades = [
  {
    id: 'trade-001',
    timestamp: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
    type: 'LONG',
    pair: 'BTC/USDT',
    price: 42000.50,
    size: 0.5,
    profit: 1250.75,
    status: 'closed',
    botId: 'bot-1'
  },
  {
    id: 'trade-002',
    timestamp: new Date(Date.now() - 86400000 * 25).toISOString(),
    type: 'SHORT',
    pair: 'ETH/USDT',
    price: 2450.00,
    size: 2.0,
    profit: -450.50,
    status: 'closed',
    botId: 'bot-2'
  },
  {
    id: 'trade-003',
    timestamp: new Date(Date.now() - 86400000 * 20).toISOString(),
    type: 'LONG',
    pair: 'SOL/USDT',
    price: 98.25,
    size: 10.0,
    profit: 890.00,
    status: 'closed',
    botId: 'bot-1'
  },
  {
    id: 'trade-004',
    timestamp: new Date(Date.now() - 86400000 * 18).toISOString(),
    type: 'LONG',
    pair: 'BTC/USDT',
    price: 43500.00,
    size: 0.3,
    profit: 2100.30,
    status: 'closed',
    botId: 'bot-3'
  },
  {
    id: 'trade-005',
    timestamp: new Date(Date.now() - 86400000 * 15).toISOString(),
    type: 'SHORT',
    pair: 'ADA/USDT',
    price: 0.52,
    size: 5000.0,
    profit: 320.40,
    status: 'closed',
    botId: 'bot-2'
  },
  {
    id: 'trade-006',
    timestamp: new Date(Date.now() - 86400000 * 12).toISOString(),
    type: 'LONG',
    pair: 'BTC/USDT',
    price: 44500.75,
    size: 0.8,
    profit: 1850.60,
    status: 'closed',
    botId: 'bot-1'
  },
  {
    id: 'trade-007',
    timestamp: new Date(Date.now() - 86400000 * 10).toISOString(),
    type: 'LONG',
    pair: 'ETH/USDT',
    price: 2680.50,
    size: 1.5,
    profit: -680.25,
    status: 'closed',
    botId: 'bot-3'
  },
  {
    id: 'trade-008',
    timestamp: new Date(Date.now() - 86400000 * 8).toISOString(),
    type: 'SHORT',
    pair: 'SOL/USDT',
    price: 125.80,
    size: 8.0,
    profit: 740.80,
    status: 'closed',
    botId: 'bot-1'
  },
  {
    id: 'trade-009',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    type: 'LONG',
    pair: 'BTC/USDT',
    price: 45200.00,
    size: 1.2,
    profit: 2750.90,
    status: 'closed',
    botId: 'bot-2'
  },
  {
    id: 'trade-010',
    timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    type: 'LONG',
    pair: 'ETH/USDT',
    price: 2750.25,
    size: 2.5,
    profit: 1320.75,
    status: 'closed',
    botId: 'bot-3'
  },
  {
    id: 'trade-011',
    timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    type: 'SHORT',
    pair: 'ADA/USDT',
    price: 0.58,
    size: 3000.0,
    profit: 420.60,
    status: 'closed',
    botId: 'bot-1'
  },
  {
    id: 'trade-012',
    timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
    type: 'LONG',
    pair: 'BTC/USDT',
    price: 46500.50,
    size: 0.6,
    profit: 980.45,
    status: 'open',
    botId: 'bot-2'
  }
];

/**
 * Generate mock candlestick data for charting
 * Format: { time, open, high, low, close, volume }
 */
export const generateCandlestickData = (days = 30) => {
  const data = [];
  const now = Date.now();
  let basePrice = 45000;
  
  for (let i = days; i >= 0; i--) {
    const timestamp = now - (i * 86400000);
    const volatility = 0.02; // 2% daily volatility
    const trend = Math.random() > 0.5 ? 1 : -1; // Random trend
    
    // Generate OHLC
    const open = basePrice;
    const close = basePrice * (1 + (Math.random() - 0.5) * volatility * trend);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = Math.floor(Math.random() * 1000000) + 500000;
    
    data.push({
      time: timestamp,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume
    });
    
    basePrice = close;
  }
  
  return data;
};

/**
 * Calculate performance metrics from trades
 */
export const calculateMetrics = (trades) => {
  if (!trades || trades.length === 0) {
    return {
      totalPnL: 0,
      winRate: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalTrades: 0,
      profitableTrades: 0,
      losingTrades: 0
    };
  }
  
  const profits = trades.map(t => t.profit || 0);
  const totalPnL = profits.reduce((sum, p) => sum + p, 0);
  const profitableTrades = trades.filter(t => (t.profit || 0) > 0).length;
  const losingTrades = trades.filter(t => (t.profit || 0) < 0).length;
  const winRate = (profitableTrades / trades.length) * 100;
  
  // Calculate Sharpe Ratio (simplified - assumes daily returns)
  const avgReturn = totalPnL / trades.length;
  const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgReturn, 2), 0) / trades.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
  
  // Calculate Max Drawdown
  let maxPnL = 0;
  let maxDrawdown = 0;
  let currentPnL = 0;
  
  for (const profit of profits) {
    currentPnL += profit;
    if (currentPnL > maxPnL) {
      maxPnL = currentPnL;
    }
    const drawdown = (maxPnL - currentPnL) / (maxPnL || 1) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return {
    totalPnL,
    winRate,
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    totalTrades: trades.length,
    profitableTrades,
    losingTrades
  };
};

/**
 * Group trades by time period for charting
 */
export const groupTradesByPeriod = (trades, period = 'day') => {
  const grouped = {};
  
  trades.forEach(trade => {
    const date = new Date(trade.timestamp);
    let key;
    
    switch (period) {
      case 'hour':
        key = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        break;
      case 'day':
        key = date.toISOString().slice(0, 10); // YYYY-MM-DD
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
        break;
      case 'month':
        key = date.toISOString().slice(0, 7); // YYYY-MM
        break;
      default:
        key = date.toISOString().slice(0, 10);
    }
    
    if (!grouped[key]) {
      grouped[key] = {
        trades: [],
        pnl: 0,
        volume: 0,
        timestamp: new Date(key).getTime()
      };
    }
    
    grouped[key].trades.push(trade);
    grouped[key].pnl += trade.profit || 0;
    grouped[key].volume += (trade.price * trade.size) || 0;
  });
  
  return Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);
};
