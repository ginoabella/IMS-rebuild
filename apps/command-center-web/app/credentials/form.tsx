'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Panel } from '@myims/ui-web';
export function CredentialForm() {
  const [capability, setCapability] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false),
    [completed, setCompleted] = useState(false);
  const busy = useRef(false),
    mounted = useRef(true),
    retryAt = useRef(0),
    heading = useRef<HTMLHeadingElement>(null),
    epoch = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const hide = () => {
      epoch.current++;
      setCapability('');
      setPassword('');
      setConfirm('');
      if (busy.current)
        setMessage(
          'Outcome uncertain. Ask the issuer to check status before explicitly reissuing.',
        );
      busy.current = false;
      setPending(false);
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') hide();
    };
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', visibility);
      mounted.current = false;
      epoch.current++;
    };
  }, []);
  async function exchange(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || Date.now() < retryAt.current || completed) return;
    if (password !== confirm) {
      setMessage('Passwords must match exactly.');
      return;
    }
    const count = [...password].length;
    if (
      /[\uD800-\uDFFF]/u.test(password) ||
      count < 15 ||
      count > 128 ||
      new TextEncoder().encode(password).length > 512 ||
      /[\0\r\n\u0085\u2028\u2029]/u.test(password)
    ) {
      setMessage(
        'Use 15–128 characters, at most 512 UTF-8 bytes, without NUL or line breaks.',
      );
      return;
    }
    if (!/^[A-Za-z0-9_-]{43}$/.test(capability)) {
      setMessage('Enter the handoff code exactly as provided.');
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage('');
    const captured = epoch.current;
    const current = () => mounted.current && epoch.current === captured;
    try {
      const bootstrap = await fetch('/credential-actions/csrf', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(7000),
      });
      if (!bootstrap.ok)
        throw new Error(
          'Credential service unavailable. Retry when it is available.',
        );
      const context: unknown = await bootstrap.json();
      if (!current()) return;
      if (
        !context ||
        typeof context !== 'object' ||
        !('proof' in context) ||
        typeof context.proof !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(context.proof)
      )
        throw new Error('Credential service unavailable.');
      const response = await fetch('/credential-actions/exchange', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          'X-Credential-CSRF': context.proof,
        },
        body: JSON.stringify({ capability, password }),
      });
      if (!current()) return;
      const retry = Number(response.headers.get('retry-after'));
      retryAt.current =
        Date.now() + Math.max(1, Math.min(900, retry || 1)) * 1000;
      if (response.status === 400) {
        setMessage('Check your password and handoff code.');
        return;
      }
      setPassword('');
      setConfirm('');
      setCapability('');
      if (response.status === 401) {
        setMessage(
          'Invalid capability. Ask the authorized issuer to check status and explicitly reissue after verifying you.',
        );
        return;
      }
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Too many attempts. Wait for the retry period, then ask the issuer to check status before submitting again.'
            : 'Outcome uncertain. Ask the issuer to check status and explicitly reissue if needed. Do not automatically resend.',
        );
      const value: unknown = await response.json();
      if (!current()) return;
      if (
        !value ||
        typeof value !== 'object' ||
        !('completed' in value) ||
        value.completed !== true
      )
        throw new Error('Outcome uncertain. Ask the issuer to check status.');
      setCompleted(true);
      setMessage(
        'Credentials set. Previous sessions are invalid. Draft tenants still require separate activation.',
      );
      queueMicrotask(() => heading.current?.focus());
    } catch (error) {
      if (current()) {
        setPassword('');
        setConfirm('');
        setCapability('');
        setMessage(
          error instanceof Error
            ? error.message
            : 'Outcome uncertain. Ask the issuer to check status.',
        );
      }
    } finally {
      if (current()) {
        busy.current = false;
        setPending(false);
      }
    }
  }
  const inputClass =
    'min-h-11 w-full rounded-md border border-subtle bg-muted px-3 text-foreground';
  return (
    <Panel aria-labelledby="recipient-heading">
      <h1
        id="recipient-heading"
        ref={heading}
        tabIndex={-1}
        className="font-display text-2xl font-semibold"
      >
        Set staff credentials
      </h1>
      <p className="mt-3 text-muted-foreground">
        Use the code handed to you after identity verification. Choose your own
        password. This action does not activate a tenant or sign you in.
      </p>
      {!completed && (
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => void exchange(event)}
        >
          <div>
            <label htmlFor="capability" className="mb-2 block">
              Handoff code
            </label>
            <input
              id="capability"
              className={inputClass}
              value={capability}
              onChange={(e) => setCapability(e.target.value)}
              maxLength={43}
              autoComplete="off"
              spellCheck={false}
              required
              disabled={pending}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block">
              New password
            </label>
            <input
              id="password"
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={256}
              autoComplete="new-password"
              aria-describedby="password-help"
              required
              disabled={pending}
            />
            <p
              id="password-help"
              className="mt-2 text-sm text-muted-foreground"
            >
              15–128 characters, at most 512 UTF-8 bytes. Spaces and Unicode are
              allowed; preserve them exactly.
            </p>
          </div>
          <div>
            <label htmlFor="confirm" className="mb-2 block">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              maxLength={256}
              autoComplete="new-password"
              required
              disabled={pending}
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Setting credentials…' : 'Set credentials'}
          </Button>
        </form>
      )}
      <p role="status" aria-live="polite" className="mt-4">
        {message}
      </p>
    </Panel>
  );
}
