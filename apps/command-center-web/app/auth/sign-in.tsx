'use client';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { StaffBrowserSessionDto, StaffSignInDto } from '@myims/contracts';
import { Button, Field, Input, Panel } from '@myims/ui-web';
import {
  AccessError,
  authRequest,
  csrfProof,
  currentSession,
  failureMessage,
  signalAccessChange,
} from './client';
import { staffReturnPath } from './return-path';
export function SignIn({
  onAuthenticated,
  onDestination = '/',
}: {
  onAuthenticated?: (session: StaffBrowserSessionDto) => void;
  onDestination?: string;
}) {
  const mounted = useRef(true),
    epoch = useRef(0);
  const usernameRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    mounted.current = true;
    setReady(true);
    const clear = () => {
      epoch.current++;
      setPassword('');
    };
    window.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      mounted.current = false;
      epoch.current++;
      window.removeEventListener('pagehide', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);
  useEffect(() => {
    if (ready) usernameRef.current?.focus();
  }, [ready]);
  const [tenantCode, setTenantCode] = useState('');
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState('');
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(''),
    [retryAt, setRetryAt] = useState(0);
  const locked = useRef(false),
    errorRef = useRef<HTMLParagraphElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    if (Date.now() < retryAt) {
      setPassword('');
      setMessage('Wait for the retry interval before submitting again.');
      errorRef.current?.focus();
      return;
    }
    const captured = epoch.current;
    locked.current = true;
    setPending(true);
    setMessage('');
    const input: StaffSignInDto = {
      tenantCode: tenantCode.trim().toLowerCase(),
      username: username.trim().toLowerCase(),
      password,
    };
    setPassword('');
    try {
      const proof = csrfProof(await authRequest('csrf'));
      await authRequest('sign-in', input, proof);
      // Issuance response or typed username is never the resume authority.
      const session = await currentSession();
      if (!mounted.current || captured !== epoch.current) return;
      signalAccessChange();
      if (onAuthenticated) onAuthenticated(session);
      else window.location.replace(staffReturnPath(onDestination));
    } catch (error) {
      if (!mounted.current || captured !== epoch.current) return;
      setMessage(failureMessage(error, true));
      if (
        error instanceof AccessError &&
        (error.status === 429 || error.status === 503)
      )
        setRetryAt(Date.now() + error.retryAfter * 1000);
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      input.password = '';
      locked.current = false;
      setPending(false);
    }
  }
  return (
    <Panel>
      <h1 className="font-display text-2xl font-semibold">
        Command center sign-in
      </h1>
      <p className="mb-6 mt-2 text-muted-foreground">
        Use your tenant staff credentials.
      </p>
      <form className="space-y-5" method="post" onSubmit={submit}>
        <Field id="staff-tenant" label="Tenant code">
          <Input
            id="staff-tenant"
            name="tenantCode"
            required
            value={tenantCode}
            onChange={(e) => setTenantCode(e.target.value)}
            disabled={pending || !ready}
          />
        </Field>
        <Field id="staff-username" label="Username">
          <Input
            ref={usernameRef}
            id="staff-username"
            name="username"
            autoComplete="username"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending || !ready}
          />
        </Field>
        <Field id="staff-password" label="Password">
          <Input
            id="staff-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending || !ready}
          />
        </Field>
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="text-foreground"
        >
          {message}
        </p>
        <Button type="submit" pending={pending || !ready}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Panel>
  );
}
