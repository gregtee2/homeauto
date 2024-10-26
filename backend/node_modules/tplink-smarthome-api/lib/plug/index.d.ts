import type { SendOptions } from '../client';
import Device, { type CommonSysinfo, type DeviceConstructorOptions, type Sysinfo } from '../device';
import Cloud from '../shared/cloud';
import Emeter, { RealtimeNormalized } from '../shared/emeter';
import Time from '../shared/time';
import Away from './away';
import Dimmer from './dimmer';
import Schedule from './schedule';
import Timer from './timer';
export type PlugChild = {
    id: string;
    alias: string;
    state: number;
};
export type SysinfoChildren = {
    children?: [{
        id: string;
        alias: string;
        state: number;
    }];
};
export type PlugSysinfo = CommonSysinfo & SysinfoChildren & ({
    type: 'IOT.SMARTPLUGSWITCH' | 'IOT.RANGEEXTENDER.SMARTPLUG';
} | {
    mic_type: 'IOT.SMARTPLUGSWITCH';
}) & ({
    mac: string;
} | {
    ethernet_mac: string;
}) & {
    feature: string;
    led_off: 0 | 1;
    relay_state?: 0 | 1;
    dev_name?: string;
    brightness?: number;
};
export declare function hasSysinfoChildren(candidate: Sysinfo): candidate is Sysinfo & Required<SysinfoChildren>;
export interface PlugConstructorOptions extends DeviceConstructorOptions {
    sysInfo: PlugSysinfo;
    /**
     * Watts
     * @defaultValue 0.1
     */
    inUseThreshold?: number;
    /**
     * If passed a string between 0 and 99 it will prepend the deviceId
     */
    childId?: string;
}
export interface PlugEvents {
    /**
     * Plug's Energy Monitoring Details were updated from device. Fired regardless if status was changed.
     * @event Plug#emeter-realtime-update
     */
    'emeter-realtime-update': (value: RealtimeNormalized) => void;
    /**
     * Plug's relay was turned on.
     */
    'power-on': () => void;
    /**
     * Plug's relay was turned off.
     */
    'power-off': () => void;
    /**
     * Plug's relay state was updated from device. Fired regardless if status was changed.
     */
    'power-update': (value: boolean) => void;
    /**
     * Plug's relay was turned on _or_ power draw exceeded `inUseThreshold`
     */
    'in-use': () => void;
    /**
     * Plug's relay was turned off _or_ power draw fell below `inUseThreshold`
     */
    'not-in-use': () => void;
    /**
     * Plug's in-use state was updated from device. Fired regardless if status was changed.
     */
    'in-use-update': (value: boolean) => void;
    'brightness-change': (value: number) => void;
    'brightness-update': (value: number) => void;
}
declare interface Plug {
    on<U extends keyof PlugEvents>(event: U, listener: PlugEvents[U]): this;
    emit<U extends keyof PlugEvents>(event: U, ...args: Parameters<PlugEvents[U]>): boolean;
}
/**
 * Plug Device.
 *
 * TP-Link models: HS100, HS105, HS107, HS110, HS200, HS210, HS220, HS300.
 *
 * Models with multiple outlets (HS107, HS300) will have a children property.
 * If Plug is instantiated with a childId it will control the outlet associated with that childId.
 * Some functions only apply to the entire device, and are noted below.
 *
 * Emits events after device status is queried, such as {@link Plug#getSysInfo} and {@link Plug#emeter.getRealtime}.
 * @extends Device
 * @extends EventEmitter
 * @fires  Plug#power-on
 * @fires  Plug#power-off
 * @fires  Plug#power-update
 * @fires  Plug#in-use
 * @fires  Plug#not-in-use
 * @fires  Plug#in-use-update
 * @fires  Plug#emeter-realtime-update
 */
