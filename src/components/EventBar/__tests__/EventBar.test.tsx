import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {describe, expect, it, vi} from 'vitest';

import {EventBar} from '@/components/EventBar';
import {eventVariantClassName} from '@/components/shared/eventVariants';
import {LabelsProvider} from '@/labels/LabelsContext';
import type {CalendarEvent} from '@/types';

const baseEvent: CalendarEvent = {
    id: 'bar-1',
    start: '2026-06-05T10:00:00+03:00',
    end: '2026-06-08T18:00:00+03:00',
    title: 'Multi-day route',
    variant: 'green',
    isOverdue: false,
    isCritical: false,
    isAllDay: false,
    taskId: 'bar-1',
    isClickable: true,
    hasHoverActions: true,
};

function renderBar(
    event: CalendarEvent,
    segmentKind: 'whole' | 'first' | 'middle' | 'last',
    props?: Partial<React.ComponentProps<typeof EventBar>>,
) {
    return render(
        <LabelsProvider>
            <EventBar
                event={event}
                segmentKind={segmentKind}
                utcOffset="+03:00"
                locale="en"
                onPress={vi.fn()}
                data-testid="event-bar"
                {...props}
            />
        </LabelsProvider>,
    );
}

describe('EventBar', () => {
    it('applies variant CSS class', () => {
        renderBar(baseEvent, 'whole');
        const bar = screen.getByTestId('event-bar');
        expect(bar.className).toContain(eventVariantClassName('green'));
    });

    it('formats whole segment with start and end', () => {
        renderBar(baseEvent, 'whole');
        expect(screen.getByText(/10:00, 05\.06\.2026 — 18:00, 08\.06\.2026/)).toBeInTheDocument();
    });

    it('formats first segment with until date', () => {
        renderBar(baseEvent, 'first');
        expect(screen.getByText('10:00')).toBeInTheDocument();
        expect(screen.getByText(/до 08 June/)).toBeInTheDocument();
    });

    it('formats last segment with until time only', () => {
        renderBar(baseEvent, 'last');
        expect(screen.getByText('до 18:00')).toBeInTheDocument();
    });

    it('wires edit hover action', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn();

        renderBar(baseEvent, 'whole', {onEdit, onDelete: vi.fn()});

        await user.click(screen.getByTestId('event-bar-actions-edit-trigger'));
        await user.click(screen.getByTestId('event-bar-actions-edit-option-single'));

        expect(onEdit).toHaveBeenCalledWith(baseEvent, 'single');
    });
});
