import React, { useState, useEffect, useCallback } from 'react';
import Card from './Card';
import CardHeader from './CardHeader';
import PerformanceChart from './PerformanceChart';
import CandlestickChart from './CandlestickChart';
import { useTradeStore } from '../stores/tradeStore';
import { calculateMetrics, groupTradesByPeriod, generateCandlestickData } from '../utils/trades';
import { fmt } from '../utils/format';
import { useNotifications } from '../hooks/useNotifications';
import { jsPDF } from 'jspdf';

/**
 * PerformanceDashboard - Advanced analytics dashboard
 * Shows key metrics, performance charts, and candlestick data
 */

const PerformanceDashboard = ({ theme }) => {
  const B = theme?.B || {
    surf: '#fff',
    surf2: '#f7f7f7',
    border: '#e0e0e0',
    text: '#000',
    muted: '#888',
    subtext: '#666',
    green: '#00C87A',
    red: '#F05C5C',
    amber: '#F5A623',
    blue: '#4c9eeb',
    dim: '#999'
  };

  const T = theme?.T || {
    accentSoft: 'rgba(76,158,235,0.1)',
    accentText: '#4c9eeb',
    accentBorder: 'rgba(76,158,235,0.25)'
  };

  // State
  const trades = useTradeStore(state => state.trades);
  const [candlestickData, setCandlestickData] = useState(generateCandlestickData(30));
  const [selectedChart, setSelectedChart] = useState('cumulative');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1M');
  const [exporting, setExporting] = useState(false);

  // Calculate performance metrics
  const metrics = calculateMetrics(trades);
  
  // Group trades by period
  const groupedTrades = groupTradesByPeriod(trades, selectedTimeframe === '1M' ? 'day' : 'week');
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+R: Refresh data
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        handleRefresh();
      }
      
