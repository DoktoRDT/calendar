import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';

afterEach(() => {
    cleanup();
});

// Since Vitest 4 the jsdom environment keeps Node's AbortController and converts its signals only in the main window's
// addEventListener (vitest-dev/vitest#8390, #8704). A document of another realm (the iframe in hosts.test.tsx) rejects
// such a signal, and the press listener of MonthView threw there. Browsers accept a signal of any realm, and jsdom
// accepts its own in every window, so the jsdom suites use jsdom's controller, as under Vitest 3; no test needs Node's
// for fetch. `jsdom` is the JSDOM instance Vitest exposes; `window` and `document.defaultView` are Node's global here.
if (typeof document !== 'undefined') {
    const {AbortController, AbortSignal} = (globalThis as unknown as {jsdom: {window: typeof globalThis}}).jsdom.window;
    Object.assign(globalThis, {AbortController, AbortSignal});
}

// A server render inside jsdom is an artifact of the test host: `document` exists, so isomorphic layout effects (the
// package's and React Aria's) choose useLayoutEffect, and React 18's server renderer logs its documented notice once per
// effect (T15-R2-04). A real server has no document; the node-environment suites (ssr.test.tsx, surface.ssr.test.tsx)
// render there and keep this notice visible, so only the jsdom copy of this one message is dropped. Every other
// console.error, and any test's own console spy, is unchanged.
if (typeof document !== 'undefined') {
    const error = console.error;
    console.error = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].startsWith('Warning: useLayoutEffect does nothing on the server')) return;
        error(...args);
    };
}
