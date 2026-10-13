// Staff HTTPS -> private Next browser composition or three named native consumers.
import { createServer } from 'node:https';
import { request } from 'node:http';
import { isIP } from 'node:net';
const excluded = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
export function createStaffIngress({ tls, config }) {
  return createServer(
    { ...tls, minVersion: 'TLSv1.2', maxHeaderSize: 16384 },
    (req, res) => {
      const fail = (status) => {
        if (res.writableEnded || res.destroyed) return;
        if (!res.headersSent)
          res.writeHead(status, {
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json',
            ...(status === 503 ? { 'Retry-After': '1' } : {}),
          });
        res.end(
          JSON.stringify({
            statusCode: status,
            message: status === 503 ? 'Service unavailable' : 'Access denied',
          }),
        );
      };
      const raw = req.url ?? '';
      const single = (name) =>
        req.rawHeaders.filter(
          (_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === name,
        ).length <= 1;
      let url,
        origin,
        recipientHost = false;
      try {
        origin = new URL(config.origin);
        if (
          config.recipientOrigin &&
          config.recipientOrigin !== config.origin
        ) {
          const recipient = new URL(config.recipientOrigin);
          if (
            recipient.protocol !== 'https:' ||
            recipient.origin !== config.recipientOrigin
          )
            return fail(503);
          if (req.headers.host === recipient.host) {
            recipientHost = true;
            origin = recipient;
          }
        }
        url = new URL(raw, origin.origin);
      } catch {
        return fail(503);
      }
      if (
        origin.protocol !== 'https:' ||
        (!recipientHost && origin.origin !== config.origin) ||
        !raw.startsWith('/') ||
        raw.startsWith('//') ||
        raw.includes('\\') ||
        url.origin !== origin.origin ||
        url.pathname !== raw.split('?')[0] ||
        !single('host') ||
        req.headers.host !== origin.host ||
        !single('origin') ||
        !single('authorization') ||
        !single('cookie') ||
        !single('sec-fetch-site') ||
        !['GET', 'HEAD', 'POST'].includes(req.method)
      )
        return fail(403);
      // The optional dedicated recipient host can serve only public exchange and assets.
      if (
        recipientHost &&
        !(
          url.pathname === '/credentials' ||
          url.pathname.startsWith('/credential-actions/') ||
          url.pathname.startsWith('/_next/') ||
          url.pathname === '/favicon.ico'
        )
      )
        return fail(403);
      const native = url.pathname.startsWith('/staff/auth/mobile/');
      if (native) {
        if (
          url.search ||
          !/^\/staff\/auth\/mobile\/(sign-in|session|logout)$/.test(
            url.pathname,
          ) ||
          req.method !== (url.pathname.endsWith('/session') ? 'GET' : 'POST') ||
          [
            'origin',
            'cookie',
            'sec-fetch-site',
            'sec-fetch-mode',
            'sec-fetch-dest',
            'x-staff-proxy',
            'x-staff-csrf',
            'x-staff-mobile-proxy',
            'x-myims-ingress',
          ].some((h) => req.headers[h] !== undefined) ||
          (url.pathname.endsWith('/sign-in') &&
            req.headers.authorization !== undefined)
        )
          return fail(403);
      } else if (
        req.headers.authorization !== undefined ||
        (req.method === 'POST'
          ? req.headers.origin !== origin.origin
          : !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))
      )
        return fail(403);
      if (
        config.recipientOrigin &&
        config.recipientOrigin !== config.origin &&
        !recipientHost
      ) {
        if (url.pathname.startsWith('/credential-actions/')) return fail(403);
        if (url.pathname === '/credentials' && req.method === 'GET') {
          res.writeHead(307, {
            Location: `${config.recipientOrigin}/credentials`,
            'Cache-Control': 'no-store',
          });
          return res.end();
        }
      }
      const source = req.socket.remoteAddress;
      if (!source || !isIP(source)) return fail(403);
      const length = req.headers['content-length'];
      if (
        req.method === 'POST' &&
        length !== undefined &&
        (!/^\d+$/.test(length) || Number(length) > 4096)
      )
        return fail(400);
      const headers = {};
      if (native) {
        headers['x-staff-mobile-proxy'] = config.proxySecret;
        headers['x-forwarded-for'] = source;
        if (req.headers.authorization)
          headers.authorization = req.headers.authorization;
        if (req.headers['content-type'])
          headers['content-type'] = req.headers['content-type'];
      } else {
        const connection = String(req.headers.connection ?? '')
          .toLowerCase()
          .split(',')
          .map((s) => s.trim());
        for (const [name, value] of Object.entries(req.headers))
          if (
            !excluded.has(name) &&
            !connection.includes(name) &&
            !name.startsWith('x-myims-') &&
            !name.startsWith('x-forwarded-') &&
            !name.endsWith('-proxy') &&
            name !== 'forwarded'
          )
            headers[name] = value;
        headers['x-myims-ingress'] = config.ingressSecret;
        headers['x-myims-client-ip'] = source;
        headers['x-myims-path'] = url.pathname;
      }
      // Buffer mutations before forwarding: no partial/oversized body reaches a write.
      const chunks = [];
      let size = 0;
      const timer = setTimeout(() => {
        req.destroy();
        fail(503);
      }, 4000);
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > 4096) {
          clearTimeout(timer);
          fail(400);
          req.destroy();
        } else chunks.push(chunk);
      });
      req.on('error', () => {
        clearTimeout(timer);
        fail(503);
      });
      req.on('end', () => {
        clearTimeout(timer);
        if (size > 4096) return;
        if (size) headers['content-length'] = String(size);
        else delete headers['content-length'];
        const upstream = request(
          `${native ? config.backendUrl : config.nextUrl}${raw}`,
          { method: req.method, headers },
          (incoming) => {
            const responseHeaders = {};
            if (native) {
              if (
                ![200, 201, 400, 401, 403, 429, 503].includes(
                  incoming.statusCode,
                )
              ) {
                incoming.resume();
                return fail(503);
              }
              responseHeaders['Cache-Control'] = 'no-store';
              responseHeaders['Content-Type'] = 'application/json';
              const retry = incoming.headers['retry-after'];
              if (typeof retry === 'string' && /^\d{1,3}$/.test(retry))
                responseHeaders['Retry-After'] = String(
                  Math.max(1, Math.min(900, Number(retry))),
                );
              let bytes = 0;
              const output = [];
              incoming.on('data', (chunk) => {
                bytes += chunk.length;
                if (bytes > 8192) {
                  incoming.destroy();
                  fail(503);
                } else output.push(chunk);
              });
              incoming.on('end', () => {
                if (bytes > 8192) return;
                res.writeHead(incoming.statusCode, responseHeaders);
                res.end(Buffer.concat(output));
              });
              incoming.on('error', () => fail(503));
            } else {
              for (const [name, value] of Object.entries(incoming.headers))
                if (!excluded.has(name)) responseHeaders[name] = value;
              responseHeaders['cache-control'] = 'no-store';
              res.writeHead(incoming.statusCode, responseHeaders);
              incoming.pipe(res);
            }
          },
        );
        upstream.setTimeout(10000, () => upstream.destroy());
        upstream.on('error', () => fail(503));
        res.on('close', () => upstream.destroy());
        upstream.end(size ? Buffer.concat(chunks) : undefined);
      });
    },
  );
}
