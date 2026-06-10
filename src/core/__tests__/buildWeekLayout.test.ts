import {describe, expect, it} from 'vitest';

import {buildWeekLayout} from '@/core/buildWeekLayout';
import {dayjs} from '@/core/dayjs';
import {getMonthGridWeeks} from '@/core/dateUtils';
import type {CalendarEvent} from '@/types';

function makeEvent(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'start'>): CalendarEvent {
    return {
        title: 'Task',
        variant: 'blue',
        isOverdue: false,
        isCritical: false,
        isAllDay: false,
        taskId: null,
        isClickable: false,
        hasHoverActions: false,
        ...overrides,
    };
}

describe('buildWeekLayout', () => {
    const anchorDate = '2026-06-01';
    const weeks = getMonthGridWeeks(anchorDate);
    const utcOffset = '+03:00';

    it('places single-day events in lower lanes than multi-day', () => {
        const events = [
            makeEvent({
                id: 'multi',
                start: '2026-06-02T10:00:00+03:00',
                end: '2026-06-04T12:00:00+03:00',
            }),
            makeEvent({
                id: 'single',
                start: '2026-06-03T10:00:00+03:00',
            }),
        ];

        const layout = buildWeekLayout(events, weeks, utcOffset);
        const weekWithBoth = layout.find(week =>
            week.segments.some(s => s.event.id === 'multi') &&
            week.segments.some(s => s.event.id === 'single'),
        );

        expect(weekWithBoth).toBeDefined();
        const multi = weekWithBoth!.segments.find(s => s.event.id === 'multi');
        const single = weekWithBoth!.segments.find(s => s.event.id === 'single');
        expect(multi!.lane).toBeLessThan(single!.lane);
    });

    it('clips multi-day events to week boundaries', () => {
        const events = [
            makeEvent({
                id: 'span',
                start: '2026-06-01T10:00:00+03:00',
                end: '2026-06-10T12:00:00+03:00',
            }),
        ];

        const firstWeek = buildWeekLayout(events, weeks, utcOffset)[0];
        const segment = firstWeek.segments[0];

        expect(segment.startCol).toBe(1);
        expect(segment.endCol).toBe(7);
        expect(segment.segmentKind).toBe('first');
        expect(segment.isMultiDay).toBe(true);
    });

    it('marks whole-week segment kind for events inside one week', () => {
        const events = [
            makeEvent({
                id: 'inside',
                start: '2026-06-02T10:00:00+03:00',
                end: '2026-06-04T12:00:00+03:00',
            }),
        ];

        const layout = buildWeekLayout(events, weeks, utcOffset);
        const segment = layout.flatMap(w => w.segments).find(s => s.event.id === 'inside');

        expect(segment?.segmentKind).toBe('whole');
    });

    it('marks middle-week segment kind for spanning events', () => {
        const events = [
            makeEvent({
                id: 'span',
                start: '2026-06-01T10:00:00+03:00',
                end: '2026-06-20T12:00:00+03:00',
            }),
        ];

        const layout = buildWeekLayout(events, weeks, utcOffset);
        const middleWeek = layout[1];
        const lastWeek = layout[2];
        const middleSegment = middleWeek.segments.find(s => s.event.id === 'span');
        const lastSegment = lastWeek.segments.find(s => s.event.id === 'span');

        expect(middleSegment?.segmentKind).toBe('middle');
        expect(middleSegment?.startCol).toBe(1);
        expect(middleSegment?.endCol).toBe(7);
        expect(lastSegment?.segmentKind).toBe('last');
    });

    it('respects utcOffset when assigning calendar dates', () => {
        const events = [
            makeEvent({
                id: 'tz',
                start: '2026-06-01T22:30:00+00:00',
                end: '2026-06-02T01:00:00+00:00',
            }),
        ];

        const moscow = buildWeekLayout(events, weeks, '+03:00');
        const utc = buildWeekLayout(events, weeks, '+00:00');

        const moscowSegment = moscow.flatMap(w => w.segments).find(s => s.event.id === 'tz');
        const utcSegment = utc.flatMap(w => w.segments).find(s => s.event.id === 'tz');

        expect(dayjs(events[0].start).utcOffset('+03:00').format('YYYY-MM-DD')).toBe('2026-06-02');
        expect(dayjs(events[0].start).utcOffset('+00:00').format('YYYY-MM-DD')).toBe('2026-06-01');
        expect(utcSegment?.isMultiDay).toBe(true);
        expect(moscowSegment?.isMultiDay).toBe(false);
    });

    it('skips events with end before start', () => {
        const events = [
            makeEvent({
                id: 'inverted',
                start: '2026-06-05T12:00:00+03:00',
                end: '2026-06-03T10:00:00+03:00',
            }),
        ];

        const layout = buildWeekLayout(events, weeks, utcOffset);
        const segment = layout.flatMap(w => w.segments).find(s => s.event.id === 'inverted');

        expect(segment).toBeUndefined();
    });
});
