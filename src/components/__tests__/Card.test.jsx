import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from '../Card';
import { DARK } from '../../constants/themes';

describe('Card Component', () => {
  it('renders children correctly', () => {
    render(<Card theme={DARK}>Test Content</Card>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('accepts custom styles via style prop', () => {
    const customStyle = { padding: '20px' };
    const { container } = render(
      <Card theme={DARK} style={customStyle}>Content</Card>
    );
    const card = container.querySelector('div');
    expect(card).toHaveStyle({ padding: '20px' });
  });
});