export {DEFAULT_LOCALE} from '@/core/dayjs';
export {Calendar} from '@/calendar/Calendar';
export {CalendarSkeleton} from '@/calendar/CalendarSkeleton';
export type {CalendarSkeletonProps} from '@/calendar/CalendarSkeleton';
export {getMonthGridRange, getMonthGridWeeks} from '@/core/dateUtils';
export {formatEventTime} from '@/core/formatEventTime';
export {buildWeekLayout} from '@/core/buildWeekLayout';
export type {EventSegment, WeekLayout} from '@/core/buildWeekLayout';
export type {CalendarLabels} from '@/labels/types';
export {defaultLabels} from '@/labels/defaultLabels';
export type {CalendarTheme} from '@/theme/types';
export {defaultTheme} from '@/theme/defaultTheme';
export {
    defaultPalette,
    defaultOverdueColor,
    defaultCriticalColor,
    defaultProgressBarColor,
} from '@/theme/defaultCalendarColors';
export type {
    CalendarEvent,
    CalendarEventVariant,
    CalendarProps,
    SeriesActionScope,
    VariantColor,
    VariantPalette,
} from '@/types';