declare class Plug extends Device {
    #private;
    protected _sysInfo: PlugSysinfo;
    inUseThreshold: number;
    emitEventsEnabled: boolean;
    /**
     * @internal
     */
    lastState: {
        inUse: boolean;
        relayState: boolean;
    };
    readonly apiModules: {
        system: string;
        cloud: string;
        schedule: string;
        timesetting: string;
        emeter: string;
        netif: string;
        lightingservice: string;
    };
    away: Away;
    cloud: Cloud;
    dimmer: Dimmer;
    emeter: Emeter;
    schedule: Schedule;
    time: Time;
    timer: Timer;
    /**
     * Created by {@link Client} - Do not instantiate directly.
     *
     * See [Device constructor]{@link Device} for common options.
     */
    constructor(options: PlugConstructorOptions);
    get sysInfo(): PlugSysinfo;
    /**
     * @internal
     */
    setSysInfo(sysInfo: PlugSysinfo): void;
    /**
     * Returns children as a map keyed by childId. From cached results from last retrieval of `system.sysinfo.children`.
     */
    get children(): Map<string, PlugChild>;
    private setChildren;
    /**
     * Returns childId.
     */
    get childId(): string | undefined;
    private setChildId;
    /**
     * Cached value of `sysinfo.alias` or `sysinfo.children[childId].alias` if childId set.
     */
    get alias(): string;
    protected setAliasProperty(alias: string): void;
    /**
     * Cached value of `sysinfo.dev_name`.
     */
    get description(): string | undefined;
    get deviceType(): 'plug';
    /**
     * Cached value of `sysinfo.deviceId` or `childId` if set.
     */
    get id(): string;
    /**
     * Determines if device is in use based on cached `emeter.get_realtime` results.
     *
     * If device supports energy monitoring (e.g. HS110): `power > inUseThreshold`. `inUseThreshold` is specified in Watts
     *
     * Otherwise fallback on relay state: `relay_state === 1` or `sysinfo.children[childId].state === 1`.
     *
     * Supports childId.
     */
    get inUse(): boolean;
    /**
     * Cached value of `sysinfo.relay_state === 1` or `sysinfo.children[childId].state === 1`.
     * Supports childId.
     * If device supports childId, but childId is not set, then it will return true if any child has `state === 1`.
     * @returns On (true) or Off (false)
     */
    get relayState(): boolean;
    protected setRelayState(relayState: boolean): void;
    /**
     * True if cached value of `sysinfo` has `brightness` property.
     * @returns `true` if cached value of `sysinfo` has `brightness` property.
     */
    get supportsDimmer(): boolean;
    /**
     * True if cached value of `sysinfo` has `feature` property that contains 'ENE'.
     * @returns `true` if cached value of `sysinfo` has `feature` property that contains 'ENE'
     */
    get supportsEmeter(): boolean;
    /**
     * Gets plug's SysInfo.
     *
     * Requests `system.sysinfo` from device. Does not support childId.
  
     */
    getSysInfo(sendOptions?: SendOptions): Promise<PlugSysinfo>;
    /**
     * Requests common Plug status details in a single request.
     * - `system.get_sysinfo`
     * - `cloud.get_sysinfo`
     * - `emeter.get_realtime`
     * - `schedule.get_next_action`
     *
     * This command is likely to fail on some devices when using UDP transport.
     * This defaults to TCP transport unless overridden in sendOptions.
     *
     * Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getInfo(sendOptions?: SendOptions): Promise<{
        sysInfo: Record<string, unknown>;
        cloud: {
            info: Record<string, unknown>;
        };
        emeter: {
            realtime: Record<string, unknown>;
        };
        schedule: {
            nextAction: Record<string, unknown>;
        };
    }>;
    /**
     * Same as {@link Plug#inUse}, but requests current `emeter.get_realtime`. Supports childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getInUse(sendOptions?: SendOptions): Promise<boolean>;
    /**
     * Get Plug LED state (night mode).
     *
     * Requests `system.sysinfo` and returns true if `led_off === 0`. Does not support childId.
     * @param  {SendOptions} [sendOptions]
     * @returns LED State, true === on
     * @throws {@link ResponseError}
     */
    getLedState(sendOptions?: SendOptions): Promise<boolean>;
    /**
     * Turn Plug LED on/off (night mode). Does not support childId.
     *
     * Sends `system.set_led_off` command.
     * @param   value - LED State, true === on
     * @throws {@link ResponseError}
     */
    setLedState(value: boolean, sendOptions?: SendOptions): Promise<true>;
    /**
     * Get Plug relay state (on/off).
     *
     * Requests `system.get_sysinfo` and returns true if On. Calls {@link Plug#relayState}. Supports childId.
     * @throws {@link ResponseError}
     */
    getPowerState(sendOptions?: SendOptions): Promise<boolean>;
    /**
     * Turns Plug relay on/off.
     *
     * Sends `system.set_relay_state` command. Supports childId.
     * @throws {@link ResponseError}
     */
    setPowerState(value: boolean, sendOptions?: SendOptions): Promise<true>;
    /**
     * Toggles Plug relay state.
     *
     * Requests `system.get_sysinfo` sets the power state to the opposite `relay_state === 1 and returns the new power state`. Supports childId.
     * @throws {@link ResponseError}
     */
    togglePowerState(sendOptions?: SendOptions): Promise<boolean>;
    /**
     * Blink Plug LED.
     *
     * Sends `system.set_led_off` command alternating on and off number of `times` at `rate`,
     * then sets the led to its pre-blink state. Does not support childId.
     *
     * Note: `system.set_led_off` is particularly slow, so blink rate is not guaranteed.
     * @throws {@link ResponseError}
     */
    blink(times?: number, rate?: number, sendOptions?: SendOptions): Promise<boolean>;
    private emitEvents;
}
export default Plug;
//# sourceMappingURL=index.d.ts.map