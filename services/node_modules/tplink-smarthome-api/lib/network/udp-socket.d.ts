/// <reference types="node" />
import dgram from 'dgram';
import TplinkSocket from './tplink-socket';
/**
 * @hidden
 */
export default class UdpSocket extends TplinkSocket {
    readonly socketType = "UDP";
    socket?: dgram.Socket;
    logDebug(...args: any[]): void;
    createSocketImpl(): Promise<dgram.Socket>;
    close(): void;
    protected sendAndGetResponse(payload: string, port: number, host: string, timeout: number): Promise<string>;
}
//# sourceMappingURL=udp-socket.d.ts.map