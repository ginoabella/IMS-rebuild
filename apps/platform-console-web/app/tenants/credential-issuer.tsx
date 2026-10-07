'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Panel, PanelHeading } from '@myims/ui-web';
import {
  credentialActionDto,
  type CredentialActionDto,
  type VerificationMethod,
} from '@myims/contracts';
import { useOperatorWork } from '../auth/console-access';
import { AccessError } from '../auth/client';
export function AdministratorCredentials({
  tenantId,
  credentialState,
}: {
  tenantId: string;
  credentialState: 'unset' | 'ready' | undefined;
}) {
  const work = useOperatorWork();
  const [action, setAction] = useState<CredentialActionDto | null>(null),
    [state, setState] = useState<'unset' | 'ready'>(credentialState ?? 'unset');
  const [token, setToken] = useState(''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false),
    [verified, setVerified] = useState(false),
    [method, setMethod] = useState<VerificationMethod>('in_person');
  const busy = useRef(false),
    mounted = useRef(true),
    retryAt = useRef(0);
  const path = `/platform/tenants/${tenantId}/administrator/credential-actions`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setToken('');
    setVerified(false);
    setMessage('');
    setAction(null);
    setMethod('in_person');
  }, [work.operatorId, tenantId]);
  useEffect(() => {
    if (!work.ready || credentialState === undefined) {
      setToken('');
      setVerified(false);
    }
  }, [work.ready, credentialState]);
  useEffect(() => {
    if (credentialState !== undefined) setState(credentialState);
  }, [credentialState]);
  async function perform(operation: 'status' | 'issue' | 'reissue' | 'cancel') {
    if (
      busy.current ||
      !work.ready ||
      credentialState === undefined ||
      Date.now() < retryAt.current ||
      ((operation === 'issue' || operation === 'reissue') && !verified)
    )
      return;
    const captured = work.capture();
    if (!captured.current()) return;
    busy.current = true;
    setPending(true);
    setToken('');
    setMessage('');
    try {
      const response = await fetch(
        operation === 'cancel' ? `${path}/${action?.id}/cancel` : path,
        {
          method: operation === 'status' ? 'GET' : 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: AbortSignal.timeout(7000),
          headers: {
            'Content-Type': 'application/json',
            'X-Platform-CSRF': captured.proof,
          },
          ...(operation === 'status'
            ? {}
            : {
                body: JSON.stringify(
                  operation === 'cancel'
                    ? {}
                    : {
                        operation,
                        purpose: state === 'unset' ? 'setup' : 'reset',
                        verificationMethod: method,
                      },
                ),
              }),
        },
      );
      if (!mounted.current || !captured.current()) return;
      if (!response.ok) {
        const retry = Number(response.headers.get('retry-after'));
        retryAt.current =
          Date.now() +
          Math.max(1, Math.min(900, Number.isFinite(retry) ? retry : 1)) * 1000;
        if ([401, 429, 503].includes(response.status)) {
          setMessage(
            'Outcome uncertain. Check status after access is restored; explicitly reissue if a new code is needed.',
          );
          work.rejectAccess(
            new AccessError(
              response.status as 401 | 429 | 503,
              Math.max(1, retry || 1),
            ),
          );
          return;
        }
        throw new Error(
          response.status === 409
            ? 'An outstanding action exists. Check status, then explicitly reissue.'
            : response.status === 403
              ? 'This administrator is not eligible for this action.'
              : response.status === 400
                ? 'Check the credential request.'
                : 'Outcome uncertain. Check status after access is restored; explicitly reissue if a new code is needed.',
        );
      }
      const value: unknown = await response.json();
      if (!mounted.current || !captured.current()) return;
      if (!value || typeof value !== 'object')
        throw new Error('Outcome uncertain. Check status before reissuing.');
      const v = value as Record<string, unknown>;
      if (operation === 'status') {
        if (
          !['unset', 'ready'].includes(String(v.credentialState)) ||
          (v.action !== null && !credentialActionDto(v.action))
        )
          throw new Error('Status unavailable.');
        setState(v.credentialState as 'unset' | 'ready');
        setAction(v.action as CredentialActionDto | null);
        setMessage(
          'Canonical credential status loaded. Codes cannot be redisclosed.',
        );
      } else if (operation === 'cancel') {
        if (v.cancelled !== true)
          throw new Error('Outcome uncertain. Check status.');
        setAction(null);
        setMessage('Credential action cancelled.');
      } else {
        if (
          !credentialActionDto(v.action) ||
          typeof v.capability !== 'string' ||
          !/^[A-Za-z0-9_-]{43}$/.test(v.capability)
        )
          throw new Error('Outcome uncertain. Check status before reissuing.');
        setAction(v.action);
        setToken(v.capability);
        setVerified(false);
        setMessage(
          'Code issued once. Hand it directly to the verified person.',
        );
      }
    } catch (error) {
      if (mounted.current && captured.current()) {
        setToken('');
        setMessage(
          error instanceof Error
            ? error.message
            : 'Outcome uncertain. Check status.',
        );
        if (error instanceof TypeError || error instanceof DOMException)
          work.rejectAccess(new AccessError(503, 1));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  return (
    <Panel
      aria-labelledby="credential-heading"
      hidden={credentialState === undefined}
    >
      <PanelHeading id="credential-heading">
        Administrator credentials
      </PanelHeading>
      <p className="mt-2 text-muted-foreground">
        Credentials do not activate a tenant. Verify the person against
        established organization records and use in-person or approved encrypted
        private handoff.
      </p>
      <div className="mt-4 space-y-3">
        <Button
          variant="secondary"
          disabled={pending || !work.ready}
          onClick={() => void perform('status')}
        >
          Check credential status
        </Button>
        <p>
          Credential state: {state}.{' '}
          {action &&
            `Action: ${action.state}; expires ${new Date(action.expiresAt).toLocaleString()}.`}
        </p>
        <label className="block" htmlFor="verification-method">
          Verification method
        </label>
        <select
          id="verification-method"
          className="min-h-11 w-full rounded-md border border-subtle bg-muted px-3"
          value={method}
          disabled={pending}
          onChange={(e) => setMethod(e.target.value as VerificationMethod)}
        >
          <option value="in_person">In person</option>
          <option value="known_contact_call">
            Live call to established contact
          </option>
        </select>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5"
            checked={verified}
            disabled={pending}
            onChange={(e) => setVerified(e.target.checked)}
          />
          <span>
            I verified this person and will use the approved secure handoff.
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={pending || !verified || !work.ready}
            onClick={() => void perform('issue')}
          >
            {state === 'unset' ? 'Issue setup code' : 'Issue recovery code'}
          </Button>
          <Button
            variant="secondary"
            disabled={pending || !verified || !work.ready}
            onClick={() => void perform('reissue')}
          >
            Reissue code
          </Button>
          <Button
            variant="secondary"
            disabled={pending || !action || !work.ready}
            onClick={() => void perform('cancel')}
          >
            Cancel code
          </Button>
        </div>
        {token && (
          <div className="space-y-2">
            <p className="font-semibold">One-time handoff code</p>
            <output
              className="block break-all rounded-md border border-subtle p-3 font-mono"
              aria-label="One-time handoff code"
            >
              {token}
            </output>
            <p>
              Give the recipient the clean HTTPS credentials page address
              separately. Keep the code out of URLs, email/SMS and support
              reports.
            </p>
            <Button variant="secondary" onClick={() => setToken('')}>
              Hide code
            </Button>
          </div>
        )}
        <p role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </Panel>
  );
}
