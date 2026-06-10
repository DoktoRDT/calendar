import type {Meta, StoryObj} from '@storybook/react';
import React, {Suspense, useCallback, useState} from 'react';

import {CalendarSkeleton} from '@/calendar/CalendarSkeleton';
import {defaultPalette} from '@/theme/defaultCalendarColors';

import {STORY_PROGRESS_BAR_COLOR} from './fixtures/calendarColors';
import {LazyCalendarBundle, LazyCalendarWithDataBundle} from './fixtures/lazyCalendar';

const UTC_OFFSET = '+03:00';
const CHUNK_DELAY_MS = 1200;

const panelStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    padding: '10px 12px',
    borderRadius: 8,
    background: '#fff',
    border: '1px solid #ebebeb',
    font: '13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
    color: '#404a52',
};

const replayButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #ebebeb',
    background: '#fff',
    font: '13px/1.4 system-ui, sans-serif',
    cursor: 'pointer',
};

function LazyChunkWithDataDemo() {
    const [anchorDate, setAnchorDate] = useState('2026-06-01');
    const [replayKey, setReplayKey] = useState(0);
    const [phase, setPhase] = useState<'skeleton' | 'calendar' | 'fetching'>('skeleton');

    const handleFetchingChange = useCallback((isFetching: boolean) => {
        setPhase(isFetching ? 'fetching' : 'calendar');
    }, []);

    const handleReplay = () => {
        setPhase('skeleton');
        setReplayKey(key => key + 1);
    };

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 12, height: '100%'}}>
            <div style={panelStyle}>
                <span>
                    <strong>phase:</strong> {phase}
                </span>
                <span>
                    <strong>anchorDate:</strong> {anchorDate}
                </span>
                <span>
                    <strong>chunk delay:</strong> {CHUNK_DELAY_MS}ms
                </span>
                <button type="button" style={replayButtonStyle} onClick={handleReplay}>
                    Reload chunk
                </button>
            </div>
            <div style={{flex: 1, minHeight: 0}}>
                <Suspense
                    key={replayKey}
                    fallback={
                        <CalendarSkeleton
                            anchorDate={anchorDate}
                            utcOffset={UTC_OFFSET}
                            data-testid="lazy-calendar-skeleton"
                        />
                    }
                >
                    <LazyCalendarWithDataBundle
                        anchorDate={anchorDate}
                        onNavigate={setAnchorDate}
                        onFetchingChange={handleFetchingChange}
                    />
                </Suspense>
            </div>
        </div>
    );
}

function LazyChunkOnlyDemo() {
    const [anchorDate] = useState('2026-06-01');
    const [replayKey, setReplayKey] = useState(0);

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 12, height: '100%'}}>
            <div style={panelStyle}>
                <span>
                    <strong>mode:</strong> chunk only (no data fetch)
                </span>
                <button
                    type="button"
                    style={replayButtonStyle}
                    onClick={() => setReplayKey(key => key + 1)}
                >
                    Reload chunk
                </button>
            </div>
            <div style={{flex: 1, minHeight: 0}}>
                <Suspense
                    key={replayKey}
                    fallback={
                        <CalendarSkeleton
                            anchorDate={anchorDate}
                            utcOffset={UTC_OFFSET}
                            data-testid="lazy-chunk-only-skeleton"
                        />
                    }
                >
                    <LazyCalendarBundle
                        anchorDate={anchorDate}
                        events={[]}
                        utcOffset={UTC_OFFSET}
                        palette={defaultPalette}
                        overdueColor="#e5453a"
                        criticalColor="#e5453a"
                        progressBarColor={STORY_PROGRESS_BAR_COLOR}
                        onNavigate={() => {}}
                        data-testid="lazy-chunk-only-calendar"
                    />
                </Suspense>
            </div>
        </div>
    );
}

const meta: Meta = {
    title: 'Calendar/Lazy chunk',
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'corp-tracking pattern: `Suspense` + `lazy()` + `CalendarSkeleton` fallback, then `isFetching` while events load.',
            },
        },
    },
    decorators: [
        Story => (
            <div style={{height: 700, padding: 24, background: '#f5f5f5'}}>
                <Story />
            </div>
        ),
    ],
};

export default meta;

type Story = StoryObj;

export const WithSkeletonAndDataFetch: Story = {
    render: () => <LazyChunkWithDataDemo />,
};

export const SkeletonOnly: Story = {
    render: () => <LazyChunkOnlyDemo />,
};
