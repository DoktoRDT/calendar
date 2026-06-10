import {describe, expect, it} from 'vitest';

import {formatEventTime} from '@/core/formatEventTime';

describe('formatEventTime', () => {
    it('returns empty string for all-day events', () => {
        expect(
            formatEventTime(
                {start: '2026-06-01T10:00:00+03:00', isAllDay: true},
                '+03:00',
            ),
        ).toBe('');
    });

    it('formats single start time', () => {
        expect(
            formatEventTime(
                {start: '2026-06-01T10:30:00+03:00', isAllDay: false},
                '+03:00',
            ),
        ).toBe('10:30');
    });

    it('formats start-end range', () => {
        expect(
            formatEventTime(
                {
                    start: '2026-06-01T10:00:00+03:00',
                    end: '2026-06-01T12:30:00+03:00',
                    isAllDay: false,
                },
                '+03:00',
            ),
        ).toBe('10:00-12:30');
    });
});
