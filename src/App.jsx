import { useState, useEffect } from "react";
import { DARK, LIGHT, THEMES } from "./constants/themes";
import { fmt } from "./utils/format";
import { wsService } from "./services/WebSocketService";
import { useNotifications } from "./hooks/useNotifications";
import ToastContainer from "./components/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { usePWA } from "./hooks/usePWA";
import useBots from "./hooks/useBots";
import useTrades from "./hooks/useTrades";
import { useTheme } from "./hooks/useTheme";

// Import all tab components
import OverviewTab from "./components/OverviewTab";
import TradesTab from "./components/TradesTab";
import StrategiesTab from "./components/StrategiesTab";
import CopierTab from "./components/CopierTab";
import SettingsTab from "./components/SettingsTab";

// Bot and strategy definitions
const BOTS = [
  { id: 1, name: "Bond Bot", file: "polydesk_bond_bot.py", strategy: "Bond / Near-Certainty", status: "live", color: "#10b981" },
  { id: 2, name: "Maker Rebates", file: "polydesk_maker_rebates_bot.py", strategy: "Market Making", status: "live", color: "#3b82f6" },
  { id: 3, name: "BTC 5-Min Bot", file: "polydesk_btc5m_bot.py", strategy: "OFI + Gabagool", status: "live", color: "#8b5cf6" },
  { id: 4, name: "Whale Mirror", file: "copier_tab", strategy: "Copy Trading", status: "paused", color: "#f59e0b" },
  { id: 5, name: "Esports Oracle", file: "—", strategy: "Live Data Lag", status: "planned", color: "#64748b" },
];

const STRATEGY_TIERS = [
  { tier: "TIER 1 - Structural Edge", color: "#10b981", strategies: [] },
  { tier: "TIER 2 - High Confidence", color: "#4f6ef7", strategies: [] },
  { tier: "TIER 3 - Specialist Alpha", color: "#8b5cf6", strategies: [] },
  { tier: "TIER 4 - Experimental", color: "#f5a623", strategies: [] },
];

// Supabase and orchestrator configuration
const SUPABASE_URL = "https://dwpqvhmdiaimfphdzmpc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_uY0g2jvzpE9xwAsaOEDjmw_A9y_de-6";
const ORCHESTRATOR_BASE = "https://api.gurbcapital.com";

