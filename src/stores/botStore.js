import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Bot Store
 * Manages bot state and operations with persistence
 * Phase 8.3 Implementation
 */

export const useBotStore = create(
  persist(
    (set, get) => ({
      // State
      bots: [
        { id: 1, name: "Bond Bot", file: "polydesk_bond_bot.py", strategy: "Bond / Near-Certainty", status: "live", color: "#10b981", pnl: 602 },
        { id: 2, name: "Maker Rebates", file: "polydesk_maker_rebates_bot.py", strategy: "Market Making", status: "live", color: "#3b82f6", pnl: -2816 },
        { id: 3, name: "BTC 5-Min Bot", file: "polydesk_btc5m_bot.py", strategy: "OFI + Gabagool", status: "live", color: "#8b5cf6", pnl: 24800 },
        { id: 4, name: "Whale Mirror", file: "copier_tab", strategy: "Copy Trading", status: "paused", color: "#f59e0b", pnl: 0 },
        { id: 5, name: "Esports Oracle", file: "—", strategy: "Live Data Lag", status: "planned", color: "#64748b", pnl: 0 },
      ],
      selectedBot: null,
      botAllocations: { 1: 15, 2: 25, 3: 30, 4: 20, 5: 10 },
      selectedStrategies: [],

      // Actions
      setBots: (bots) => set({ bots }),
      
      addBot: (bot) => set((state) => ({ bots: [...state.bots, bot] })),
      
      updateBot: (id, updates) => set((state) => ({
        bots: state.bots.map(bot => bot.id === id ? { ...bot, ...updates } : bot)
      })),

      removeBot: (id) => set((state) => {
        const bots = state.bots.filter(bot => bot.id !== id);
        const botAllocations = { ...state.botAllocations };
        delete botAllocations[id];
        if (!isNaN(botAllocations['5'])) {
          botAllocations['5'] = 0;
        }
        return { bots, botAllocations };
      }),
      
      selectBot: (id) => set((state) => ({
        selectedBot: id
      })),
      
      deselectBot: () => set({ selectedBot: null }),
      
      updateAllocation: (botId, allocation) => set((state) => ({
        botAllocations: { ...state.botAllocations, [botId]: allocation }
      })),

      selectStrategy: (strategy) => set((state) => ({
        selectedStrategies: [...state.selectedStrategies, strategy]
      })),

      deselectStrategy: (strategy) => set((state) => ({
        selectedStrategies: state.selectedStrategies.filter(s => s !== strategy)
      }))
    }),
    {
      name: 'bot-storage',
      storage: localStorage,
      partialize: (state) => ({
        bots: state.bots,
        botAllocations: state.botAllocations,
        selectedStrategies: state.selectedStrategies
      })
    }
  )
);

// Selectors
export const useBots = () => useBotStore(state => state.bots);
export const useSelectedBot = () => useBotStore(state => state.selectedBot);
export const useBotActions = () => useBotStore(state => ({
  setBots: state.setBots,
  addBot: state.addBot,
  updateBot: state.updateBot,
  removeBot: state.removeBot,
  selectBot: state.selectBot,
  deselectBot: state.deselectBot
}));

export const useBotAllocations = () => useBotStore(state => state.botAllocations);
export const useUpdateAllocation = () => useBotStore(state => state.updateAllocation);

export const useSelectedStrategies = () => useBotStore(state => state.selectedStrategies);
export const useStrategyActions = () => useBotStore(state => ({
  selectStrategy: state.selectStrategy,
  deselectStrategy: state.deselectStrategy
}));
