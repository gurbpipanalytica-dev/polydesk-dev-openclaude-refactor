import React from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ChartTip from './ChartTip';
import { fmt } from '../utils/format';

/**
 * PerformanceChart - Advanced chart component for trading performance visualization
 * Props:
 * - trades: array - Trade data
 * - theme: object - Theme colors
 * - type: string - Chart type ('line', 'area', 'bar', 'pie')
 * - height: number - Chart height
 */

const PerformanceChart = ({ trades = [], theme, type = 'line', height = 300 }) => {
  const B = theme?.B || {
    surf: '#fff',
    text: '#000',
    green: '#00C87A',
    red: '#F05C5C',
    amber: '#F5A623',
    muted: '#888',
    border: '#e0e0e0'
  };

  // Prepare data for charts
  const prepareTimelineData = () => {
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    let cumulativePnL = 0;
    return sortedTrades.map(trade => {
      cumulativePnL += trade.profit || 0;
      const date = new Date(trade.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      return {
        date: dateStr,
        timestamp: date.getTime(),
        pnl: trade.profit || 0,
        cumulativePnL: cumulativePnL,
        pair: trade.pair,
        type: trade.type
      };
    });
  };

  const prepareMonthlyData = () => {
    const monthly = {};
    
    trades.forEach(trade => {
      const date = new Date(trade.timestamp);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthly[key]) {
        monthly[key] = {
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          pnl: 0,
          wins: 0,
          losses: 0,
          trades: 0
        };
      }
      
      monthly[key].pnl += trade.profit || 0;
      monthly[key].trades += 1;
      if (trade.profit > 0) {
        monthly[key].wins += 1;
      } else if (trade.profit < 0) {
        monthly[key].losses += 1;
      }
    });
    
    return Object.values(monthly).sort((a, b) => {
      const [yearA, monthA] = a.month.split(' ');
      const [yearB, monthB] = b.month.split(' ');
      return new Date(`${monthA} 1, ${yearA}`) - new Date(`${monthB} 1, ${yearB}`);
    });
  };

  const prepareWinLossData = () => {
    const wins = trades.filter(t => t.profit > 0).length;
    const losses = trades.filter(t => t.profit < 0).length;
    const breakeven = trades.filter(t => t.profit === 0).length;
    
    return [
      { name: 'Wins', value: wins, color: B.green },
      { name: 'Losses', value: losses, color: B.red },
      { name: 'Breakeven', value: breakeven, color: B.amber }
    ];
  };

  const timelineData = prepareTimelineData();
  const monthlyData = prepareMonthlyData();
  const winLossData = prepareWinLossData();

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    
    return (
      <ChartTip 
        active={active} 
        payload={payload} 
        label={label} 
        theme={theme} 
      />
    );
  };

  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={timelineData}>
        <CartesianGrid strokeDasharray="3 3" stroke={B.border} strokeOpacity={0.5} />
        <XAxis 
          dataKey="date" 
          stroke={B.muted}
          fontSize={12}
          tick={{ fill: B.muted }}
        />
        <YAxis 
          stroke={B.muted}
          fontSize={12}
          tickFormatter={(value) => fmt.short(value)}
          tick={{ fill: B.muted }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="cumulativePnL" 
          stroke={B.blue || '#4c9eeb'} 
          strokeWidth={2}
          dot={false}
          name="Cumulative P&L"
        />
        <Line 
          type="monotone" 
          dataKey="pnl" 
          stroke={B.green} 
          strokeWidth={1}
          dot={{ r: 3, fill: B.green }}
          name="Daily P&L"
          opacity={0.7}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderAreaChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={timelineData}>
        <defs>
          <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={B.green} stopOpacity={0.6}/>
            <stop offset="95%" stopColor={B.green} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="pnlNegativeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={B.red} stopOpacity={0.6}/>
            <stop offset="95%" stopColor={B.red} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={B.border} strokeOpacity={0.5} />
        <XAxis 
          dataKey="date" 
          stroke={B.muted}
          fontSize={12}
          tick={{ fill: B.muted }}
        />
        <YAxis 
          stroke={B.muted}
          fontSize={12}
          tickFormatter={(value) => fmt.short(value)}
          tick={{ fill: B.muted }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Area 
          type="monotone" 
          dataKey="cumulativePnL" 
          stroke={timelineData.length > 0 && timelineData[timelineData.length - 1].cumulativePnL >= 0 ? B.green : B.red}
          fill={timelineData.length > 0 && timelineData[timelineData.length - 1].cumulativePnL >= 0 ? "url(#pnlGradient)" : "url(#pnlNegativeGradient)"}
          strokeWidth={2}
          name="Cumulative P&L"
        />
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={monthlyData}>
        <CartesianGrid strokeDasharray="3 3" stroke={B.border} strokeOpacity={0.5} />
        <XAxis 
          dataKey="month" 
          stroke={B.muted}
          fontSize={12}
          tick={{ fill: B.muted }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          stroke={B.muted}
          fontSize={12}
          tickFormatter={(value) => fmt.short(value)}
          tick={{ fill: B.muted }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar 
          dataKey="pnl" 
          name="Monthly P&L"
          fill={B.green}
          radius={[4, 4, 0, 0]}
        >
          {monthlyData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.pnl >= 0 ? B.green : B.red}
            />
          ))}
        </Bar>
        <Bar 
          dataKey="wins" 
          name="Wins" 
          fill={B.green}
          opacity={0.7}
        />
        <Bar 
          dataKey="losses" 
          name="Losses" 
          fill={B.red}
          opacity={0.7}
        />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Pie
          data={winLossData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={(entry) => `${entry.name}: ${entry.value}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {winLossData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );

  const renderChart = () => {
    switch (type) {
      case 'area':
        return renderAreaChart();
      case 'bar':
        return renderBarChart();
      case 'pie':
        return renderPieChart();
      case 'line':
      default:
        return renderLineChart();
    }
  };

  return (
    <div style={{ width: '100%', height: height }}>
      {renderChart()}
    </div>
  );
};

export default PerformanceChart;