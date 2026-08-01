import { describe, it, expect } from 'vitest';
import { extractVisit } from './extract.js';

describe('extractVisit', () => {
  it('is defined', () => {
    expect(typeof extractVisit).toBe('function');
  });
});
