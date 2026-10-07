import { createServer } from 'node:https';
import { request } from 'node:http';
import { isIP } from 'node:net';
import { browserOrigin } from './platform-https-material.mjs';

const hopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function filteredHeaders(headers) {
  const connection = String(headers.connection ?? '')
    .toLowerCase()
    .split(',')
    .map((name) => name.trim());
  return Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !hopHeaders.has(name) && !connection.includes(name),
    ),
  );
}

export function createIngress(material) {
  const server = createServer(
    {
      key: material.key,
      cert: material.cert,
      minVersion: 'TLSv1.2',
      maxHeaderSize: 16384,
    },
    (req, res) => {
      const deny = (status) => {
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
      const single = (name) =>
        req.rawHeaders.filter(
          (_, i) => i % 2 === 0 && req.rawHeaders[i].toLowerCase() === name,
        ).length <= 1;
      const raw = req.url ?? '';
      let parsed;
      try {
        parsed = new URL(raw, browserOrigin);
      } catch {
        return deny(403);
      }
      if (
        !raw.startsWith('/') ||
        raw.startsWith('//') ||
        raw.includes('\\') ||
        parsed.origin !== browserOrigin ||
        parsed.pathname !== raw.split('?')[0] ||
        !single('host') ||
        req.headers.host !== 'localhost:3443' ||
        !single('origin') ||
        !single('sec-fetch-site') ||
        !['GET', 'HEAD', 'POST'].includes(req.method)
      )
        return deny(403);
      if (req.method === 'POST' && req.headers.origin !== browserOrigin)
        return deny(403);
      if (
        ['GET', 'HEAD'].includes(req.method) &&
        !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])
      )
        return deny(403);
      if (req.headers.authorization) return deny(403);
      if (
        parsed.pathname.startsWith('/platform/auth/') &&
        (![
          '/platform/auth/csrf',
          '/platform/auth/session',
          '/platform/auth/sign-in',
          '/platform/auth/logout',
        ].includes(parsed.pathname) ||
          parsed.search)
      )
        return deny(403);
      let source = req.socket.remoteAddress ?? '';
      if (source.startsWith('::ffff:')) source = source.slice(7);
      if (!isIP(source)) return deny(403);
      const headers = filteredHeaders(req.headers);
      for (const name of Object.keys(headers)) {
        if (
          name === 'forwarded' ||
          name.startsWith('x-forwarded-') ||
          name.startsWith('x-myims-') ||
          name === 'x-platform-proxy' ||
          name === 'x-real-ip'
        )
          delete headers[name];
      }
      headers.host = 'localhost:3443';
      headers['x-myims-ingress'] = material.secrets.ingress;
      headers['x-myims-client-ip'] = source;
      headers['x-myims-path'] = parsed.pathname;
      const upstream = request(
        {
          hostname: '127.0.0.1',
          port: 3003,
          path: raw,
          method: req.method,
          headers,
          timeout: 10000,
        },
        (incoming) => {
          res.writeHead(incoming.statusCode ?? 503, {
            ...filteredHeaders(incoming.headers),
            'cache-control': 'no-store',
          });
          incoming.on('error', () => res.destroy());
          incoming.pipe(res);
        },
      );
      upstream.on('timeout', () => upstream.destroy());
      upstream.on('error', () => {
        if (res.headersSent) res.destroy();
        else deny(503);
      });
      req.on('aborted', () => upstream.destroy());
      res.on('close', () => {
        if (!res.writableEnded) upstream.destroy();
      });
      req.pipe(upstream);
    },
  );
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('tlsClientError', () => {});
  server.on('clientError', (_, socket) => socket.destroy());
  server.on('upgrade', (_, socket) => socket.destroy());
  return server;
}
