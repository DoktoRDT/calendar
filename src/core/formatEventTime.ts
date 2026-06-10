import type {CalendarEvent} from '@/types';

import {dayjs} from './dayjs';

export function formatEventTime(
    event: Pick<CalendarEvent, 'start' | 'end' | 'isAllDay'>,
    utcOffset: string,
): string {
    if (event.isAllDay) {
        return '';
    }
    const start = dayjs(event.start).utcOffset(utcOffset);
    const startStr = start.format('HH:mm');
    if (!event.end) {
        return startStr;
    }
    const end = dayjs(event.end).utcOffset(utcOffset);
    return `${startStr}-${end.format('HH:mm')}`;
}
