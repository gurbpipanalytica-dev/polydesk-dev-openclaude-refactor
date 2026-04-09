import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../services/WebSocketService';

/**
 * useWebSocket Hook
 * Provides easy access to WebSocket service with React integration
 * Phase 8.1 Implementation
 */

export const useWebSocket = (channel = null, options = {}) => {
  const {
    autoReconnect = true,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;
  
  const [connectionStatus, setConnectionStatus] = useState(
    wsService.getConnectionStatus()
  );
  
  const [messages, setMessages] = useState([]);
  const [lastMessage, setLastMessage] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  // Subscribe to channel on mount
  useEffect(() => {
    if (!channel) return;
    
    const unsubscribe = wsService.subscribe(channel, (data) => {
      setLastMessage(data);
      setMessages(prev => [...prev.slice(-49), data]); // Keep last 50 messages
      
      if (onMessage) {
        onMessage(data);
      }
    });
    
    setIsSubscribed(true);
    
    return () => {
      unsubscribe();
      setIsSubscribed(false);
    };
  }, [channel, onMessage]);
  
  // Listen for connection status changes
  useEffect(() => {
    const unsubscribeStatus = wsService.subscribe('system', (data) => {
      if (data.type === 'connection_status') {
        setConnectionStatus(data.data);
        
        switch (data.data.status) {
          case 'connected':
            if (onConnect) onConnect(data.data);
            break;
          case 'disconnected':
            if (onDisconnect) onDisconnect(data.data);
            break;
          case 'error':
            if (onError) onError(data.data);
            break;
        }
      }
    });
    
    return unsubscribeStatus;
  }, [onConnect, onDisconnect, onError]);
  
  // Send message through WebSocket
  const send = useCallback((data) => {
    wsService.send(data);
  }, []);
  
  // Subscribe to a new channel
  const subscribe = useCallback((channelName, callback) => {
    return wsService.subscribe(channelName, callback);
  }, []);
  
  // Unsubscribe from a channel
  const unsubscribe = useCallback((channelName, callback) => {
    wsService.unsubscribe(channelName, callback);
  }, []);
  
  // Get current connection status
  const getStatus = useCallback(() => {
    return wsService.getConnectionStatus();
  }, []);
  
  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    wsService.disconnect();
  }, []);
  
  // Reconnect WebSocket
  const reconnect = useCallback(() => {
    wsService.disconnect();
    // Create new instance to trigger reconnection
    setTimeout(() => {
      wsService.connect();
    }, 100);
  }, []);
  
  return {
    // State
    connectionStatus,
    messages,
    lastMessage,
    isSubscribed,
    
    // Methods
    send,
    subscribe,
    unsubscribe,
    getStatus,
    disconnect,
    reconnect,
    
    // Convenience getters
    isConnected: connectionStatus.status === 'connected',
    isDisconnected: connectionStatus.status === 'disconnected',
    hasError: connectionStatus.status === 'error',
    reconnectAttempt: connectionStatus.reconnectAttempt || 0
  };
};

export default useWebSocket;
