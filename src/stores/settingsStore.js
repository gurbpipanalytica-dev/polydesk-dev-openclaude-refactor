import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Settings Store
 * Manages UI settings, theme, and preferences
 * Phase 8.3 Implementation
 */

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Theme state
      darkMode: true,
      mode: 'demo',
      
      // UI preferences
      autoRefresh: true,
      refreshInterval: 5000,
      notificationsEnabled: true,
      soundEnabled: false,
      
      // Shortcut state
      shortcuts: {
        'Ctrl+R': { action: 'refresh', description: 'Refresh data' },
        'Ctrl+S': { action: 'save', description: 'Save settings' },
        'Ctrl+T': { action: 'trade', description: 'Execute trade' }
      },
      
      // Connected wallets/accounts
      connectedWallets: [],

      // Actions
      setDarkMode: (darkMode) => set({ darkMode }),
      
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      
      setMode: (mode) => set({ mode }),
      
      toggleMode: () => set((state) => ({ mode: state.mode === 'demo' ? 'live' : 'demo' })),
      
      setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),
      
      setRefreshInterval: (interval) => set({ refreshInterval: interval }),
      
      setNotifications: (enabled) => set({ notificationsEnabled: enabled }),
      
      setSound: (enabled) => set({ soundEnabled: enabled }),

      addWallet: (wallet) => set((state) => ({
        connectedWallets: [...state.connectedWallets, wallet]
      })),

      removeWallet: (walletId) => set((state) => ({
        connectedWallets: state.connectedWallets.filter(w => w.id !== walletId)
      })),

      addKeyboardShortcut: (keyCombo, action) => set((state) => ({
        shortcuts: { ...state.shortcuts, [keyCombo]: action }
      })),

      removeKeyboardShortcut: (keyCombo) => set((state) => {
        const shortcuts = { ...state.shortcuts };
        delete shortcuts[keyCombo];
        return { shortcuts };
      })
    }),
    {
      name: 'settings-storage',
      storage: localStorage,
      partialize: (state) => ({
        darkMode: state.darkMode,
        mode: state.mode,
        autoRefresh: state.autoRefresh,
        refreshInterval: state.refreshInterval,
        notificationsEnabled: state.notificationsEnabled,
        soundEnabled: state.soundEnabled,
        shortcuts: state.shortcuts,
        connectedWallets: state.connectedWallets
      })
    }
  )
);

// Selectors
export const useDarkMode = () => useSettingsStore(state => state.darkMode);
export const useMode = () => useSettingsStore(state => state.mode);
export const useAutoRefresh = () => useSettingsStore(state => state.autoRefresh);
export const useRefreshInterval = () => useSettingsStore(state => state.refreshInterval);
export const useNotificationsEnabled = () => useSettingsStore(state => state.notificationsEnabled);
export const useSoundEnabled = () => useSettingsStore(state => state.soundEnabled);
export const useConnectedWallets = () => useSettingsStore(state => state.connectedWallets);
export const useShortcuts = () => useSettingsStore(state => state.shortcuts);

export const useSettingsActions = () => useSettingsStore(state => ({
  setDarkMode: state.setDarkMode,
  toggleDarkMode: state.toggleDarkMode,
  setMode: state.setMode,
  toggleMode: state.toggleMode,
  setAutoRefresh: state.setAutoRefresh,
  setRefreshInterval: state.setRefreshInterval,
  setNotifications: state.setNotifications,
  setSound: state.setSound,
  addWallet: state.addWallet,
  removeWallet: state.removeWallet,
  addKeyboardShortcut: state.addKeyboardShortcut,
  removeKeyboardShortcut: state.removeKeyboardShortcut
}));
