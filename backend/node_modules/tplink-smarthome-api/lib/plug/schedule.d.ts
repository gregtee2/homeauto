import type { SendOptions } from '../client';
import Schedule, { type ScheduleRule, type ScheduleRuleInputTime } from '../shared/schedule';
import type Plug from './index';
export type PlugScheduleRule = Omit<ScheduleRule, 'emin'> & {
    sact?: number;
    s_dimmer?: Record<string, unknown>;
    emin: 0;
};
export interface PlugScheduleRuleInput {
    powerState: boolean;
    /**
     * dimmer data (dimmable plugs only)
     */
    dimmer?: Record<string, unknown>;
    /**
     * Date or number of minutes
     */
    start: ScheduleRuleInputTime;
    /**
     * [0,6] = weekend, [1,2,3,4,5] = weekdays
     */
    daysOfWeek?: number[];
    name?: string;
    /**
     * @defaultValue true
     */
    enable: boolean;
}
export default class PlugSchedule extends Schedule {
    readonly device: Plug;
    readonly apiModuleName: string;
    readonly childId?: string | undefined;
    constructor(device: Plug, apiModuleName: string, childId?: string | undefined);
    /**
     * Adds Schedule rule.
     *
     * Sends `schedule.add_rule` command and returns rule id. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    addRule(rule: PlugScheduleRuleInput, sendOptions?: SendOptions): ReturnType<Schedule['addRule']>;
    /**
     * Edits Schedule rule.
     *
     * Sends `schedule.edit_rule` command and returns rule id. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    editRule(rule: PlugScheduleRuleInput & {
        id: string;
    }, sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=schedule.d.ts.map