/// <reference types="node" />
import { EventEmitter } from 'events';
import type Client from '../client';
import type { Logger } from '../logger';
import TcpSocket from './tcp-socket';
import UdpSocket from './udp-socket';
/**
 * @hidden
 */
export default abstract class TplinkConnection extends EventEmitter {
    host: string;
    port: number;
    readonly log: Logger;
    readonly client: Client;
    abstract readonly socketType: string;
    private queue;
    constructor(host: string, port: number, log: Logger, client: Client);
    protected get description(): string;
    protected abstract getSocket(useSharedSocket?: boolean): Promise<UdpSocket | TcpSocket>;
    send(payload: string, port: number, host: string, { timeout, useSharedSocket, sharedSocketTimeout, }: {
        timeout: number;
        useSharedSocket?: boolean;
        sharedSocketTimeout?: number;
    }): Promise<string>;
    close(): void;
}
//# sourceMappingURL=tplink-connection.d.ts.map