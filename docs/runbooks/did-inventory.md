# Trunk, gateway and DID desired inventory

Open **PBX nodes → Inspect → Manage trunks, gateways and DIDs** in the platform
console. Sign in as a platform operator. All definitions are installation-owned,
desired settings: saving or enabling does not contact a provider, register,
reload Asterisk, route a call or establish tenant voice readiness.

1. In **Trunks**, create a name, direction and typed host/IP, port and codec
   selection. IP-peer needs no credentials. For outbound digest, first follow
   [trusted credential setup](trunk-credentials.md), then choose the confirmed
   label/version. Optional desired registration needs an explicit registrar/realm.
   Inspect the saved trunk and copy its ID.
2. In **Gateways**, create a SIP provider with the inbound-capable trunk ID, or a
   SIP device with an optional trunk. Enter exact source IP hosts. Sources are
   unique across nonremoved gateways, including disabled records. Inspect and
   copy the gateway ID.
3. In **DIDs**, create a name, called number and gateway ID from the same PBX.
   The form previews the canonical number; saved detail shows the canonical value.
   Multiple DIDs can share one gateway. No destination or tenant is selected.
4. Inspect, edit, enable or disable each definition as needed. These flags express
   desired intent and can be changed independently of linked resource flags.
5. Remove DIDs first, gateways second, trunks last. Gateway ingress changes are
   blocked while DIDs refer to them; trunk connection changes/removal are blocked
   by referencing gateways. Blocker buttons open the referring record. Relink a
   DID through its versioned edit if the gateway should remain in use elsewhere.

Numbers accept 1–15 ASCII digits and one optional leading `+`. Outer whitespace is
trimmed; ordinary spaces, hyphens and parentheses are removed. Leading zeros and
`+` are preserved. `+63 (2) 8123-4567` collides with `+63281234567` on the same
installation, including disabled records. `0281234567` is a separate explicit
form. No country code is inferred. Tabs inside numbers, non-ASCII digits and other
punctuation reject. Names are trimmed and case-insensitively unique per resource
type/installation. Removed names/numbers may be reused only under a new UUID.

Validation and collision rejection retain entered values. Correct the fields and
save again. After a stale version, use **Reload canonical state**, review the
saved detail, then **Use current version** before resubmitting retained inputs.
For an unknown create outcome, use **Retry exact create request**; it retains the
request UUID and cannot create a second identity. For an unknown edit/status/removal,
reload canonical detail and review before continuing. Mounted drafts/recovery do
not survive a browser refresh. Ordinary access rejection can resume after restoring
the same operator session; another operator cannot adopt the retained work.

Deploy with `./dev migrate`, refresh ordinary backend with `./dev up`, and refresh
the console with `./dev platform-https-stop` followed by `./dev platform-https`. Verify `./dev health` and
`./dev platform-https-check`. Migrations are additive and retain existing resource,
endpoint, provider and backup data. Stop new consumers to roll back code while
retaining schema/history; no destructive down migration is supplied.

Reproduce integrated real PostgreSQL/A/B API/HTTPS browser checks with:

```sh
MYIMS_TRUNK_INSTALLATION_ID=58adb785-5384-41ce-9c72-ccda6ea554db ./dev exec pnpm check:trunk-gateways
./dev exec pnpm check:extension-inventory --inventory
./dev check
```

The installation variable enables real trusted OpenBao synthetic import into the
isolated acceptance database. It requires the existing protected trunk setup
access; provider versions remain retained. Without it, metadata and provider fault
fixtures prove API/browser contracts, not real OpenBao setup. Test PBX targets use
unreachable `.invalid` hosts; no telephony process is started for this journey.

P3-U4 must deliberately resolve alternate-number forms and add real routing
references before consuming IDs. P3-U5 must add actual applied-use dependencies,
validate coexistence and own compilation/apply/recovery. P4 must add allocation
ownership and voice-readiness checks. Those consumers must use retained UUIDs,
register their real blockers and take the node lock before reference changes;
name/number reuse never retargets old references. No purchasing, inbound routing,
call test, live registration or production readiness is delivered here.
