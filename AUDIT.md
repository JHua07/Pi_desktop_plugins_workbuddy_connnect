# 0.4.1 targeted audit

## Live state checked

- Listener is owned by PI's plugin process, bound to 127.0.0.1:18765 only.
- Legacy Windows login task and PowerShell .lnk were absent. The remaining .url contains only the local browser address, not a script launcher.
- Domestic auth/catalog worked: 19 models, upstream source. International had no credential, not an error in the domestic integration.
- Live unauthenticated model request: HTTP 401. Foreign-Origin request: HTTP 403. Authenticated models: HTTP 200.
- No real API key was regenerated, no PI restart or paid chat was performed.

## Fixed defects

1. Failed catalog refresh could retain `upstream` provenance and claim refresh success. It now reports cached/builtin fallback and a stale-catalog warning, preserving the last successful timestamp.
2. An already-open PI panel could copy the old key after another window regenerated it. Key display/copy/config-copy now reread authorized current configuration; pending old configuration is discarded.
3. Signing out could leave old model rows on screen. Status synchronization clears them and updates the available count.
4. Logging in again and manually refreshing could load models while still showing signed-out auth. Manual refresh now synchronizes auth and refresh metadata; cache fallback is not shown as success. Catalog changes are reloaded on status refresh.

## Verification

43 built-in tests passed, including new regressions. Actual original PI 0.17.0 host code was exercised through isolated IPC, with lifecycle + Edge panel tests: start, auto authorization, pause/resume and unload port release. Edge separately exercised key changes, logout/relogin, model changes, cache warnings, and mobile layout without JavaScript errors.

At the final live check the service reported version 0.4.1, PI-managed ownership, and the new refresh metadata. No manual installation or PI restart was performed during this audit; development hot reload may have applied the edits. Refresh already-open panels. The 0.4.1 package is also provided for normal installation.

## Remaining limits

Actual paid model chat/tool continuation and a full quit/relaunch of PI are still unverified. International real account flow was not tested. Model registration in PI remains a one-time manual configuration. WorkBuddy's upstream private protocol may change; source compatibility and antivirus acceptance are not guaranteed by unit tests. Native credential/file/network code is not an OS capability sandbox, as documented in README.
