import type { AnyDevice, SendOptions } from '../client';
export default class Time {
    readonly device: AnyDevice;
    readonly apiModuleName: string;
    constructor(device: AnyDevice, apiModuleName: string);
    /**
     * Gets device's time.
     *
     * Requests `timesetting.get_time`. Does not support ChildId.
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getTime(sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Gets device's timezone.
     *
     * Requests `timesetting.get_timezone`. Does not support ChildId.
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getTimezone(sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=time.d.ts.map