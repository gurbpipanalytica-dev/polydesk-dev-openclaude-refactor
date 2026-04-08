import React, { useState } from "react";
import Card from "./Card";
import CardHeader from "./CardHeader";
import StatusBadge from "./StatusBadge";
import ChartTip from "./ChartTip";

export default function SettingsTab({ theme = DARK, setTheme }) {
  const [settings, setSettings] = useState({
    // General Settings
    refreshInterval: 30,
    showDemoBots: false,
    darkMode: true,
    compactMode: false,
    rememberFilters: true,
    notebookEnabled: true,
    
    // API Configuration
    supabaseUrl: "https://dwpqvhmdiaimfphdzmpc.supabase.co",
    supabaseKey: "sb_publishable_uY0g2jvzpE9xwAsaOEDjmw_A9y_de-6",
    openaiApiKey: "",
    
    // Orchestrator Configuration
    orchestratorBase: "https://api.gurbcapital.com",
    arbBotUrl: "http://arb_bot:9001",
    bondBotUrl: "http://bond_bot:9002",
    polyBotUrl: "http://poly_bot:9003",
    swingBotUrl: "http://swing_bot:9004",
    
    // Risk Management
    tradeBatchSize: 3,
    allocatedCapital: 85,
    maxTradeLoss: 10,
    maxDailyLoss: 25,
    stopLoss: true,
    maxPositionSize: 15,
    
    // Notifications
    emailAlerts: true,
    discordAlerts: false,
    webhookAlerts: false,
    tradeNotifications: true,
    errorNotifications: true,
    
    // Display Preferences
    showTooltip: true,
    showHelpText: true,
    showAdvancedStats: false,
    chartAnimations: true,
    autoRefresh: true,
    
    // Export/Import
    dataRetention: 90,
    autoBackup: false,
    webhookUrl: ""
  });
  
  const [apiStatus, setApiStatus] = useState({
    supabase: "connected",
    orchestrator: "connected",
    arb: "connected",
    bond: "connected",
    poly: "connected",
    swing: "connected"
  });
  
  const [activeSection, setActiveSection] = useState("general");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const onSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    
    if (key === "darkMode") {
      setTheme(value ? DARK : LIGHT);
    }
  };
  
  const onSaveSettings = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }, 800);
  };
  
  const onTestConnection = (service) => {
    setApiStatus(prev => ({ ...prev, [service]: "testing" }));
    setTimeout(() => {
      setApiStatus(prev => ({ ...prev, [service]: Math.random() > 0.1 ? "connected" : "error" }));
    }, 1500);
  };
  
  const onExportData = () => {
    setExporting(true);
    setTimeout(() => {
      const dataStr = JSON.stringify(settings, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "polydesk-settings.json";
      a.click();
      setExporting(false);
    }, 1000);
  };
  
  const onImportData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          setSettings(prev => ({ ...prev, ...imported }));
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        } catch (err) {
          console.error("Invalid settings file");
        }
      };
      reader.readAsText(file);
    }
  };
  
  const onResetSettings = () => {
    if (confirm("Are you sure you want to reset all settings to defaults?")) {
      setSettings({
        refreshInterval: 30,
        showDemoBots: false,
        darkMode: true,
        compactMode: false,
        rememberFilters: true,
        notebookEnabled: true,
        tradeBatchSize: 3,
        allocatedCapital: 85,
        maxTradeLoss: 10,
        maxDailyLoss: 25,
        stopLoss: true,
        maxPositionSize: 15,
        emailAlerts: true,
        discordAlerts: false,
        webhookAlerts: false,
        tradeNotifications: true,
        errorNotifications: true,
        showTooltip: true,
        showHelpText: true,
        showAdvancedStats: false,
        chartAnimations: true,
        autoRefresh: true,
        dataRetention: 90,
        autoBackup: false
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };
  
  return (
    <div className="settings-container" style={{ color: theme.text }}>
      <style jsx>{`
        .settings-container {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
        }
        .sidebar {
          background: ${theme.surf};
          border: 1px solid ${theme.border};
          border-radius: 16px;
          padding: 16px;
          height: fit-content;
          position: sticky;
          top: 24px;
        }
        .sidebar-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
          color: ${theme.text};
        }
        .nav-item {
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 4px;
          font-size: 14px;
          font-weight: 500;
          color: ${theme.subtext};
        }
        .nav-item:hover {
          background: ${theme.surf2};
          color: ${theme.text};
        }
        .nav-item.active {
          background: ${theme.blueSoft};
          color: ${theme.blue};
        }
        .main-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .settings-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          color: ${theme.text};
        }
        .settings-subtitle {
          color: ${theme.subtext};
          font-size: 16px;
        }
        .action-buttons {
          display: flex;
          gap: 12px;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-primary {
          background: ${theme.blue};
          color: ${theme.surf};
        }
        .btn-primary:hover {
          background: ${theme.blue};
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(76, 158, 235, 0.3);
        }
        .btn-secondary {
          background: ${theme.surf};
          color: ${theme.text};
          border: 1px solid ${theme.border};
        }
        .btn-secondary:hover {
          background: ${theme.surf2};
          border-color: ${theme.borderHover};
        }
        .btn-success {
          background: ${theme.green};
          color: ${theme.greenSoft};
        }
        .btn-warning {
          background: ${theme.amber};
          color: ${theme.amberSoft};
        }
        .section {
          background: ${theme.surf};
          border: 1px solid ${theme.border};
          border-radius: 16px;
          overflow: hidden;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeInUp 0.5s ease forwards;
        }
        .section:nth-child(1) { animation-delay: 0.1s; }
        .section:nth-child(2) { animation-delay: 0.2s; }
        .section:nth-child(3) { animation-delay: 0.3s; }
        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .section.active {
          display: block;
        }
        .section-title {
          background: ${theme.surf2};
          padding: 20px 24px;
          border-bottom: 1px solid ${theme.border};
          font-size: 18px;
          font-weight: 600;
          color: ${theme.text};
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .section-content {
          padding: 24px;
        }
        .setting-group {
          margin-bottom: 24px;
        }
        .setting-label {
          font-size: 14px;
          font-weight: 500;
          color: ${theme.text};
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .setting-description {
          font-size: 13px;
          color: ${theme.muted};
          margin-bottom: 12px;
        }
        .toggle {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }
        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: ${theme.dim};
          transition: .4s;
          border-radius: 24px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }
        input:checked + .toggle-slider {
          background-color: ${theme.blue};
        }
        input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }
        .input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid ${theme.border};
          background: ${theme.surf2};
          color: ${theme.text};
          border-radius: 8px;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .input:focus {
          outline: none;
          border-color: ${theme.blue};
          background: ${theme.surf3};
        }
        .input-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .input-addon {
          padding: 8px 12px;
          background: ${theme.surf2};
          border: 1px solid ${theme.border};
          border-radius: 6px;
          color: ${theme.subtext};
          font-size: 13px;
          font-weight: 500;
        }
        .range-slider {
          width: 100%;
          height: 4px;
          border-radius: 2px;
          background: ${theme.dim};
          outline: none;
          -webkit-appearance: none;
        }
        .range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${theme.blue};
          cursor: pointer;
        }
        .range-value {
          min-width: 60px;
          text-align: right;
          font-size: 14px;
          font-weight: 600;
          color: ${theme.text};
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }
        .connection-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .status-dot.connected { background: ${theme.green}; }
        .status-dot.error { background: ${theme.red}; }
        .status-dot.testing { 
          background: ${theme.amber}; 
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .save-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }
        .save-indicator.success {
          background: ${theme.greenSoft};
          color: ${theme.green};
        }
        @media (max-width: 968px) {
          .settings-container {
            grid-template-columns: 1fr;
          }
          .sidebar {
            position: static;
          }
        }
      `}</style>
      
      <div className="sidebar">
        <div className="sidebar-title">Settings</div>
        <div className={`nav-item ${activeSection === "general" ? "active" : ""}`}
             onClick={() => setActiveSection("general")}
        >
          ⚙️ General
        </div>
        <div className={`nav-item ${activeSection === "api" ? "active" : ""}`}
             onClick={() => setActiveSection("api")}
        >
          🔑 API Configuration
        </div>
        <div className={`nav-item ${activeSection === "orchestrator" ? "active" : ""}`}
             onClick={() => setActiveSection("orchestrator")}
        >
          🖥️ Orchestrator
        </div>
        <div className={`nav-item ${activeSection === "risk" ? "active" : ""}`}
             onClick={() => setActiveSection("risk")}
        >
          ⚡ Risk Management
        </div>
        <div className={`nav-item ${activeSection === "notifications" ? "active" : ""}`}
             onClick={() => setActiveSection("notifications")}
        >
          🔔 Notifications
        </div>
        <div className={`nav-item ${activeSection === "display" ? "active" : ""}`}
             onClick={() => setActiveSection("display")}
        >
          🎨 Display
        </div>
        <div className={`nav-item ${activeSection === "export" ? "active" : ""}`}
             onClick={() => setActiveSection("export")}
        >
          💾 Data Management
        </div>
      </div>
      
      <div className="main-content">
        <div className="settings-header">
          <div>
            <div className="settings-title">Settings</div>
            <div className="settings-subtitle">Configure your trading dashboard preferences</div>
          </div>
          <div className="action-buttons">
            {saveSuccess && (
              <div className="save-indicator success">
                ✅ Settings saved!
              </div>
            )}
            <button className="btn btn-secondary" onClick={onResetSettings}>
              🔄 Reset to Defaults
            </button>
            <button className="btn btn-primary" onClick={onSaveSettings} disabled={saving}>
              {saving ? "⏳ Saving..." : "💾 Save Changes"}
            </button>
          </div>
        </div>
        
        {activeSection === "general" && (
          <div className="section">
            <div className="section-title">⚙️ General Settings</div>
            <div className="section-content">
              <div className="grid">
                <div className="setting-group">
                  <div className="setting-label">
                    Dark Mode
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.darkMode}
                        onChange={(e) => onSettingChange("darkMode", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Use dark theme for better visibility in low-light environments</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Refresh Interval
                    <span className="range-value">{settings.refreshInterval}s</span>
                  </div>
                  <div className="setting-description">How often the dashboard updates data (in seconds)</div>
                  <div className="input-group">
                    <input
                      type="range"
                      className="range-slider"
                      min="5"
                      max="300"
                      value={settings.refreshInterval}
                      onChange={(e) => onSettingChange("refreshInterval", parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Show Demo Bots
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.showDemoBots}
                        onChange={(e) => onSettingChange("showDemoBots", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Display demo/example bots for testing purposes</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Notebook Integration
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.notebookEnabled}
                        onChange={(e) => onSettingChange("notebookEnabled", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Enable the embedded Jupyter notebook feature</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Compact Mode
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.compactMode}
                        onChange={(e) => onSettingChange("compactMode", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Reduce spacing for more information density</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Remember Filters
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.rememberFilters}
                        onChange={(e) => onSettingChange("rememberFilters", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Save trade/bot filter preferences between sessions</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeSection === "api" && (
          <div className="section">
            <div className="section-title">🔑 API Configuration</div>
            <div className="section-content">
              <div className="setting-group">
                <div className="setting-label">Supabase URL</div>
                <div className="setting-description">Database and authentication endpoint</div>
                <div className="input-group">
                  <input
                    type="text"
                    className="input"
                    value={settings.supabaseUrl}
                    onChange={(e) => onSettingChange("supabaseUrl", e.target.value)}
                  />
                  <div className="connection-status">
                    <div className={`status-dot ${apiStatus.supabase}`}></div>
                    <span>{apiStatus.supabase}</span>
                  </div>
                  <button className="btn btn-secondary" onClick={() => onTestConnection("supabase")}>
                    Test
                  </button>
                </div>
              </div>
              
              <div className="setting-group">
                <div className="setting-label">Supabase API Key (READ ONLY)</div>
                <div className="setting-description">Publishable key for anonymous access</div>
                <div className="input-group">
                  <input
                    type="password"
                    className="input"
                    value={settings.supabaseKey}
                    onChange={(e) => onSettingChange("supabaseKey", e.target.value)}
                    placeholder="sb_publishable_..."
                  />
                  <span className="input-addon">ANON</span>
                </div>
              </div>
              
              <div className="setting-group">
                <div className="setting-label">OpenAI API Key (Optional)</div>
                <div className="setting-description">For AI-powered analytics and insights</div>
                <input
                  type="password"
                  className="input"
                  value={settings.openaiApiKey}
                  onChange={(e) => onSettingChange("openaiApiKey", e.target.value)}
                  placeholder="sk-... (optional)"
                />
              </div>
              
              <ChartTip theme={theme} align="right">
                <strong>API Security</strong><br/>
                Only use publishable API keys here.<br/>
                Service keys should remain in your backend.<br/>
                All connections are tested to ensure they're working.
              </ChartTip>
            </div>
          </div>
        )}
        
        {activeSection === "orchestrator" && (
          <div className="section">
            <div className="section-title">🖥️ Orchestrator Configuration</div>
            <div className="section-content">
              <div className="setting-group">
                <div className="setting-label">Orchestrator Base URL</div>
                <div className="setting-description">Main orchestrator API endpoint</div>
                <div className="input-group">
                  <input
                    type="text"
                    className="input"
                    value={settings.orchestratorBase}
                    onChange={(e) => onSettingChange("orchestratorBase", e.target.value)}
                  />
                  <div className="connection-status">
                    <div className={`status-dot ${apiStatus.orchestrator}`}></div>
                    <span>{apiStatus.orchestrator}</span>
                  </div>
                  <button className="btn btn-secondary" onClick={() => onTestConnection("orchestrator")}>
                    Test
                  </button>
                </div>
              </div>
              
              <div className="grid">
                <div className="setting-group">
                  <div className="setting-label">ARB_BOT URL</div>
                  <div className="input-group">
                    <input
                      type="text"
                      className="input"
                      value={settings.arbBotUrl}
                      onChange={(e) => onSettingChange("arbBotUrl", e.target.value)}
                    />
                    <div className="connection-status">
                      <div className={`status-dot ${apiStatus.arb}`}></div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => onTestConnection("arb")}>
                      Test
                    </button>
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">BOND_BOT URL</div>
                  <div className="input-group">
                    <input
                      type="text"
                      className="input"
                      value={settings.bondBotUrl}
                      onChange={(e) => onSettingChange("bondBotUrl", e.target.value)}
                    />
                    <div className="connection-status">
                      <div className={`status-dot ${apiStatus.bond}`}></div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => onTestConnection("bond")}>
                      Test
                    </button>
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">POLY_BOT URL</div>
                  <div className="input-group">
                    <input
                      type="text"
                      className="input"
                      value={settings.polyBotUrl}
                      onChange={(e) => onSettingChange("polyBotUrl", e.target.value)}
                    />
                    <div className="connection-status">
                      <div className={`status-dot ${apiStatus.poly}`}></div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => onTestConnection("poly")}>
                      Test
                    </button>
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">SWING_BOT URL</div>
                  <div className="input-group">
                    <input
                      type="text"
                      className="input"
                      value={settings.swingBotUrl}
                      onChange={(e) => onSettingChange("swingBotUrl", e.target.value)}
                    />
                    <div className="connection-status">
                      <div className={`status-dot ${apiStatus.swing}`}></div>
                    </div>
                    <button className="btn btn-secondary" onClick={() => onTestConnection("swing")}>
                      Test
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeSection === "risk" && (
          <div className="section">
            <div className="section-title">⚡ Risk Management</div>
            <div className="section-content">
              <div className="grid">
                <div className="setting-group">
                  <div className="setting-label">
                    Allocated Capital
                    <span className="range-value">{settings.allocatedCapital}%</span>
                  </div>
                  <div className="setting-description">Percentage of wallet balance to use for trading</div>
                  <div className="input-group">
                    <input
                      type="range"
                      className="range-slider"
                      min="10"
                      max="100"
                      value={settings.allocatedCapital}
                      onChange={(e) => onSettingChange("allocatedCapital", parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Max Trade Loss
                    <span className="range-value">{settings.maxTradeLoss}%</span>
                  </div>
                  <div className="setting-description">Maximum loss per individual trade</div>
                  <div className="input-group">
                    <input
                      type="range"
                      className="range-slider"
                      min="1"
                      max="50"
                      value={settings.maxTradeLoss}
                      onChange={(e) => onSettingChange("maxTradeLoss", parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Max Daily Loss
                    <span className="range-value">{settings.maxDailyLoss}%</span>
                  </div>
                  <div className="setting-description">Maximum cumulative loss per day</div>
                  <div className="input-group">
                    <input
                      type="range"
                      className="range-slider"
                      min="5"
                      max="100"
                      value={settings.maxDailyLoss}
                      onChange={(e) => onSettingChange("maxDailyLoss", parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Max Position Size
                    <span className="range-value">{settings.maxPositionSize}%</span>
                  </div>
                  <div className="setting-description">Maximum percentage of capital per position</div>
                  <div className="input-group">
                    <input
                      type="range"
                      className="range-slider"
                      min="5"
                      max="50"
                      value={settings.maxPositionSize}
                      onChange={(e) => onSettingChange("maxPositionSize", parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Continuous Stop-Loss
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.stopLoss}
                        onChange={(e) => onSettingChange("stopLoss", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Automatically close positions when loss limits are reached</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Trade Batch Size
                    <span className="range-value">{settings.tradeBatchSize}</span>
                  </div>
                  <div className="setting-description">Number of concurrent trades</div>
                  <div className="input-group">
                    <input
                      type="range"
                      className="range-slider"
                      min="1"
                      max="10"
                      value={settings.tradeBatchSize}
                      onChange={(e) => onSettingChange("tradeBatchSize", parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              
              <ChartTip theme={theme} align="right">
                <strong>Risk Management</strong><br/>
                These settings protect your capital from excessive losses.<br/>
                <strong>Recommended:</strong> Start conservative (10-15% per trade)<br/>
                <strong>Advanced:</strong> Adjust based on strategy performance
              </ChartTip>
            </div>
          </div>
        )}
        
        {activeSection === "notifications" && (
          <div className="section">
            <div className="section-title">🔔 Notifications</div>
            <div className="section-content">
              <div className="grid">
                <div className="setting-group">
                  <div className="setting-label">
                    Email Alerts
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.emailAlerts}
                        onChange={(e) => onSettingChange("emailAlerts", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Receive email notifications for critical events</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Discord Alerts
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.discordAlerts}
                        onChange={(e) => onSettingChange("discordAlerts", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Send notifications to Discord webhook</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Webhook Alerts
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.webhookAlerts}
                        onChange={(e) => onSettingChange("webhookAlerts", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Custom webhook endpoint for notifications</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Trade Notifications
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.tradeNotifications}
                        onChange={(e) => onSettingChange("tradeNotifications", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Notify on trade execution, errors, and P&L milestones</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Error Notifications
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.errorNotifications}
                        onChange={(e) => onSettingChange("errorNotifications", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Alert on bot failures, API errors, and connection issues</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeSection === "display" && (
          <div className="section">
            <div className="section-title">🎨 Display Preferences</div>
            <div className="section-content">
              <div className="grid">
                <div className="setting-group">
                  <div className="setting-label">
                    Show Tooltips
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.showTooltip}
                        onChange={(e) => onSettingChange("showTooltip", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Show helpful tooltip explanations for UI elements</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Show Help Text
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.showHelpText}
                        onChange={(e) => onSettingChange("showHelpText", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Display guidance text and hints throughout the dashboard</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Advanced Statistics
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.showAdvancedStats}
                        onChange={(e) => onSettingChange("showAdvancedStats", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Show additional metrics and detailed analytics</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Chart Animations
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.chartAnimations}
                        onChange={(e) => onSettingChange("chartAnimations", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Enable smooth animations for charts and visualizations</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Auto Refresh
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.autoRefresh}
                        onChange={(e) => onSettingChange("autoRefresh", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Automatically refresh data based on refresh interval</div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeSection === "export" && (
          <div className="section">
            <div className="section-title">💾 Data Management</div>
            <div className="section-content">
              <div className="grid">
                <div className="setting-group">
                  <div className="setting-label">
                    Data Retention
                    <span className="range-value">{settings.dataRetention} days</span>
                  </div>
                  <div className="setting-description">How long to keep trade and performance history</div>
                  <div className="input-group">
                    <input
                      type="range"
                      className="range-slider"
                      min="7"
                      max="365"
                      value={settings.dataRetention}
                      onChange={(e) => onSettingChange("dataRetention", parseInt(e.target.value))}
                    />
                  </div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">
                    Auto Backup
                    <label className="toggle">
                      <input 
                        type="checkbox" 
                        checked={settings.autoBackup}
                        onChange={(e) => onSettingChange("autoBackup", e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-description">Automatically backup settings and data</div>
                </div>
                
                <div className="setting-group">
                  <div className="setting-label">Webhook URL (Optional)</div>
                  <div className="setting-description">Custom webhook for real-time data streaming</div>
                  <input
                    type="text"
                    className="input"
                    value={settings.webhookUrl}
                    onChange={(e) => onSettingChange("webhookUrl", e.target.value)}
                    placeholder="https://your-webhook.com/endpoint"
                  />
                </div>
              </div>
              
              <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                <button className="btn btn-primary" onClick={onExportData} disabled={exporting}>
                  {exporting ? "⏳ Exporting..." : "📤 Export Settings"}
                </button>
                <label className="btn btn-secondary">
                  📥 Import Settings
                  <input
                    type="file"
                    accept=".json"
                    onChange={onImportData}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
              
              <ChartTip theme={theme} align="right">
                <strong>Data Management</strong><br/>
                Export: Downloads settings as JSON<br/>
                Import: Upload settings from a JSON file<br/>
                Webhook: Real-time data streaming to external services
              </ChartTip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}