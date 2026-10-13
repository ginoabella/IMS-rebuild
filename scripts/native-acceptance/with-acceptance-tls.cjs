// Installed only in the isolated acceptance application, never the shipping app.
/* global module */
/* eslint-disable @typescript-eslint/no-require-imports -- Expo loads local config plugins synchronously through CommonJS. */
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { X509Certificate } = require('node:crypto');

module.exports = function withAcceptanceTls(config) {
  const origin = new URL(process.env.EXPO_PUBLIC_STAFF_AUTH_ORIGIN);
  if (
    origin.protocol !== 'https:' ||
    origin.origin !== process.env.EXPO_PUBLIC_STAFF_AUTH_ORIGIN
  )
    throw new Error('Exact native HTTPS origin required');
  if (!/^[a-zA-Z0-9.-]+$/.test(origin.hostname))
    throw new Error('Native acceptance requires a DNS hostname');
  const ca = readFileSync(join(__dirname, 'acceptance-ca.pem'), 'utf8');
  const certificate = new X509Certificate(ca);
  if (
    !certificate.ca ||
    !certificate.checkIssued(certificate) ||
    !certificate.verify(certificate.publicKey)
  )
    throw new Error('Public root CA certificate required');
  config = withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      mod.modResults,
    );
    app.$['android:networkSecurityConfig'] = '@xml/myims_acceptance_network';
    app.$['android:usesCleartextTraffic'] = 'false';
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const resource = join(
        mod.modRequest.platformProjectRoot,
        'app/src/main/res',
      );
      mkdirSync(join(resource, 'raw'), { recursive: true });
      mkdirSync(join(resource, 'xml'), { recursive: true });
      writeFileSync(join(resource, 'raw/myims_acceptance_ca.pem'), ca);
      writeFileSync(
        join(resource, 'xml/myims_acceptance_network.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors><certificates src="system" /></trust-anchors>
  </base-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">${origin.hostname}</domain>
    <trust-anchors>
      <certificates src="system" />
      <certificates src="@raw/myims_acceptance_ca" />
    </trust-anchors>
  </domain-config>
</network-security-config>
`,
      );
      return mod;
    },
  ]);
};
