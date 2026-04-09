# Polydesk Component Architecture Analysis

**Last Updated:** April 09, 2026
**Current Status:** Phase 8.3 Complete - 20+ Components Extracted

---

## App.jsx Current State

**File:** `/src/App.jsx`
**Current Size:** ~554 lines
**Original Size:** ~4,739 lines (pre-refactor)
**Reduction:** 88% (still needs further modularization)

**Current Responsibilities:**
- App shell with routing
- WebSocket connection management
- PWA install/update prompts
- Theme context provider
- Toast notification container
- Modal management (wallet, bot details)

---

## ✅ Extracted Components (Phase 1-5)

### Foundation Components
| Component | File | Props | Purpose |
|-----------|------|-------|---------|
| ChartTip | `components/ChartTip.jsx` | `active, payload, label` | Custom chart tooltips |
| StatusBadge | `components/StatusBadge.jsx` | `status` | Bot/status badges |
| Sparkline | `components/Sparkline.jsx` | `positive` | Mini SVG charts |
| Card | `components/Card.jsx` | `children, style` | Glass-morphism container |
| CardHeader | `components/CardHeader.jsx` | `title, sub, right` | Card headers |
| PeriodSelector | `components/PeriodSelector.jsx` | `period, setPeriod` | Time period buttons |
| Popup | `components/Popup.jsx` | `children, onClose` | Modal dialogs |

### Feature Components
| Component | File | Props | Purpose |
|-----------|------|-------|---------|
| BotCard | `components/BotCard.jsx` | `bot, theme, onClick` | Individual bot display |
| CommandPanel | `components/CommandPanel.jsx` | `theme, onCommand` | Bot controls |
| TradeTable | `components/TradeTable.jsx` | `trades, theme` | Trade history table |
| AllocationsPanel | `components/AllocationsPanel.jsx` | `allocations, theme` | Capital allocation |

### Tab Components
| Component | File | Purpose |
|-----------|------|---------|
| OverviewTab | `components/OverviewTab.jsx` | Dashboard with charts |
| TradesTab | `components/TradesTab.jsx` | Trade history view |
| StrategiesTab | `components/StrategiesTab.jsx` | Strategy management |
| CopierTab | `components/CopierTab.jsx` | Whale copy trading |
| SettingsTab | `components/SettingsTab.jsx` | Configuration panel |

---

## ✅ Phase 8.1 Components (Real-Time Features)

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| Toast | `components/Toast.jsx` | Notification display | ✅ Complete |
| ToastContainer | `components/ToastContainer.jsx` | Toast manager | ✅ Complete |
| ErrorBoundary | `components/ErrorBoundary.jsx` | Error isolation | ✅ Complete |

### Hooks
| Hook | File | Purpose | Status |
|------|------|---------|--------|
| useNotifications | `hooks/useNotifications.js` | Toast state | ✅ Complete |
| useWebSocket | `hooks/useWebSocket.js` | WS connection | ✅ Complete |

### Services
| Service | File | Purpose | Status |
|---------|------|---------|--------|
| WebSocketService | `services/WebSocketService.js` | Real-time data | ✅ Complete |

---

## ✅ Phase 8.2 Components (PWA)

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| usePWA | `hooks/usePWA.js` | PWA controls | ✅ Complete |

### PWA Files
- `public/manifest.json` - App manifest
- `public/service-worker.js` - Offline caching

---

## ✅ Phase 8.3 Components (Advanced Features)

| Component | File | Props | Purpose |
|-----------|------|-------|---------|
| Skeleton | `components/Skeleton.jsx` | `width, height` | Loading shimmer |
| PerformanceChart | `components/PerformanceChart.jsx` | `data, type, theme` | Multi-type charts |
| CandlestickChart | `components/CandlestickChart.jsx` | `data, theme` | OHLC charts |
| PerformanceDashboard | `components/PerformanceDashboard.jsx` | `theme` | Analytics + export |

### Zustand Stores
| Store | File | Purpose | Status |
|-------|------|---------|--------|
| botStore | `stores/botStore.js` | Bot state + persistence | ✅ Complete |
| tradeStore | `stores/tradeStore.js` | Trades + metrics | ✅ Complete |
| settingsStore | `stores/settingsStore.js` | Config + wallets | ✅ Complete |

### Utilities
| Utility | File | Purpose |
|---------|------|---------|
| format | `utils/format.js` | Number/date formatting |
| trades | `utils/trades.js` | Sample trade data |

---

## Custom Hooks Summary

| Hook | File | Purpose | Phase |
|------|------|---------|-------|
| useBots | `hooks/useBots.js` | Bot registry management | 4 |
| useTrades | `hooks/useTrades.js` | Trade data fetching | 4 |
| useTheme | `hooks/useTheme.js` | Theme switching | 4 |
| useNotifications | `hooks/useNotifications.js` | Toast system | 8.1 |
| usePWA | `hooks/usePWA.js` | PWA install/update | 8.2 |
| useWebSocket | `hooks/useWebSocket.js` | WebSocket connection | 8.1 |

---

## Current Architecture

```
src/
├── App.jsx                    # App shell (554 lines)
├── main.jsx                   # Entry point
├── stores/                    # Zustand stores (NEW)
│   ├── botStore.js           # Bot state
│   ├── tradeStore.js         # Trade state
│   └── settingsStore.js      # Settings state
├── components/                # 20+ components
│   ├── [foundation]          # Card, CardHeader, etc.
│   ├── [features]            # BotCard, TradeTable, etc.
│   ├── [tabs]                # OverviewTab, TradesTab, etc.
│   ├── [phase8]              # Toast, Skeleton, Charts
│   └── __tests__/            # Component tests
├── hooks/                     # 6 custom hooks
├── services/                  # WebSocket service
├── utils/                     # format.js, trades.js
└── constants/                 # themes.js
```

---

## Remaining Technical Debt

### App.jsx Still Needs Work
**Current:** 554 lines
**Target:** <200 lines

**Still in App.jsx:**
- Header UI (120 lines)
- Navigation (40 lines)
- Modal management (110 lines)
- WebSocket subscription logic (40 lines)
- PWA controls (30 lines)

**Recommended Extraction:**
1. `Layout/Header.jsx` - Header with PWA controls
2. `Layout/Navigation.jsx` - Tab navigation
3. `Modals/WalletModal.jsx` - Wallet connection
4. `Modals/BotDetailModal.jsx` - Bot details
5. `providers/AppProviders.jsx` - Context providers

---

## Phase 9+ Component Plans

### Backend Standardization (Phase 9)
No new frontend components

### Testing Suite (Phase 10)
```
src/
├── components/__tests__/
│   ├── Toast.test.jsx        # To create
│   ├── Skeleton.test.jsx     # To create
│   ├── PerformanceChart.test.jsx  # To create
│   └── [16 total test files] # Target: 80% coverage
```

### Enterprise Features (Phase 11-12)
- `RiskDashboard.jsx` - Risk metrics display
- `BacktestPanel.jsx` - Strategy backtesting
- `TeamSettings.jsx` - Multi-user settings

---

*Last Updated: Phase 8.3 Complete | 20+ Components | 6 Hooks | 3 Stores*
