'use client';
import { Button, Field, Input, Panel, Select, Textarea } from '@myims/ui-web';
import { CredentialFields } from './credential-fields';
import { type PeerModel } from './use-peers';
export function PeerForm({ model }: { model: PeerModel }) {
  const { state, kind, submit, blocked, errors, v, change, pending, r, save } =
    model;
  return (
    <>
      {' '}
      {(state.mode === 'create' || state.mode === 'edit') && (
        <Panel aria-label="Resource form">
          <h2 className="font-display text-xl">
            {state.mode === 'create' ? 'Create' : 'Edit'}{' '}
            {kind === 'trunks'
              ? 'trunk'
              : kind === 'gateways'
                ? 'gateway'
                : 'DID'}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="mt-4 space-y-4"
          >
            <fieldset disabled={blocked} className="min-w-0 space-y-4">
              <Field id="peer-name" label="Name" error={errors.name}>
                <Input
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'peer-name-error' : undefined}
                  id="peer-name"
                  required
                  maxLength={320}
                  value={v.name}
                  onChange={(e) => change('name', e.target.value)}
                />
              </Field>
              {kind === 'trunks' ? (
                <>
                  <Field
                    id="peer-direction"
                    label="Direction"
                    error={errors.direction}
                  >
                    <Select
                      aria-invalid={!!errors.direction}
                      aria-describedby={
                        errors.direction ? 'peer-direction-error' : undefined
                      }
                      id="peer-direction"
                      value={v.direction}
                      onChange={(e) => change('direction', e.target.value)}
                    >
                      <option value="inbound">Inbound</option>
                      <option value="outbound">Outbound</option>
                      <option value="both">Both</option>
                    </Select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="peer-host" label="Remote host or IP">
                      <Input
                        id="peer-host"
                        required
                        maxLength={253}
                        value={v.host}
                        onChange={(e) => change('host', e.target.value)}
                      />
                    </Field>
                    <Field id="peer-port" label="SIP port">
                      <Input
                        id="peer-port"
                        type="number"
                        required
                        min={1}
                        max={65535}
                        value={v.port}
                        onChange={(e) => change('port', e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field
                    id="peer-settings"
                    label="Codecs"
                    error={errors.settings}
                  >
                    <Select
                      aria-invalid={!!errors.settings}
                      aria-describedby={
                        errors.settings ? 'peer-settings-error' : undefined
                      }
                      id="peer-settings"
                      value={v.codecs}
                      onChange={(e) => change('codecs', e.target.value)}
                    >
                      <option value="ulaw,alaw">ulaw and alaw</option>
                      <option value="ulaw">ulaw</option>
                      <option value="alaw">alaw</option>
                    </Select>
                  </Field>
                  <Field id="peer-auth" label="Authentication">
                    <Select
                      id="peer-auth"
                      value={v.authentication}
                      onChange={(e) => change('authentication', e.target.value)}
                    >
                      <option value="ip-peer">
                        IP-peer · credentials not required
                      </option>
                      <option value="outbound-digest">Outbound digest</option>
                    </Select>
                  </Field>
                  <CredentialFields model={model} />
                  <p>
                    UDP/RTP · direct media off · symmetric RTP and force-rport
                    on.
                  </p>
                </>
              ) : kind === 'dids' ? (
                <>
                  <Field
                    id="peer-number"
                    label="DID number"
                    error={errors.number}
                  >
                    <Input
                      id="peer-number"
                      required
                      maxLength={320}
                      value={v.number}
                      aria-invalid={!!errors.number}
                      aria-describedby={
                        errors.number
                          ? 'peer-number-error did-number-help'
                          : 'did-number-help'
                      }
                      onChange={(e) => change('number', e.target.value)}
                    />
                  </Field>
                  <p id="did-number-help">
                    Spaces, hyphens and parentheses are removed. Use 1–15 ASCII
                    digits and an optional leading +. Leading zeros and + remain
                    distinct; no country code is inferred. Disabled DIDs still
                    reserve their number.
                  </p>
                  <p>
                    Canonical preview:{' '}
                    <span className="font-mono break-all">
                      {v.number.trim().replace(/[ ()-]/g, '') || '—'}
                    </span>
                  </p>
                  <Field
                    id="peer-gatewayId"
                    label="Gateway ID"
                    error={errors.gatewayId}
                  >
                    <Input
                      id="peer-gatewayId"
                      required
                      maxLength={36}
                      value={v.gatewayId}
                      aria-invalid={!!errors.gatewayId}
                      aria-describedby={
                        errors.gatewayId ? 'peer-gatewayId-error' : undefined
                      }
                      onChange={(e) => change('gatewayId', e.target.value)}
                    />
                  </Field>
                  <p>
                    Copy the gateway ID from its detail. Choose a nonremoved
                    gateway on this PBX; multiple DIDs may share it. No tenant
                    or route destination is assigned.
                  </p>
                </>
              ) : (
                <>
                  <Field
                    id="peer-kind"
                    label="Gateway kind"
                    error={errors.kind}
                  >
                    <Select
                      aria-invalid={!!errors.kind}
                      aria-describedby={
                        errors.kind ? 'peer-kind-error' : undefined
                      }
                      id="peer-kind"
                      value={v.kind}
                      onChange={(e) => change('kind', e.target.value)}
                    >
                      <option value="sip-device">SIP device</option>
                      <option value="sip-provider">SIP provider</option>
                    </Select>
                  </Field>
                  <Field
                    id="peer-trunkId"
                    label="Trunk ID (required for provider gateways)"
                    optional={v.kind !== 'sip-provider'}
                    error={errors.trunkId}
                  >
                    <Input
                      aria-invalid={!!errors.trunkId}
                      aria-describedby={
                        errors.trunkId ? 'peer-trunkId-error' : undefined
                      }
                      id="peer-trunkId"
                      required={v.kind === 'sip-provider'}
                      value={v.trunkId}
                      maxLength={36}
                      onChange={(e) => change('trunkId', e.target.value)}
                    />
                  </Field>
                  <p>
                    Copy the trunk ID from its detail. Provider gateways require
                    an inbound-capable trunk on this PBX. A device gateway can
                    be standalone.
                  </p>
                  <Field
                    id="peer-sourceAddresses"
                    label="Exact source IP addresses"
                    error={errors.sourceAddresses}
                  >
                    <Textarea
                      aria-invalid={!!errors.sourceAddresses}
                      aria-describedby={
                        errors.sourceAddresses
                          ? 'peer-sourceAddresses-error'
                          : undefined
                      }
                      id="peer-sourceAddresses"
                      required
                      rows={3}
                      value={v.sources}
                      onChange={(e) => change('sources', e.target.value)}
                    />
                  </Field>
                  <p>
                    One IPv4 or IPv6 host address per line, up to 32. Hostnames,
                    subnets and caller-ID matching are unavailable. Disabled
                    gateways still reserve addresses.
                  </p>
                </>
              )}
              {errors.body && <p role="alert">Review the form values.</p>}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" pending={pending}>
                  Save{' '}
                  {kind === 'trunks'
                    ? 'trunk'
                    : kind === 'gateways'
                      ? 'gateway'
                      : 'DID'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    save({ ...state, mode: r ? 'detail' : 'list' })
                  }
                >
                  Cancel edit
                </Button>
              </div>
            </fieldset>
          </form>
        </Panel>
      )}
    </>
  );
}
