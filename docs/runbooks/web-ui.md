# Web UI development and verification

Start the Docker workspace with `./dev up`. In separate terminals run
`./dev command` and `./dev platform`. The published local URLs are
`http://localhost:3100` and `http://localhost:3101`. Shared styling and components
are described in [web UI foundation](../architecture/web-ui-foundation.md).

After `./dev check` builds the workspace, the focused browser check starts and
stops private production instances inside Docker on ports 3200/3201:

```sh
./dev exec pnpm check:ui
```

One-time setup per new workspace container (after dependency installation):

```sh
./dev exec pnpm exec playwright install chromium
docker compose -p myims-rebuild-dev -f infra/docker/compose.yaml exec -T --user root workspace pnpm exec playwright install-deps chromium
```

Browser binaries and system libraries are development-only container assets;
recreating the workspace may require setup again. These commands do not install
browser tooling on the host. No manually running preview is required for the
browser check. After changing dependencies or PostCSS configuration, restart the development app processes so they resolve the current installation.

`./dev check` runs the complete existing quality and backend-foundation checks.
The browser check is separate because it needs Chromium. CI runs it after the
quality and foundation checks. Generated traces and results live in ignored
`test-results/`; visual captures live in `.local/ui-review/`.

Review the actual UI at desktop, tablet and narrow sizes, including keyboard
focus, font rendering, contrast, long labels, zoom and reduced motion. Browser
automation does not establish screen-reader, native-device or production launch
accessibility certification. Record results and remaining limits in the unit's
evidence document.

The two operations apps use Webpack for development, matching their existing
production build mode. Turbopack's persisted development graph panicked on a
previously removed temporary route during P1-U4 verification. Switching to the
[supported Webpack CLI mode](https://nextjs.org/docs/app/api-reference/cli/next)
keeps these previews usable without changing the application stack.

The app development commands build `ui-web` before starting Next.js so a fresh
clone does not depend on an existing `dist` directory. While editing shared UI,
run `./dev exec pnpm --filter @myims/ui-web exec tsc --watch` in another terminal.
App-owned source changes reload through Next.js as usual.
