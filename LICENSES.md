# 许可证与版权说明

## 本项目

PI WorkBuddy Connect 使用 **MIT License**。英文授权与免责原文见根目录 [LICENSE](LICENSE)，本说明不替代或缩减 MIT 原文的授权。

- 本项目新增的 PI 生命周期、接入管理界面、桥接适配、配置流程及相关测试：`Copyright (c) 2026 JHua07 and PI WorkBuddy Connect contributors`。
- 参考并复用的上游部分：`Copyright (c) 2026 Corrine Hu`，仍属于上游作者；不能把全部协议及认证代码宣称为本项目原创。

复制或再分发软件时，需要按照 MIT 条款保留适用的版权声明和许可证。MIT 对软件的授权不代表 WorkBuddy 服务、账号、商标或 API 的授权；使用第三方服务仍需遵守其条款。

## 主要代码参考与复用来源

**https://github.com/corrinehu/dsh-workbuddy-connect.git**

| 项目 | 说明 |
| --- | --- |
| 作者 | Corrine Hu / GitHub `corrinehu` |
| 固定版本 | `0.7.1` |
| 固定提交 | `fa570627016f56adfd2f91ccd706356b9157f2a7` |
| 许可证 | MIT |
| 原始版权 | `Copyright (c) 2026 Corrine Hu` |
| 许可证副本 | [vendor/dsh-workbuddy-connect/LICENSE](vendor/dsh-workbuddy-connect/LICENSE) |

部分原始 TypeScript 模块保存于 `vendor/dsh-workbuddy-connect/`，涉及本人客户端登录凭据、加密保护、token 刷新、产品区分、目录及协议转换等。`bridge/core.cjs` 是构建后的合并文件，包含这些模块，分发该文件时也必须携带相应许可和版权声明。

构建时将上游 DSH home 路径解析替换为本项目专用目录解析；PI 专属入口、管理 API 和界面不改变上游代码的归属。本项目不是上游作者发布或认可的官方移植版。

## 其他第三方依赖

| 依赖/项目 | 许可证 | 使用范围 | 许可位置 |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh-atomic-write` `0.2.0-rc.2` | MIT；Copyright (c) 2026 DeepSeek | 上游凭据写入所需的文件锁与原子写入，构建进 `bridge/core.cjs` | [vendor/licenses/LICENSE](vendor/licenses/LICENSE) |
| `esbuild` `0.25.12` | MIT | 开发构建工具，不属于插件运行依赖 | 安装依赖时包内 LICENSE；[上游许可证](https://github.com/evanw/esbuild/blob/v0.25.12/LICENSE.md) |
| `Sliverkiss/workbuddy2api` | MIT | DSH 上游注明的协议参考来源，未单独从该仓库复制模块到本项目 | [上游许可证](https://github.com/Sliverkiss/workbuddy2api/blob/main/LICENSE) |

更多构建与来源细节见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。`package-lock.json` 中开发依赖不应理解为所有依赖都被打包到插件内。

## 名称与商标

WorkBuddy、腾讯、DeepSeek、PI-Desktop 等名称仅用于描述兼容关系；相关商标属于其各自所有者。本项目不声称与这些主体或上游作者具有官方隶属、授权、认可或支持关系。
