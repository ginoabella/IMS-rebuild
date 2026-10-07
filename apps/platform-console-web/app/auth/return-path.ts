// Only delivered console destinations can be resumed. No decoding or arbitrary URLs.
export function consoleReturnPath(value: string | null | undefined): string {
  return value === '/ui-preview' ? value : '/';
}
