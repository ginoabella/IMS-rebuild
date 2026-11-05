import { networkInterfaces } from 'node:os';
import { createSocket, type Socket } from 'node:dgram';
import { createHash, randomUUID } from 'node:crypto';
export interface ControlledSipResult {
  outcome: 'permitted' | 'denied' | 'unknown';
  destinationObserved: boolean;
  mediaObserved: boolean;
  sipStatus: number | null;
}
const md5 = (v: string) => createHash('md5').update(v).digest('hex');
interface Message {
  start: string;
  headers: Map<string, string>;
  body: string;
}
function parse(bytes: Buffer): Message | null {
  if (bytes.length > 16384) return null;
  const [head, ...body] = bytes.toString('utf8').split('\r\n\r\n');
  if (!head) return null;
  const [start, ...lines] = head.split('\r\n');
  const headers = new Map<string, string>();
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 1) return null;
    const key = line.slice(0, colon).toLowerCase();
    if (headers.has(key)) return null;
    headers.set(key, line.slice(colon + 1).trim());
  }
  return { start: start!, headers, body: body.join('\r\n\r\n') };
}
async function bind(socket: Socket, address: string) {
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(0, address, resolve);
  });
  return socket.address().port;
}
const sdp = (address: string, port: number) =>
  `v=0\r\no=myims 1 1 IN IP4 ${address}\r\ns=Controlled verification\r\nc=IN IP4 ${address}\r\nt=0 0\r\nm=audio ${port} RTP/AVP 0\r\na=rtpmap:0 PCMU/8000\r\na=sendrecv\r\n`;
