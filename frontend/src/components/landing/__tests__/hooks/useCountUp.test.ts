import * as fc from 'fast-check';
import { simulateCountUp } from '../../hooks/useCountUp';

// Feature: velocity-landing-page, Property 2: Count-up final value
// Validates: Requirements 6.2

describe('simulateCountUp', () => {
  it('Property 2: always returns exactly targetValue for any positive integer and duration', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),  // targetValue
        fc.integer({ min: 200, max: 2000 }),      // duration ms
        (targetValue, duration) => {
          const finalValue = simulateCountUp(targetValue, duration);
          return finalValue === targetValue;
        }
      ),
      { numRuns: 100 }
    );
  });
});
