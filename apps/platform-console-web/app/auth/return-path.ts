// Only literal delivered paths; never decode untrusted destinations.
export function consoleReturnPath(value: string | null | undefined): string {
  if (
    value === '/ui-preview' ||
    value === '/tenants' ||
    value === '/tenants/create'
  )
    return value;
  if (
    value &&
    /^\/tenants\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return value;
  return '/';
}
