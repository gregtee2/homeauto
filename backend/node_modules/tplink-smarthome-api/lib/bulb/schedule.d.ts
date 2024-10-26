import type Bulb from './index';
import Schedule, { ScheduleRule } from '../shared/schedule';
import type { ScheduleRuleInputTime } from '../shared/schedule';
import type { LightState } from './lighting';
import type { SendOptions } from '../client';
export type BulbScheduleRule = Omit<ScheduleRule, 'emin'> & {
    s_light: LightState;
    sact: 2;
    emin: -1;
    etime_opt: -1;
};
export interface BulbScheduleRuleInput {
    lightState: LightState;
    /**
     * Date or number of minutes
     */
    start: ScheduleRuleInputTime;
    /**
     * [0,6] = weekend, [1,2,3,4,5] = weekdays
     */
    daysOfWeek?: number[];
    /**
     * @defaultValue ''
     */
    name: string;
    /**
     * @defaultValue true
     */
    enable: boolean;
}
export default class BulbSchedule extends Schedule {
    readonly device: Bulb;
    readonly apiModuleName: string;
    readonly childId?: string | undefined;
    constructor(device: Bulb, apiModuleName: string, childId?: string | undefined);
    /**
     * Adds Schedule rule.
     *
     * Sends `schedule.add_rule` command and returns rule id.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    addRule(rule: BulbScheduleRuleInput, sendOptions?: SendOptions): Promise<{
        id: string;
    }>;
    /**
     * Edits Schedule rule.
     *
     * Sends `schedule.edit_rule`.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    editRule(rule: BulbScheduleRuleInput & {
        id: string;
    }, sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=schedule.d.ts.map