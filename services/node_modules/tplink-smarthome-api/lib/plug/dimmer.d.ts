import type { SendOptions } from '../client';
import type Plug from './index';
export interface DimmerTransitionInput {
    /**
     * 0-100
     */
    brightness?: number;
    /**
     * "gentle_on_off", etc.
     */
    mode?: string;
    /**
     * duration in seconds
     */
    duration?: number;
}
export interface DimmerActionInput {
    mode?: string;
    index?: number;
}
/**
 * Dimmer
 *
 * TP-Link models: HS220.
 */
export default class Dimmer {
    #private;
    readonly device: Plug;
    readonly apiModuleName: string;
    /**
     * @internal
     */
    lastState: {
        brightness: number;
    };
    constructor(device: Plug, apiModuleName: string);
    /**
     * Cached value of `sysinfo.brightness`.
     */
    get brightness(): number;
    /**
     * @internal
     */
    setBrightnessValue(brightness: number): void;
    /**
     * Sets Plug to the specified `brightness`.
     *
     * Sends `dimmer.set_brightness` command. Does not support childId.
     * @param   brightness - 0-100
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setBrightness(brightness: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Get Plug/Dimmer default behavior configuration.
     *
     * Requests `dimmer.get_default_behavior`. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getDefaultBehavior(sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Get Plug/Dimmer parameters configuration.
     *
     * Requests `dimmer.get_dimmer_parameters`. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getDimmerParameters(sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Transitions Plug to the specified `brightness`.
     *
     * Sends `dimmer.set_dimmer_transition` command. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setDimmerTransition(dimmerTransition: DimmerTransitionInput, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Set Plug/Dimmer `default_behavior` configuration for `double_click`.
     *
     * Sends `dimmer.set_double_click_action`. Does not support childId.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setDoubleClickAction({ mode, index }: DimmerActionInput, sendOptions?: SendOptions): Promise<unknown>;
    private setAction;
    /**
     * Set Plug `dimmer_parameters` for `fadeOffTime`.
     *
     * Sends `dimmer.set_fade_off_time`. Does not support childId.
     * @param   fadeTime - duration in ms
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setFadeOffTime(fadeTime: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Set Plug `dimmer_parameters` for `fadeOnTime`.
     *
     * Sends `dimmer.set_fade_on_time`. Does not support childId.
     * @param   fadeTime - duration in ms
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setFadeOnTime(fadeTime: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Set Plug `dimmer_parameters` for `gentleOffTime`.
     *
     * Sends `dimmer.set_gentle_off_time`. Does not support childId.
     * @param   duration - duration in ms
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setGentleOffTime(duration: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Set Plug `dimmer_parameters` for `gentleOnTime`.
     *
     * Sends `dimmer.set_gentle_on_time`. Does not support childId.
     * @param   duration - duration in ms
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setGentleOnTime(duration: number, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Set Plug/Dimmer `default_behavior` configuration for `long_press`.
     *
     * Sends `dimmer.set_long_press_action`. Does not support childId.
     * @param   options
     * @param   options.mode
     * @param   options.index
     * @param   sendOptions
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setLongPressAction({ mode, index }: DimmerActionInput, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * Sets Plug to the specified on/off state.
     *
     * Sends `dimmer.set_switch_state` command. Does not support childId.
     * @param  {Boolean}     state  true=on, false=off
     * @param  {SendOptions} [sendOptions]
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    setSwitchState(state: boolean | 0 | 1, sendOptions?: SendOptions): Promise<unknown>;
    /**
     * @internal
     */
    emitEvents(): void;
}
//# sourceMappingURL=dimmer.d.ts.map