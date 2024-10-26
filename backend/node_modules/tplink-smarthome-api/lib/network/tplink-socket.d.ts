/// <reference types="node" />
/// <reference types="node" />
import Queue from 'promise-queue';
import dgram from 'dgram';
import net from 'net';
import type { Logger } from '../logger';
/**
 * @hidden
 */
export default abstract class TplinkSocket {
    readonly socketId: number;
    readonly log: Logger;
    abstract socketType: string;
    abstract socket?: dgram.Socket | net.Socket;
    isBound: boolean;
    queue: Queue;
    constructor(socketId: number, log: Logger);
    protected abstract createSocketImpl(): Promise<dgram.Socket | net.Socket>;
    createSocket(): Promise<dgram.Socket | net.Socket>;
    protected abstract sendAndGetResponse(payload: string, port: number, host: string, timeout: number): Promise<string>;
    send(payload: string, port: number, host: string, { timeout }: {
        timeout: number;
    }): Promise<string>;
    close(): void;
    unref(): dgram.Socket | net.Socket;
}
//# sourceMappingURL=tplink-socket.d.ts.map