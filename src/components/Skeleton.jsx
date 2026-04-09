/**
 * Skeleton Component
 * Loading placeholder with shimmer animation
 * Glass-morphism design matching Polydesk aesthetic
 * Phase 8.3 Implementation
 */

export const Skeleton = ({ variant = 'text', width, height, style = {} }) => {
  const baseStyle = {
    background: 'linear-gradient(90deg, rgba(15, 23, 42, 0.6) 25%, rgba(30, 41, 59, 0.4) 50%, rgba(15, 23, 42, 0.6) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '6px',
    display: 'inline-block',
    backdropFilter: 'blur(5px)',
    border: '1px solid rgba(148, 163, 184, 0.1)'
  };

  const variants = {
    text: {
      height: '16px',
      width: width || '100%'
    },
    heading: {
      height: '24px',
      width: width || '60%'
    },
    card: {
      height: height || '120px',
      width: width || '100%',
      borderRadius: '8px'
    },
    avatar: {
      height: '40px',
      width: '40px',
      borderRadius: '50%'
    },
    table: {
      height: height || '48px',
      width: width || '100%',
      borderRadius: '4px'
    },
    chart: {
      height: height || '300px',
      width: width || '100%',
      borderRadius: '12px'
    }
  };

  const combinedStyle = {
    ...baseStyle,
    ...variants[variant],
    ...style,
    width: width || variants[variant].width,
    height: height || variants[variant].height
  };

  return <div style={combinedStyle} />;
};

export const SkeletonList = ({ count = 5, variant = 'text', spacing = '12px' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant={variant} />
      ))}
    </div>
  );
};

export const SkeletonGrid = ({ columns = 3, rows = 3, variant = 'card', gap = '16px' }) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: gap
      }}
    >
      {Array.from({ length: columns * rows }).map((_, i) => (
        <Skeleton key={i} variant={variant} />
      ))}
    </div>
  );
};

export default Skeleton;
