const TIME_ZONE = "America/New_York";

type DateParts = {
    year: number;
    month: number;
    day: number;
};

type DateRange = {
    start: Date;
    end: Date;
};

function parseDateParts(value: string): DateParts | null {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }

    const utc = new Date(Date.UTC(year, month - 1, day));
    if (
        utc.getUTCFullYear() !== year ||
        utc.getUTCMonth() + 1 !== month ||
        utc.getUTCDate() !== day
    ) {
        return null;
    }

    return { year, month, day };
}

function addDays(parts: DateParts, days: number): DateParts {
    const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    return {
        year: utc.getUTCFullYear(),
        month: utc.getUTCMonth() + 1,
        day: utc.getUTCDate(),
    };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const localTimestamp = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
    );
    return localTimestamp - date.getTime();
}

function getDatePartsInTimeZone(date: Date, timeZone: string): DateParts {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day),
    };
}

function getUtcDateForTimeZone(parts: DateParts, timeZone: string) {
    const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
    const offset = getTimeZoneOffset(utcDate, timeZone);
    return new Date(utcDate.getTime() - offset);
}

export function getDecisionDateRange(options?: {
    date?: string;
    now?: Date;
    timeZone?: string;
}): DateRange | null {
    const timeZone = options?.timeZone ?? TIME_ZONE;
    const baseDate = options?.date
        ? parseDateParts(options.date)
        : getDatePartsInTimeZone(options?.now ?? new Date(), timeZone);

    if (!baseDate) {
        return null;
    }

    const start = getUtcDateForTimeZone(baseDate, timeZone);
    const nextDay = addDays(baseDate, 1);
    const end = getUtcDateForTimeZone(nextDay, timeZone);

    return { start, end };
}

export const DECISION_TIME_ZONE = TIME_ZONE;
