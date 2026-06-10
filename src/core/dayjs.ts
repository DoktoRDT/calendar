import dayjsLib from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import 'dayjs/locale/ru.js';
import 'dayjs/locale/en.js';

dayjsLib.extend(utc);

export const DEFAULT_LOCALE = 'ru';

export const dayjs = dayjsLib;
export type {Dayjs} from 'dayjs';
