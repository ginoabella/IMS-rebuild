export function staffReturnPath(value: string | null | undefined): string {
  return value === '/credential-issuer' || value === '/ui-preview'
    ? value
    : '/';
}
