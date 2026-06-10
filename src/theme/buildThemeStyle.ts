import type {CSSProperties} from 'react';

import {mergeTheme} from './defaultTheme';
import {CALENDAR_THEME_VARS, type CalendarTheme} from './types';

export function buildThemeStyle(theme?: Partial<CalendarTheme>): CSSProperties {
    const resolved = mergeTheme(theme);
    return {
        [CALENDAR_THEME_VARS.background]: resolved.backgroundColor,
        [CALENDAR_THEME_VARS.border]: resolved.borderColor,
        [CALENDAR_THEME_VARS.headerText]: resolved.headerTextColor,
        [CALENDAR_THEME_VARS.todayBadgeBg]: resolved.todayBadgeBackground,
        [CALENDAR_THEME_VARS.todayBadgeText]: resolved.todayBadgeText,
        [CALENDAR_THEME_VARS.dayNumber]: resolved.dayNumberColor,
        [CALENDAR_THEME_VARS.buttonBg]: resolved.buttonBackground,
        [CALENDAR_THEME_VARS.buttonBgHovered]: resolved.buttonBackgroundHovered,
        [CALENDAR_THEME_VARS.buttonBgPressed]: resolved.buttonBackgroundPressed,
        [CALENDAR_THEME_VARS.buttonText]: resolved.buttonText,
        [CALENDAR_THEME_VARS.dropdownBg]: resolved.dropdownBackground,
        [CALENDAR_THEME_VARS.dropdownText]: resolved.dropdownText,
    } as CSSProperties;
}
