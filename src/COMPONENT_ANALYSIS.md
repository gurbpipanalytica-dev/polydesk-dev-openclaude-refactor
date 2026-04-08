# App.jsx Structure Analysis

## File Overview
**File:** `/src/App.jsx`
**Size:** 336KB, 5072 lines
**Main Component:** `PolydeskV12()` (line 2241)

## Extractable Components

### 1. ChartTip (line 213)
- **Purpose:** Custom tooltip for charts
- **Props:** `active`, `payload`, `label`

### 2. StatusBadge (line 228)
- **Purpose:** Display bot/status badges with colors
- **Props:** `status`

### 3. Sparkline (line 246)
- **Purpose:** Mini SVG sparkline chart
- **Props:** `positive`

### 4. Card (line 255)
- **Purpose:** Card container with theming
- **Props:** `children`, `style`

### 5. CardHeader (line 264)
- **Purpose:** Card header with title and subtitle
- **Props:** `title`, `sub`, `right`

### 6. PeriodSelector (line 280)
- **Purpose:** Period selector buttons (1D, 7D, 1M, 3M, ALL, Custom)
- **Props:** `period`, `setPeriod`, `customRange`, `setCustomRange`

### 7. Popup (line ~302)
- **Purpose:** Modal popup component

### 8. Header
- **Purpose:** Top header with logo, stats, mode switcher
- **Features:** Balance display, uptime, mode (demo/live), settings

### 9. OverviewTab
- **Purpose:** Main dashboard overview
- **Features:** Chart, P&L summary, bot cards grid, allocations, top trades

### 10. BotCard
- **Purpose:** Individual bot display card
- **Props:** bot info (name, status, pnl, trades)

### 11. TradesTab
- **Purpose:** Trade history table
- **Features:** Filters, search, pagination

### 12. StrategiesTab
- **Purpose:** Strategy roadmaps and details
- **Features:** Tiered strategy display, ROI estimates

### 13. CopierTab
- **Purpose:** Whale copy trading interface
- **Features:** Tracked wallets, copy controls

### 14. SettingsTab
- **Purpose:** Configuration and settings
- **Features:** Parameter inputs, toggles

### 15. CommandPanel
- **Purpose:** Send commands to bots
- **Features:** Start, stop, pause, set allocation

### 16. BotDetailDrawer
- **Purpose:** Individual bot detail view
- **Features:** Metrics, parameters, controls

### 17. StrategyDetailDrawer
- **Purpose:** Strategy information and allocation

### 18. AllocationsPanel
- **Purpose:** Bot allocation management
- **Features:** Capital allocation sliders, confirm dialog

## Main State Variables (in PolydeskV12)

```javascript
// Mode & UI
const [mode, setMode] = useState("demo");
const [page, setPage] = useState("overview");
const [period, setPeriod] = useState("1M");

// Bot Management
const [botsRegistry, setBotsRegistry] = useState([...BOTS]);
const [botAllocations, setBotAllocations] = useState({1:0, 2:0, 3:0, 4:0, 5:0});
const [selectedBot, setBot] = useState(null);

// Trading Data
const [allTrades, setAllTrades] = useState([]);
const [tradesLoading, setTradesLoading] = useState(false);

// Theme
const [darkMode, setDarkMode] = useState(true);
const B = darkMode ? DARK : LIGHT; // theme colors
const T = THEMES[mode]; // mode theme

// Modals
const [liveWalletModal, setLiveWalletModal] = useState(false);
const [allocConfirm, setAllocConfirm] = useState(null);
```

## Main UI Sections

### Header (line ~325-450)
- Logo, title
- Stats (live bots, P&L, uptime)
- Mode switcher (demo/live)
- Settings button

### Main Tabs (line ~450-700)
1. **Overview** - Dashboard with charts, bot cards, P&L
2. **Trades** - Trade history table
3. **Strategies** - Strategy roadmap and details
4. **Copier** - Whale copy trading
5. **Settings** - Configuration

### Sub-Components (spread throughout)
- TopTrades panel
- Heatmap chart
- P&L chart
- Rebate markets table
- Copy trading controls
- Strategy details

## Data Flow

1. **Fetch trades:** `fetchAllTrades()` called on mount
2. **Fetch bot state:** `fetchBotState()` for each bot
3. **Commands:** User action → API call → bot state update
4. **Auto-refresh:** 10-second refresh interval for trades

## Key Functions

- `fetchAllTrades()` - Get trade history
- `fetchBotState()` - Get bot status
- `sendCommand(bot, action, data)` - Send command to bot
- `buildChartData()` - Process trade data for charts
- `buildBotStats()` - Calculate bot statistics
- `handleAllocation()` - Update bot allocations

## File Configuration Sections

Lines 10-99: Constants and configuration
Lines 100-2240: Helper components and utilities
Lines 2241-5072: Main PolydeskV12 component

---

## Refactoring Strategy

### Phase 1: Extract User-Defined Components
1. Move ChartTip, StatusBadge, Sparkline, Card, CardHeader to `/components/common/`
2. Move PeriodSelector to `/components/controls/`
3. Extract Header to `/components/layout/`

### Phase 2: Extract Tab Components
1. Extract OverviewTab to `/components/tabs/`
2. Extract TradesTab to `/components/tabs/`
3. Extract StrategiesTab to `/components/tabs/`
4. Extract CopierTab to `/components/tabs/`
5. Extract SettingsTab to `/components/tabs/`

### Phase 3: Extract Shared Components
1. Extract BotCard to `/components/bots/`
2. Extract CommandPanel to `/components/bots/`
3. Extract TradeTable to `/components/trades/`

### Phase 4: Create Custom Hooks
1. `useBots()` - Manage bot registry and state
2. `useTrades()` - Manage trade data
3. `useTheme()` - Manage theme (already exists but extractable)

### Phase 5: Reduce App.jsx
Goal: Reduce from 5072 lines to <200 lines
- Only keep routing logic
- Delegate all rendering to components
- Manage state with custom hooks
