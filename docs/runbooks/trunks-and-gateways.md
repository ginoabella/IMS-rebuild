# Manage IP-peer trunks and gateways

Sign in to the platform console, open **PBX nodes**, inspect the intended PBX,
then choose **Manage trunks and gateways**. Its canonical installation owns all
records. Management works when the PBX is offline.

1. In **Trunks**, choose **Create trunk**. Enter a unique name, direction, remote
   host/IP, SIP port and codecs. Save creates a disabled desired IP-peer definition.
2. Inspect it to copy its stable ID. In **Gateways**, create a SIP provider linked
   to that ID, or a SIP device with an optional trunk. Provider trunks must support
   inbound traffic. Enter up to 32 exact IPv4/IPv6 sources, one per line.
3. Inspect/edit either resource and use enable/disable to change desired intent.
   A disabled trunk can still be referenced; enabled is not a connected/readiness claim.
4. Choose remove and confirm. Referencing gateways (including disabled ones) block
   trunk removal or incompatible connection edits. Inspect those gateways to relink
   or remove them, then retry after canonical reload. History remains retained.

Names ignore case for uniqueness within one installation and resource type.
Disabled gateways still reserve their exact addresses. IPv6 spelling variants and
IPv4-mapped IPv6 collide with their canonical hosts. Subnets, hostnames and wildcard
source matching reject. Deployment administrators can list known unmanaged ingress
in the existing PBX catalog's optional `unmanagedIngress` array; ordinary forms cannot
adopt those addresses. Use a deployment-maintained catalog selected by `PBX_CATALOG_FILE`
for persistent custom declarations; the local `pbx-catalog-prepare` utility regenerates
its own catalog and is not an editor for custom metadata. No DNS lookup or live coexistence check occurs on save.

Correct field errors without losing entered values. If another operator changes a
record, choose **Reload canonical state**, review the current data, then **Use current
version** and review retained inputs before saving. If a write outcome is unknown,
reload/review its canonical record. For an unknown create, **Retry exact create
request** reuses its request ID and returns its original result. Do not invent a new
create request merely because a response was lost. Sign-in/access correction uses the
existing mounted recovery; browser refresh does not preserve unfinished input.

Digest credentials, registration, DIDs, routing, live apply and tenant voice readiness
belong to later units. No operation in this screen registers, reloads or calls.

Verification: `./dev exec pnpm check:trunk-gateways` uses disposable PostgreSQL/Redis,
two actual backend replicas and the production Next HTTPS browser. PBX fixture targets
are deliberately unreachable `.invalid` names; it starts no observer/PBX adapter and
changes no Asterisk configuration. Required repository verification is `./dev check`.
See the [stable API and extension boundary](../architecture/trunks-and-gateways.md).
