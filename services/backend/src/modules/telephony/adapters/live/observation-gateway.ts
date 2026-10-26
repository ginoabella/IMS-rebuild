import { createServer, type TLSSocket } from 'node:tls';
import { connect, type Socket } from 'node:net';
import { readFileSync } from 'node:fs';
/**
 * Native installation only. Asterisk AMI binds loopback plaintext behind this TLS
 * gateway. Existing observation needs the system permission class, which also
 * contains control actions; the gateway exposes only its five read-only actions.
 * No telephony owner can use its observation credential to bypass the epoch gate.
 */
export class ReadOnlyObservationGateway {
  private readonly sockets = new Set<TLSSocket | Socket>();
  private readonly server;
  constructor(certificateFile: string, keyFile: string) {
    this.server = createServer(
      {
        cert: readFileSync(certificateFile),
        key: readFileSync(keyFile),
        minVersion: 'TLSv1.2',
        handshakeTimeout: 2000,
      },
      (socket) => this.session(socket),
    );
    this.server.maxConnections = 8;
    this.server.on('tlsClientError', () => {});
  }
  private session(client: TLSSocket) {
    const upstream = connect({ host: '127.0.0.1', port: 5038 });
    this.sockets.add(client);
    this.sockets.add(upstream);
    let buffered = Buffer.alloc(0),
      frames = 0,
      window = Date.now(),
      outBytes = 0;
    const end = () => {
      client.destroy();
      upstream.destroy();
      this.sockets.delete(client);
      this.sockets.delete(upstream);
    };
    client.on('error', end);
    upstream.on('error', end);
    client.on('close', end);
    upstream.on('close', end);
    client.setTimeout(65000, end);
    upstream.setTimeout(65000, end);
    upstream.on('data', (bytes: Buffer) => {
      outBytes += bytes.length;
      if (outBytes > 2097152) {
        end();
        return;
      }
      if (!client.write(bytes)) {
        upstream.pause();
        client.once('drain', () => upstream.resume());
      }
    });
    client.on('data', (bytes: Buffer) => {
      if (Date.now() - window >= 1000) {
        window = Date.now();
        frames = 0;
        outBytes = 0;
      }
      buffered = Buffer.concat([buffered, bytes]);
      if (buffered.length > 16384) {
        end();
        return;
      }
      let at: number;
      while ((at = buffered.indexOf('\r\n\r\n')) >= 0) {
        if (++frames > 10) {
          end();
          return;
        }
        const text = buffered.subarray(0, at).toString('utf8');
        buffered = buffered.subarray(at + 4);
        const headers: Record<string, string> = {};
        let valid = true;
        for (const line of text.split('\r\n')) {
          const pos = line.indexOf(':');
          if (pos < 1) {
            valid = false;
            break;
          }
          const key = line.slice(0, pos).toLowerCase(),
            value = line.slice(pos + 1).trim();
          if (
            !/^[a-z][a-z0-9-]*$/.test(key) ||
            Object.hasOwn(headers, key) ||
            // eslint-disable-next-line no-control-regex -- protocol values exclude framing controls.
            /[\u0000-\u001f\u007f]/.test(value)
          ) {
            valid = false;
            break;
          }
          headers[key] = value;
        }
        if (!valid) {
          end();
          return;
        }
        const action = headers.action,
          id = headers.actionid;
        const login = action === 'Login';
        const permitted =
          [
            'Login',
            'Logoff',
            'Ping',
            'PJSIPShowEndpoints',
            'PJSIPShowContacts',
          ].includes(action ?? '') &&
          Object.keys(headers).every((k) =>
            (login
              ? ['action', 'actionid', 'username', 'secret', 'events']
              : ['action', 'actionid']
            ).includes(k),
          ) &&
          typeof id === 'string' &&
          /^[a-zA-Z0-9._:-]{1,80}$/.test(id);
        if (!permitted) {
          if (typeof id === 'string' && /^[a-zA-Z0-9._:-]{1,80}$/.test(id))
            client.write(
              `Response: Error\r\nActionID: ${id}\r\nMessage: Permission denied\r\n\r\n`,
            );
          else end();
          continue;
        }
        if (!upstream.write(text + '\r\n\r\n')) {
          client.pause();
          upstream.once('drain', () => client.resume());
        }
      }
    });
  }
  async start() {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(5039, '0.0.0.0', () => {
        this.server.off('error', reject);
        resolve();
      });
    });
  }
  async close() {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