// Ctrl+E: Export data
  if (e.ctrlKey && e.key === 'e') {
    e.preventDefault();
    handleExportCSV();
  }

  // Ctrl+P: Export PDF report
  if (e.ctrlKey && e.key === 'p') {
    e.preventDefault();
    handleExportPDF();
  }

  // Ctrl+S: Save dashboard state
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    handleSave();
  }
    };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [trades, selectedChart, selectedTimeframe, handleExportPDF]);

  // Auto-refresh candlestick data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCandlestickData(generateCandlestickData(30));
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = useCallback(() => {
    setCandlestickData(generateCandlestickData(30));
    toast.success('Data refreshed');
  }, []);

  const handleExportCSV = useCallback(() => {
    setExporting(true);
    
    try {
      // Prepare CSV headers
      const headers = [
        'ID',
        'Timestamp',
        'Type',
        'Pair',
        'Price',
        'Size',
        'Profit',
        'Status',
        'Bot ID'
      ];

      // Prepare CSV rows
      const rows = trades.map(trade => [
        trade.id,
        new Date(trade.timestamp).toLocaleString(),
        trade.type,
        trade.pair,
        trade.price,
        trade.size,
        trade.profit,
        trade.status,
        trade.botId
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `trades_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
}, [trades]);

const handleExportPDF = useCallback(() => {
  setExporting(true);

  try {
    // Initialize jsPDF
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text('Polydesk Trading Report', 105, 20, { align: 'center' });

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });

    // Summary Metrics
    doc.setFontSize(14);
    doc.text('Performance Summary', 20, 45);

    let yPosition = 55;
    doc.setFontSize(10);

    // Metrics table
    const metrics = calculateMetrics(trades);
    const metricRows = [
      ['Total P&L', fmt.pnl(metrics.totalPnL)],
      ['Win Rate', `${fmt.dec(metrics.winRate, 1)}%`],
      ['Sharpe Ratio', fmt.dec(metrics.sharpeRatio, 2)],
      ['Max Drawdown', `${fmt.dec(metrics.maxDrawdown, 1)}%`],
      ['Total Trades', metrics.totalTrades.toString()],
      ['Profitable Trades', metrics.profitableTrades.toString()],
      ['Losing Trades', metrics.losingTrades.toString()]
    ];

    metricRows.forEach((row, i) => {
      doc.text(row[0], 20, yPosition + (i * 8));
      doc.text(row[1], 100, yPosition + (i * 8));
    });

    // Trades table
    yPosition = 120;
    doc.setFontSize(14);
    doc.text('Trade History', 20, yPosition);

    yPosition += 10;
    doc.setFontSize(8);

    // Table headers
    doc.text('Time', 20, yPosition);
    doc.text('Pair', 60, yPosition);
    doc.text('Type', 100, yPosition);
    doc.text('P&L', 140, yPosition);
    yPosition += 8;

    // Table rows (limit to 50 trades to fit page)
    const tradesToShow = trades.slice(0, 50);
    tradesToShow.forEach(trade => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(new Date(trade.timestamp).toLocaleDateString(), 20, yPosition);
      doc.text(trade.pair, 60, yPosition);
      doc.text(trade.type, 100, yPosition);
      doc.text(fmt.pnl(trade.profit), 140, yPosition);
      yPosition += 6;
    });

    // Download
    doc.save(`polydesk-report_${new Date().toISOString().slice(0, 10)}.pdf`);

    toast.success('PDF report exported');
  } catch (error) {
    toast.error('Failed to export PDF');
    console.error('PDF export error:', error);
  } finally {
    setExporting(false);
  }
}, [trades, toast]);

const handleSave = useCallback(() => {
    // Save dashboard state to localStorage
    const state = {
      selectedChart,
      selectedTimeframe,
      metrics,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('dashboard_state', JSON.stringify(state));
    toast.success('Dashboard state saved');
  }, [selectedChart, selectedTimeframe, metrics]);

  // Performance metrics cards
  const metricCards = [
    {
      label: 'Sharpe Ratio',
      value: fmt.dec(metrics.sharpeRatio, 2),
      color: metrics.sharpeRatio > 1.5 ? B.green : metrics.sharpeRatio > 1 ? B.amber : B.red,
      sub: 'Risk-adjusted return'
    },
    {
      label: 'Max Drawdown',
      value: `${fmt.dec(metrics.maxDrawdown, 1)}%`,
      color: metrics.maxDrawdown < 10 ? B.green : metrics.maxDrawdown < 20 ? B.amber : B.red,
      sub: 'Peak to trough loss'
    },
    {
      label: 'Total P&L',
      value: fmt.pnl(metrics.totalPnL),
      color: metrics.totalPnL >= 0 ? B.green : B.red,
      sub: 'Closed transactions'
    },
    {
      label: 'Win Rate',
      value: `${fmt.dec(metrics.winRate, 1)}%`,
      color: metrics.winRate > 70 ? B.green : metrics.winRate > 50 ? B.amber : B.red,
      sub: 'Profitable trades'
    },
    {
      label: 'Total Trades',
      value: fmt.num(metrics.totalTrades),
      color: B.text,
      sub: `${fmt.num(metrics.profitableTrades)} wins, ${fmt.num(metrics.losingTrades)} losses`
    },
    {
      label: 'Avg Trade',
      value: fmt.pnl(metrics.totalPnL / metrics.totalTrades || 0, 2),
      color: metrics.totalPnL >= 0 ? B.green : B.red,
      sub: 'Average P&L per trade'
    }
  ];

  // Chart options
  const chartTabs = [
    { id: 'cumulative', label: 'Cumulative P&L', type: 'line' },
    { id: 'monthly', label: 'Monthly Breakdown', type: 'bar' },
    { id: 'wins', label: 'Win/Loss Ratio', type: 'pie' },
    { id: 'candlestick', label: 'Price Action', type: 'candlestick' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <Card theme={theme}>
        <CardHeader 
          title="Performance Analytics"
          sub="Deep dive into trading performance and risk metrics"
          theme={theme}
        />
        
        {/* Controls */}
        <div style={{ 
          padding: '12px 24px 20px',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {chartTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedChart(tab.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${selectedChart === tab.id ? T.accentText : B.border}`,
                  background: selectedChart === tab.id ? T.accentSoft : B.surf,
                  color: selectedChart === tab.id ? T.accentText : B.text,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRefresh}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: `1px solid ${B.border}`,
                background: B.surf,
                color: B.text,
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
            >
              <span>↻</span> Refresh (Ctrl+R)
            </button>
            
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: `1px solid ${T.accentBorder}`,
                background: T.accentSoft,
                color: T.accentText,
                fontSize: 11,
                fontWeight: 500,
                cursor: exporting ? 'not-allowed' : 'pointer',
                opacity: exporting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease'
              }}
            >
<span>↓</span> {exporting ? 'Exporting...' : 'Export CSV (Ctrl+E)'}
</button>

<button
  onClick={handleExportPDF}
  disabled={exporting}
  style={{
    padding: '8px 14px',
    borderRadius: 6,
    border: `1px solid ${T.accentBorder}`,
    background: T.accentSoft,
    color: T.accentText,
    fontSize: 11,
    fontWeight: 500,
    cursor: exporting ? 'not-allowed' : 'pointer',
    opacity: exporting ? 0.6 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    transition: 'all 0.2s ease'
  }}
>
  <span>📄</span> {exporting ? 'Exporting...' : 'Export PDF (Ctrl+P)'}
</button>
        </div>
        
        {/* Chart */}
        <div style={{ padding: '0 24px 24px' }}>
          {selectedChart === 'candlestick' ? (
            <CandlestickChart 
              data={candlestickData}
              theme={theme}
              height={400}
            />
          ) : (
            <PerformanceChart 
              trades={trades}
              theme={theme}
              type={selectedChart === 'monthly' ? 'bar' : selectedChart === 'wins' ? 'pie' : 'line'}
              height={400}
            />
          )}
        </div>
      </Card>
      
      {/* Metrics Grid */}
      <Card theme={theme}>
        <CardHeader 
          title="Key Performance Metrics"
          sub="Track your trading edge with precision"
          theme={theme}
        />
        <div style={{ padding: '16px 24px' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16 
          }}>
            {metricCards.map((metric, i) => (
              <div 
                key={i} 
                style={{ 
                  background: B.surf2, 
                  borderRadius: 8, 
                  padding: '16px',
                  border: `1px solid ${B.border}`,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: 10, color: B.dim, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {metric.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: metric.color, marginBottom: 4 }}>
                  {metric.value}
                </div>
                <div style={{ fontSize: 10, color: B.muted }}>{metric.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
      
      {/* Performance Table */}
      <Card theme={theme}>
        <CardHeader 
          title="Detailed Trade Log"
          sub={`${trades.length} trades analyzed`}
          theme={theme}
        />
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, color: B.muted }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, color: B.muted }}>Pair</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, color: B.muted }}>Type</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: 11, color: B.muted }}>Size</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: 11, color: B.muted }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontSize: 11, color: B.muted }}>P&L</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: 11, color: B.muted }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...trades]
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map(trade => (
                  <tr key={trade.id} style={{ borderBottom: `1px solid ${B.surf2}` }}>
                    <td style={{ padding: '10px 8px', fontSize: 11, color: B.subtext }}>
                      {new Date(trade.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 12, color: B.text, fontWeight: 500 }}>
                      {trade.pair}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 11, color: B.muted }}>
                      <span style={{ 
                        padding: '3px 6px', 
                        borderRadius: 4,
                        background: trade.type === 'LONG' ? `${B.green}15` : `${B.red}15`,
                        color: trade.type === 'LONG' ? B.green : B.red,
                        fontWeight: 600
                      }}>
                        {trade.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 11, color: B.text, textAlign: 'right' }}>
                      {fmt.dec(trade.size, 4)}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 11, color: B.text, textAlign: 'right' }}>
                      {fmt.usd(trade.price)}
                    </td>
                    <td style={{ 
                      padding: '10px 8px', 
                      fontSize: 12, 
                      color: trade.profit >= 0 ? B.green : B.red, 
                      textAlign: 'right',
                      fontWeight: 600 
                    }}>
                      {fmt.pnl(trade.profit)}
                    </td>
                    <td style={{ padding: '10px 8px', fontSize: 10, color: B.muted }}>
                      <span style={{ 
                        padding: '3px 6px', 
                        borderRadius: 4,
                        background: trade.status === 'closed' ? `${B.surf2}` : `${T.accentSoft}`,
                        border: `1px solid ${trade.status === 'closed' ? B.border : T.accentBorder}`,
                        color: B.text
                      }}>
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PerformanceDashboard;