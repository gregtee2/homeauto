import TplinkConnection from './tplink-connection';
import UdpSocket from './udp-socket';
/**
 * @hidden
 */
export default class UdpConnection extends TplinkConnection {
    protected sharedSocket?: UdpSocket;
    readonly socketType = "UDP";
    private timeout?;
    protected getSocket(useSharedSocket: boolean): Promise<UdpSocket>;
    private setTimeout;
    send(payload: string, port: number, host: string, { timeout, useSharedSocket, sharedSocketTimeout, }: {
        timeout: number;
        useSharedSocket: boolean;
        sharedSocketTimeout: number;
    }): Promise<string>;
    close(): void;
}
//# sourceMappingURL=udp-connection.d.ts.map