export default function PolydeskV12() {
  // Mode management
  const [mode, setMode] = useState("demo");
  const [darkMode, setDarkMode] = useState(true);
  const [page, setPage] = useState("overview");
  const [period, setPeriod] = useState("1M");
  const [selectedBot, setSelectedBot] = useState(null);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [liveWalletModal, setLiveWalletModal] = useState(false);
  const [liveWalletInput, setLiveWalletInput] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  // Theme tokens
  const B = darkMode ? DARK : LIGHT;
  const T = THEMES[mode];

  // PWA controls
  const { 
    isInstalled, 
    installPrompt, 
    isOfflineReady,
    updateAvailable,
    installPWA,
    update: skipWaiting,
    getStatus
  } = usePWA();

  // Notification system
  const { toasts, notify, success, error, warning, info, remove } = useNotifications();
  
  // Use custom hooks
  const {
    botsRegistry,
    botAllocations,
    addBot,
    removeBot,
    reallocateBot,
    enableBot,
    disableBot,
  } = useBots(ORCHESTRATOR_BASE);

  const {
    allTrades,
    tradesLoading,
    buildChartData,
    buildMeta,
    buildCategories,
  } = useTrades(ORCHESTRATOR_BASE);

  // Load demo balance on mount
  const [demoBalance, setDemoBalance] = useState(100000);
  useEffect(() => {
    fetch(`${ORCHESTRATOR_BASE}/app-state?key=demo_balance`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.value != null) setDemoBalance(parseFloat(d.value));
      })
      .catch(() => {});
  }, [ORCHESTRATOR_BASE]);

  // Derived values
  const totalAllocated = Object.values(botAllocations).reduce((sum, val) => sum + (val || 0), 0);
  const availableBalance = demoBalance - totalAllocated;
  
  // WebSocket state
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
  
  // WebSocket Integration - Subscribe to real-time data
  useEffect(() => {
    // Subscribe to system status
    const unsubscribeStatus = wsService.subscribe('system', (data) => {
      if (data.type === 'connection_status') {
        setConnectionStatus(data.data.status);
      }
    });
    
  // Subscribe to price updates
  const unsubscribePrices = wsService.subscribe('prices', (data) => {
    if (data.type === 'price_update') {
      setLastPriceUpdate(data.symbol + ': ' + data.data.price.toFixed(2));
    }
  });
  
  // Subscribe to trade updates
  const unsubscribeTrades = wsService.subscribe('trades', (data) => {
    if (data.type === 'trade_executed') {
      setLastTrade(data.data);
      success(`🎉 New trade: ${data.data.type} ${data.data.symbol} @ ${fmt.short(data.data.price)}`);
    }
  });

  return () => {
    unsubscribeStatus();
    unsubscribePrices();
    unsubscribeTrades();
  };
  }, []);

  // Event handlers
  const handleModeChange = (newMode) => {
    if (newMode === "live" && !walletAddress) {
      setLiveWalletModal(true);
    } else {
      setMode(newMode);
    }
  };

  const handleWalletConnect = async () => {
    if (liveWalletInput.startsWith("0x") && liveWalletInput.length >= 20) {
      setWalletAddress(liveWalletInput);
      setMode("live");
      setLiveWalletModal(false);
      // Fetch live balance and trades
      fetch(`${ORCHESTRATOR_BASE}/portfolio/${liveWalletInput}`)
        .then(r => r.json())
        .then(d => {
          if (d?.balance != null) {
            // Update with real balance
          }
        });
    }
  };

  // Render active tab with ErrorBoundary
  const renderActiveTab = () => {
    switch (page) {
      case "overview":
        return (
          <ErrorBoundary theme={B}>
            <OverviewTab
              theme={B}
              bots={botsRegistry}
              trades={allTrades}
              botAllocations={botAllocations}
              availableBalance={availableBalance}
              demoBalance={demoBalance}
              mode={mode}
            />
          </ErrorBoundary>
        );
      case "trades":
        return (
          <ErrorBoundary theme={B}>
            <TradesTab
              theme={B}
              trades={allTrades}
              period={period}
              setPeriod={setPeriod}
              buildChartData={buildChartData}
              buildMeta={buildMeta}
              buildCategories={buildCategories}
              fmt={fmt}
            />
          </ErrorBoundary>
        );
      case "strategies":
        return (
          <ErrorBoundary theme={B}>
            <StrategiesTab
              theme={B}
              bots={botsRegistry}
              trades={allTrades}
              botAllocations={botAllocations}
            />
          </ErrorBoundary>
        );
      case "copier":
        return (
          <ErrorBoundary theme={B}>
            <CopierTab theme={B} trades={allTrades} />
          </ErrorBoundary>
        );
      case "settings":
        return (
          <ErrorBoundary theme={B}>
            <SettingsTab
              theme={B}
              setTheme={(newTheme) => {
                setDarkMode(newTheme === DARK);
              }}
            />
          </ErrorBoundary>
        );
      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <div
      className="app-root"
      style={{
        minHeight: "100vh",
        background: B.bg,
        color: B.text,
        fontFamily: "'Outfit', -apple-system, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        .app-root { transition: background 0.3s ease, color 0.3s ease; }
      `}</style>

      {/* Header */}
      <header
        style={{
          background: B.surf,
          borderBottom: `1px solid ${B.border}`,
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: "700", color: B.text }}>
          Polydesk
          <span
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: T.accentText,
              background: T.accentSoft,
              padding: "4px 8px",
              borderRadius: "6px",
              marginLeft: "8px",
            }}
          >
            {T.label}
          </span>
        </div>

      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* PWA Install Button */}
          {installPrompt && !isInstalled && (
            <button
              onClick={installPWA}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: T.accentSoft,
                border: `1px solid ${T.accentBorder}`,
                color: T.accentText,
                fontSize: "12px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              📱 Install App
            </button>
          )}
          
          {/* PWA Status */}
          {isInstalled && (
            <div style={{ color: '#10b981', fontSize: "12px", fontWeight: "500" }}>
              📱 Installed
            </div>
          )}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div 
            style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              background: connectionStatus === 'connected' ? '#10b981' : 
                          connectionStatus === 'error' ? '#ef4444' : '#f59e0b',
              boxShadow: connectionStatus === 'connected' ? '0 0 8px #10b981' : 'none'
            }} 
          />
          <div style={{ color: B.subtext, fontSize: "12px" }}>
            WebSocket: {connectionStatus}
          </div>
          {lastPriceUpdate && (
            <div style={{ color: B.muted, fontSize: "11px", marginLeft: "8px" }}>
              {lastPriceUpdate}
            </div>
          )}
        </div>
        
        <button
          onClick={() => handleModeChange(mode === "demo" ? "live" : "demo")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            background: T.accentSoft,
            border: `1px solid ${T.accentBorder}`,
            color: T.accentText,
            fontWeight: "500",
            cursor: "pointer",
          }}
        >
          Switch to {mode === "demo" ? "Live" : "Demo"}
        </button>

        <div style={{ color: B.subtext, fontSize: "14px" }}>
          {T.balanceLabel}: {fmt.short(mode === "demo" ? demoBalance : 0)}
        </div>
      </div>
      
      {updateAvailable && (
        <button
          onClick={skipWaiting}
          style={{
            position: 'fixed',
            top: '24px',
            right: '220px',
            padding: "8px 16px",
            borderRadius: "8px",
            background: '#f59e0b',
            border: `1px solid #d97706`,
            color: '#fff',
            fontWeight: "500",
            cursor: "pointer",
            zIndex: 1001,
          }}
        >
          🔄 Update Available
        </button>
      )}

      <button
        onClick={() => {
          info("Info: This is an informational toast");
          setTimeout(() => warning("Warning: Connection may be unstable", 3000), 300);
          setTimeout(() => error("Error: Failed to connect to exchange", 3003), 600);
          setTimeout(() => success("Success: Trade executed successfully"), 900);
        }}
        style={{
          position: 'fixed',
          top: '24px',
          right: '120px',
          padding: "8px 16px",
          borderRadius: "8px",
          background: T.accentSoft,
          border: `1px solid ${T.accentBorder}`,
          color: T.accentText,
          fontWeight: "500",
          cursor: "pointer",
          zIndex: 1001,
        }}
      >
        Test Toasts
      </button>
    </header>

      {/* Navigation */}
      <nav
        style={{
          background: B.surf,
          borderBottom: `1px solid ${B.border}`,
          padding: "12px 24px",
          display: "flex",
          gap: "8px",
        }}
      >
        {[
          { key: "overview", label: "Overview", icon: "📊" },
          { key: "trades", label: "Trades", icon: "💹" },
          { key: "strategies", label: "Strategies", icon: "🎯" },
          { key: "copier", label: "Copy Trading", icon: "🐋" },
          { key: "settings", label: "Settings", icon: "⚙️" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPage(tab.key)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              background: page === tab.key ? B.surf2 : "transparent",
              border: `1px solid ${page === tab.key ? B.border : "transparent"}`,
              color: page === tab.key ? B.text : B.subtext,
              fontWeight: page === tab.key ? "600" : "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ marginRight: "6px" }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main style={{ padding: "24px" }}>{renderActiveTab()}</main>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={remove} theme={B} />

      {/* Modals */}
      {selectedBot && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: B.surf,
            border: `1px solid ${B.border}`,
            borderRadius: "16px",
            padding: "24px",
            zIndex: 1000,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            maxWidth: "600px",
            width: "90%",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ color: B.text }}>{selectedBot.name} Details</h3>
            <button onClick={() => setSelectedBot(null)} style={{ color: B.muted, cursor: "pointer" }}>
              ✕
            </button>
          </div>
          {/* Bot details would go here */}
        </div>
      )}

      {liveWalletModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(6px)",
            zIndex: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setLiveWalletModal(false)}
        >
          <div
            style={{
              background: B.surf,
              border: `1px solid ${B.border}`,
              borderRadius: "16px",
              padding: "28px 32px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              width: "420px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: "6px", fontSize: "11px", color: T.accentText, fontWeight: 700 }}>
              🟢 Switch to Live Mode
            </div>
            <h3 style={{ color: B.text, marginBottom: "8px" }}>Connect your Polymarket wallet</h3>
            <p style={{ color: B.muted, fontSize: "12px", marginBottom: "20px" }}>
              Enter your Polygon wallet address (0x...) to fetch your real USDC balance and trade history.
            </p>
            <input
              value={liveWalletInput}
              onChange={(e) => setLiveWalletInput(e.target.value)}
              placeholder="0x... your Polymarket wallet address"
              style={{
                width: "100%",
                background: B.surf2,
                border: `1px solid ${B.border}`,
                borderRadius: "8px",
                padding: "10px 13px",
                fontSize: "12px",
                color: B.text,
                marginBottom: "12px",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setLiveWalletModal(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  background: B.surf2,
                  border: `1px solid ${B.border}`,
                  color: B.muted,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                disabled={!liveWalletInput.startsWith("0x") || liveWalletInput.length < 20}
                onClick={handleWalletConnect}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  background: B.green,
                  border: "none",
                  color: B.surf,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: (!liveWalletInput.startsWith("0x") || liveWalletInput.length < 20) ? 0.5 : 1,
                }}
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
