import type { AnyDevice, SendOptions } from '../client';
import { HasErrCode } from '../utils';
export type CloudInfo = {
    username?: string;
    server?: string;
    binded?: number;
    cld_connection?: number;
    illegalType?: number;
    tcspStatus?: number;
    fwDlPage?: string;
    tcspInfo?: string;
    stopConnect?: number;
    fwNotifyType?: number;
};
export declare function isCloudInfo(candidate: unknown): candidate is CloudInfo;
export default class Cloud {
    readonly device: AnyDevice;
    readonly apiModuleName: string;
    info: (CloudInfo & HasErrCode) | undefined;
    constructor(device: AnyDevice, apiModuleName: string);
    /**
     * Gets device's TP-Link cloud info.
     *
     * Requests `cloud.get_info`. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getInfo(sendOptions?: SendOptions): Promise<CloudInfo & HasErrCode>;
    /**
     * Add device to TP-Link cloud.
     *
     * Sends `cloud.bind` command. Does not support childId.
     * @param   username
     * @param   password
     * @param   sendOptions
     * @returns parsed JSON response
     */
    bind(username: string, password: string, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Remove device from TP-Link cloud.
     *
     * Sends `cloud.unbind` command. Does not support childId.
     * @param   sendOptions
     * @returns parsed JSON response
     */
    unbind(sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Get device's TP-Link cloud firmware list.
     *
     * Sends `cloud.get_intl_fw_list` command. Does not support childId.
     * @param   sendOptions
     * @returns parsed JSON response
     */
    getFirmwareList(sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Sets device's TP-Link cloud server URL.
     *
     * Sends `cloud.set_server_url` command. Does not support childId.
     * @param   server - URL
     * @param   sendOptions
     * @returns parsed JSON response
     */
    setServerUrl(server: string, sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=cloud.d.ts.map