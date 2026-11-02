# Launcher source

Current version: **0.3.4**. See the [project README](../README.md) for features, build steps, and TV integration.

`app.js` implements the core launcher. `collections.js` and `collections.css` implement the cinematic content experience. Fonts are local; their licences are included.

Run `node tools/bootstrap.cjs` from the project root to create missing local configuration and feed files from the tracked examples. Live configuration, snapshots, and downloaded artwork are ignored by Git. A fresh checkout therefore has a generic catalog and empty feeds.

The frontend never receives account tokens. TV-side workers and their configuration live outside the packaged application. Deployment does not by itself disable LG firmware telemetry.
