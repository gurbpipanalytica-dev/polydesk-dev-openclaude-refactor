/**
 * WebSocket Service for Real-Time Trading Data
 * Phase 8.1 Implementation
 */

class WebSocketService {
  constructor(url = null) {
    this.url = url || this.getWebSocketUrl();
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isMock = !url && process.env.NODE_ENV === 'development';
    this.connectionStatus = 'disconnected';
    this.messageQueue = [];
    
    // Initialize with mock data if in development mode
    if (this.isMock) {
      console.log('[WebSocket] Using mock data for development');
      this.startMockFeed();
    } else {
      this.connect();
    }
  }
  
  getWebSocketUrl() {
    // In production, use actual WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.REACT_APP_WS_PORT || '8080';
    
    // For now, return null to trigger mock mode
    return null; // Will be: `${protocol}//${host}:${port}`
  }
  
  connect() {
    if (this.isMock) return;
    
    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.handleReconnect();
    }
  }
  
  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      this.flushMessageQueue();
      this.notifyStatusChange();
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('[WebSocket] Message parse error:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.connectionStatus = 'error';
      this.notifyStatusChange();
    };
    
    this.ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      this.connectionStatus = 'disconnected';
      this.notifyStatusChange();
      this.handleReconnect();
    };
  }
  
  handleMessage(data) {
    // Notify all listeners for this channel
    const channel = data.channel || 'default';
    if (this.listeners.has(channel)) {
      this.listeners.get(channel).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[WebSocket] Listener error:', error);
        }
      });
    }
    
    // Handle system messages
    if (data.type === 'system') {
      this.handleSystemMessage(data);
    }
  }
  
  handleSystemMessage(data) {
    switch (data.action) {
      case 'pong':
        console.log('[WebSocket] Pong received');
        break;
      case 'error':
        console.error('[WebSocket] Server error:', data.message);
        break;
      default:
        console.log('[WebSocket] System message:', data);
    }
  }
  
  subscribe(channel, callback) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    
    // Check if callback already exists
    const callbacks = this.listeners.get(channel);
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
      console.log(`[WebSocket] Subscribed to ${channel}`);
    }
    
    // Request subscription message
    this.send({
      type: 'subscribe',
      channel: channel
    });
    
    // Return unsubscribe function
    return () => this.unsubscribe(channel, callback);
  }
  
  unsubscribe(channel, callback) {
    if (this.listeners.has(channel)) {
      const callbacks = this.listeners.get(channel);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        console.log(`[WebSocket] Unsubscribed from ${channel}`);
      }
      
      // Remove channel if no more listeners
      if (callbacks.length === 0) {
        this.listeners.delete(channel);
      }
    }
  }
  
  send(data) {
    if (this.isMock) {
      console.log('[WebSocket] Mock send:', data);
      return;
    }
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(data);
      console.log('[WebSocket] Queued message (connection not ready)');
    }
  }
  
  flushMessageQueue() {
    if (this.messageQueue.length > 0) {
      console.log(`[WebSocket] Flushing ${this.messageQueue.length} queued messages`);
      this.messageQueue.forEach(msg => this.send(msg));
      this.messageQueue = [];
    }
  }
  
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.ws) {
        this.ws.close();
      }
      this.connect();
    }, delay);
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listerners.clear();
  }
  
  getConnectionStatus() {
    return {
      status: this.connectionStatus,
      reconnectAttempts: this.reconnectAttempts,
      isMock: this.isMock,
      listeners: Array.from(this.listeners.keys())
    };
  }
  
  // Mock data feed for development
  startMockFeed() {
    console.log('[WebSocket] Starting mock feed');
    this.connectionStatus = 'connected';
    
    // Simulate connection delay
    setTimeout(() => {
      this.notifyStatusChange();
    }, 500);
    
    // Start mock data generators
    this.startMockPriceFeed();
    this.startMockTradeFeed();
  }
  
  startMockPriceFeed() {
    const symbols = ['BTC/USDT', 'ETH/USDT', 'XAUUSD', 'EUR/USD'];
    
    setInterval(() => {
      symbols.forEach(symbol => {
        const price = this.generateMockPrice(symbol);
        const data = {
          channel: 'prices',
          symbol: symbol,
          type: 'price_update',
          data: {
            price: price,
            bid: price - 0.05,
            ask: price + 0.05,
            timestamp: Date.now(),
            change24h: (Math.random() - 0.5) * 5
          }
        };
        this.simulateIncomingMessage(data);
      });
    }, 2000); // Update every 2 seconds
  }
  
  startMockTradeFeed() {
    const botIds = [1, 2, 3]; // Mock bot IDs
    
    setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance of trade per interval
        const botId = botIds[Math.floor(Math.random() * botIds.length)];
        const trade = this.generateMockTrade(botId);
        
        const data = {
          channel: 'trades',
          type: 'trade_executed',
          data: trade
        };
        this.simulateIncomingMessage(data);
      }
    }, 5000); // Check for trades every 5 seconds
  }
  
  generateMockPrice(symbol) {
    const basePrices = {
      'BTC/USDT': 45000 + (Math.random() - 0.5) * 2000,
      'ETH/USDT': 3000 + (Math.random() - 0.5) * 150,
      'XAUUSD': 2000 + (Math.random() - 0.5) * 50,
      'EUR/USD': 1.08 + (Math.random() - 0.5) * 0.02
    };
    return basePrices[symbol] || 100 + Math.random() * 50;
  }
  
  generateMockTrade(botId) {
    const symbols = ['BTC/USDT', 'ETH/USDT', 'XAUUSD'];
    const types = ['BUY', 'SELL'];
    
    return {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      botId: botId,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      type: types[Math.floor(Math.random() * types.length)],
      price: Math.random() * 50000,
      amount: Math.random() * 2 + 0.1,
      timestamp: Date.now(),
      profit: (Math.random() - 0.5) * 100
    };
  }
  
  simulateIncomingMessage(data) {
    setTimeout(() => {
      this.handleMessage(data);
    }, Math.random() * 100); // Add slight random delay
  }
  
  notifyStatusChange() {
    // Notify status channel listeners
    const statusData = this.getConnectionStatus();
    this.handleMessage({
      channel: 'system',
      type: 'connection_status',
      data: statusData
    });
  }
}

// Create singleton instance
export const wsService = new WebSocketService();

export default WebSocketService;
