import '@testing-library/jest-dom';

// jsdom does not provide requestAnimationFrame / cancelAnimationFrame.
// Polyfill synchronously so React Testing Library (which reads rAF at import
// time) and hooks that schedule via rAF work correctly in the test environment.
if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'undefined') {
  window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    cb(performance.now());
    return 1;
  };
  window.cancelAnimationFrame = (_id: number) => {};
}

// jsdom does not provide window.matchMedia.
// Provide a minimal stub so components that call matchMedia (e.g. LineSlider,
// useReducedMotion) don't throw in the test environment.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
