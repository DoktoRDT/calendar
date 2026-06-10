import {describe, expect, it} from 'vitest';

import {
    CALENDAR_CSS_VARS,
    buildCalendarPaletteStyle,
} from '@/core/calendarPaletteVars';
import type {VariantPalette} from '@/types';

const palette: VariantPalette = {
    red: {bg: '#f00', fg: '#a00'},
    blue: {bg: '#00f', fg: '#00a'},
    green: {bg: '#0f0', fg: '#0a0'},
    grey: {bg: '#ccc', fg: '#666'},
};

describe('buildCalendarPaletteStyle', () => {
    it('maps palette and semantic colors to CSS variables', () => {
        const style = buildCalendarPaletteStyle({
            palette,
            overdueColor: '#e00',
            criticalColor: '#c00',
            progressBarColor: '#111',
        });

        const vars = style as Record<string, string>;

        expect(vars[CALENDAR_CSS_VARS.overdue]).toBe('#e00');
        expect(vars[CALENDAR_CSS_VARS.critical]).toBe('#c00');
        expect(vars[CALENDAR_CSS_VARS.progressBar]).toBe('#111');
        expect(vars[CALENDAR_CSS_VARS.redBg]).toBe('#f00');
        expect(vars[CALENDAR_CSS_VARS.blueFg]).toBe('#00a');
    });
});
