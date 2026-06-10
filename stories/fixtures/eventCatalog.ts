import {dayjs} from '@/core/dayjs';
import type {CalendarEvent, CalendarEventVariant} from '@/types';

const VARIANTS: CalendarEventVariant[] = ['red', 'blue', 'green', 'grey'];

const TITLES = [
    'Morning inspection',
    'Site visit',
    'Equipment check',
    'Route planning',
    'Warehouse audit',
    'Client meeting',
    'Safety review',
    'Inventory count',
    'Delivery window',
    'Maintenance slot',
    'Field survey',
    'Quality control',
    'Shift handover',
    'Compliance check',
    'Loading bay',
];

const MONTHS = ['2026-05', '2026-06', '2026-07', '2026-08'] as const;

function pick<T>(items: readonly T[], seed: number): T {
    return items[seed % items.length];
}

function eventStartIso(month: string, day: number, hour: number, utcOffset: string): string {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const time = `${String(hour).padStart(2, '0')}:00:00`;
    return `${date}T${time}${utcOffset}`;
}

export function createEventCatalog(utcOffset = '+03:00'): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    let seed = 0;

    for (const month of MONTHS) {
        const daysInMonth = dayjs(`${month}-01`).daysInMonth();
        const eventCount = 22;

        for (let i = 0; i < eventCount; i++) {
            seed += 1;
            const day = 1 + ((i * 11 + seed * 7) % daysInMonth);
            const variant = pick(VARIANTS, seed);
            const title = pick(TITLES, seed + i);
            const kind = seed % 5;

            const isAllDay = kind === 0;
            const isMultiDay = kind === 1 || kind === 2;
            const spanDays = isMultiDay ? 2 + (seed % 4) : 0;
            const endDay = Math.min(day + spanDays, daysInMonth);

            const start = isAllDay
                ? eventStartIso(month, day, 0, utcOffset)
                : eventStartIso(month, day, 8 + (seed % 9), utcOffset);

            const end =
                isMultiDay && endDay > day
                    ? eventStartIso(month, endDay, 17 + (seed % 3), utcOffset)
                    : undefined;

            const isOverdue = seed % 11 === 0;
            const isCritical = seed % 13 === 0;
            const hasSeries = seed % 3 !== 0;

            events.push({
                id: `catalog-${month}-${i}`,
                start,
                end,
                title: isMultiDay ? `${title} (${endDay - day + 1}d)` : title,
                variant,
                isOverdue,
                isCritical,
                isAllDay,
                taskId: hasSeries ? `series-${month}-${i % 6}` : null,
                isClickable: true,
                hasHoverActions: hasSeries,
            });
        }
    }

    events.push(
        {
            id: 'catalog-span-may-jun',
            start: '2026-05-28T10:00:00+03:00',
            end: '2026-06-03T18:00:00+03:00',
            title: 'Cross-month rollout',
            variant: 'blue',
            isOverdue: false,
            isCritical: true,
            isAllDay: false,
            taskId: 'series-rollout',
            isClickable: true,
            hasHoverActions: true,
        },
        {
            id: 'catalog-span-jun-jul',
            start: '2026-06-27T09:00:00+03:00',
            end: '2026-07-02T12:00:00+03:00',
            title: 'Quarter boundary sync',
            variant: 'green',
            isOverdue: false,
            isCritical: false,
            isAllDay: false,
            taskId: 'series-quarter',
            isClickable: true,
            hasHoverActions: true,
        },
        {
            id: 'catalog-tz-edge',
            start: '2026-06-01T22:30:00+00:00',
            end: '2026-06-02T01:00:00+00:00',
            title: 'TZ edge (22:30 UTC)',
            variant: 'grey',
            isOverdue: false,
            isCritical: false,
            isAllDay: false,
            taskId: null,
            isClickable: true,
            hasHoverActions: false,
        },
    );

    return events;
}

export const eventCatalog = createEventCatalog('+03:00');
