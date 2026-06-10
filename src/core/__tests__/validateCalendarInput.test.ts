import {afterEach, describe, expect, it, vi} from 'vitest';

import {
    resolveUtcOffset,
    validateEventDates,
    validateUtcOffset,
} from '@/core/validateCalendarInput';
import type {CalendarEvent} from '@/types';

const baseEvent: CalendarEvent = {
    id: 'e1',
    start: '2026-06-03T10:00:00+03:00',
    title: 'Task',
    variant: 'blue',
    isOverdue: false,
    isCritical: false,
    isAllDay: false,
    taskId: null,
    isClickable: false,
    hasHoverActions: false,
};

describe('validateUtcOffset', () => {
    it('accepts fixed offset strings', () => {
        expect(validateUtcOffset('+03:00')).toBe(true);
        expect(validateUtcOffset('-05:00')).toBe(true);
    });

    it('rejects IANA zones and malformed values', () => {
        expect(validateUtcOffset('Europe/Moscow')).toBe(false);
        expect(validateUtcOffset('UTC')).toBe(false);
        expect(validateUtcOffset('+3')).toBe(false);
    });
});

describe('resolveUtcOffset', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('prefers utcOffset over timezone alias', () => {
        expect(resolveUtcOffset('+03:00', '-05:00')).toBe('+03:00');
    });

    it('falls back to timezone when utcOffset is omitted', () => {
        expect(resolveUtcOffset(undefined, '+02:00')).toBe('+02:00');
    });

    it('returns +00:00 and warns when offset is missing', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(resolveUtcOffset()).toBe('+00:00');
        expect(warnSpy).toHaveBeenCalled();
    });
});

describe('validateEventDates', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('accepts valid start and end dates', () => {
        expect(validateEventDates(baseEvent)).toBe(true);
    });

    it('rejects invalid start date', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(validateEventDates({...baseEvent, start: 'not-a-date'})).toBe(false);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('rejects invalid end date', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(
            validateEventDates({...baseEvent, end: 'also-not-a-date'}),
        ).toBe(false);
        expect(warnSpy).toHaveBeenCalled();
    });
});
