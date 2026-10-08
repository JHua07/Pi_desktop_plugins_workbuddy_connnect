# 第三方代码及依赖声明 / Third-party notices

## DSH WorkBuddy Connect — MIT

- 主要参考并复用的代码仓库：**https://github.com/corrinehu/dsh-workbuddy-connect.git**
- 项目网页：https://github.com/corrinehu/dsh-workbuddy-connect
- 作者 / copyright：**Corrine Hu — Copyright (c) 2026 Corrine Hu**
- 固定版本：`0.7.1`
- 固定提交：`fa570627016f56adfd2f91ccd706356b9157f2a7`
- MIT 原文：[vendor/dsh-workbuddy-connect/LICENSE](vendor/dsh-workbuddy-connect/LICENSE)

Selected original TypeScript modules are preserved in `vendor/dsh-workbuddy-connect/` with their original license and copyright. They cover credential parsing/protection, token refresh, app/client identity, model catalogs and upstream request protocol. `bridge/core.cjs` bundles these modules for use by the PI plugin and standalone bridge.

The build aliases `@deepseek-ai/dsh-home-paths` to `bridge/home.cjs`, so credentials, identity caches and catalogs use the PI WorkBuddy Connect data directory rather than DSH state. PI lifecycle ownership, HTTP management API, dashboard and PI panel integration are adaptations added by this project. No affiliation or endorsement by the upstream author is claimed.

部分认证、加密凭据、token 刷新、目录和上游协议代码直接复用了该 MIT 上游。本项目新增适配不取代原作者版权，发布源码或安装包时保留其许可证。

The upstream credits [Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api) (MIT) for protocol behavior. This project does not separately vendor source modules from that repository; see upstream source comments.

## @deepseek-ai/dsh-atomic-write 0.2.0-rc.2 — MIT

Bundled into `bridge/core.cjs` for original credential locking and atomic updates.

Copyright (c) 2026 DeepSeek. License copy: [vendor/licenses/LICENSE](vendor/licenses/LICENSE).

## esbuild 0.25.12 — MIT

Build-time dependency only; not needed to run the `.piplug` or bundled bridge. Its license is included in the installed development package and available at https://github.com/evanw/esbuild/blob/v0.25.12/LICENSE.md.

## Project-added code — MIT

Copyright (c) 2026 JHua07 and PI WorkBuddy Connect contributors. License: [LICENSE](LICENSE).

许可证索引与中文说明：[LICENSES.md](LICENSES.md)。Software licensing does not grant permission to use third-party accounts, trademarks or services beyond their terms.
