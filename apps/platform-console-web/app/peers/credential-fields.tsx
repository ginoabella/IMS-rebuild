'use client';
import { Button, Field, Input, Select } from '@myims/ui-web';
import type { PeerModel } from './use-peers';
export function CredentialFields({ model }: { model: PeerModel }) {
  const { v, change } = model;
  return (
    <>
      {v.authentication === 'outbound-digest' && (
        <>
          <Field id="peer-credential" label="Credential label and version">
            <Select
              id="peer-credential"
              required
              value={v.credential}
              onChange={(e) => change('credential', e.target.value)}
            >
              <option value="">Choose a confirmed version</option>
              {v.credential &&
                !model.credentials.some(
                  (c) => `${c.id}:${c.version}` === v.credential,
                ) && (
                  <option value={v.credential}>
                    Current selection · reload to verify availability
                  </option>
                )}
              {model.credentials.map((c) => (
                <option
                  key={`${c.id}:${c.version}`}
                  value={`${c.id}:${c.version}`}
                  disabled={!c.available}
                >
                  {c.label} · v{c.version}
                  {c.available ? '' : ' · unavailable'}
                </option>
              ))}
            </Select>
          </Field>
          {model.credentialMessage && (
            <p role="status">{model.credentialMessage}</p>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void model.loadCredentials()}
          >
            Reload credentials
          </Button>
          {model.credentialCursor && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void model.loadCredentials(true)}
            >
              More credentials
            </Button>
          )}
          <Field id="peer-registration" label="Desired outbound registration">
            <Select
              id="peer-registration"
              value={v.registration}
              onChange={(e) => change('registration', e.target.value)}
            >
              <option value="off">Off</option>
              <option value="on">On (desired only)</option>
            </Select>
          </Field>
          {v.registration === 'on' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="peer-registrar" label="Registrar host or IP">
                <Input
                  id="peer-registrar"
                  required
                  value={v.registrar}
                  onChange={(e) => change('registrar', e.target.value)}
                />
              </Field>
              <Field id="peer-realm" label="Registration realm">
                <Input
                  id="peer-realm"
                  required
                  value={v.realm}
                  onChange={(e) => change('realm', e.target.value)}
                />
              </Field>
            </div>
          )}
          <p>
            Versions change only when you select and save them. Registration is
            desired configuration only; no live registration is attempted.
            Expiration/retry/forbidden retry: 3600/60/10 seconds.
          </p>
        </>
      )}
    </>
  );
}
