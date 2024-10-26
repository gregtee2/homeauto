import type { SendOptions } from '../client';
import { ScheduleRuleInputTime, type HasRuleListWithRuleIds } from '../shared/schedule';
import { type HasErrCode } from '../utils';
import type Plug from './index';
export type AwayRule = {
    name?: string;
    enable?: number;
    frequency?: number;
    delay?: number;
};
export interface AwayRuleInput {
    /**
     * Date or number of minutes
     */
    start: ScheduleRuleInputTime;
    /**
     * Date or number of minutes (only time component of date is used)
     */
    end: ScheduleRuleInputTime;
    /**
     * [0,6] = weekend, [1,2,3,4,5] = weekdays
     */
    daysOfWeek: number[];
    /**
     * @defaultValue 5
     */
    frequency: number;
    name?: string;
    /**
     * @defaultValue true
     */
    enable: boolean | 0 | 1;
}
export default class Away {
    readonly device: Plug;
    readonly apiModuleName: string;
    readonly childId: string | undefined;
    constructor(device: Plug, apiModuleName: string, childId?: string | undefined);
    /**
     * Gets Away Rules.
     *
     * Requests `anti_theft.get_rules`. Support childId.
     * @throws {@link ResponseError}
     */
    getRules(sendOptions?: SendOptions): Promise<HasRuleListWithRuleIds & HasErrCode>;
    /**
     * Gets Away Rule.
     *
     * Requests `anti_theft.get_rules` and return rule matching Id. Support childId.
     * @throws {@link ResponseError}
     */
    getRule(id: string, sendOptions?: SendOptions): Promise<{
        id: string;
    } & HasErrCode>;
    /**
     * Adds Away Rule.
     *
     * Sends `anti_theft.add_rule` command and returns rule id. Support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    addRule(rule: AwayRuleInput, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Edits Away rule.
     *
     * Sends `anti_theft.edit_rule` command and returns rule id. Support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    editRule(rule: AwayRuleInput & {
        id: string;
    }, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Deletes All Away Rules.
     *
     * Sends `anti_theft.delete_all_rules` command. Support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    deleteAllRules(sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Deletes Away Rule.
     *
     * Sends `anti_theft.delete_rule` command. Support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    deleteRule(id: string, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Enables or Disables Away Rules.
     *
     * Sends `anti_theft.set_overall_enable` command. Support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setOverallEnable(enable: boolean | 0 | 1, sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=away.d.ts.map