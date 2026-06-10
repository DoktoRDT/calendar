import {useEffect, useRef, useState} from 'react';

import {PROGRESS_BAR_CYCLE_MS} from './calendarPaletteVars';

export function useProgressBarVisible(isFetching: boolean): boolean {
    const [visible, setVisible] = useState(false);
    const shownAtRef = useRef<number | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isFetching) {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }

            shownAtRef.current = Date.now();
            setVisible(true);
            return;
        }

        if (shownAtRef.current === null) {
            return;
        }

        const elapsed = Date.now() - shownAtRef.current;
        const remaining = Math.max(0, PROGRESS_BAR_CYCLE_MS - elapsed);

        hideTimerRef.current = setTimeout(() => {
            hideTimerRef.current = null;
            shownAtRef.current = null;
            setVisible(false);
        }, remaining);

        return () => {
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        };
    }, [isFetching]);

    return visible;
}
