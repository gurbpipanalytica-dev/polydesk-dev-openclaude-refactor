import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sampleTrades } from '../utils/trades';

/**
 * Trade Store
 * Manages trade data and operations with persistence
 * Phase 8.3 Implementation
 */

export const useTradeStore = create(
  persist(
    (set, get) => ({
      // State
      trades: sampleTrades,
      period: { label: "24h", value: 1 },
      selectedTrade: null,
      filters: {
        status: null,
        botId: null,
        dateRange: null
      },

      // Actions
      setTrades: (trades) => set({ trades }),
      
      addTrade: (trade) => set((state) => ({
        trades: [trade, ...state.trades]
      })),
      
      updateTrade: (id, updates) => set((state) => ({
        trades: state.trades.map(trade => trade.id === id ? { ...trade, ...updates } : trade)
      })),

      removeTrade: (id) => set((state) => ({
        trades: state.trades.filter(trade => trade.id !== id)
      })),
      
      setPeriod: (period) => set({ period }),
      
      selectTrade: (id) => set({ selectedTrade: id }),
      
      deselectTrade: () => set({ selectedTrade: null }),

      setFilter: (filterType, value) => set((state) => ({
        filters: { ...state.filters, [filterType]: value }
      })),

      clearFilters: () => set({ filters: { status: null, botId: null, dateRange: null } }),

      // Computed
      getTradeHistory: () => {
        const state = get();
        return state.trades.filter(trade => {
          if (state.filters.status && trade.status !== state.filters.status) return false;
          if (state.filters.botId && trade.botId !== state.filters.botId) return false;
          // Add date range filter logic here
          return true;
        });
      },

      getTotalPnL: () => {
        return get().trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
      },

      getWinRate: () => {
        const state = get();
        const profitable = state.trades.filter(t => t.profit > 0).length;
        return state.trades.length > 0 ? (profitable / state.trades.length) * 100 : 0;
      }
    }),
    {
      name: 'trade-storage',
      storage: localStorage,
      partialize: (state) => ({
        trades: state.trades,
        filters: state.filters
      })
    }
  )
);

// Selectors
export const useTrades = () => useTradeStore(state => state.trades);
export const useSelectedTrade = () => useTradeStore(state => state.selectedTrade);
export const usePeriod = () => useTradeStore(state => state.period);
export const useFilters = () => useTradeStore(state => state.filters);
export const useTradeActions = () => useTradeStore(state => ({
  setTrades: state.setTrades,
  addTrade: state.addTrade,
  updateTrade: state.updateTrade,
  removeTrade: state.removeTrade,
  selectTrade: state.selectTrade,
  deselectTrade: state.deselectTrade,
  setPeriod: state.setPeriod,
  setFilter: state.setFilter,
  clearFilters: state.clearFilters
}));

export const useTradeMetrics = () => useTradeStore(state => ({
  getTotalPnL: state.getTotalPnL,
  getWinRate: state.getWinRate
}));
