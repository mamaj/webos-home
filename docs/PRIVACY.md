# Privacy and repository boundaries

## Kept locally, excluded from Git

- `.local-tv/`: provider tokens, 30nama sessions, SSH private keys and host pins, device addresses, inventories, diagnostics, backups, screenshots, and private notes.
- `artifacts/`: IPKs, render screenshots, and deployment reports. Screenshots can expose watching history even when their filenames look harmless.
- `audit/` and `cache/`: downloaded third-party projects and research output.
- Generated `personal-home/config.js` and `*/feed.js`: the actual device catalog and live snapshots.
- Downloaded movie/show artwork and device-specific app icons beyond the generic sample catalog.

Private operating notes are preserved in `.local-tv/notes/`. Exclusion keeps them out of commits; it does not encrypt them or remove them from local backups.

## Before sharing

Run `pnpm run check:privacy` after staging changes. It checks the Git index rather than the whole private working directory, flags likely credential material, and compares staged bytes against known local authentication values without printing those values. Heuristic scans cannot prove the absence of all personal information; review the staged diff too.

Do not share a ZIP of the entire working directory. Share a reviewed Git commit or `git archive` instead. No remote is configured automatically.

The `com.reza.tvhome` app ID and `reza-*` TV paths are legacy deployment identifiers. They are visible in source because changing them would break the existing installation; they are not credentials. Toronto is the explicit default weather city and appears in source. Change these defaults if you want a more anonymous fork.

## Runtime data flows

The frontend is restricted by CSP and consumes local snapshots. TV workers make fixed HTTPS requests for TMDB metadata/artwork, Open-Meteo weather, IMDb's bulk ratings dataset, and optional 30nama history. Providers still receive the connection's public IP. 30nama session credentials allow account access even though this connector uses read operations; protect them accordingly.

Provider tokens are not bundled into the web app. A TV backend session does not sign the TV browser in. Reconnection may be needed when the provider rejects a saved session.

No credentials were committed before Git initialization in this project. If a secret is ever committed later, ignoring the file or deleting it in a subsequent commit is insufficient: rotate the credential and address the repository history before publishing.
