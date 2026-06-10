import type {CalendarLabels} from '@/labels/types';
import type {CalendarTheme} from '@/theme/types';

export type CalendarEventVariant = 'red' | 'blue' | 'green' | 'grey';

export type SeriesActionScope = 'single' | 'series';

export type CalendarEvent = {
    id: string;
    start: string;
    end?: string;
    title: string;
    variant: CalendarEventVariant;
    isOverdue: boolean;
    isCritical: boolean;
    isAllDay: boolean;
    taskId: string | null;
    isClickable: boolean;
    hasHoverActions: boolean;
};

export type VariantColor = {
    bg: string;
    fg: string;
};

export type VariantPalette = Record<CalendarEventVariant, VariantColor>;

export type CalendarProps = {
    anchorDate: string;
    events: CalendarEvent[];
    utcOffset?: string;
    timezone?: string;
    locale?: string;
    onNavigate: (anchorDate: string) => void;
    onEventPress?: (event: CalendarEvent) => void;
    onEventEdit?: (event: CalendarEvent, scope: SeriesActionScope) => void;
    onEventDelete?: (event: CalendarEvent, scope: SeriesActionScope) => void;
    className?: string;
    palette?: VariantPalette;
    overdueColor?: string;
    criticalColor?: string;
    progressBarColor?: string;
    isFetching?: boolean;
    labels?: Partial<CalendarLabels>;
    theme?: Partial<CalendarTheme>;
    'data-testid'?: string;
};

export type CalendarPaletteStyleInput = {
    palette: VariantPalette;
    overdueColor: string;
    criticalColor: string;
    progressBarColor: string;
};
