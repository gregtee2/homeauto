/// <reference types="node" />
import net from 'net';
import TplinkSocket from './tplink-socket';
/**
 * @hidden
 */
export default class TcpSocket extends TplinkSocket {
    readonly socketType = "TCP";
    socket?: net.Socket;
    logDebug(...args: any[]): void;
    protected createSocketImpl(): Promise<net.Socket>;
    close(): void;
    private destroy;
    protected sendAndGetResponse(payload: string, port: number, host: string, timeout: number): Promise<string>;
}
//# sourceMappingURL=tcp-socket.d.ts.map