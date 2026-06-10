import type {CalendarTheme} from './types';

export const defaultTheme: CalendarTheme = {
    backgroundColor: '#ffffff',
    borderColor: '#ebebeb',
    headerTextColor: '#404a52',
    todayBadgeBackground: '#f5523a',
    todayBadgeText: '#ffffff',
    dayNumberColor: 'rgba(33, 32, 31, 0.5)',
    buttonBackground: 'rgba(92, 90, 87, 0.1)',
    buttonBackgroundHovered: 'rgba(60, 58, 57, 0.145)',
    buttonBackgroundPressed: 'rgba(43, 42, 41, 0.19)',
    buttonText: '#21201f',
    dropdownBackground: '#ffffff',
    dropdownText: '#21201f',
};

export function mergeTheme(partial?: Partial<CalendarTheme>): CalendarTheme {
    if (!partial) {
        return defaultTheme;
    }

    return {
        ...defaultTheme,
        ...partial,
    };
}
