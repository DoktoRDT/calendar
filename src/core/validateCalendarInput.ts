import type {CalendarEvent} from '@/types';

import {dayjs} from './dayjs';
import {warn} from './utils';

const UTC_OFFSET_RE = /^[+-]\d{2}:\d{2}$/;

export function resolveUtcOffset(utcOffset?: string, timezone?: string): string {
    const resolved = utcOffset ?? timezone;

    if (!resolved) {
        warn('Calendar requires utcOffset (or timezone).');
        return '+00:00';
    }

    validateUtcOffset(resolved);
    return resolved;
}

export function validateUtcOffset(utcOffset: string): boolean {
    if (UTC_OFFSET_RE.test(utcOffset)) {
        return true;
    }

    warn(
        `Invalid utcOffset "${utcOffset}". Expected fixed offset like "+03:00" or "-05:00".`,
    );
    return false;
}

export function validateEventDates(event: CalendarEvent): boolean {
    if (!dayjs(event.start).isValid()) {
        warn(`Event "${event.id}" has invalid start date: "${event.start}".`);
        return false;
    }

    if (event.end !== undefined && !dayjs(event.end).isValid()) {
        warn(`Event "${event.id}" has invalid end date: "${event.end}".`);
        return false;
    }

    return true;
}
