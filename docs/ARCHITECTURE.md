# Architecture and recovery

## Launcher

`personal-home/app.js` handles navigation, app/input launching, preferences, clock and weather. `collections.js` adds the fixed hero, two-row windows, title details and content rows. `collections.css` contains the current cinematic refinements. Outfit is bundled locally.

The current design prefers supplied PNG title logos and retains original colours. Missing ratings display an em dash rather than substituting a TMDB score.

`preview/refined-collections.*` are working design drafts. Once accepted, they are copied into the launcher source. Keep both consistent when making a production change; the preview server overlays these drafts onto a private copy of the app.

## Data workers

- `root/home-feed-refresh.js`: private history and general collections, local artwork cache and publication into app copies.
- `root/imdb-ratings.js`: bounded streaming lookup from IMDb's public daily dataset, with cached scores on failure.
- `root/logo-analysis.js`: bounded PNG colour analysis used for provider artwork selection.
- `root/weather-refresh.js`: fixed Toronto forecast request, separate cached weather feed.

The cinema timer runs every fifteen minutes; general discovery and metadata have longer cache lifetimes. IMDb ratings refresh approximately daily when the worker runs. No HTTP control endpoint is exposed by these workers.

## Existing C1 deployment

The installation maintains a persistent Personal Home source, an installed standalone app, and a RAM overlay for system Home. The overlay is restored by the existing boot integration. Local preference and credential files are separate from app files.

Root scripts include historical versions and migration-specific assumptions. Their names do not imply that they are idempotent installers for a fresh TV. Do not run the whole directory in order. The latest design migration is `root/install-design-refinement.sh`; its payload is staged separately by the maintainer.

Recovery uses the installed fixed helper to restore LG Home or re-enable Personal Home. The two root-level Mac `.command` files invoke these existing helpers over pinned SSH. The latest deployment saved a TV-local backup before changing app files. Detailed device-specific recovery notes remain private under `.local-tv/notes/`.

Rooting, service masking, and privacy settings need separate review for each firmware. On this already rooted C1, LG Developer Mode remains uninstalled as required by the selected root setup. The repository does not automatically reproduce that setup.

## Reactivation state (0.3.4)

webOS can deliver `webOSRelaunch` when bringing an existing Home renderer forward. The earlier handler rebuilt favourites and focused the first tile for every event, which could look like a delayed page reload. During diagnosis the Home renderer PID remained unchanged and the remote helper's last-launch file did not change during the physical test, so an additional helper launch was not observed.

The handler now preserves the existing main Home grid, content row and valid focus during reactivation. From All apps or Inputs it still returns to favourites; an open dialog is dismissed and missing focus is restored. The remote watcher and its fallback timing are unchanged. Run `pnpm run test:relaunch` for the isolated handler regression checks. TV deployment uses `root/install-home-relaunch-fix.sh`, with prior app source and manifest retained in a TV-local backup.


## Preview QR sign-in

The live preview offers Connect 30nama beside the watching row, or as a button in the empty row. It calls the existing provider device-login flow and displays a QR code generated locally by the pinned `qrcode` package. The phone completes sign-in and device approval on 30nama. No password or session token is returned to the frontend.

`tools/preview-pairing.cjs` bounds each connection window to ten minutes, throttles polls, validates the provider login destination, and handles cancellation. `tools/nama-client.cjs` recognizes the observed empty pending response and prevents a cancelled or replaced poll from saving a session. The localhost server accepts only fixed connection POST actions behind its existing random path, exact Origin/Host checks, a required custom header, and bounded JSON bodies. There is no arbitrary provider proxy.

After approval, the private Mac session and preview metadata configuration are updated, the preceding personal row is cleared, and a serialized background refresh republishes the watching list. Direct `file://` copies cannot perform this flow; use the live server URL. The preview alone permits same-origin connections in its CSP; the deployed TV frontend still blocks connections. TV-side QR pairing has not been implemented or deployed.

Run `pnpm run test:pairing` and `pnpm run test:connector`. A real device code, pending polling, approval and refreshed history were verified in the live preview. Screenshots and pending codes stay in ignored private storage.
