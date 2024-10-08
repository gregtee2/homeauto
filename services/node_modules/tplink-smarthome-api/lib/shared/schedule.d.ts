import type { MarkRequired } from 'ts-essentials';
import type { AnyDevice, SendOptions } from '../client';
import { type HasErrCode } from '../utils';
export type ScheduleDateStart = {
    smin: number;
    stime_opt: number;
};
export type WDay = [
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean
];
export type ScheduleRule = {
    name?: string;
    enable?: number;
    day?: number;
    month?: number;
    year?: number;
    wday?: WDay;
    repeat?: boolean;
    etime_opt: -1;
    emin: -1 | 0;
} & (ScheduleDateStart | Record<string, unknown>);
export type ScheduleRuleWithId = ScheduleRule & {
    id: string;
};
export type ScheduleRules = {
    rule_list: ScheduleRuleWithId[];
};
export type ScheduleNextAction = Record<string, unknown>;
export type ScheduleRuleResponse = ScheduleRule & HasErrCode;
export type ScheduleRulesResponse = ScheduleRules & HasErrCode;
export type ScheduleNextActionResponse = ScheduleNextAction & HasErrCode;
export declare function isScheduleNextActionResponse(candidate: unknown): candidate is ScheduleNextActionResponse;
export type HasRuleListWithRuleIds = {
    rule_list: {
        id: string;
    }[];
};
export declare function hasRuleListWithRuleIds(candidate: unknown): candidate is {
    rule_list: {
        id: string;
    }[];
};
export declare function isScheduleRulesResponse(candidate: unknown): candidate is ScheduleNextActionResponse;
export type ScheduleRuleInputTime = Date | number | 'sunrise' | 'sunset';
export declare function createScheduleRule({ start, daysOfWeek, }: {
    start: ScheduleRuleInputTime;
    daysOfWeek?: number[];
}): ScheduleDateStart & {
    wday: WDay;
    repeat: boolean;
    day?: number;
    month?: number;
    year?: number;
};
export declare function createRule({ start, end, daysOfWeek, }: {
    start: ScheduleRuleInputTime;
    end?: ScheduleRuleInputTime;
    daysOfWeek?: number[];
}): MarkRequired<Partial<ScheduleRule>, 'wday' | 'repeat'> & ScheduleDateStart;
export default abstract class Schedule {
    readonly device: AnyDevice;
    readonly apiModuleName: string;
    readonly childId?: string | undefined;
    nextAction: ScheduleNextActionResponse | undefined;
    constructor(device: AnyDevice, apiModuleName: string, childId?: string | undefined);
    /**
     * Gets Next Schedule Rule Action.
     *
     * Requests `schedule.get_next_action`. Supports childId.
     * @throws {@link ResponseError}
     */
    getNextAction(sendOptions?: SendOptions): Promise<ScheduleNextActionResponse>;
    /**
     * Gets Schedule Rules.
     *
     * Requests `schedule.get_rules`. Supports childId.
     * @throws {@link ResponseError}
     */
    getRules(sendOptions?: SendOptions): Promise<ScheduleRulesResponse>;
    /**
     * Gets Schedule Rule.
     *
     * Requests `schedule.get_rules` and return rule matching Id. Supports childId.
     * @throws {@link ResponseError}
     * @throws Error
     */
    getRule(id: string, sendOptions?: SendOptions): Promise<ScheduleRuleResponse>;
    /**
     * Adds Schedule rule.
     *
     * Sends `schedule.add_rule` command and returns rule id. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    addRule(rule: object, sendOptions?: SendOptions): Promise<{
        id: string;
    }>;
    /**
     * Edits Schedule Rule.
     *
     * Sends `schedule.edit_rule` command. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    editRule(rule: object, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Deletes All Schedule Rules.
     *
     * Sends `schedule.delete_all_rules` command. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    deleteAllRules(sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Deletes Schedule Rule.
     *
     * Sends `schedule.delete_rule` command. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    deleteRule(id: string, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Enables or Disables Schedule Rules.
     *
     * Sends `schedule.set_overall_enable` command. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setOverallEnable(enable: boolean, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Get Daily Usage Statistics.
     *
     * Sends `schedule.get_daystat` command. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getDayStats(year: number, month: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Get Monthly Usage Statistics.
     *
     * Sends `schedule.get_monthstat` command. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getMonthStats(year: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Erase Usage Statistics.
     *
     * Sends `schedule.erase_runtime_stat` command. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    eraseStats(sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=schedule.d.ts.map