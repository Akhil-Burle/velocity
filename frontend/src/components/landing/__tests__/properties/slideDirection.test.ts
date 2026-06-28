import * as fc from 'fast-check';
import { getSlideDirection } from '../../hooks/useReducedMotion';

/**
 * Feature: velocity-landing-page, Property 3: Stat card alternating slide direction
 * Validates: Requirements 6.3
 *
 * For any array of N stat cards, the card at index i receives direction 'left'
 * when i % 2 === 0 and 'right' when i % 2 !== 0 — regardless of array length
 * or card content.
 */
describe('getSlideDirection — Property 3: Alternating Slide Direction', () => {
  it('returns left for even indices and right for odd indices across all card arrays', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            value: fc.integer({ min: 1 }),
            suffix: fc.string(),
            label: fc.string(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (cards) => {
          return cards.every((_, i) => {
            const direction = getSlideDirection(i);
            return i % 2 === 0 ? direction === 'left' : direction === 'right';
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
