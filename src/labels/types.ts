export type CalendarLabels = {
    loading: string;
    today: string;
    prevMonth: string;
    nextMonth: string;
    allDay: string;
    overdue: string;
    untilDate: (date: string) => string;
    untilTime: (time: string) => string;
    formatBarDateTime: (iso: string, utcOffset: string, locale: string) => string;
    formatBarTime: (iso: string, utcOffset: string) => string;
    formatBarDate: (iso: string, utcOffset: string, locale: string) => string;
    editEvent: string;
    deleteEvent: string;
    editSingle: string;
    editSeries: string;
    deleteSingle: string;
    deleteSeries: string;
};
