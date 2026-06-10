import {dayjs} from '@/core/dayjs';
import {getMonthGridRange} from '@/core/dateUtils';
import type {CalendarEvent} from '@/types';

import {eventCatalog} from './eventCatalog';

export type FetchEventsResult = {
    events: CalendarEvent[];
    from: string;
    to: string;
    durationMs: number;
};

function eventOverlapsRange(
    event: CalendarEvent,
    from: string,
    to: string,
    utcOffset: string,
): boolean {
    const startStr = dayjs(event.start).utcOffset(utcOffset).format('YYYY-MM-DD');
    const endStr = event.end
        ? dayjs(event.end).utcOffset(utcOffset).format('YYYY-MM-DD')
        : startStr;

    return endStr >= from && startStr <= to;
}

export async function fetchEventsForRange(
    anchorDate: string,
    utcOffset: string,
    options?: {delayMs?: number; catalog?: CalendarEvent[]},
): Promise<FetchEventsResult> {
    const {from, to} = getMonthGridRange(anchorDate);
    const catalog = options?.catalog ?? eventCatalog;
    const delayMs = options?.delayMs ?? 650;

    const started = performance.now();
    await new Promise(resolve => setTimeout(resolve, delayMs));

    const events = catalog.filter(event => eventOverlapsRange(event, from, to, utcOffset));

    return {
        events,
        from,
        to,
        durationMs: Math.round(performance.now() - started),
    };
}
