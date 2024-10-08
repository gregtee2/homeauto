import type { SendOptions } from '../client';
import Device, { type CommonSysinfo, type DeviceConstructorOptions } from '../device';
import Cloud from '../shared/cloud';
import type { RealtimeNormalized } from '../shared/emeter';
import Emeter from '../shared/emeter';
import Time from '../shared/time';
import Lighting, { type LightState } from './lighting';
import Schedule from './schedule';
export interface BulbSysinfoLightState {
    /**
     * (ms)
     */
    transition_period?: number;
    /**
     * (ms)
     */
    transition?: number;
    on_off?: 0 | 1;
    mode?: string;
    /**
     * 0-360
     */
    hue?: number;
    /**
     * 0-100
     */
    saturation?: number;
    /**
     * 0-100
     */
    brightness?: number;
    /**
     * Kelvin
     */
    color_temp?: number;
    ignore_default?: 0 | 1;
    dft_on_state?: {
        mode?: string;
        hue?: number;
        saturation?: number;
        color_temp?: number;
        brightness?: number;
    };
}
export type BulbSysinfo = CommonSysinfo & {
    mic_type: string;
    mic_mac: string;
    description: string;
    light_state: BulbSysinfoLightState;
    is_dimmable: 0 | 1;
    is_color: 0 | 1;
    is_variable_color_temp: 0 | 1;
    length?: number;
};
export interface BulbConstructorOptions extends DeviceConstructorOptions {
    sysInfo: BulbSysinfo;
}
export interface BulbEvents {
    'emeter-realtime-update': (value: RealtimeNormalized) => void;
    /**
     * Bulb was turned on (`lightstate.on_off`).
     * @event Bulb#lightstate-on
     * @property {LightState} value lightstate
     */
    'lightstate-on': (value: LightState) => void;
    /**
     * Bulb was turned off (`lightstate.on_off`).
     * @event Bulb#lightstate-off
     * @property {LightState} value lightstate
     */
    'lightstate-off': (value: LightState) => void;
    /**
     * Bulb's lightstate was changed.
     * @event Bulb#lightstate-change
     * @property {LightState} value lightstate
     */
    'lightstate-change': (value: LightState) => void;
    /**
     * Bulb's lightstate was updated from device. Fired regardless if status was changed.
     * @event Bulb#lightstate-update
     * @property {LightState} value lightstate
     */
    'lightstate-update': (value: LightState) => void;
    /**
     * Bulb was turned on (`sysinfo.light_state.on_off`).
     * @event Bulb#lightstate-sysinfo-on
     * @property {BulbSysinfoLightState} value BulbSysinfoLightState
     */
    'lightstate-sysinfo-on': (value: BulbSysinfoLightState) => void;
    /**
     * Bulb was turned off (`sysinfo.light_state.on_off`).
     * @event Bulb#lightstate-sysinfo-off
     * @property {BulbSysinfoLightState} value BulbSysinfoLightState
     */
    'lightstate-sysinfo-off': (value: BulbSysinfoLightState) => void;
    /**
     * Bulb's lightstate (`sysinfo.light_state`) was changed.
     * @event Bulb#lightstate-sysinfo-change
     * @property {BulbSysinfoLightState} value BulbSysinfoLightState
     */
    'lightstate-sysinfo-change': (value: BulbSysinfoLightState) => void;
    /**
     * Bulb's lightstate (`sysinfo.light_state`) was updated from device. Fired regardless if status was changed.
     * @event Bulb#lightstate-sysinfo-update
     * @property {BulbSysinfoLightState} value BulbSysinfoLightState
     */
    'lightstate-sysinfo-update': (value: BulbSysinfoLightState) => void;
}
declare interface Bulb {
    on<U extends keyof BulbEvents>(event: U, listener: BulbEvents[U]): this;
    emit<U extends keyof BulbEvents>(event: U, ...args: Parameters<BulbEvents[U]>): boolean;
}
/**
 * Bulb Device.
 *
 * @fires  Bulb#emeter-realtime-update
 * @fires  Bulb#lightstate-on
 * @fires  Bulb#lightstate-off
 * @fires  Bulb#lightstate-change
 * @fires  Bulb#lightstate-update
 * @fires  Bulb#lightstate-sysinfo-on
 * @fires  Bulb#lightstate-sysinfo-off
 * @fires  Bulb#lightstate-sysinfo-change
 * @fires  Bulb#lightstate-sysinfo-update
 */
