import {afterEach, describe, expect, it} from 'vitest';
import {openModalLayer} from '../modality.js';

afterEach(() => document.body.replaceChildren());
// #11: an aria-disabled control is in the Tab order of a modal layer, but never its recovery or initial target.
describe('modal layer focus with a focusable unavailable control', () => {
    it('restores focus to the first usable control and wraps Tab through the aria-disabled one', () => {
        document.body.innerHTML = '<button id="outside">Outside</button><div id="backdrop"><div id="surface">'
            + '<button id="unavailable" aria-disabled="true">Unavailable</button><button id="usable">Usable</button></div></div>';
        const element = document.getElementById('backdrop')!, surface = document.getElementById('surface')!;
        const close = openModalLayer({element, surface, restore: true, onEscape() {}, onYield() {}});
        try {
            expect(document.activeElement?.id).toBe('usable');
            const tab = (shiftKey = false) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', shiftKey, bubbles: true, composed: true, cancelable: true}));
            tab();
            expect(document.activeElement?.id).toBe('unavailable');
            tab();
            expect(document.activeElement?.id).toBe('usable');
            tab(true);
            expect(document.activeElement?.id).toBe('unavailable');
        } finally { close(); }
    });
});
