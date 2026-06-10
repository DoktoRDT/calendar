import {dayjs} from '@/core/dayjs';

import type {CalendarLabels} from './types';

export const defaultLabels: CalendarLabels = {
    loading: 'Загрузка календаря',
    today: 'Сегодня',
    prevMonth: 'Предыдущий месяц',
    nextMonth: 'Следующий месяц',
    allDay: 'Весь день',
    overdue: 'Просрочено',
    untilDate: date => `до ${date}`,
    untilTime: time => `до ${time}`,
    formatBarDateTime: (iso, utcOffset, locale) =>
        dayjs(iso).utcOffset(utcOffset).locale(locale).format('HH:mm, DD.MM.YYYY'),
    formatBarTime: (iso, utcOffset) => dayjs(iso).utcOffset(utcOffset).format('HH:mm'),
    formatBarDate: (iso, utcOffset, locale) =>
        dayjs(iso).utcOffset(utcOffset).locale(locale).format('DD MMMM'),
    editEvent: 'Редактировать',
    deleteEvent: 'Удалить',
    editSingle: 'Только это задание',
    editSeries: 'Все задания серии',
    deleteSingle: 'Только это задание',
    deleteSeries: 'Все задания серии',
};

export function mergeLabels(partial?: Partial<CalendarLabels>): CalendarLabels {
    if (!partial) {
        return defaultLabels;
    }

    return {
        ...defaultLabels,
        ...partial,
    };
}
