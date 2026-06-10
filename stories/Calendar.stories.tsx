import type {Meta, StoryObj} from '@storybook/react';
import React, {useState} from 'react';

import {Calendar} from '@/calendar/Calendar';
import type {CalendarEvent, SeriesActionScope} from '@/types';

import {STORY_PROGRESS_BAR_COLOR} from './fixtures/calendarColors';
import {defaultPalette, sampleEvents} from './fixtures/events';
import {utcOffsetOptions, type UtcOffsetValue} from './fixtures/utcOffsets';

const meta: Meta<typeof Calendar> = {
    title: 'Calendar',
    component: Calendar,
    parameters: {
        layout: 'fullscreen',
    },
    argTypes: {
        utcOffset: {
            control: 'select',
            options: utcOffsetOptions.map(option => option.value),
        },
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

type Story = StoryObj<typeof Calendar>;

type CalendarStoryProps = Partial<React.ComponentProps<typeof Calendar>> & {
    showUtcOffsetPicker?: boolean;
    initialUtcOffset?: UtcOffsetValue;
};

function CalendarStory({
    showUtcOffsetPicker = false,
    initialUtcOffset = '+03:00',
    utcOffset: utcOffsetProp,
    ...props
}: CalendarStoryProps) {
    const [anchorDate, setAnchorDate] = useState('2026-06-01');
    const [utcOffset, setUtcOffset] = useState<UtcOffsetValue>(initialUtcOffset);

    const resolvedUtcOffset = utcOffsetProp ?? utcOffset;

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 12, height: '100%'}}>
            {showUtcOffsetPicker && (
                <label
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        font: '14px/1.4 system-ui, sans-serif',
                        color: '#21201f',
                    }}
                >
                    UTC offset
                    <select
                        value={resolvedUtcOffset}
                        onChange={event => setUtcOffset(event.target.value as UtcOffsetValue)}
                        data-testid="story-utc-offset"
                        style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            border: '1px solid #ebebeb',
                            background: '#fff',
                            font: 'inherit',
                        }}
                    >
                        {utcOffsetOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            <div style={{flex: 1, minHeight: 0}}>
                <Calendar
                    anchorDate={anchorDate}
                    events={sampleEvents}
                    utcOffset={resolvedUtcOffset}
                    timezone={props.timezone}
                    palette={defaultPalette}
                    overdueColor="#e5453a"
                    criticalColor="#e5453a"
                    progressBarColor={STORY_PROGRESS_BAR_COLOR}
                    onNavigate={setAnchorDate}
                    {...props}
                />
            </div>
        </div>
    );
}

export const Default: Story = {
    render: () => <CalendarStory />,
};

export const UtcOffsets: Story = {
    render: () => (
        <CalendarStory
            showUtcOffsetPicker
            events={sampleEvents.filter(event => ['task-tz', 'task-2', 'task-1'].includes(event.id))}
        />
    ),
};

export const MultiDay: Story = {
    render: () => (
        <CalendarStory
            events={sampleEvents.filter(event => event.id === 'task-2')}
            anchorDate="2026-06-01"
        />
    ),
};

export const OverdueCritical: Story = {
    render: () => (
        <CalendarStory events={sampleEvents.filter(event => event.id === 'task-4')} />
    ),
};

export const WithActions: Story = {
    render: () => (
        <CalendarStory
            onEventPress={(event: CalendarEvent) => console.log('press', event.id)}
            onEventEdit={(event: CalendarEvent, scope: SeriesActionScope) =>
                console.log('edit', event.id, scope)
            }
            onEventDelete={(event: CalendarEvent, scope: SeriesActionScope) =>
                console.log('delete', event.id, scope)
            }
        />
    ),
};

export const Fetching: Story = {
    render: () => <CalendarStory isFetching />,
};

export const English: Story = {
    render: () => (
        <CalendarStory
            locale="en"
            labels={{
                today: 'Today',
                prevMonth: 'Previous month',
                nextMonth: 'Next month',
                allDay: 'All day',
                overdue: 'Overdue',
                untilDate: date => `until ${date}`,
                untilTime: time => `until ${time}`,
                editEvent: 'Edit',
                deleteEvent: 'Delete',
                editSingle: 'This task only',
                editSeries: 'All tasks in series',
                deleteSingle: 'This task only',
                deleteSeries: 'All tasks in series',
            }}
        />
    ),
};

export const ReferenceParity: Story = {
    decorators: [
        Story => (
            <div
                style={{
                    height: 584,
                    padding: 16,
                    background: '#f5f5f5',
                    boxSizing: 'border-box',
                }}
            >
                <Story />
            </div>
        ),
    ],
    render: () => (
        <CalendarStory
            timezone="+03:00"
            onEventPress={(event: CalendarEvent) => console.log('press', event.id)}
            onEventEdit={(event: CalendarEvent, scope: SeriesActionScope) =>
                console.log('edit', event.id, scope)
            }
            onEventDelete={(event: CalendarEvent, scope: SeriesActionScope) =>
                console.log('delete', event.id, scope)
            }
        />
    ),
};

export const Empty: Story = {
    render: () => <CalendarStory events={[]} />,
};
