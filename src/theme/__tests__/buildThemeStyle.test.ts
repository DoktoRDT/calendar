import {describe, expect, it} from 'vitest';

import {buildThemeStyle} from '@/theme/buildThemeStyle';
import {CALENDAR_THEME_VARS} from '@/theme/types';

describe('buildThemeStyle', () => {
    it('maps theme values to CSS custom properties', () => {
        const style = buildThemeStyle({
            backgroundColor: '#fafafa',
            borderColor: '#ccc',
        });

        const vars = style as Record<string, string>;

        expect(vars[CALENDAR_THEME_VARS.background]).toBe('#fafafa');
        expect(vars[CALENDAR_THEME_VARS.border]).toBe('#ccc');
        expect(vars[CALENDAR_THEME_VARS.todayBadgeBg]).toBeTruthy();
    });
});
