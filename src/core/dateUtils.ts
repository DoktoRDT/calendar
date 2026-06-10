import {dayjs, type Dayjs} from './dayjs';

const WEEK_DAYS = 7;

function startOfIsoWeek(d: Dayjs): Dayjs {
    const dow = d.day();
    const offset = dow === 0 ? -6 : 1 - dow;
    return d.add(offset, 'day').startOf('day');
}

function endOfIsoWeek(d: Dayjs): Dayjs {
    return startOfIsoWeek(d)
        .add(WEEK_DAYS - 1, 'day')
        .endOf('day');
}

export function getMonthGridRange(anchorDate: string): {from: string; to: string} {
    const anchor = dayjs(anchorDate);
    const from = startOfIsoWeek(anchor.startOf('month'));
    const to = endOfIsoWeek(anchor.endOf('month'));
    return {from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD')};
}

export function getMonthGridWeeks(anchorDate: string): Dayjs[][] {
    const {from, to} = getMonthGridRange(anchorDate);
    const fromD = dayjs(from);
    const toD = dayjs(to);
    const totalDays = toD.diff(fromD, 'day') + 1;
    const weekCount = totalDays / WEEK_DAYS;
    const weeks: Dayjs[][] = [];
    for (let w = 0; w < weekCount; w++) {
        const week: Dayjs[] = [];
        for (let d = 0; d < WEEK_DAYS; d++) {
            week.push(fromD.add(w * WEEK_DAYS + d, 'day'));
        }
        weeks.push(week);
    }
    return weeks;
}

export function isToday(date: Dayjs, utcOffset: string): boolean {
    const todayStr = dayjs().utcOffset(utcOffset).format('YYYY-MM-DD');
    return date.format('YYYY-MM-DD') === todayStr;
}

export function getCurrentMonthAnchor(utcOffset: string): string {
    return dayjs().utcOffset(utcOffset).startOf('month').format('YYYY-MM-DD');
}

export function isViewingCurrentMonth(anchorDate: string, utcOffset: string): boolean {
    return (
        dayjs(anchorDate).startOf('month').format('YYYY-MM-DD') === getCurrentMonthAnchor(utcOffset)
    );
}

export function shiftMonth(anchorDate: string, delta: -1 | 1): string {
    return dayjs(anchorDate).add(delta, 'month').startOf('month').format('YYYY-MM-DD');
}
