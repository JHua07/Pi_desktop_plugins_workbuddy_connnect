# Third-party notices

## DSH WorkBuddy Connect (MIT)

Source: https://github.com/corrinehu/dsh-workbuddy-connect
Version: 0.7.1
Commit: fa570627016f56adfd2f91ccd706356b9157f2a7

Selected original TypeScript modules are preserved unchanged in `vendor/dsh-workbuddy-connect/` with their LICENSE. `bridge/core.cjs` bundles these modules for standalone use. The build aliases only `@deepseek-ai/dsh-home-paths` to `bridge/home.cjs` so credentials, identity caches and catalog caches belong to `~/.pi-workbuddy-connect`, not DSH. PI-specific HTTP server and CLI are new code. The original private-client protocol is not an official WorkBuddy API.

The upstream credits Sliverkiss/workbuddy2api (MIT) for protocol behavior. See upstream source comments.

## @deepseek-ai/dsh-atomic-write 0.2.0-rc.2

Used and bundled for original credential locking and atomic updates. Its license notice is included in `vendor/licenses/` after dependency installation.

## esbuild 0.25.12 (MIT)

Build-time dependency only; not needed to run the packaged bridge.
