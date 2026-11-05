# Edifier remote volume control

A separate root worker controls an Edifier S1000W over the local network. It runs independently of Personal Home, including while a streaming app or HDMI input is open. The launcher does not need to stay open.

| Button | Speaker mode on | Speaker mode off |
| --- | --- | --- |
| Volume + / − | Adjust Edifier volume by 5; holding repeats | LG handling |
| Short Mute | Save volume / set zero; restore on unmute | LG handling |
| Hold Mute about 2 seconds, then release | Turn speaker mode off | Turn speaker mode on |
| Arrows, OK, Home and other keys | Normal handling | Normal handling |

A passive overlay confirms mode changes and shows the speaker's reported volume or mute state, then disappears. The mode setting survives worker restarts and, after installation of the boot hook, TV restarts. Turning the mode off does not change the speaker's existing mute state. Mute saves the last volume in root-only settings, sets the actual speaker volume to zero, and restores it on unmute. This avoids the S1000W’s UPnP mute flag, which did not silence optical audio in the physical test. Changing volume while muted restores the saved level with the requested adjustment; an external nonzero volume change clears our mute state.

## Device discovery and access

The private settings identify the speaker by its UPnP UDN, manufacturer and model. The last IP is a hint: SSDP discovery finds the same speaker again when its address changes. Identity is checked before writes. The worker reads back volume and mute rather than inferring them from the TV's volume scale. It does not switch speaker inputs.

The control channel listens only on `127.0.0.1:41273`, requires a random private capability token and accepts four fixed audio actions. It has no arbitrary command, URL or file API. Credentials remain in root-only TV files and the ignored `.local-tv/` directory; they are absent from the overlay app. UPnP control itself uses the speaker's local HTTP interface.

If the speaker or worker becomes unavailable, audio keys fall back to LG handling. The speaker can still be controlled with its own app or remote. This does not imply that LG's fallback controls necessarily adjust an optical speaker.

## Firmware integration

This integration is specific to the existing LG C1 setup on firmware **03.53.45**. It is not a universal webOS installer.

Three RAM bind mounts are used; original LG files on flash retain their bytes:

- `systemUi.js`: handle only the three audio keys at the first ordinary filter, with a short-lived worker heartbeat.
- `appLaunch.js`: avoid LG's competing long-Mute Audio Guidance timer and triple-Mute reset menu for owned speaker actions.
- `libqstarfishegl.so`: bypass two native Volume +/− fast-path branches so those keys reach the ordinary Qt key filters. Stock LG volume handling remains the fallback there.

The native patch generator requires an exact original SHA-256 and checks both instruction sequences. It changes eight bytes in a private generated copy. No LG firmware binary or full firmware source is distributed in this repository. Startup checks firmware hashes and refuses to apply the overlays to an unrecognized update. The worker and overlay are separate from the Home-button integration.

Public source is under `speaker-service/`, `speaker-overlay/` and `tools/speaker/`. Generate patched firmware copies locally with the three `patch-*.py` tools using pristine private backups. Keep the resulting files, settings and backups outside Git. `speaker-service/settings.example.json` lists the required private fields; its placeholders cannot authenticate.

The overlay IPK can be built with the repository's webOS CLI dependency:

```sh
node .tooling/node_modules/@webos-tools/cli/bin/ares-package.js speaker-overlay --outdir artifacts --no-minify
```

## Recovery and testing

On the configured maintenance Mac, open **Restore LG Volume.command** to stop the worker, disable its boot startup and remove the RAM overlays. The already loaded key filter returns to LG handling when the worker heartbeat expires; the next compositor start loads original code. **Enable Speaker Controls.command** installs the runtime overlays again; hold Mute to select speaker mode.

Equivalent commands, using the configured pinned SSH connection:

```sh
node tools/speaker/control-tv.cjs status
node tools/speaker/control-tv.cjs disable
node tools/speaker/control-tv.cjs enable
```

`accept` installs the boot hook and marks a guarded trial accepted. Use it only after validating the real remote. An unaccepted trial watchdog disables the feature and restarts the compositor after ten minutes.

Desktop checks: `node tools/speaker/test-control.cjs`. TV-only `test-tv.cjs` injects only the three audio keys, checks volume/mute/hold/toggle behaviour and foreground preservation, and restores the speaker's initial volume and mute state. `test-channel.cjs` verifies unauthorized and malformed requests are rejected. Bounded diagnostics contain audio actions only and are stored in TV RAM; no microphone audio or typed text is collected.

The passive floating-window approach was informed by [eARC Volume Overlay](https://github.com/Nikolay1243/Webos-EARC-Volume-Overlay) and [webos-av-overlay](https://github.com/SammySco/webos-av-overlay). This worker controls the Edifier directly rather than relying on ARC volume reports.
