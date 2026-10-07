'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { PlatformSessionDto } from '@myims/contracts';
import { AppShell, Button, OverlayScope } from '@myims/ui-web';
import { AppNavigation } from '../navigation';
import { usePathname } from 'next/navigation';
import { SignIn } from './sign-in';
import { RetainedWork } from './retained-work';
import {
  AccessError,
  authRequest,
  csrfProof,
  currentSession,
  failureMessage,
  signalAccessChange,
} from './client';

type FormValues = Record<string, string>;
type WorkContract = {
  operatorId: string;
  rejectAccess: (error: unknown) => void;
  values: FormValues;
  record: (values: FormValues) => void;
  authorize: () => Promise<boolean>;
};
const WorkContext = createContext<WorkContract | null>(null);
export function useOperatorWork() {
  const value = useContext(WorkContext);
  if (!value) throw new Error('Operator forms require ConsoleAccess');
  return value;
}
export function ConsoleAccess({
  initial,
  children,
}: {
  initial: PlatformSessionDto;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [session, setSession] = useState<PlatformSessionDto | null>(initial);
  const [mode, setMode] = useState<
    'ready' | 'unknown' | 'reauth' | 'blocked' | 'logout'
  >('ready');
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false),
    [values, setValues] = useState<FormValues>({});
  const retained = useRef(new RetainedWork<FormValues>(() => ({})));
  const authority = useRef(initial),
    epoch = useRef(0),
    busy = useRef(false),
    accessible = useRef(true),
    mounted = useRef(true),
    inFlight = useRef<Promise<boolean> | null>(null),
    clearOnAbsent = useRef(false),
    logoutRequested = useRef(false),
    retryAt = useRef(0);
  const presentation = useRef<HTMLDivElement>(null),
    retryFocus = useRef<HTMLButtonElement>(null);
  const accept = useCallback((next: PlatformSessionDto) => {
    accessible.current = true;
    clearOnAbsent.current = false;
    setValues(retained.current.validateOwner(next.operatorId));
    authority.current = next;
    setSession(next);
    setMode('ready');
    setMessage('');
    if (presentation.current) presentation.current.style.visibility = '';
  }, []);
  const hide = useCallback(() => {
    accessible.current = false;
    epoch.current++;
    if (presentation.current) presentation.current.style.visibility = 'hidden';
    setMode(logoutRequested.current ? 'logout' : 'unknown');
  }, []);
  const rejectAccess = useCallback(
    (error: unknown) => {
      if (logoutRequested.current) return;
      hide();
      if (
        error instanceof AccessError &&
        (error.status === 429 || error.status === 503)
      )
        retryAt.current = Date.now() + error.retryAfter * 1000;
      setMessage(failureMessage(error));
      setMode(
        error instanceof AccessError && error.status === 401
          ? 'reauth'
          : 'blocked',
      );
    },
    [hide],
  );
  const validate = useCallback(
    (clearAbsentLogout = false): Promise<boolean> => {
      if (!mounted.current || busy.current || logoutRequested.current)
        return Promise.resolve(false);
      clearOnAbsent.current ||= clearAbsentLogout;
      if (inFlight.current) return inFlight.current;
      const flight: Promise<boolean> = (async () => {
        for (;;) {
          if (!mounted.current || busy.current || logoutRequested.current)
            return false;
          accessible.current = false;
          if (presentation.current)
            presentation.current.style.visibility = 'hidden';
          if (Date.now() < retryAt.current) {
            setMode('blocked');
            return false;
          }
          const generation = epoch.current;
          setMode('unknown');
          try {
            const next = await currentSession();
            if (!mounted.current) return false;
            // Invalidation during a read requires one fresh read, never acceptance
            // of the old result. Concurrent restoration events share this flight.
            if (generation !== epoch.current) continue;
            accept(next);
            return true;
          } catch (error) {
            if (!mounted.current) return false;
            if (generation !== epoch.current) continue;
            if (
              clearOnAbsent.current &&
              error instanceof AccessError &&
              error.status === 401
            ) {
              retained.current.clear();
              setValues({});
              setSession(null);
              clearOnAbsent.current = false;
            }
            rejectAccess(error);
            return false;
          }
        }
      })().finally(() => {
        if (inFlight.current === flight) {
          inFlight.current = null;
        }
      });
      inFlight.current = flight;
      return flight;
    },
    [accept, rejectAccess],
  );
  useLayoutEffect(() => {
    hide();
    void validate();
  }, [pathname, initial.operatorId, hide, validate]);
  useEffect(() => {
    mounted.current = true;
    retained.current.validateOwner(initial.operatorId);
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel('myims-platform-access');
    const changed = (event?: MessageEvent | Event) => {
      hide();
      // Delayed signals cannot clear a workspace whose current session is still valid.
      void validate(event instanceof MessageEvent && event.data === 'logout');
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') hide();
      else void validate();
    };
    channel?.addEventListener('message', changed);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', changed);
    window.addEventListener('focus', changed);
    document.addEventListener('visibilitychange', visibility);
    // Validate on mount too: a cached client router layout never establishes access.
    void validate();
    return () => {
      mounted.current = false;
      accessible.current = false;
      epoch.current++;
      channel?.close();
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', changed);
      window.removeEventListener('focus', changed);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [initial.operatorId, hide, validate]);
  useEffect(() => {
    if (mode !== 'ready' || !session) return;
    const timer = setTimeout(
      () => {
        hide();
        setMode('reauth');
        setMessage('Your session ended. Sign in to continue.');
      },
      Math.max(
        0,
        Math.min(session.idleExpiresAt, session.absoluteExpiresAt) - Date.now(),
      ),
    );
    return () => clearTimeout(timer);
  }, [session, mode, hide]);
  useEffect(() => {
    if (!pending && message && (mode === 'blocked' || mode === 'logout'))
      retryFocus.current?.focus();
  }, [mode, pending, message]);
  async function logout() {
    if (busy.current) return;
    if (Date.now() < retryAt.current) {
      setMessage('Sign-out is not confirmed. Wait for the retry interval.');
      setMode('logout');
      return;
    }
    busy.current = true;
    logoutRequested.current = true;
    setPending(true);
    hide();
    setMode('logout');
    try {
      let proof: string;
      try {
        proof = (await currentSession()).proof;
      } catch (error) {
        if (!(error instanceof AccessError) || error.status !== 401)
          throw error;
        proof = csrfProof(await authRequest('csrf'));
      }
      const result = await authRequest('logout', undefined, proof);
      if (
        !result ||
        typeof result !== 'object' ||
        !('signedOut' in result) ||
        result.signedOut !== true
      )
        throw new AccessError(503);
      retained.current.clear();
      setValues({});
      setSession(null);
      signalAccessChange('logout');
      window.location.replace('/sign-in');
    } catch (error) {
      if (
        error instanceof AccessError &&
        (error.status === 429 || error.status === 503)
      )
        retryAt.current = Date.now() + error.retryAfter * 1000;
      setMessage(`Sign-out is not confirmed. ${failureMessage(error)}`);
      setMode('logout');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const renderedOwner = session?.operatorId ?? authority.current.operatorId;
  return (
    <>
      <div
        ref={presentation}
        hidden={mode !== 'ready'}
        inert={mode !== 'ready'}
      >
        <WorkContext.Provider
          value={{
            operatorId: renderedOwner,
            rejectAccess,
            values,
            record: (next) => {
              if (
                accessible.current &&
                authority.current.operatorId === renderedOwner &&
                !logoutRequested.current
              ) {
                retained.current.record(renderedOwner, next);
                setValues(next);
              }
            },
            authorize: async () => {
              return (
                accessible.current &&
                authority.current.operatorId === renderedOwner &&
                (await validate()) &&
                authority.current.operatorId === renderedOwner
              );
            },
          }}
        >
          <OverlayScope active={mode === 'ready'} container={presentation}>
            <AppShell
              key={session?.operatorId}
              name="Platform console"
              description="Platform workspace"
              navigation={<AppNavigation />}
            >
              <div className="mb-5 flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => void logout()}
                  pending={pending}
                >
                  Sign out
                </Button>
              </div>
              <div>{children}</div>
            </AppShell>
          </OverlayScope>
        </WorkContext.Provider>
      </div>
      {mode !== 'ready' && (
        <main className="mx-auto max-w-md p-6 pt-16">
          <p role="status" className="mb-4">
            {message || 'Checking platform access…'}
          </p>
          {mode === 'reauth' ? (
            <SignIn
              onAuthenticated={(next) => {
                epoch.current++;
                accept(next);
              }}
            />
          ) : (
            mode !== 'unknown' && (
              <div className="flex flex-wrap gap-3">
                <Button
                  ref={retryFocus}
                  onClick={() =>
                    void (mode === 'logout' ? logout() : validate())
                  }
                  pending={pending}
                >
                  {mode === 'logout' ? 'Retry sign out' : 'Retry access'}
                </Button>
                {mode !== 'logout' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      hide();
                      setMode('reauth');
                    }}
                  >
                    Sign in
                  </Button>
                )}
              </div>
            )
          )}
        </main>
      )}
    </>
  );
}
