import {render, screen} from '@testing-library/react';
import React from 'react';
import {describe, expect, it} from 'vitest';

import {CalendarSkeleton} from '@/calendar/CalendarSkeleton';
import {getMonthGridWeeks} from '@/core/dateUtils';

function countWeekRows(container: HTMLElement): number {
    return container.querySelectorAll('[role="row"]').length;
}

describe('CalendarSkeleton', () => {
    it('renders loading status with default week count', () => {
        const {container} = render(<CalendarSkeleton data-testid="skeleton" />);

        const root = screen.getByTestId('skeleton');
        expect(root).toHaveAttribute('role', 'status');
        expect(root).toHaveAttribute('aria-busy', 'true');
        expect(countWeekRows(container)).toBe(7);
    });

    it('matches month grid week count for anchor date', () => {
        const anchorDate = '2026-06-01';
        const weekCount = getMonthGridWeeks(anchorDate).length;

        const {container} = render(
            <CalendarSkeleton anchorDate={anchorDate} data-testid="skeleton" />,
        );

        expect(countWeekRows(container)).toBe(weekCount + 1);
    });
});
