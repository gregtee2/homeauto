import type { AnyDevice, SendOptions } from '../client';
export type RealtimeV1 = {
    current?: number;
    power?: number;
    total?: number;
    voltage?: number;
};
export type RealtimeV2 = {
    current_ma?: number;
    power_mw?: number;
    total_wh?: number;
    voltage_mv?: number;
};
export type Realtime = RealtimeV1 | RealtimeV2;
export type RealtimeNormalized = RealtimeV1 & RealtimeV2;
export declare function isRealtime(candidate: unknown): candidate is Realtime;
export default class Emeter {
    #private;
    readonly device: AnyDevice;
    readonly apiModuleName: string;
    readonly childId: string | undefined;
    constructor(device: AnyDevice, apiModuleName: string, childId?: string | undefined);
    /**
     * Returns cached results from last retrieval of `emeter.get_realtime`.
     * @returns {Object}
     */
    get realtime(): RealtimeNormalized;
    /**
     * @private
     */
    setRealtime(realtime: Realtime): void;
    /**
     * Gets device's current energy stats.
     *
     * Requests `emeter.get_realtime`. Older devices return `current`, `voltage`, etc,
     * while newer devices return `current_ma`, `voltage_mv` etc
     * This will return a normalized response including both old and new style properties for backwards compatibility.
     * Supports childId.
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getRealtime(sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Get Daily Emeter Statistics.
     *
     * Sends `emeter.get_daystat` command. Supports childId.
     * @param   year
     * @param   month
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getDayStats(year: number, month: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Get Monthly Emeter Statistics.
     *
     * Sends `emeter.get_monthstat` command. Supports childId.
     * @param   year
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getMonthStats(year: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Erase Emeter Statistics.
     *
     * Sends `emeter.erase_runtime_stat` command. Supports childId.
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    eraseStats(sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=emeter.d.ts.map