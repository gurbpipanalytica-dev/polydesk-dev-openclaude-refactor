import React from 'react';

/**
 * Sparkline - Modern mini SVG sparkline chart
 * Props:
 * - positive: boolean - Determines color (green/red) and default data direction
 * - theme: object - Theme with green/red color definitions
 * - data: array - Optional custom data points (default: [3,5,4,7,...])
 */

const Sparkline = ({ positive = true, theme, data }) => {
  const B = theme?.B || {
    green: '#00C87A',
    red: '#F05C5C'
  };

  // Default data - rising if positive, falling if negative
  const defaultData = positive
    ? [3, 5, 4, 7, 6, 8, 9, 8, 11, 10, 13, 12, 15, 14, 17, 20]
    : [15, 13, 14, 11, 12, 9, 10, 8, 7, 9, 6, 5, 7, 4, 3, 2];

  const points = data || defaultData;
  const maxValue = Math.max(...points);
  const minValue = Math.min(...points);
  const range = maxValue - minValue || 1;

  // Generate SVG points string
  const svgPoints = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 56; // Scale to 58px width
      const y = 18 - ((value - minValue) / range) * 16; // Scale to 20px height
      return `${x},${y}`;
    })
    .join(' ');

  const lineColor = positive ? B.green : B.red;

  return (
    <svg
      width={58}
      height={20}
      style={{ overflow: 'visible' }}
    >
      <polyline
        points={svgPoints}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
};

export default Sparkline;
