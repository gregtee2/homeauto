import type { SendOptions } from '../client';
import type Bulb from './index';
export interface LightState {
    /**
     * (ms)
     */
    transition_period?: number;
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
export interface LightStripLightState {
    /**
     * (ms)
     */
    transition: number;
    length: number;
    on_off: 0 | 1;
    mode: string;
    /**
     * Start Index (inclusive), End Index (inclusive), Hue, Saturation, Brightness, Color Temp (Kelvin)
     */
    groups: Array<[number, number, number, number, number, number]>;
}
export interface LightStateInput extends LightState {
    /**
     * @defaultValue 1
     */
    ignore_default?: 0 | 1;
}
export type LightStateResponse = LightState & {
    err_code: number;
};
export declare function isLightState(candidate: unknown): candidate is LightState;
export declare function isLightStateResponse(candidate: unknown): candidate is LightStateResponse;
export default class Lighting {
    #private;
    private readonly device;
    private readonly apiModuleName;
    private readonly setLightStateMethodName;
    /**
     * @internal
     */
    lastState: {
        powerOn?: boolean;
        lightState?: LightState;
    };
    constructor(device: Bulb, apiModuleName: string, setLightStateMethodName: string);
    /**
     * Returns cached results from last retrieval of `lightingservice.get_light_state`.
     * @returns cached results from last retrieval of `lightingservice.get_light_state`.
     */
    get lightState(): LightState;
    /**
     * @internal
     */
    set lightState(lightState: LightState);
    private emitEvents;
    /**
     * Get Bulb light state.
     *
     * Requests `lightingservice.get_light_state`.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getLightState(sendOptions?: SendOptions): Promise<LightState>;
    /**
     * Sets Bulb light state (on/off, brightness, color, etc).
     *
     * Sends `lightingservice.transition_light_state` command.
     * @param  lightState - light state
     * @param  sendOptions - send options
     */
    setLightState(lightState: LightStateInput, sendOptions?: SendOptions): Promise<true>;
    /**
     * Get Bulb light details.
     *
     * Requests `lightingservice.get_light_details`.
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     */
    getLightDetails(sendOptions?: SendOptions): Promise<unknown>;
}
//# sourceMappingURL=lighting.d.ts.map