function mediaTarget(body: string) {
  const host = /^c=IN IP4 ([0-9.]{7,15})\r?$/m.exec(body)?.[1];
  const localAddresses = new Set(
    Object.values(networkInterfaces())
      .flatMap((entries) => entries ?? [])
      .filter((entry) => entry.family === 'IPv4')
      .map((entry) => entry.address),
  );
  const port = Number(/^m=audio ([0-9]+) RTP\/AVP/m.exec(body)?.[1]);
  return host && localAddresses.has(host) && port >= 10000 && port <= 10100
    ? { host, port }
    : null;
}
function packets(socket: Socket, body: string, fill: number) {
  const target = mediaTarget(body);
  if (!target) return () => {};
  let sequence = 0;
  const interval = setInterval(() => {
    const packet = Buffer.alloc(172, fill);
    packet[0] = 0x80;
    packet[1] = 0;
    packet.writeUInt16BE(sequence++ % 65536, 2);
    packet.writeUInt32BE(sequence * 160, 4);
    packet.writeUInt32BE(0x4d59494d, 8);
    socket.send(packet, target.port, target.host, () => {});
  }, 20);
  return () => clearInterval(interval);
}
/** Fixed private loopback fixture adapter. No arbitrary host/action/command API. */
export class ControlledSipCall {
  async run(input: {
    direction: 'inbound' | 'outbound';
    number: string;
    username: string;
    password: string | null;
    nonce: string;
    destinationUsername: string;
    destinationAor: string;
    destinationPassword: string | null;
    sinkPort: number;
    ambiguous?: boolean;
  }): Promise<ControlledSipResult> {
    if (
      !/^[0-9]{1,15}$/.test(input.number) ||
      !/^ims-[a-z0-9-]{1,150}$/.test(input.username) ||
      !/^(?:ims-[a-z0-9-]{1,150}|[0-9]{1,15})$/.test(
        input.destinationUsername,
      ) ||
      !/^[a-f0-9]{64}$/.test(input.nonce) ||
      !Number.isInteger(input.sinkPort) ||
      input.sinkPort < 20000 ||
      input.sinkPort > 20100
    )
      throw new Error('Unsupported controlled test');
    const caller = createSocket('udp4'),
      sink = createSocket('udp4'),
      callerMedia = createSocket('udp4'),
      sinkMedia = createSocket('udp4');
    const pending = new Map<string, (m: Message) => void>();
    const stops: (() => void)[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let sipStatus: number | null = null;
    let observed = false,
      callerRtp = 0,
      sinkRtp = 0,
      complete: (() => void) | undefined;
    const finished = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const send = (
      socket: Socket,
      text: string,
      port: number,
      address = '127.0.0.1',
    ) => socket.send(Buffer.from(text), port, address, () => {});
    const reply = (m: Message, code: string, body = '', extra: string[] = []) =>
      [
        `SIP/2.0 ${code}`,
        ...['via', 'from', 'to', 'call-id', 'cseq'].map(
          (k) =>
            `${k}: ${m.headers.get(k)}${k === 'to' && !m.headers.get(k)?.includes(';tag=') ? ';tag=myims-sink' : ''}`,
        ),
        ...extra,
        ...(body ? ['Content-Type: application/sdp'] : []),
        `Content-Length: ${Buffer.byteLength(body)}`,
        '',
        body,
      ].join('\r\n');
    try {
      const callerPort = await bind(
        caller,
        input.direction === 'inbound' ? '127.0.0.2' : '127.0.0.3',
      );
      const callerRtpPort = await bind(callerMedia, '127.0.0.3');
      const sinkRtpPort = await bind(sinkMedia, '127.0.0.4');
      await new Promise<void>((resolve, reject) => {
        sink.once('error', reject);
        sink.bind(input.sinkPort, '127.0.0.4', resolve);
      });
      callerMedia.on('message', (bytes) => {
        if (bytes.length >= 172 && bytes[0] === 0x80) callerRtp++;
      });
      sinkMedia.on('message', (bytes) => {
        if (bytes.length >= 172 && bytes[0] === 0x80) sinkRtp++;
      });
      for (const socket of [caller, sink]) {
        socket.on('error', () => complete?.());
        socket.on('message', (bytes, peer) => {
          if (peer.address !== '127.0.0.1' || peer.port !== 5060) return;
          const m = parse(bytes);
          if (!m) return;
          if (m.start.startsWith('SIP/2.0 ')) {
            pending.get(
              `${m.headers.get('call-id')}:${m.headers.get('cseq')}`,
            )?.(m);
            return;
          }
          if (m.start.startsWith('BYE ')) {
            send(socket, reply(m, '200 OK'), peer.port);
            complete?.();
            return;
          }
          if (socket !== sink) return;
          if (m.start.startsWith('OPTIONS ')) {
            send(sink, reply(m, '200 OK'), peer.port);
            return;
          }
          if (m.start.startsWith('INVITE ')) {
            const target = m.start.split(' ')[1] ?? '';
            if (!target.startsWith(`sip:${input.destinationUsername}@`)) {
              send(sink, reply(m, '404 Not Found'), peer.port);
              return;
            }
            observed = true;
            send(
              sink,
              reply(m, '200 OK', sdp('127.0.0.4', sinkRtpPort), [
                `Contact: <sip:${input.destinationUsername}@127.0.0.4:${input.sinkPort}>`,
              ]),
              peer.port,
            );
            stops.push(packets(sinkMedia, m.body, 0x7f));
            const callId = m.headers.get('call-id')!,
              to = m.headers.get('to')!,
              from = m.headers.get('from')!,
              contact = m.headers.get('contact');
            const uri = /<([^>]+)>/.exec(contact ?? '')?.[1];
            if (!uri || !/^sip:[a-zA-Z0-9_.-]+@127\.0\.0\.1:5060$/.test(uri))
              return;
            timers.push(
              setTimeout(
                () =>
                  send(
                    sink,
                    [
                      `BYE ${uri} SIP/2.0`,
                      `Via: SIP/2.0/UDP 127.0.0.4:${input.sinkPort};branch=z9hG4bK${randomUUID()}`,
                      `From: ${to}${to.includes(';tag=') ? '' : ';tag=myims-sink'}`,
                      `To: ${from}`,
                      `Call-ID: ${callId}`,
                      'CSeq: 2 BYE',
                      'Max-Forwards: 5',
                      'Content-Length: 0',
                      '',
                      '',
                    ].join('\r\n'),
                    5060,
                  ),
                1200,
              ),
            );
          }
        });
      }
      const transaction = async (
        socket: Socket,
        method: 'REGISTER' | 'INVITE',
        uri: string,
        username: string,
        password: string | null,
        contact: string,
        body: string,
      ) => {
        const callId = randomUUID(),
          tag = randomUUID(),
          source = socket.address();
        let sequence = 1;
        const request = async (authorization?: string) =>
          new Promise<Message>((resolve, reject) => {
            const key = `${callId}:${sequence} ${method}`;
            const timeout = setTimeout(() => {
              pending.delete(key);
              reject(new Error('Dispatch uncertain'));
            }, 4000);
            pending.set(key, (m) => {
              const code = Number(m.start.split(' ')[1]);
              if (code < 200) return;
              clearTimeout(timeout);
              pending.delete(key);
              resolve(m);
            });
            send(
              socket,
              [
                `${method} ${uri} SIP/2.0`,
                `Via: SIP/2.0/UDP ${source.address}:${source.port};branch=z9hG4bK${randomUUID()};rport`,
                `From: <sip:${username}@127.0.0.1>;tag=${tag}`,
                ...(input.ambiguous
                  ? [`From: <sip:ims-ambiguous@127.0.0.1>;tag=ambiguous`]
                  : []),
                `To: <${method === 'REGISTER' ? `sip:${input.destinationAor}@127.0.0.1` : uri}>`,
                `Call-ID: ${callId}`,
                `CSeq: ${sequence} ${method}`,
                'Max-Forwards: 5',
                `Contact: <${contact}>`,
                ...(method === 'REGISTER'
                  ? ['Expires: 60']
                  : [
                      'Content-Type: application/sdp',
                      `X-MyIMS-Test: ${input.nonce}`,
                    ]),
                ...(authorization ? [authorization] : []),
                `Content-Length: ${Buffer.byteLength(body)}`,
                '',
                body,
              ].join('\r\n'),
              5060,
            );
          });
        const ack = (m: Message) =>
          send(
            socket,
            [
              `ACK ${uri} SIP/2.0`,
              `Via: SIP/2.0/UDP ${source.address}:${source.port};branch=z9hG4bK${randomUUID()}`,
              `From: <sip:${username}@127.0.0.1>;tag=${tag}`,
              `To: ${m.headers.get('to')}`,
              `Call-ID: ${callId}`,
              `CSeq: ${sequence} ACK`,
              'Max-Forwards: 5',
              'Content-Length: 0',
              '',
              '',
            ].join('\r\n'),
            5060,
          );
        let response = await request();
        if (response.start.startsWith('SIP/2.0 401 ') && password) {
          if (method === 'INVITE') ack(response);
          const challenge = response.headers.get('www-authenticate') ?? '';
          const realm = /realm="([^"\r\n]+)"/.exec(challenge)?.[1],
            nonce = /nonce="([^"\r\n]+)"/.exec(challenge)?.[1];
          if (
            !realm ||
            !nonce ||
            !/^[-a-zA-Z0-9_.:]{1,256}$/.test(realm) ||
            !/^[-a-zA-Z0-9_.:/+]{1,512}$/.test(nonce)
          )
            throw new Error('Unsupported authentication');
          const opaque = /opaque="([a-zA-Z0-9_.:-]{1,256})"/.exec(
            challenge,
          )?.[1];
          const qop = /qop="auth"/.test(challenge),
            cnonce = randomUUID().replaceAll('-', ''),
            nc = '00000001';
          const hash = md5(
            `${md5(`${username}:${realm}:${password}`)}:${nonce}:${qop ? `${nc}:${cnonce}:auth:` : ''}${md5(`${method}:${uri}`)}`,
          );
          sequence++;
          response = await request(
            `Authorization: Digest username="${username}",realm="${realm}",nonce="${nonce}",uri="${uri}",response="${hash}",algorithm=MD5${opaque ? `,opaque="${opaque}"` : ''}${qop ? `,qop=auth,nc=${nc},cnonce="${cnonce}"` : ''}`,
          );
        }
        if (method === 'INVITE') ack(response);
        return response;
      };
      if (input.destinationPassword) {
        const registered = await transaction(
          sink,
          'REGISTER',
          'sip:127.0.0.1',
          input.destinationUsername,
          input.destinationPassword,
          `sip:${input.destinationUsername}@127.0.0.4:${input.sinkPort}`,
          '',
        );
        if (!registered.start.startsWith('SIP/2.0 200 '))
          throw new Error('Controlled destination unavailable');
      }
      const response = await transaction(
        caller,
        'INVITE',
        `sip:${input.number}@127.0.0.1`,
        input.username,
        input.password,
        `sip:${input.username}@${input.direction === 'inbound' ? '127.0.0.2' : '127.0.0.3'}:${callerPort}`,
        sdp('127.0.0.3', callerRtpPort),
      );
      sipStatus = Number(response.start.split(' ')[1]);
      if (/^SIP\/2\.0 (400|401|403|404|603) /.test(response.start))
        return {
          outcome: observed ? 'unknown' : 'denied',
          destinationObserved: observed,
          mediaObserved: false,
          sipStatus,
        };
      if (!response.start.startsWith('SIP/2.0 200 '))
        return {
          outcome: 'unknown',
          destinationObserved: observed,
          mediaObserved: false,
          sipStatus,
        };
      stops.push(packets(callerMedia, response.body, 0xff));
      await Promise.race([
        finished,
        new Promise<void>((resolve) => timers.push(setTimeout(resolve, 4000))),
      ]);
      return {
        outcome: observed ? 'permitted' : 'unknown',
        destinationObserved: observed,
        mediaObserved: callerRtp > 0 && sinkRtp > 0,
        sipStatus,
      };
    } catch {
      return {
        outcome: 'unknown',
        destinationObserved: observed,
        mediaObserved: false,
        sipStatus,
      };
    } finally {
      for (const stop of stops) stop();
      for (const timer of timers) clearTimeout(timer);
      for (const socket of [caller, sink, callerMedia, sinkMedia]) {
        try {
          socket.close();
        } catch {
          /* Already closed. */
        }
      }
    }
  }
}
