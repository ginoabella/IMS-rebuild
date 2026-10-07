'use client';
import { useEffect, useRef, useState } from 'react';
export type IssuerOwner = {
  tenantId: string;
  staffId: string;
  proof: string;
  idleExpiresAt: number;
  absoluteExpiresAt: number;
};
// Existing-session consumer only. Signals hide/clear work; canonical metadata
// must still validate before any signal can restore presentation or authorize writes.
export function useIssuerAccess(
  onOwnerCleared: () => void,
  onHidden: () => void,
) {
  const [owner, setOwner] = useState<IssuerOwner | null>(null),
    [message, setMessage] = useState('');
  const current = useRef<IssuerOwner | null>(null),
    epoch = useRef(0),
    mounted = useRef(true),
    checking = useRef<Promise<boolean> | null>(null),
    lastOwner = useRef(''),
    deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useRef(onOwnerCleared),
    hidden = useRef(onHidden);
  clear.current = onOwnerCleared;
  hidden.current = onHidden;
  function hide() {
    epoch.current++;
    current.current = null;
    setOwner(null);
    hidden.current();
    if (deadline.current) clearTimeout(deadline.current);
    deadline.current = null;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[data-issuer-work]'))
      active.blur();
  }
  async function authorize() {
    if (checking.current) return checking.current;
    const captured = epoch.current;
    const flight = (async () => {
      try {
        const response = await fetch('/staff/credential-actions/session', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok)
          throw new Error(
            'Staff administrator access is required. Restore access, then explicitly check it.',
          );
        const v = (await response.json()) as Partial<IssuerOwner>;
        if (!mounted.current || epoch.current !== captured) return false;
        const id = (value: unknown) =>
          typeof value === 'string' &&
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
            value,
          );
        if (
          !id(v.tenantId) ||
          !id(v.staffId) ||
          typeof v.proof !== 'string' ||
          !/^[A-Za-z0-9_-]{43}$/.test(v.proof) ||
          typeof v.idleExpiresAt !== 'number' ||
          !Number.isSafeInteger(v.idleExpiresAt) ||
          typeof v.absoluteExpiresAt !== 'number' ||
          !Number.isSafeInteger(v.absoluteExpiresAt)
        )
          throw new Error('Access unavailable.');
        const expires = Math.min(v.idleExpiresAt, v.absoluteExpiresAt);
        if (expires <= Date.now())
          throw new Error('Administrator access expired.');
        const key = `${v.tenantId}:${v.staffId}`;
        if (lastOwner.current && lastOwner.current !== key) {
          epoch.current++;
          clear.current();
          setMessage('Previous owner work cleared.');
        }
        if (!lastOwner.current || lastOwner.current === key) setMessage('');
        lastOwner.current = key;
        current.current = v as IssuerOwner;
        setOwner(v as IssuerOwner);
        if (deadline.current) clearTimeout(deadline.current);
        deadline.current = setTimeout(
          () => {
            if (mounted.current) {
              hide();
              setMessage(
                'Administrator access expired. Restore access, then explicitly check it.',
              );
            }
          },
          Math.min(2147483647, expires - Date.now()),
        );
        return true;
      } catch (error) {
        if (mounted.current && epoch.current === captured) {
          hide();
          setMessage(
            error instanceof Error ? error.message : 'Access unavailable.',
          );
        }
        return false;
      }
    })();
    checking.current = flight;
    try {
      return await flight;
    } finally {
      if (checking.current === flight) checking.current = null;
    }
  }
  function capture() {
    const generation = epoch.current,
      key = current.current
        ? `${current.current.tenantId}:${current.current.staffId}`
        : null;
    return {
      current: () =>
        mounted.current &&
        generation === epoch.current &&
        !!current.current &&
        `${current.current.tenantId}:${current.current.staffId}` === key,
    };
  }
  useEffect(() => {
    mounted.current = true;
    void authorize();
    const timer = setInterval(() => {
      if (current.current) void authorize();
    }, 15000);
    const restore = () => {
      hide();
      const previous = checking.current;
      void (async () => {
        if (previous) await previous;
        if (mounted.current && document.visibilityState !== 'hidden')
          await authorize();
      })();
    };
    const visibility = () => {
      hide();
      if (document.visibilityState !== 'hidden') restore();
    };
    const logout = () => {
      hide();
      lastOwner.current = '';
      clear.current();
      setMessage('Issuer work cleared after sign-out.');
    };
    window.addEventListener('focus', restore);
    window.addEventListener('pageshow', restore);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('myims-staff-logout', logout);
    return () => {
      mounted.current = false;
      epoch.current++;
      clearInterval(timer);
      if (deadline.current) clearTimeout(deadline.current);
      window.removeEventListener('focus', restore);
      window.removeEventListener('pageshow', restore);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('myims-staff-logout', logout);
    };
  }, []);
  return {
    owner,
    message,
    authorize,
    capture,
    hide,
    reject: (feedback: string) => {
      hide();
      setMessage(feedback);
    },
    currentOwner: () => current.current,
  };
}
