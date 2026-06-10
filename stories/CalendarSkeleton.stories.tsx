import type {Meta, StoryObj} from '@storybook/react';
import React from 'react';

import {CalendarSkeleton} from '@/calendar/CalendarSkeleton';

const meta: Meta<typeof CalendarSkeleton> = {
    title: 'CalendarSkeleton',
    component: CalendarSkeleton,
    parameters: {
        layout: 'fullscreen',
    },
    decorators: [
        Story => (
            <div style={{height: 640, padding: 24, background: '#f5f5f5'}}>
                <Story />
            </div>
        ),
    ],
};

export default meta;

type Story = StoryObj<typeof CalendarSkeleton>;

export const Default: Story = {
    render: () => <CalendarSkeleton />,
};

export const WithAnchorDate: Story = {
    render: () => (
        <CalendarSkeleton anchorDate="2026-06-01" utcOffset="+03:00" />
    ),
};
