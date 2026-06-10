import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';

import {Calendar} from '@/calendar/Calendar';
import type {CalendarEvent, VariantPalette} from '@/types';

const palette: VariantPalette = {
    red: {bg: 'rgba(245, 82, 58, 0.1)', fg: '#f5523a'},
    blue: {bg: 'rgba(64, 96, 227, 0.1)', fg: '#4060e3'},
    green: {bg: 'rgba(28, 192, 82, 0.1)', fg: '#1cc052'},
    grey: {bg: 'rgba(33, 32, 31, 0.1)', fg: '#666666'},
};

const events: CalendarEvent[] = [
    {
        id: 'e1',
        start: '2026-06-03T10:00:00+03:00',
        title: 'Test task',
        variant: 'blue',
        isOverdue: false,
        isCritical: false,
        isAllDay: false,
        taskId: 'e1',
        isClickable: true,
        hasHoverActions: false,
    },
];

function CalendarHarness({locale}: {locale?: string} = {}) {
    const [anchorDate, setAnchorDate] = useState('2026-06-01');
    return (
        <Calendar
            anchorDate={anchorDate}
            events={events}
            utcOffset="+03:00"
            locale={locale}
            palette={palette}
            overdueColor="#e00"
            criticalColor="#c00"
            progressBarColor="#111"
            onNavigate={setAnchorDate}
            data-testid="calendar"
        />
    );
}

describe('Calendar', () => {
    it('uses Russian locale by default', () => {
        render(<CalendarHarness />);

        expect(screen.getByText('июнь')).toBeInTheDocument();
        expect(screen.queryByText('June')).not.toBeInTheDocument();
    });

    it('navigates to previous and next month', async () => {
        const user = userEvent.setup();
        render(<CalendarHarness locale="en" />);

        expect(screen.getByText('June')).toBeInTheDocument();

        await user.click(screen.getByTestId('calendar-next'));
        expect(screen.getByText('July')).toBeInTheDocument();

        await user.click(screen.getByTestId('calendar-prev'));
        expect(screen.getByText('June')).toBeInTheDocument();
    });

    it('shows progress bar when fetching', () => {
        render(
            <Calendar
                anchorDate="2026-06-01"
                events={events}
                utcOffset="+03:00"
                palette={palette}
                overdueColor="#e00"
                criticalColor="#c00"
                progressBarColor="#111"
                onNavigate={vi.fn()}
                isFetching
                data-testid="calendar"
            />,
        );

        expect(screen.getByTestId('calendar-progress')).toBeInTheDocument();
    });

    it('renders event chip', () => {
        render(<CalendarHarness />);
        expect(screen.getAllByTestId('calendar-grid-chip-e1').length).toBeGreaterThan(0);
    });
});
