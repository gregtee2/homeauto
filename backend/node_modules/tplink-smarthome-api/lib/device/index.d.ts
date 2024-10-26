/// <reference types="node" />
import { EventEmitter } from 'events';
import type log from 'loglevel';
import type { BulbSysinfo } from '../bulb';
import type { default as Client, SendOptions } from '../client';
import type { Logger } from '../logger';
import type { PlugSysinfo } from '../plug';
import type { RealtimeNormalized } from '../shared/emeter';
import { type HasErrCode } from '../utils';
import Netif from './netif';
type HasAtLeastOneProperty = {
    [key: string]: unknown;
};
export interface ApiModuleNamespace {
    system: string;
    cloud: string;
    schedule: string;
    timesetting: string;
    emeter: string;
    netif: string;
    lightingservice: string;
}
export type Sysinfo = BulbSysinfo | PlugSysinfo;
export interface DeviceConstructorOptions {
    client: Client;
    host: string;
    /**
     * @defaultValue 9999
     */
    port?: number;
    logger?: log.RootLogger;
    defaultSendOptions?: SendOptions;
}
export type CommonSysinfo = {
    alias: string;
    deviceId: string;
    model: string;
    sw_ver: string;
    hw_ver: string;
};
export declare function isCommonSysinfo(candidate: unknown): candidate is CommonSysinfo;
export declare function isBulbSysinfo(candidate: unknown): candidate is BulbSysinfo;
export declare function isPlugSysinfo(candidate: unknown): candidate is PlugSysinfo;
export interface DeviceEvents {
    /**
     * Energy Monitoring Details were updated from device. Fired regardless if status was changed.
     */
    'emeter-realtime-update': (value: RealtimeNormalized) => void;
}
declare interface Device {
    on<U extends keyof DeviceEvents>(event: U, listener: DeviceEvents[U]): this;
    emit<U extends keyof DeviceEvents>(event: U, ...args: Parameters<DeviceEvents[U]>): boolean;
}
/**
 * TP-Link Device.
 *
 * Abstract class. Shared behavior for {@link Plug} and {@link Bulb}.
 * @fires  Device#emeter-realtime-update
 * @noInheritDoc
 */
declare abstract class Device extends EventEmitter {
    readonly client: Client;
    host: string;
    port: number;
    netif: Netif;
    log: Logger;
    readonly defaultSendOptions: SendOptions;
    private readonly udpConnection;
    private readonly tcpConnection;
    protected _sysInfo: Sysinfo;
    abstract readonly apiModules: ApiModuleNamespace;
    abstract supportsEmeter: boolean;
    get childId(): string | undefined;
    constructor(options: DeviceConstructorOptions & {
        _sysInfo: Sysinfo;
    });
    /**
     * Returns cached results from last retrieval of `system.sysinfo`.
     * @returns system.sysinfo
     */
    get sysInfo(): Sysinfo;
    /**
     * @internal
     */
    setSysInfo(sysInfo: Sysinfo): void;
    /**
     * Cached value of `sysinfo.alias`.
     */
    get alias(): string;
    /**
     * Cached value of `sysinfo.deviceId`.
     */
    get id(): string;
    /**
     * Cached value of `sysinfo.deviceId`.
     */
    get deviceId(): string;
    /**
     * Cached value of `sysinfo.[description|dev_name]`.
     */
    abstract get description(): string | undefined;
    /**
     * Cached value of `sysinfo.model`.
     */
    get model(): string;
    /**
     * Cached value of `sysinfo.alias`.
     */
    get name(): string;
    /**
     * Cached value of `sysinfo.[type|mic_type]`.
     */
    get type(): string;
    /**
     * Type of device (or `device` if unknown).
     *
     * Based on cached value of `sysinfo.[type|mic_type]`
     */
    get deviceType(): 'plug' | 'bulb' | 'device';
    /**
     * Cached value of `sysinfo.sw_ver`.
     */
    get softwareVersion(): string;
    /**
     * Cached value of `sysinfo.hw_ver`.
     */
    get hardwareVersion(): string;
    /**
     * Cached value of `sysinfo.[mac|mic_mac|ethernet_mac]`.
     */
    get mac(): string;
    /**
     * Normalized cached value of `sysinfo.[mac|mic_mac|ethernet_mac]`
     *
     * Removes all non alphanumeric characters and makes uppercase
     * `aa:bb:cc:00:11:22` will be normalized to `AABBCC001122`
     */
    get macNormalized(): string;
    /**
     * Closes any open network connections including any shared sockets.
     */
    closeConnection(): void;
    /**
     * Sends `payload` to device (using {@link Client#send})
     * @param   payload - payload to send to device, if object, converted to string via `JSON.stringify`
     * @returns parsed JSON response
     */
    send(payload: string | Record<string, unknown>, sendOptions?: SendOptions): Promise<string>;
    /**
     * @internal
     * @alpha
     */
    sendSingleCommand(moduleName: string, methodName: string, parameters: HasAtLeastOneProperty, childIds?: string[] | string | undefined, sendOptions?: SendOptions): Promise<HasErrCode>;
    /**
     * Sends command(s) to device.
     *
     * Calls {@link Device#send} and processes the response.
     *
     * - Adds context.child_ids:[] to the command.
     *   - If `childIds` parameter is set. _or_
     *   - If device was instantiated with a childId it will default to that value.
     *
     * - If only one operation was sent:
     *   - Promise fulfills with specific parsed JSON response for command.\
     *     Example: `{system:{get_sysinfo:{}}}`
     *     - resolves to: `{err_code:0,...}`\
     *     - instead of: `{system:{get_sysinfo:{err_code:0,...}}}` (as {@link Device#send} would)
     * - If more than one operation was sent:
     *   - Promise fulfills with full parsed JSON response (same as {@link Device#send})
     *
     * Also, the response's `err_code`(s) are checked, if any are missing or != `0` the Promise is rejected with {@link ResponseError}.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    sendCommand(command: string | Record<string, unknown>, childIds?: string[] | string | undefined, sendOptions?: SendOptions): Promise<unknown>;
    protected normalizeChildId(childId: string): string;
    /**
     * Gets device's SysInfo.
     *
     * Requests `system.sysinfo` from device. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getSysInfo(sendOptions?: SendOptions): Promise<Sysinfo>;
    /**
     * Change device's alias (name).
     *
     * Sends `system.set_dev_alias` command. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setAlias(alias: string, sendOptions?: SendOptions): Promise<boolean>;
    protected abstract setAliasProperty(alias: string): void;
    /**
     * Set device's location.
     *
     * Sends `system.set_dev_location` command. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setLocation(latitude: number, longitude: number, sendOptions?: SendOptions): Promise<Record<string, unknown>>;
    /**
     * Gets device's model.
     *
     * Requests `system.sysinfo` and returns model name. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getModel(sendOptions?: SendOptions): Promise<string>;
    /**
     * Reboot device.
     *
     * Sends `system.reboot` command. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    reboot(delay: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Reset device.
     *
     * Sends `system.reset` command. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    reset(delay: number, sendOptions?: SendOptions): Promise<unknown>;
    abstract getInfo(sendOptions?: SendOptions): Promise<Record<string, unknown>>;
}
export default Device;
//# sourceMappingURL=index.d.ts.map