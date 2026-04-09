import React from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import ChartTip from './ChartTip';
import { fmt } from '../utils/format';

/**
 * CandlestickChart component
 * Since Recharts doesn't have a native candlestick component,
 * we create a custom composite chart using Bars for OHLC
 */

const CandlestickChart = ({ data = [], theme, height = 400 }) => {
  const B = theme?.B || {
    surf: '#fff',
    text: '#000',
    green: '#00C87A',
    red: '#F05C5C',
    border: '#e0e0e0',
    muted: '#888'
  };

  // Prepare candlestick data
  const prepareData = () => {
    return data.map((candle, index) => {
      const date = new Date(candle.time);
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return {
        key: index,
        date: dateStr,
        timestamp: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        up: candle.close >= candle.open
      };
    });
  };

  const chartData = prepareData();

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    
    const data = payload[0].payload;
    
    return (
      <div style={{ 
        background: B.surf, 
        border: `1px solid ${B.border}`, 
        borderRadius: 8, 
        padding: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}>
        <div style={{ fontSize: 11, color: B.muted, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12, marginBottom: 2 }}>
          <span style={{ color: B.muted }}>O:</span> <span style={{ fontWeight: 600 }}>{fmt.dec(data.open)}</span>
        </div>
        <div style={{ fontSize: 12, marginBottom: 2 }}>
          <span style={{ color: B.muted }}>H:</span> <span style={{ fontWeight: 600 }}>{fmt.dec(data.high)}</span>
        </div>
        <div style={{ fontSize: 12, marginBottom: 2 }}>
          <span style={{ color: B.muted }}>L:</span> <span style={{ fontWeight: 600 }}>{fmt.dec(data.low)}</span>
        </div>
        <div style={{ fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: B.muted }}>C:</span> <span style={{ fontWeight: 600 }}>{fmt.dec(data.close)}</span>
        </div>
        <div style={{ fontSize: 12, color: B.muted }}>Vol: {fmt.short(data.volume)}</div>
      </div>
    );
  };

  // Calculate colors for wicks
  const getWickColor = (entry) => entry.up ? B.green : B.red;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={B.border} strokeOpacity={0.5} />
        <XAxis 
          dataKey="date" 
          stroke={B.muted}
          fontSize={11}
          tick={{ fill: B.muted }}
          angle={-45}
          textAnchor="end"
          height={60}
          interval="preserveStartEnd"
        />
        <YAxis 
          yAxisId="price"
          stroke={B.muted}
          fontSize={11}
          tickFormatter={(value) => fmt.dec(value, 0)}
          tick={{ fill: B.muted }}
        />
        <YAxis 
          yAxisId="volume"
          orientation="right"
          stroke={B.muted}
          fontSize={11}
          tickFormatter={(value) => fmt.short(value)}
          tick={{ fill: B.muted }}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {/* Candlestick bodies */}
        <Bar 
          dataKey="close"
          yAxisId="price"
          barSize={4}
          fill={B.green}
          radius={[2, 2, 0, 0]}
        >
          {chartData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={entry.up ? B.green : B.red}
            />
          ))}
        </Bar>
        
        {/* Volume bars */}
        <Bar 
          dataKey="volume"
          yAxisId="volume"
          barSize={1}
          opacity={0.3}
          fill={B.muted}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// Alternative: Custom SVG implementation if Recharts limitations are an issue
export const CustomCandlestickChart = ({ data = [], theme, height = 400 }) => {
  const B = theme?.B || {
    surf: '#fff',
    text: '#000',
    green: '#00C87A',
    red: '#F05C5C',
    border: '#e0e0e0',
    muted: '#888'
  };

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        height, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: B.muted,
        fontSize: 14
      }}>
        No data to display
      </div>
    );
  }

  const padding = 20;
  const candleWidth = 8;
  const gap = 4;
  const chartHeight = height - padding * 2;
  const chartWidth = data.length * (candleWidth + gap) + padding * 2;

  const prices = data.flatMap(d => [d.high, d.low]);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const xScale = (index) => padding + index * (candleWidth + gap) + candleWidth / 2;
  const yScale = (price) => padding + ((maxPrice - price) / priceRange) * chartHeight;

  return (
    <svg width="100%" height={height} style={{ background: B.surf, borderRadius: 8 }}>
      {/* Grid lines */}
      {[...Array(5)].map((_, i) => {
        const y = padding + (i / 4) * chartHeight;
        return (
          <g key={i}>
            <line 
              x1={padding} 
              y1={y} 
              x2={chartWidth - padding / 2} 
              y2={y} 
              stroke={B.border} 
              strokeOpacity={0.3}
              strokeDasharray="2,2"
            />
            <text 
              x={padding - 5} 
              y={y + 3} 
              textAnchor="end" 
              fontSize="10" 
              fill={B.muted}
            >
              {fmt.dec(maxPrice - (i / 4) * priceRange, 0)}
            </text>
          </g>
        );
      })}

      {/* Candlesticks */}
      {data.map((candle, index) => {
        const x = xScale(index);
        const openY = yScale(candle.open);
        const highY = yScale(candle.high);
        const lowY = yScale(candle.low);
        const closeY = yScale(candle.close);
        const isUp = candle.close >= candle.open;
        const color = isUp ? B.green : B.red;
        
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.abs(closeY - openY);
        const minBodyHeight = 1; // Minimum 1px for visibility

        return (
          <g key={index}>
            {/* Wick */}
            <line 
              x1={x} 
              y1={highY} 
              x2={x} 
              y2={lowY} 
              stroke={color} 
              strokeWidth={1}
            />
            {/* Body */}
            <rect 
              x={x - candleWidth / 2} 
              y={bodyHeight < minBodyHeight ? bodyTop - (minBodyHeight - bodyHeight) / 2 : bodyTop} 
              width={candleWidth} 
              height={Math.max(bodyHeight, minBodyHeight)} 
              fill={color} 
              stroke={color} 
              strokeWidth={1}
            />
          </g>
        );
      })}

      {/* Min/Max labels */}
      <text 
        x={padding - 5} 
        y={padding + 5} 
        textAnchor="end" 
        fontSize="10" 
        fill={B.muted}
      >
        {fmt.dec(maxPrice, 0)}
      </text>
      <text 
        x={padding - 5} 
        y={height - padding + 15} 
        textAnchor="end" 
        fontSize="10" 
        fill={B.muted}
      >
        {fmt.dec(minPrice, 0)}
      </text>
    </svg>
  );
};

export default CandlestickChart;