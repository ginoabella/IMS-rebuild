// Disposable loopback synthetic peers only. Never imported by runtime code.
import { createSocket } from 'node:dgram';
import { createHash, randomUUID } from 'node:crypto';
const hash = (value) => createHash('md5').update(value).digest('hex');
const fields = (text) =>
  new Map(
    [...text.matchAll(/([a-z]+)=(?:"([^"\r\n]*)"|([^,\s]+))/gi)].map(
      (entry) => [entry[1].toLowerCase(), entry[2] ?? entry[3]],
    ),
  );
export class SyntheticSipPeer {
  constructor(username, password, events, options = {}) {
    this.username = username;
    this.password = password;
    this.events = events;
    this.options = options;
    this.socket = createSocket('udp4');
    this.pending = new Map();
    this.nonce = randomUUID().replaceAll('-', '');
  }
  async start() {
    await new Promise((resolve, reject) => {
      this.socket.once('error', reject);
      this.socket.bind(0, '127.0.0.1', resolve);
    });
    this.port = this.socket.address().port;
    this.socket.on('message', (bytes, peer) =>
      this.receive(bytes.toString('utf8'), peer),
    );
    return this;
  }
  receive(text, peer) {
    if (
      peer.address !== '127.0.0.1' ||
      peer.port !== 5060 ||
      text.length > 16384
    )
      return;
    const header = (name) =>
      new RegExp(`^${name}: ([^\\r\\n]+)$`, 'im').exec(text)?.[1];
    const id = header('Call-ID');
    if (text.startsWith('SIP/2.0 ')) {
      const pending = this.pending.get(id);
      if (pending && !text.startsWith('SIP/2.0 100 ')) pending(text);
      return;
    }
    const method = text.split(' ')[0];
    if (method === 'ACK') return;
    let code = method === 'INVITE' ? 486 : 200,
      extra = [];
    const uri = text.split(' ')[1];
    if (method === 'INVITE' && this.options.digest) {
      const authorization = header('Authorization');
      if (!authorization) {
        code = 401;
        extra = [
          `WWW-Authenticate: Digest realm="synthetic.invalid",nonce="${this.nonce}",algorithm=MD5,qop="auth"`,
        ];
      } else {
        const data = fields(authorization);
        const response = hash(
          `${hash(`${this.username}:synthetic.invalid:${this.password}`)}:${this.nonce}:${data.get('nc')}:${data.get('cnonce')}:auth:${hash(`INVITE:${uri}`)}`,
        );
        if (
          data.get('username') !== this.username ||
          data.get('nonce') !== this.nonce ||
          data.get('uri') !== uri ||
          data.get('response') !== response
        ) {
          code = 403;
          this.events.push({ kind: 'invalid_digest' });
        }
      }
    }
    if (method === 'INVITE' && code === 486)
      this.events.push({
        kind: 'invite',
        peer: this.username,
        number: /^sip:([^@;]+)/.exec(uri)?.[1],
        authenticated: !!this.options.digest,
        time: Date.now(),
      });
    const response = [
      `SIP/2.0 ${code} ${code === 486 ? 'Busy Here' : code === 401 ? 'Unauthorized' : code === 403 ? 'Forbidden' : 'OK'}`,
      ...['Via', 'From', 'To', 'Call-ID', 'CSeq'].map(
        (name) =>
          `${name}: ${header(name)}${name === 'To' && !header(name).includes(';tag=') ? ';tag=fixture' : ''}`,
      ),
      ...extra,
      'Content-Length: 0',
      '',
      '',
    ].join('\r\n');
    setTimeout(
      () => this.socket.send(Buffer.from(response), peer.port, peer.address),
      this.options.delay ?? 0,
    );
  }
  async register(expires = 60) {
    const id = randomUUID(),
      uri = 'sip:127.0.0.1',
      tag = randomUUID().replaceAll('-', '');
    const send = (sequence, authorization) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error('Synthetic registration deadline'));
        }, 2000);
        this.pending.set(id, (text) => {
          clearTimeout(timeout);
          this.pending.delete(id);
          resolve(text);
        });
        const data = [
          `REGISTER ${uri} SIP/2.0`,
          `Via: SIP/2.0/UDP 127.0.0.1:${this.port};branch=z9hG4bK${randomUUID().replaceAll('-', '')};rport`,
          `From: <sip:${this.username}@127.0.0.1>;tag=${tag}`,
          `To: <sip:${this.options.aor ?? this.username}@127.0.0.1>`,
          `Call-ID: ${id}`,
          `CSeq: ${sequence} REGISTER`,
          `Contact: <sip:${this.username}@127.0.0.1:${this.port}>`,
          `Expires: ${expires}`,
          'Max-Forwards: 1',
          ...(authorization ? [authorization] : []),
          'Content-Length: 0',
          '',
          '',
        ].join('\r\n');
        this.socket.send(Buffer.from(data), 5060, '127.0.0.1');
      });
    const first = await send(1);
    if (!first.startsWith('SIP/2.0 401 '))
      throw new Error('Synthetic registration did not challenge');
    const data = fields(
      /^WWW-Authenticate: Digest ([^\r\n]+)/im.exec(first)?.[1] ?? '',
    );
    const cnonce = randomUUID().replaceAll('-', ''),
      nc = '00000001';
    const response = hash(
      `${hash(`${this.username}:${data.get('realm')}:${this.password}`)}:${data.get('nonce')}:${nc}:${cnonce}:auth:${hash(`REGISTER:${uri}`)}`,
    );
    const authorization = `Authorization: Digest username="${this.username}",realm="${data.get('realm')}",nonce="${data.get('nonce')}",uri="${uri}",response="${response}",algorithm=MD5,qop=auth,nc=${nc},cnonce="${cnonce}"${data.has('opaque') ? `,opaque="${data.get('opaque')}"` : ''}`;
    const result = await send(2, authorization);
    if (!result.startsWith('SIP/2.0 200 '))
      throw new Error(
        'Synthetic registration rejected: ' + result.split('\r\n')[0],
      );
  }
  close() {
    this.socket.close();
  }
}
