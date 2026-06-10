import {lazy, type ComponentType, type LazyExoticComponent} from 'react';

import type {CalendarProps} from '@/types';

import type {LazyCalendarWithDataProps} from './LazyCalendarWithData';

export function createLazyCalendarBundle<T extends object>(
    load: () => Promise<{default: ComponentType<T>}>,
    delayMs = 1200,
): LazyExoticComponent<ComponentType<T>> {
    return lazy(async () => {
        const [module] = await Promise.all([
            load(),
            new Promise<void>(resolve => {
                setTimeout(resolve, delayMs);
            }),
        ]);

        return module;
    });
}

export const LazyCalendarWithDataBundle = createLazyCalendarBundle<LazyCalendarWithDataProps>(
    () =>
        import('./LazyCalendarWithData').then(module => ({
            default: module.LazyCalendarWithData,
        })),
    1200,
);

export const LazyCalendarBundle = createLazyCalendarBundle<CalendarProps>(
    () =>
        import('@/calendar/Calendar').then(module => ({
            default: module.Calendar,
        })),
    1200,
);
