import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {PROGRESS_BAR_CYCLE_MS} from '@/core/calendarPaletteVars';
import {useProgressBarVisible} from '@/core/useProgressBarVisible';

describe('useProgressBarVisible', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows immediately when fetching starts', () => {
        const {result, rerender} = renderHook(
            ({isFetching}) => useProgressBarVisible(isFetching),
            {initialProps: {isFetching: false}},
        );

        expect(result.current).toBe(false);

        rerender({isFetching: true});
        expect(result.current).toBe(true);
    });

    it('keeps the bar visible for at least one cycle after fetching stops', () => {
        const {result, rerender} = renderHook(
            ({isFetching}) => useProgressBarVisible(isFetching),
            {initialProps: {isFetching: true}},
        );

        expect(result.current).toBe(true);

        rerender({isFetching: false});
        expect(result.current).toBe(true);

        act(() => {
            vi.advanceTimersByTime(PROGRESS_BAR_CYCLE_MS);
        });

        expect(result.current).toBe(false);
    });
});
