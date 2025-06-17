import { localize } from '../localize/localize'

export type IntervalType = "days" | "weeks" | "months";

export const INTERVAL_TYPES: IntervalType[] = ["days", "weeks", "months"];

export function getIntervalTypeLabels(lang: string): Record<IntervalType, string> {
    return {
        days: localize("intervals.days", lang),
        weeks: localize("intervals.weeks", lang),
        months: localize("intervals.months", lang),
    };
}

export interface Tag {
    id: string;
    name?: string;
}

export interface Task {
    id: string;
    title: string;
    interval_value: number;
    interval_type: IntervalType;
    last_performed: string;
    tag_id?: string;
    icon?: string;
}