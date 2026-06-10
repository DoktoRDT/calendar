import {describe, expect, it, vi, afterEach} from 'vitest';

import {dayjs} from '@/core/dayjs';
import {
    getCurrentMonthAnchor,
    getMonthGridRange,
    getMonthGridWeeks,
    isToday,
    isViewingCurrentMonth,
    shiftMonth,
} from '@/core/dateUtils';

describe('dateUtils', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns ISO week range covering full month grid', () => {
        const range = getMonthGridRange('2026-06-01');
        expect(range.from).toBe('2026-06-01');
        expect(range.to).toBe('2026-07-05');
    });

    it('builds 5 or 6 week grids depending on month', () => {
        const feb2026 = getMonthGridWeeks('2026-02-01');
        const aug2026 = getMonthGridWeeks('2026-08-01');

        expect(feb2026).toHaveLength(5);
        expect(aug2026).toHaveLength(6);
        expect(feb2026[0]).toHaveLength(7);
    });

    it('shifts month anchor to first day of target month', () => {
        expect(shiftMonth('2026-06-15', -1)).toBe('2026-05-01');
        expect(shiftMonth('2026-06-15', 1)).toBe('2026-07-01');
    });

    it('detects today in selected utcOffset', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));

        expect(isToday(dayjs('2026-06-08'), '+03:00')).toBe(true);
        expect(isToday(dayjs('2026-06-07'), '+03:00')).toBe(false);
    });

    it('detects current month anchor in utcOffset', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));

        expect(getCurrentMonthAnchor('+03:00')).toBe('2026-06-01');
        expect(isViewingCurrentMonth('2026-06-01', '+03:00')).toBe(true);
        expect(isViewingCurrentMonth('2026-05-01', '+03:00')).toBe(false);
    });
});
