import { createSocket } from 'node:dgram';
import { createHash, randomUUID } from 'node:crypto';
import { ProtectedArtifactStore } from './artifact-store';
import { runtimeNames } from './materialize';
import { NativePbxFailure, nativeCli } from './native-driver';
import type { NativeLiveProbes } from './native-application';
import type { RetainedLiveArtifact } from './verified-execution';
const md5 = (value: string) => createHash('md5').update(value).digest('hex');
/** Fixed loopback SIP OPTIONS proves loaded endpoint auth without registration or calls. */
export class NativeDenyProbes implements NativeLiveProbes {
  constructor(private readonly artifacts: ProtectedArtifactStore) {}
  private async options(
    username: string,
    password: string,
    signal: AbortSignal,
  ) {
    const socket = createSocket('udp4');
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.bind(0, '127.0.0.1', resolve);
    });
    let wake: ((value: string) => void) | undefined;
    let fail: (() => void) | undefined;
    const id = randomUUID(),
      tag = randomUUID().replaceAll('-', ''),
      port = socket.address().port;
    socket.on('message', (bytes, peer) => {
      if (
        peer.address !== '127.0.0.1' ||
        peer.port !== 5060 ||
        bytes.length > 16384
      )
        return;
      const text = bytes.toString('utf8');
      if (!text.includes(`Call-ID: ${id}\r\n`)) return;
      wake?.(text);
    });
    socket.on('error', () => fail?.());
    const abort = () => fail?.();
    signal.addEventListener('abort', abort, { once: true });
    const uri = 'sip:s@127.0.0.1';
    const send = async (sequence: number, authorization?: string) =>
      new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          wake = undefined;
          fail = undefined;
          reject(new NativePbxFailure('verification_failed'));
        }, 2000);
        fail = () => {
          clearTimeout(timeout);
          wake = undefined;
          fail = undefined;
          reject(new NativePbxFailure('verification_failed'));
        };
        wake = (value) => {
          clearTimeout(timeout);
          wake = undefined;
          fail = undefined;
          resolve(value);
        };
        if (signal.aborted) {
          fail();
          return;
        }
        const request = [
          `OPTIONS ${uri} SIP/2.0`,
          `Via: SIP/2.0/UDP 127.0.0.1:${port};branch=z9hG4bK${randomUUID().replaceAll('-', '')};rport`,
          `From: <sip:${username}@127.0.0.1>;tag=${tag}`,
          'To: <sip:s@127.0.0.1>',
          `Call-ID: ${id}`,
          `CSeq: ${sequence} OPTIONS`,
          'Max-Forwards: 1',
          ...(authorization ? [authorization] : []),
          'Content-Length: 0',
          '',
          '',
        ].join('\r\n');
        socket.send(Buffer.from(request), 5060, '127.0.0.1', (error) => {
          if (error) fail?.();
        });
      });
    try {
      const challenge = await send(1);
      if (!challenge.startsWith('SIP/2.0 401 '))
        throw new NativePbxFailure('verification_failed');
      const header = /^WWW-Authenticate: Digest ([^\r\n]+)$/im.exec(
        challenge,
      )?.[1];
      if (!header) throw new NativePbxFailure('verification_failed');
      const fields = new Map(
        [...header.matchAll(/([a-z]+)=(?:"([^"\r\n]*)"|([^,\s]+))/gi)].map(
          (match) => [match[1]!.toLowerCase(), match[2] ?? match[3]!],
        ),
      );
      const realm = fields.get('realm'),
        nonce = fields.get('nonce'),
        qop = fields.get('qop');
      if (
        !realm ||
        !nonce ||
        !/^[a-zA-Z0-9_.:-]{1,256}$/.test(realm) ||
        !/^[a-zA-Z0-9_.:/+-]{1,512}$/.test(nonce) ||
        (fields.has('algorithm') && fields.get('algorithm') !== 'MD5') ||
        (qop && qop !== 'auth')
      )
        throw new NativePbxFailure('verification_failed');
      const authorization = (secret: string) => {
        const cnonce = randomUUID().replaceAll('-', ''),
          nc = '00000001';
        const response = md5(
          `${md5(`${username}:${realm}:${secret}`)}:${nonce}:${qop ? `${nc}:${cnonce}:auth:` : ''}${md5(`OPTIONS:${uri}`)}`,
        );
        return `Authorization: Digest username="${username}",realm="${realm}",nonce="${nonce}",uri="${uri}",response="${response}",algorithm=MD5${qop ? `,qop=auth,nc=${nc},cnonce="${cnonce}"` : ''}${fields.has('opaque') ? `,opaque="${fields.get('opaque')}"` : ''}`;
      };
      const denied = await send(2, authorization(randomUUID()));
      if (!/^SIP\/2\.0 (401|403) /.test(denied))
        throw new NativePbxFailure('verification_failed');
      const accepted = await send(3, authorization(password));
      if (!accepted.startsWith('SIP/2.0 200 '))
        throw new NativePbxFailure('verification_failed');
    } finally {
      signal.removeEventListener('abort', abort);
      socket.close();
    }
  }
  async verify(artifact: RetainedLiveArtifact, signal: AbortSignal) {
    if (signal.aborted) throw new NativePbxFailure('verification_failed');
    const names = runtimeNames(artifact.snapshot, artifact.identity.revisionId);
    const denied = await nativeCli(
      artifact.identity.compilerVersion === 'baseline-1'
        ? 'dialplan show default'
        : `dialplan show ${names.deny}`,
    );
    if (!denied.includes('Hangup()') || /\b(?:Dial|Goto|Gosub)\(/.test(denied))
      throw new NativePbxFailure('verification_failed');
    const files = this.artifacts.load(artifact.identity);
    const configuration = files.pjsip.toString('utf8');
    for (const endpoint of artifact.snapshot.extensions.filter(
      (entry) => entry.administrativeStatus === 'enabled',
    )) {
      // Generated identifiers and passwords have a restricted proven grammar;
      // read only the exact protected auth section, never CLI/log diagnostics.
      const section = configuration
        .split(`[${endpoint.authKey}]\n`)[1]
        ?.split('\n[')[0];
      const password =
        section && /^password=([a-f0-9]{64})$/m.exec(section)?.[1];
      if (!password) throw new NativePbxFailure('verification_failed');
      await this.options(endpoint.endpointKey, password, signal);
    }
  }
}
