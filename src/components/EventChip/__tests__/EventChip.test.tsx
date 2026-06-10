import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {describe, expect, it, vi} from 'vitest';

import {EventChip} from '@/components/EventChip';
import {eventVariantClassName} from '@/components/shared/eventVariants';
import {LabelsProvider} from '@/labels/LabelsContext';
import type {CalendarEvent} from '@/types';

const baseEvent: CalendarEvent = {
    id: 'chip-1',
    start: '2026-06-03T10:00:00+03:00',
    end: '2026-06-03T12:00:00+03:00',
    title: 'Chip task',
    variant: 'blue',
    isOverdue: false,
    isCritical: false,
    isAllDay: false,
    taskId: 'chip-1',
    isClickable: true,
    hasHoverActions: false,
};

function renderChip(
    event: CalendarEvent,
    props?: Partial<React.ComponentProps<typeof EventChip>>,
) {
    return render(
        <LabelsProvider>
            <EventChip
                event={event}
                utcOffset="+03:00"
                allDayLabel="All day"
                onPress={vi.fn()}
                data-testid="event-chip"
                {...props}
            />
        </LabelsProvider>,
    );
}

describe('EventChip', () => {
    it('calls onPress for clickable events', async () => {
        const user = userEvent.setup();
        const onPress = vi.fn();

        renderChip({...baseEvent, isClickable: true}, {onPress});
        await user.click(screen.getByTestId('event-chip'));
        expect(onPress).toHaveBeenCalledWith(baseEvent);
    });

    it('does not wire press handler for non-clickable events', () => {
        renderChip({...baseEvent, isClickable: false});
        const chip = screen.getByTestId('event-chip');
        expect(chip).not.toHaveAttribute('tabindex');
    });

    it('shows overdue label', () => {
        renderChip({...baseEvent, isOverdue: true});
        expect(screen.getByText('Просрочено')).toBeInTheDocument();
    });

    it('shows all-day label instead of time', () => {
        renderChip({...baseEvent, isAllDay: true});
        expect(screen.getByText('All day')).toBeInTheDocument();
    });

    it('applies variant CSS class', () => {
        renderChip(baseEvent);
        const chip = screen.getByTestId('event-chip');
        expect(chip.className).toContain(eventVariantClassName('blue'));
    });
});
