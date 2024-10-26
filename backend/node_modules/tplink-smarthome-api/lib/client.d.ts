/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { RemoteInfo, Socket } from 'dgram';
import { EventEmitter } from 'events';
import type log from 'loglevel';
import type { MarkOptional } from 'ts-essentials';
import Bulb from './bulb';
import { type Sysinfo } from './device';
import { type Logger } from './logger';
import Plug from './plug';
export type AnyDevice = Bulb | Plug;
export type DeviceDiscovery = {
    status: string;
    seenOnDiscovery: number;
};
export type AnyDeviceDiscovery = (Bulb | Plug) & Partial<DeviceDiscovery>;
export type AnyDeviceOptionsConstructable = MarkOptional<ConstructorParameters<typeof Plug>[0], 'client' | 'sysInfo'> | MarkOptional<ConstructorParameters<typeof Bulb>[0], 'client' | 'sysInfo'>;
export type DeviceOptionsDiscovery = MarkOptional<ConstructorParameters<typeof Plug>[0], 'client' | 'sysInfo' | 'host'> | MarkOptional<ConstructorParameters<typeof Bulb>[0], 'client' | 'sysInfo' | 'host'>;
export type DiscoveryDevice = {
    host: string;
    port?: number;
};
export interface ClientConstructorOptions {
    /**
     * @defaultValue \{
     *   timeout: 10000,
     *   transport: 'tcp',
     *   useSharedSocket: false,
     *   sharedSocketTimeout: 20000
     * \}
     */
    defaultSendOptions?: SendOptions;
    /**
     * @defaultValue 'warn'
     */
    logLevel?: log.LogLevelDesc;
    logger?: Logger;
}
export interface DiscoveryOptions {
    /**
     * address to bind udp socket
     */
    address?: string;
    /**
     * port to bind udp socket
     */
    port?: number;
    /**
     * broadcast address
     * @defaultValue '255.255.255.255'
     */
    broadcast?: string;
    /**
     * Interval in (ms)
     * @defaultValue 10000
     */
    discoveryInterval?: number;
    /**
     * Timeout in (ms)
     * @defaultValue 0
     */
    discoveryTimeout?: number;
    /**
     * Number of consecutive missed replies to consider offline
     * @defaultValue 3
     */
    offlineTolerance?: number;
    deviceTypes?: Array<'plug' | 'bulb'>;
    /**
     * MAC will be normalized, comparison will be done after removing special characters (`:`,`-`, etc.) and case insensitive, glob style *, and ? in pattern are supported
     * @defaultValue []
     */
    macAddresses?: string[];
    /**
     * MAC will be normalized, comparison will be done after removing special characters (`:`,`-`, etc.) and case insensitive, glob style *, and ? in pattern are supported
     * @defaultValue []
     */
    excludeMacAddresses?: string[];
    /**
     * called with fn(sysInfo), return truthy value to include device
     */
    filterCallback?: (sysInfo: Sysinfo) => boolean;
    /**
     * if device has multiple outlets, create a separate plug for each outlet, otherwise create a plug for the main device
     * @defaultValue true
     */
    breakoutChildren?: boolean;
    /**
     * Set device port to the port it responded with to the discovery ping
     * @defaultValue false
     */
    devicesUseDiscoveryPort?: boolean;
    /**
     * passed to device constructors
     */
    deviceOptions?: DeviceOptionsDiscovery;
    /**
     * known devices to query instead of relying only on broadcast
     */
    devices?: DiscoveryDevice[];
}
/**
 * Send Options.
 *
 * @typeParam timeout - (ms)
 * @typeParam transport - 'tcp','udp'
 * @typeParam useSharedSocket - attempt to reuse a shared socket if available, UDP only
 * @typeParam sharedSocketTimeout - (ms) how long to wait for another send before closing a shared socket. 0 = never automatically close socket
 */
export type SendOptions = {
    timeout?: number;
    transport?: 'tcp' | 'udp';
    useSharedSocket?: boolean;
    sharedSocketTimeout?: number;
};
export interface ClientEvents {
    /**
     * First response from device.
     */
    'device-new': (device: Bulb | Plug) => void;
    /**
     * Follow up response from device.
     */
    'device-online': (device: Bulb | Plug) => void;
    /**
     * No response from device.
     */
    'device-offline': (device: Bulb | Plug) => void;
    /**
     * First response from Bulb.
     */
    'bulb-new': (device: Bulb) => void;
    /**
     * Follow up response from Bulb.
     */
    'bulb-online': (device: Bulb) => void;
    /**
     * No response from Bulb.
     */
    'bulb-offline': (device: Bulb) => void;
    /**
     * First response from Plug.
     */
    'plug-new': (device: Plug) => void;
    /**
     * Follow up response from Plug.
     */
    'plug-online': (device: Plug) => void;
    /**
     * No response from Plug.
     */
    'plug-offline': (device: Plug) => void;
    /**
     * Invalid/Unknown response from device.
     */
    'discovery-invalid': ({ rinfo, response, decryptedResponse, }: {
        rinfo: RemoteInfo;
        response: Buffer;
        decryptedResponse: Buffer;
    }) => void;
    /**
     * Error during discovery.
     */
    error: (error: Error) => void;
}
declare interface Client {
    on<U extends keyof ClientEvents>(event: U, listener: ClientEvents[U]): this;
    emit<U extends keyof ClientEvents>(event: U, ...args: Parameters<ClientEvents[U]>): boolean;
}
/**
 * Client that sends commands to specified devices or discover devices on the local subnet.
 * - Contains factory methods to create devices.
 * - Events are emitted after {@link Client#startDiscovery} is called.
 * @noInheritDoc
 */
