import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('Frontend utils cn()', () => {
  it('merges Tailwind classes and resolves conflicts', () => {
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
  });

  it('handles conditional class names', () => {
    const isPrimary = true;
    const isGhost = false;
    expect(cn('btn', isPrimary && 'btn-primary', isGhost && 'btn-ghost')).toBe('btn btn-primary');
  });
});
