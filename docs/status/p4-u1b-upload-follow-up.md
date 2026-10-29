# P4-U1b manual upload follow-up

Date: 2026-10-29 (Asia/Manila, +08:00).

## Failure and repair

Returning from a native file picker can trigger the console's focus-based access
revalidation before the file change event or while `File.arrayBuffer()` is pending.
The geography editor previously discarded the selection when locked or when its
captured access generation became stale, without feedback. Both file inputs also
reset immediately, leaving “No file chosen” without a nearby accepted filename.

The editor now keeps the selected File in its owner/tenant-mounted state until
access is ready, and retries a read whose access capture became stale. Existing
access fencing still controls when parsed values can enter the staged editor.
Pending selections disable editing and saving. Existing operator/tenant remounts
clear this work. Accepted administrative/barangay filenames appear beside their
pickers, clear after save/discard/layer clearing, and survive rejected replacements.
The inputs still reset to permit selecting the same file again. The manual guide
now identifies the staged filename and preview as the upload feedback.

No backend, storage, database or geography-policy change was required.

## Verification

- Added a deterministic regression that holds the real session response while
  delivering a file selection after window focus. It failed against the original
  production browser bundle because no staged boundary appeared.
- The repaired browser flow passes that regression and a second access change
  during an actual File read, asserting the replacement's distinct filename.
  It also checks both accepted filenames, invalid replacement retention, filename
  clearing after save, Naga geometry/27 barangays/default coordinates saved and
  reloaded across replicas, access recovery, owner/target isolation, and existing
  validation, conflict, uncertain recovery, keyboard, reflow and axe checks.
- Affected ESLint, console TypeScript and diff whitespace checks passed.
- Focused onboarding browser command: `./dev exec pnpm check:draft-tenant
--onboarding-browser`. The isolated production console build and geography,
  name/contact, voice and draft browser groups passed. A subsequent bounded
  sign-in rate-limit assertion returned frontend 503 while its backend returned
  401, overlapping the ordinary console rebuild. The final sequential rerun
  passed completely, exit 0, including that authentication retry, access recovery
  and independent-process/audit redaction checks. No authentication code changed.
- Ordinary platform HTTPS refresh completed. `./dev platform-https-check`
  passed transport/browser/access-denial and identity/data-preservation checks;
  `./dev health` returned live/ready HTTP 200 with database and both Redis
  services up. Staff HTTPS remained ready.

The regression controls focus and file-read timing in Chromium with real
Next/HTTPS/Nest/session services. It does not automate the operating system's native
file dialog. The user's desktop retry remains the manual confirmation of that path.
The full repository/foundation graph was not rerun for this focused editor repair.
