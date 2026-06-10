export type CalendarTheme = {
    backgroundColor: string;
    borderColor: string;
    headerTextColor: string;
    todayBadgeBackground: string;
    todayBadgeText: string;
    dayNumberColor: string;
    buttonBackground: string;
    buttonBackgroundHovered: string;
    buttonBackgroundPressed: string;
    buttonText: string;
    dropdownBackground: string;
    dropdownText: string;
};

export const CALENDAR_THEME_VARS = {
    background: '--tc-background-color',
    border: '--tc-border-color',
    headerText: '--tc-header-text-color',
    todayBadgeBg: '--tc-today-badge-bg',
    todayBadgeText: '--tc-today-badge-text',
    dayNumber: '--tc-day-number-color',
    buttonBg: '--tc-button-bg',
    buttonBgHovered: '--tc-button-bg-hovered',
    buttonBgPressed: '--tc-button-bg-pressed',
    buttonText: '--tc-button-text',
    dropdownBg: '--tc-dropdown-bg',
    dropdownText: '--tc-dropdown-text',
} as const;
