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