declare class Bulb extends Device {
    emitEventsEnabled: boolean;
    protected _sysInfo: BulbSysinfo;
    /**
     * @internal
     */
    lastState: {
        powerOn: boolean;
        sysinfoLightState: {};
    };
    readonly supportsEmeter = true;
    readonly apiModules: {
        system: string;
        cloud: string;
        schedule: string;
        timesetting: string;
        emeter: string;
        netif: string;
        lightingservice: string;
    };
    /**
     * @borrows Cloud#getInfo as Bulb.cloud#getInfo
     * @borrows Cloud#bind as Bulb.cloud#bind
     * @borrows Cloud#unbind as Bulb.cloud#unbind
     * @borrows Cloud#getFirmwareList as Bulb.cloud#getFirmwareList
     * @borrows Cloud#setServerUrl as Bulb.cloud#setServerUrl
     */
    readonly cloud: Cloud;
    /**
     * @borrows Emeter#realtime as Bulb.emeter#realtime
     * @borrows Emeter#getRealtime as Bulb.emeter#getRealtime
     * @borrows Emeter#getDayStats as Bulb.emeter#getDayStats
     * @borrows Emeter#getMonthStats as Bulb.emeter#getMonthStats
     * @borrows Emeter#eraseStats as Bulb.emeter#eraseStats
     */
    readonly emeter: Emeter;
    /**
     * @borrows Lighting#lightState as Bulb.lighting#lightState
     * @borrows Lighting#getLightState as Bulb.lighting#getLightState
     * @borrows Lighting#setLightState as Bulb.lighting#setLightState
     */
    readonly lighting: Lighting;
    /**
     * @borrows Schedule#getNextAction as Bulb.schedule#getNextAction
     * @borrows Schedule#getRules as Bulb.schedule#getRules
     * @borrows Schedule#getRule as Bulb.schedule#getRule
     * @borrows BulbSchedule#addRule as Bulb.schedule#addRule
     * @borrows BulbSchedule#editRule as Bulb.schedule#editRule
     * @borrows Schedule#deleteAllRules as Bulb.schedule#deleteAllRules
     * @borrows Schedule#deleteRule as Bulb.schedule#deleteRule
     * @borrows Schedule#setOverallEnable as Bulb.schedule#setOverallEnable
     * @borrows Schedule#getDayStats as Bulb.schedule#getDayStats
     * @borrows Schedule#getMonthStats as Bulb.schedule#getMonthStats
     * @borrows Schedule#eraseStats as Bulb.schedule#eraseStats
     */
    readonly schedule: Schedule;
    /**
     * @borrows Time#getTime as Bulb.time#getTime
     * @borrows Time#getTimezone as Bulb.time#getTimezone
     */
    readonly time: Time;
    /**
     * Created by {@link Client} - Do not instantiate directly.
     *
     * See [Device constructor]{@link Device} for common options.
     * @see Device
     * @param options -
     */
    constructor(options: BulbConstructorOptions);
    /**
     * Returns cached results from last retrieval of `system.sysinfo`.
     * @returns system.sysinfo
     */
    get sysInfo(): BulbSysinfo;
    /**
     * @internal
     */
    setSysInfo(sysInfo: BulbSysinfo): void;
    protected setAliasProperty(alias: string): void;
    /**
     * Cached value of `sysinfo.[description|dev_name]`.
     */
    get description(): string | undefined;
    get deviceType(): 'bulb';
    /**
     * Cached value of `sysinfo.is_dimmable === 1`
     * @returns Cached value of `sysinfo.is_dimmable === 1`
     */
    get supportsBrightness(): boolean;
    /**
     * Cached value of `sysinfo.is_color === 1`
     * @returns Cached value of `sysinfo.is_color === 1`
     */
    get supportsColor(): boolean;
    /**
     * Cached value of `sysinfo.is_variable_color_temp === 1`
     * @returns Cached value of `sysinfo.is_variable_color_temp === 1`
     */
    get supportsColorTemperature(): boolean;
    /**
     * Returns array with min and max supported color temperatures
     * @returns range in kelvin `{min,max}` or `null` if not supported
     */
    get colorTemperatureRange(): {
        min: number;
        max: number;
    } | null;
    /**
     * Gets bulb's SysInfo.
     *
     * Requests `system.sysinfo` from device.
     * @returns parsed JSON response
     */
    getSysInfo(sendOptions?: SendOptions): Promise<BulbSysinfo>;
    /**
     * Requests common Bulb status details in a single request.
     * - `system.get_sysinfo`
     * - `cloud.get_sysinfo`
     * - `emeter.get_realtime`
     * - `schedule.get_next_action`
     *
     * This command is likely to fail on some devices when using UDP transport.
     * This defaults to TCP transport unless overridden in sendOptions.
     *
     * @returns parsed JSON response
     */
    getInfo(sendOptions?: SendOptions): Promise<Record<string, unknown>>;
    /**
     * Gets on/off state of Bulb.
     *
     * Requests `lightingservice.get_light_state` and returns true if `on_off === 1`.
     * @throws {@link ResponseError}
     */
    getPowerState(sendOptions?: SendOptions): Promise<boolean>;
    /**
     * Sets on/off state of Bulb.
     *
     * Sends `lightingservice.transition_light_state` command with on_off `value`.
     * @param  value - true: on, false: off
     * @throws {@link ResponseError}
     */
    setPowerState(value: boolean, sendOptions?: SendOptions): Promise<boolean>;
    /**
     * Toggles state of Bulb.
     *
     * Requests `lightingservice.get_light_state` sets the power state to the opposite of `on_off === 1` and returns the new power state.
     * @throws {@link ResponseError}
     */
    togglePowerState(sendOptions?: SendOptions): Promise<boolean>;
    /**
     * Blink Bulb.
     *
     * Sends `system.lighting.set_light_state` command alternating on at full brightness and off number of `times` at `rate`,
     * then sets the light state to its pre-blink state.
     * @throws {@link ResponseError}
     */
    blink(times?: number, rate?: number, sendOptions?: SendOptions): Promise<boolean>;
    private emitEvents;
}
export default Bulb;
//# sourceMappingURL=index.d.ts.map