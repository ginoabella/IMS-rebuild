'use client';
import { useRef, useState } from 'react';
import { useIssuerAccess } from './access';
import { Button, Panel } from '@myims/ui-web';
import {
  credentialActionDto,
  type CredentialActionDto,
  type VerificationMethod,
} from '@myims/contracts';
export function StaffCredentialIssuer() {
  const [target, setTarget] = useState(''),
    [purpose, setPurpose] = useState<'setup' | 'reset'>('setup'),
    [method, setMethod] = useState<VerificationMethod>('in_person'),
    [verified, setVerified] = useState(false),
    [action, setAction] = useState<CredentialActionDto | null>(null),
    [token, setToken] = useState(''),
    [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const busy = useRef(false),
    retryAt = useRef(0);
  const access = useIssuerAccess(
    () => {
      setTarget('');
      setAction(null);
      setPurpose('setup');
      setMethod('in_person');
      setToken('');
      setVerified(false);
      setMessage('');
    },
    () => {
      setToken('');
      setVerified(false);
      setMessage('');
    },
  );
  const owner = access.owner;
  async function perform(operation: 'issue' | 'reissue' | 'cancel' | 'status') {
    if (
      busy.current ||
      !access.currentOwner() ||
      Date.now() < retryAt.current ||
      ((operation === 'issue' || operation === 'reissue') && !verified)
    )
      return;
    busy.current = true;
    setPending(true);
    setToken('');
    setMessage('');
    const captured = access.capture();
    try {
      if (!(await access.authorize()) || !captured.current()) return;
      const p = access.currentOwner();
      if (!p) return;
      const endpoint =
        operation === 'issue' || operation === 'reissue'
          ? '/staff/credential-actions'
          : `/staff/credential-actions/${action?.id}${operation === 'cancel' ? '/cancel' : ''}`;
      const response = await fetch(endpoint, {
        method: operation === 'status' ? 'GET' : 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        signal: AbortSignal.timeout(7000),
        headers: {
          'Content-Type': 'application/json',
          'X-Staff-CSRF': p.proof,
        },
        ...(operation === 'status'
          ? {}
          : {
              body: JSON.stringify(
                operation === 'cancel'
                  ? {}
                  : {
                      tenantId: p.tenantId,
                      staffId: target,
                      purpose,
                      operation,
                      verificationMethod: method,
                    },
              ),
            }),
      });
      if (!captured.current()) return;
      if (!response.ok) {
        retryAt.current =
          Date.now() +
          Math.max(
            1,
            Math.min(900, Number(response.headers.get('retry-after')) || 1),
          ) *
            1000;
        const feedback =
          response.status === 403
            ? 'This target or action is not permitted.'
            : response.status === 409
              ? 'Outstanding action exists. Explicitly reissue after verification.'
              : 'Outcome uncertain or request denied. Check status after restoring access; explicitly reissue if needed.';
        if ([401, 503].includes(response.status)) {
          access.reject(feedback);
          return;
        }
        throw new Error(feedback);
      }
      const v = (await response.json()) as Record<string, unknown>;
      if (!captured.current()) return;
      if (operation === 'cancel') {
        if (v.cancelled !== true)
          throw new Error('Outcome uncertain. Check status.');
        setAction(null);
        setMessage('Action cancelled.');
      } else if (operation === 'status') {
        if (!credentialActionDto(v.action))
          throw new Error('Status unavailable.');
        setAction(v.action);
        setMessage(
          `Credential state: ${String(v.credentialState)}; action ${v.action.state}.`,
        );
      } else {
        if (
          !credentialActionDto(v.action) ||
          typeof v.capability !== 'string' ||
          !/^[A-Za-z0-9_-]{43}$/.test(v.capability)
        )
          throw new Error('Outcome uncertain. Check status.');
        setAction(v.action);
        setToken(v.capability);
        setVerified(false);
        setMessage(
          'Code issued once. Hand it securely to the verified person.',
        );
      }
    } catch (error) {
      if (captured.current()) {
        setToken('');
        if (error instanceof TypeError || error instanceof DOMException)
          access.reject(
            'Outcome uncertain. Restore access, then check status before explicitly reissuing.',
          );
        else
          setMessage(
            error instanceof Error
              ? error.message
              : 'Outcome uncertain. Check status.',
          );
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const inputClass =
    'min-h-11 w-full rounded-md border border-subtle bg-muted px-3';
  return (
    <Panel aria-labelledby="staff-issuer-heading">
      <h1
        id="staff-issuer-heading"
        className="font-display text-2xl font-semibold"
      >
        Staff credential handoff
      </h1>
      <p className="mt-2 text-muted-foreground">
        An existing tenant administrator session is required. Verify the person
        against established records and hand the code in person or through an
        approved encrypted private channel.
      </p>
      <Button
        className="mt-3"
        variant="secondary"
        disabled={pending}
        onClick={() => void access.authorize()}
      >
        Check administrator access
      </Button>
      <div data-issuer-work hidden={!owner} className="mt-4 space-y-3">
        <p>Tenant ID: {owner?.tenantId}</p>
        <label className="block" htmlFor="staff-target">
          Target staff ID
        </label>
        <input
          id="staff-target"
          className={inputClass}
          value={target}
          maxLength={36}
          onChange={(e) => {
            setTarget(e.target.value);
            setAction(null);
            setToken('');
            setVerified(false);
            setMessage('');
          }}
          disabled={pending}
        />
        <label className="block" htmlFor="staff-purpose">
          Credential action
        </label>
        <select
          id="staff-purpose"
          className={inputClass}
          value={purpose}
          onChange={(e) => {
            setPurpose(e.target.value as 'setup' | 'reset');
            setToken('');
            setVerified(false);
          }}
          disabled={pending}
        >
          <option value="setup">Set unset credentials</option>
          <option value="reset">Reset ready credentials</option>
        </select>
        <label className="block" htmlFor="staff-method">
          Verification method
        </label>
        <select
          id="staff-method"
          className={inputClass}
          value={method}
          onChange={(e) => setMethod(e.target.value as VerificationMethod)}
          disabled={pending}
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
            onChange={(e) => setVerified(e.target.checked)}
            disabled={pending}
          />
          <span>
            I verified this person and will use the approved secure handoff.
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={pending || !verified}
            onClick={() => void perform('issue')}
          >
            Issue staff code
          </Button>
          <Button
            variant="secondary"
            disabled={pending || !verified}
            onClick={() => void perform('reissue')}
          >
            Reissue staff code
          </Button>
          <Button
            variant="secondary"
            disabled={pending || !action}
            onClick={() => void perform('status')}
          >
            Check action status
          </Button>
          <Button
            variant="secondary"
            disabled={pending || !action}
            onClick={() => void perform('cancel')}
          >
            Cancel staff code
          </Button>
        </div>
        {token && (
          <div>
            <p>One-time handoff code</p>
            <output
              aria-label="One-time handoff code"
              className="block break-all p-3 font-mono"
            >
              {token}
            </output>
            <Button variant="secondary" onClick={() => setToken('')}>
              Hide code
            </Button>
          </div>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-4">
        {access.message || message}
      </p>
    </Panel>
  );
}