declare class Client extends EventEmitter {
    defaultSendOptions: Required<SendOptions>;
    log: Logger;
    devices: Map<string, AnyDeviceDiscovery>;
    discoveryTimer: NodeJS.Timeout | null;
    discoveryPacketSequence: number;
    maxSocketId: number;
    socket?: Socket;
    isSocketBound: boolean;
    constructor(options?: ClientConstructorOptions);
    /**
     * Used by `tplink-connection`
     * @internal
     */
    getNextSocketId(): number;
    /**
     * {@link https://github.com/plasticrake/tplink-smarthome-crypto | Encrypts} `payload` and sends to device.
     * - If `payload` is not a string, it is `JSON.stringify`'d.
     * - Promise fulfills with encrypted string response.
     *
     * Devices use JSON to communicate.\
     * For Example:
     * - If a device receives:
     *   - `{"system":{"get_sysinfo":{}}}`
     * - It responds with:
     * ```
     *     {"system":{"get_sysinfo":{
     *       err_code: 0,
     *       sw_ver: "1.0.8 Build 151113 Rel.24658",
     *       hw_ver: "1.0",
     *       ...
     *     }}}
     * ```
     *
     * All responses from device contain an `err_code` (`0` is success).
     *
     * @returns decrypted string response
     */
    send(payload: Record<string, unknown> | string, host: string, port?: number, sendOptions?: SendOptions): Promise<string>;
    /**
     * Requests `{system:{get_sysinfo:{}}}` from device.
     *
     * @returns parsed JSON response
     * @throws {@link ResponseError}
     * @throws Error
     */
    getSysInfo(host: string, port?: number, sendOptions?: SendOptions): Promise<Sysinfo>;
    /**
     * Creates Bulb object.
     *
     * See [Device constructor]{@link Device} and [Bulb constructor]{@link Bulb} for valid options.
     * @param   deviceOptions - passed to [Bulb constructor]{@link Bulb}
     */
    getBulb(deviceOptions: MarkOptional<ConstructorParameters<typeof Bulb>[0], 'client'>): Bulb;
    /**
     * Creates {@link Plug} object.
     *
     * See [Device constructor]{@link Device} and [Plug constructor]{@link Plug} for valid options.
     * @param   deviceOptions - passed to [Plug constructor]{@link Plug}
     */
    getPlug(deviceOptions: MarkOptional<ConstructorParameters<typeof Plug>[0], 'client'>): Plug;
    /**
     * Creates a {@link Plug} or {@link Bulb} from passed in sysInfo or after querying device to determine type.
     *
     * See [Device constructor]{@link Device}, [Bulb constructor]{@link Bulb}, [Plug constructor]{@link Plug} for valid options.
     * @param   deviceOptions - passed to [Device constructor]{@link Device}
     * @throws {@link ResponseError}
     */
    getDevice(deviceOptions: AnyDeviceOptionsConstructable, sendOptions?: SendOptions): Promise<AnyDevice>;
    /**
     * Creates device corresponding to the provided `sysInfo`.
     *
     * See [Device constructor]{@link Device}, [Bulb constructor]{@link Bulb}, [Plug constructor]{@link Plug} for valid options
     * @param  deviceOptions - passed to device constructor
     * @throws Error
     */
    getDeviceFromSysInfo(sysInfo: Sysinfo, deviceOptions: AnyDeviceOptionsConstructable): AnyDevice;
    /**
     * Guess the device type from provided `sysInfo`.
     *
     * Based on sysinfo.[type|mic_type]
     */
    getTypeFromSysInfo(sysInfo: {
        type: string;
    } | {
        mic_type: string;
    }): 'plug' | 'bulb' | 'device';
    /**
     * Discover TP-Link Smarthome devices on the network.
     *
     * - Sends a discovery packet (via UDP) to the `broadcast` address every `discoveryInterval`(ms).
     * - Stops discovery after `discoveryTimeout`(ms) (if `0`, runs until {@link Client.stopDiscovery} is called).
     *   - If a device does not respond after `offlineTolerance` number of attempts, {@link ClientEvents.device-offline} is emitted.
     * - If `deviceTypes` are specified only matching devices are found.
     * - If `macAddresses` are specified only devices with matching MAC addresses are found.
     * - If `excludeMacAddresses` are specified devices with matching MAC addresses are excluded.
     * - if `filterCallback` is specified only devices where the callback returns a truthy value are found.
     * - If `devices` are specified it will attempt to contact them directly in addition to sending to the broadcast address.
     *   - `devices` are specified as an array of `[{host, [port: 9999]}]`.
     * @fires  Client#error
     * @fires  Client#device-new
     * @fires  Client#device-online
     * @fires  Client#device-offline
     * @fires  Client#bulb-new
     * @fires  Client#bulb-online
     * @fires  Client#bulb-offline
     * @fires  Client#plug-new
     * @fires  Client#plug-online
     * @fires  Client#plug-offline
     * @fires  Client#discovery-invalid
     */
    startDiscovery(options?: DiscoveryOptions): this;
    private static setSysInfoForDevice;
    private createOrUpdateDeviceFromSysInfo;
    /**
     * Stops discovery and closes UDP socket.
     */
    stopDiscovery(): void;
    private sendDiscovery;
}
export default Client;
//# sourceMappingURL=client.d.ts.map