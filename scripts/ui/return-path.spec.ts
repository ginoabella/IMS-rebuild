import { expect, test } from '@playwright/test';
import { consoleReturnPath } from '../../apps/platform-console-web/app/auth/return-path';

test('Platform return destinations allow only delivered local console paths', () => {
  for (const path of [
    undefined,
    null,
    '',
    '/sign-in',
    '/sign-in?returnTo=/',
    'https://foreign.invalid',
    '//foreign.invalid',
    '\\\\foreign.invalid',
    '/%2f%2fforeign.invalid',
    '%2F%2Fforeign.invalid',
    '/\\foreign.invalid',
    'javascript:alert(1)',
    '/ui-preview?notes=private',
    '/ui-preview#notes',
    '/ui-preview/../sign-in',
    '/%75i-preview',
    ' /ui-preview',
    '/tenants?after=bad',
    '/tenants/create/../sign-in',
    '/tenants/%63reate',
    '/tenants/not-a-uuid',
    '/tenants//foreign.invalid',
    '/tenants/create#private',
  ])
    expect(consoleReturnPath(path)).toBe('/');
  expect(consoleReturnPath('/')).toBe('/');
  expect(consoleReturnPath('/ui-preview')).toBe('/ui-preview');
});

test('Tenant returns accept only delivered literal list/create/UUID detail paths', () => {
  for (const path of [
    '/tenants',
    '/tenants/create',
    '/tenants/12345678-1234-1234-1234-123456789abc',
  ])
    expect(consoleReturnPath(path)).toBe(path);
});
