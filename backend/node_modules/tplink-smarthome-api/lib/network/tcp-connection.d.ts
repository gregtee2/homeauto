import TplinkConnection from './tplink-connection';
import TcpSocket from './tcp-socket';
/**
 * @hidden
 */
export default class TcpConnection extends TplinkConnection {
    readonly socketType = "TCP";
    protected getSocket(): Promise<TcpSocket>;
    send(payload: string, port: number, host: string, { timeout }: {
        timeout: number;
    }): Promise<string>;
}
//# sourceMappingURL=tcp-connection.d.ts.map