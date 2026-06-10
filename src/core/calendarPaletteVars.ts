import type {CSSProperties} from 'react';

import type {CalendarEventVariant, CalendarPaletteStyleInput} from '@/types';

export const PROGRESS_BAR_CYCLE_MS = 1200;

export const CALENDAR_CSS_VARS = {
    progressBar: '--calendar-progress-bar-color',
    progressBarCycle: '--calendar-progress-bar-cycle-ms',
    overdue: '--calendar-overdue-color',
    critical: '--calendar-critical-color',
    redBg: '--calendar-variant-red-bg',
    redFg: '--calendar-variant-red-fg',
    blueBg: '--calendar-variant-blue-bg',
    blueFg: '--calendar-variant-blue-fg',
    greenBg: '--calendar-variant-green-bg',
    greenFg: '--calendar-variant-green-fg',
    greyBg: '--calendar-variant-grey-bg',
    greyFg: '--calendar-variant-grey-fg',
} as const;

const VARIANT_VAR_KEYS: Record<CalendarEventVariant, {bg: string; fg: string}> = {
    red: {bg: CALENDAR_CSS_VARS.redBg, fg: CALENDAR_CSS_VARS.redFg},
    blue: {bg: CALENDAR_CSS_VARS.blueBg, fg: CALENDAR_CSS_VARS.blueFg},
    green: {bg: CALENDAR_CSS_VARS.greenBg, fg: CALENDAR_CSS_VARS.greenFg},
    grey: {bg: CALENDAR_CSS_VARS.greyBg, fg: CALENDAR_CSS_VARS.greyFg},
};

export function buildCalendarPaletteStyle({
    palette,
    overdueColor,
    criticalColor,
    progressBarColor,
}: CalendarPaletteStyleInput): CSSProperties {
    const style: Record<string, string> = {
        [CALENDAR_CSS_VARS.progressBar]: progressBarColor,
        [CALENDAR_CSS_VARS.progressBarCycle]: `${PROGRESS_BAR_CYCLE_MS}ms`,
        [CALENDAR_CSS_VARS.overdue]: overdueColor,
        [CALENDAR_CSS_VARS.critical]: criticalColor,
    };

    for (const variant of Object.keys(VARIANT_VAR_KEYS) as CalendarEventVariant[]) {
        const keys = VARIANT_VAR_KEYS[variant];
        style[keys.bg] = palette[variant].bg;
        style[keys.fg] = palette[variant].fg;
    }

    return style as CSSProperties;
}
