# Personal Home

**A cinematic Home launcher for LG webOS TVs.**

App shortcuts, a fixed title hero, and smooth rows of things to watch—rendered locally, with your TV remote.

Built and tested on an LG C1 running webOS 6. Current deployed version: **0.3.3**.

## The experience

- **Your apps, up front.** Compact icons, a custom Browser icon, configurable favourites, and HDMI inputs.
- **A cinematic hero.** Large background artwork, original-colour PNG title logos, descriptions, cast, trailers, and IMDb ratings when available.
- **Two rows in view.** Fixed hero information, visible row headings, and composited row transitions tuned for the C1.
- **Personal and discovery rows.** Optional 30nama continue watching; Popular today; Apple TV, HBO, Netflix, and A24 collections.
- **A quiet header.** Outfit typography, a large clock, and cached Toronto weather with condition icons.

The frontend reads local files. Separate TV workers fetch metadata, weather, and an optional authenticated watching list. Tokens stay outside the application bundle.

## Project map

| Directory | Purpose |
| --- | --- |
| `personal-home/` | Current launcher source and safe configuration/feed examples |
| `root/` | TV integration, fixed data workers, service units, deployment and recovery scripts |
| `tools/` | Packaging, private connectors, preview, and verification tools |
| `preview/` | Design drafts and locally bundled font comparisons |
| `docs/` | Architecture, development, and privacy notes |
| `.tooling/` | Pinned official webOS CLI manifest and lockfile |

Local device state lives in ignored `.local-tv/`. Downloaded research checkouts, artwork caches, build output, and screenshots are also ignored.

## Get started

Use Node.js 20+, Python 3, and pnpm on the development computer. The TV workers retain Node 8 compatibility for the C1.

```sh
pnpm install --frozen-lockfile
pnpm --dir .tooling install --frozen-lockfile
pnpm run setup
pnpm run build
pnpm run check:package
```

Setup creates missing `config.js` and feed files from tracked examples. It preserves existing local files. A fresh checkout starts with a generic app catalog and empty content feeds; it contains **no personal account or viewing data**. Populated artwork and feeds must be generated locally before packaging them. The build writes an IPK under `artifacts/`.

For a simple layout preview after setup:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory personal-home
```

Open [the local preview](http://127.0.0.1:8080). The authenticated design preview in `tools/nama-preview.cjs` additionally needs private connector/runtime caches; it is intended for an already configured development machine.

## TV integration

**This is an existing C1 setup, not a universal rooting installer.** The scripts under `root/` include device-specific integration and historical migrations. Read them before using them on another TV. Installing the ordinary launcher app and replacing system Home are separate operations.

Maintenance uses SSH with a dedicated key and pinned host identity. Configure the hostname without editing source:

```sh
export TV_HOST=your-tv-hostname
node tools/root-tv.cjs 'id'
```

Alternatively, put `{"host":"your-tv-hostname"}` in `.local-tv/device.json`. Keys and known-host files belong in `.local-tv/`; they must be provisioned separately. Existing scripts do not discover or root another TV automatically.

The Mac recovery shortcuts are **Restore LG Home.command** and **Enable Personal Home.command**. Keep backups and a working maintenance connection before changing system Home. See [architecture and recovery](docs/ARCHITECTURE.md).

## Privacy and data

The repository excludes tokens, account sessions, SSH keys, device inventories, personal watching feeds, screenshots, and private setup notes. See [the privacy guide](docs/PRIVACY.md) before sharing a copy of the working directory.

This launcher does not establish that LG continuously records microphone audio, nor does replacing Home prove that all firmware telemetry has stopped. Privacy settings and service changes are separate from the launcher UI.

## Credits and scope

Inspired by [theboringtv-lgwebos](https://github.com/theboringhumane/theboringtv-lgwebos). The implementation here is customized for this setup.

Metadata and artwork: TMDB. Displayed scores: IMDb's public non-commercial daily dataset. Weather: Open-Meteo. Optional account history: 30nama. Service/studio rows are our discovery selections, not official streaming charts. Availability and browser playback depend on the provider.

Font licences are bundled beside the fonts. App/provider logos and downloaded artwork remain the property of their owners. This repository does not grant redistribution rights to third-party content; no project-wide licence has been selected.
