'use client';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { PlatformSessionDto, PlatformSignInDto } from '@myims/contracts';
import { Button, Field, Input, Panel } from '@myims/ui-web';
import {
  AccessError,
  authRequest,
  csrfProof,
  currentSession,
  failureMessage,
  signalAccessChange,
} from './client';
import { consoleReturnPath } from './return-path';
export function SignIn({
  onAuthenticated,
  onDestination = '/',
}: {
  onAuthenticated?: (session: PlatformSessionDto) => void;
  onDestination?: string;
}) {
  const usernameRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (ready) usernameRef.current?.focus();
  }, [ready]);
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
    locked.current = true;
    setPending(true);
    setMessage('');
    const input: PlatformSignInDto = {
      username: username.trim().toLowerCase(),
      password,
    };
    setPassword('');
    try {
      const proof = csrfProof(await authRequest('csrf'));
      await authRequest('sign-in', input, proof);
      // Issuance response or typed username is never the resume authority.
      const session = await currentSession();
      signalAccessChange();
      if (onAuthenticated) onAuthenticated(session);
      else window.location.replace(consoleReturnPath(onDestination));
    } catch (error) {
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
        Platform console sign-in
      </h1>
      <p className="mb-6 mt-2 text-muted-foreground">
        Use your platform operator credentials.
      </p>
      <form className="space-y-5" method="post" onSubmit={submit}>
        <Field id="platform-username" label="Username">
          <Input
            ref={usernameRef}
            id="platform-username"
            name="username"
            autoComplete="username"
            required
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={pending || !ready}
          />
        </Field>
        <Field id="platform-password" label="Password">
          <Input
            id="platform-password"
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
