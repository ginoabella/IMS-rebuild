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
  ])
    expect(consoleReturnPath(path)).toBe('/');
  expect(consoleReturnPath('/')).toBe('/');
  expect(consoleReturnPath('/ui-preview')).toBe('/ui-preview');
});
