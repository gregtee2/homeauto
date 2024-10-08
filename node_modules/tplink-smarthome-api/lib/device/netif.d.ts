import type { SendOptions } from '../client';
import type Device from './index';
export default class Netif {
    readonly device: Device;
    readonly apiModuleName: string;
    constructor(device: Device, apiModuleName: string);
    /**
     * Requests `netif.get_scaninfo` (list of WiFi networks).
     *
     * Note that `timeoutInSeconds` is sent in the request and is not the actual network timeout.
     * The network timeout for the request is calculated by adding the
     * default network timeout to `timeoutInSeconds`.
     * @param  refresh - request device's cached results
     * @param  timeoutInSeconds - timeout for scan in seconds
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getScanInfo(refresh?: boolean, timeoutInSeconds?: number, sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=netif.d.ts.map