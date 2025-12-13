declare module 'date-fns' {
    export function format(date: Date | number | string, formatStr: string, options?: { locale?: object }): string;
    export function parseISO(dateString: string): Date;
    export function addDays(date: Date | number, amount: number): Date;
    export function subDays(date: Date | number, amount: number): Date;
    export function isAfter(date: Date | number, dateToCompare: Date | number): boolean;
    export function isBefore(date: Date | number, dateToCompare: Date | number): boolean;
    export function startOfDay(date: Date | number): Date;
    export function endOfDay(date: Date | number): Date;
    export function startOfMonth(date: Date | number): Date;
    export function endOfMonth(date: Date | number): Date;
    export function eachDayOfInterval(interval: { start: Date | number; end: Date | number }): Date[];
    export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean;
    export function isSameMonth(dateLeft: Date | number, dateRight: Date | number): boolean;
    export function differenceInDays(dateLeft: Date | number, dateRight: Date | number): number;
}

declare module 'date-fns/locale' {
    export const ptBR: object;
    export const enUS: object;
}
