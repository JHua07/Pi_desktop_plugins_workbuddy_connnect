# PI WorkBuddy Connect

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

将本人 **WorkBuddy / WorkBuddy AI** 桌面客户端的模型接入 **PI-Desktop**。桥接随 PI 插件启动，提供插件内管理面板，同时保留本机网页后台。

> **代码来源与致谢**：本项目参考并复用了 [corrinehu/dsh-workbuddy-connect](https://github.com/corrinehu/dsh-workbuddy-connect) 的部分 MIT 许可代码。原仓库地址：**https://github.com/corrinehu/dsh-workbuddy-connect.git**。上游作者为 **Corrine Hu**，版权及许可证完整保留；本项目主要新增 PI 生命周期适配、本机管理界面和接入配置流程，并非从零独立实现 WorkBuddy 协议。

本项目为非官方个人账号接入，请遵守 WorkBuddy 服务条款。与腾讯、WorkBuddy、DeepSeek、PI-Desktop 及上游作者没有官方授权或隶属关系。

## 功能

- **随 PI 启停**：插件启用时运行桥接，禁用/卸载插件或退出 PI 后关闭插件拥有的实例；无需另开终端、额外安装 Node 或 Windows 登录自启动。
- **国内/国际分离**：WorkBuddy 与 WorkBuddy AI 分别使用自己的账号凭据和模型目录。
- **自动认证和目录刷新**：读取本人客户端登录状态，处理加密凭据、按需刷新 token，并自动获取模型目录。
- **图形管理界面**：查看认证状态、令牌有效期、模型列表和目录来源；搜索模型、复制 ID、刷新目录、暂停及恢复桥接。
- **接入配置**：生成对应 Base URL；本地 API Key 自动生成、默认隐藏，可复制或确认后重新生成。
- **网页后台保留**：从插件面板打开一次性授权网页，或直接访问本机管理页。
- **OpenAI Chat Completions 桥接**：处理 WorkBuddy 的流式、工具调用与消息协议差异；模型能力以实际目录为准。

**边界**：当前仍需首次在 PI 的原生模型设置中添加连接。插件不会自动改写 PI 模型列表，也不会自动发送付费测试聊天。

## 安装

### 前提

1. 安装并登录自己的 WorkBuddy 或 WorkBuddy AI 桌面客户端。
2. 使用 **PI-Desktop 0.17.0 或更高版本**；当前宿主接口按 0.17.0 验证。

### 安装插件

当前版本：**0.4.1**。

[官方市场页面](https://plugins.aiuo.net/plugins/community.workbuddy-connect) · [下载 `.piplug`](https://plugins.aiuo.net/download/community.workbuddy-connect/0.4.1) · [GitHub 源码仓库](https://github.com/JHua07/Pi_desktop_plugins_workbuddy_connnect)

1. 在 **PI → 插件** 选择从文件安装，导入 `.piplug`。
2. 确认权限说明，批准后台服务权限并启用插件。
3. 打开 **WorkBuddy Connect: 接入管理**。
4. 检查国内或国际渠道是否显示“已登录”，并确认目录来源。

也可以加载本仓库目录作为开发插件。发行包已包含运行文件，**安装插件无需 `npm install`**。

> 不要把“源码已 push 到 GitHub”理解成“已经上架官方市场”。官方收录需要插件中心的账号授权与审核，流程见 [MARKETPLACE.md](MARKETPLACE.md)。

## 在 PI 中配置模型（首次一次）

在 **PI 设置 → 模型** 添加 **OpenAI 兼容 / Chat Completions** 连接。如果需要选择 API 类型，使用 `openai-completions`，**不是 Responses**。

| 设置 | WorkBuddy（国内） | WorkBuddy AI（国际） |
| --- | --- | --- |
| 提供商名称 | WorkBuddy | WorkBuddy AI |
| 默认 Base URL | `http://127.0.0.1:18765/workbuddy/v1` | `http://127.0.0.1:18765/workbuddy-ai/v1` |
| API Key | 插件界面中的本地 Key | 插件界面中的本地 Key |
| 模型 ID | 从对应渠道目录复制 | 从对应渠道目录复制 |

支持拉取模型的 PI 版本可读取 `/models`；否则填写准确模型 ID，不要用显示名称猜测。

**本地 API Key 不等于 WorkBuddy 原始 token**。Key 初次启动时生成、后续保留；重新生成后旧 Key 立即失效，必须同步更新 PI 模型设置。不要把 Key 发到聊天、Issue 或截图中。

## 生命周期与网页后台

- **关闭管理窗口**：桥接继续运行。
- **暂停服务**：当前连接停止；在插件面板点击“重新启动桥接”恢复，状态轮询不会擅自重新启动。
- **禁用/卸载插件或退出 PI**：停止插件拥有的服务，不留下独立守护进程。
- **端口已有外部实例**：同 Key 的旧桥接可被复用，但插件不会在卸载时停止它。不同 Key 或未知服务会报错，不会接管或误杀。

网页地址默认 `http://127.0.0.1:18765/dashboard/`。插件中的“网页后台”使用 60 秒有效的一次性票据授权，Key 不放入网址；普通网页管理会话有效期为 30 分钟。插件面板通过 PI 面板通道操作，不在浏览器存储中持久保存 Key。

## 设置与故障排查

插件设置可修改端口、专用数据目录，以及可选的国内/国际客户端凭据路径或 Electron 程序绝对路径。**修改后重新加载插件**。

默认专用目录为 `~/.pi-workbuddy-connect`。原始客户端登录文件只读，刷新副本、缓存及本地 Key 属于本项目专用目录，不使用 DSH 数据目录。

| 情况 | 处理 |
| --- | --- |
| 未登录 / `no-credential` | 在对应官方客户端登录后刷新。国际版未登录不影响国内版。 |
| 无法解密 / `electron-binary-unavailable` | 检查对应 WorkBuddy 程序是否已安装；可在插件设置填写 Electron 程序路径。 |
| 端口占用 / Key 不匹配 | 检查是否还在运行手动桥接，或使用其他端口；不要删除 Key 来解决迁移。 |
| 上游刷新失败、显示缓存 | 保留缓存可用状态，网络恢复后重试；缓存不等于实时目录。 |
| 重新生成 Key 后聊天失败 | 将新 Key 填回 PI 原生模型设置。 |
| 新权限未批准 | 重新安装/加载插件并批准后台服务权限，热更新不会自动授予新权限。 |

### 从 0.3.x 迁移

安装新版并批准后台权限后，如果面板显示“复用外部实例”，点击 **切换为随 PI 运行** 并确认。它只处理身份及配置匹配的本项目 Windows 任务，保留 Key、凭据副本和缓存。未知手动实例需要先自行停止。

之前使用隐藏 PowerShell 的 `.lnk` 入口已弃用，不会恢复火绒隔离文件，**不要求关闭安全软件或添加白名单**。

## 权限与安全说明

声明权限：`background.service`、`ui.panel`、`clipboard.write`、`shell.openExternal`。

- 只监听本机回环地址；聊天 API 要求本地 Key，管理 API 要求有效会话与同源访问。
- Key/配置响应不缓存，不放宽 CORS，不在网址中携带 Key。
- 原生 Node 代码会读取本人 WorkBuddy 凭据，必要时执行已安装的对应客户端解密助手，并访问 WorkBuddy 认证、目录和聊天接口。
- **原生文件/网络代码不属于 PI fs/net 权限网关或操作系统沙箱**。请仅安装可信来源插件；同一操作系统用户下的其他进程仍可能访问本地数据。
- 使用私有客户端接口，WorkBuddy 更新或服务策略变化可能导致失效。测试通过不等于服务条款授权或安全软件认证。

## 开发与验证

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
```

使用 PI 官方 `PluginCheck` / `PluginPack` 校验及打包 `.piplug`，不要用压缩 ZIP 代替安装包。

截至 0.4.1，**43 项自动测试通过**；PI 0.17.0 原版宿主隔离 IPC 与 Edge 验证面板授权、复制、暂停/恢复、卸载释放端口及状态同步。真实国内账号读取和模型目录获取成功，验证时为 19 个模型。
0.4.1 已在官方市场显示“已发布”，自动审计通过且仓库归属已验证；详情仍显示源码审查未完成。GitHub API 已确认固定 tag/commit 和源码文件公开可读，进一步审查需插件中心处理，见 [MARKETPLACE.md](MARKETPLACE.md)。

**尚未验证**：完整退出再启动 PI、真实付费聊天/工具续轮、国际版真实账号流程。不要将离线测试或目录查询等同于真实对话成功。详细记录见 [AUDIT.md](AUDIT.md)。

独立 CLI/网页模式仍保留，需 Node 22.19+，但不属于随 PI 生命周期运行：

```powershell
node .\bridge\cli.cjs start
node .\bridge\cli.cjs service
node .\bridge\cli.cjs ui
```

## 上游来源、许可证与致谢

本项目采用 **MIT License**，见 [LICENSE](LICENSE)。版权及第三方说明见 [LICENSES.md](LICENSES.md) 和 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。软件许可证不会替代 WorkBuddy 服务条款、账号授权或额度限制。

### 主要代码参考与复用来源

- 项目：[corrinehu/dsh-workbuddy-connect](https://github.com/corrinehu/dsh-workbuddy-connect)
- 原仓库：**https://github.com/corrinehu/dsh-workbuddy-connect.git**
- 上游版本：`0.7.1`
- 固定提交：`fa570627016f56adfd2f91ccd706356b9157f2a7`
- 上游版权：`Copyright (c) 2026 Corrine Hu`
- 上游许可证：[MIT 原文](vendor/dsh-workbuddy-connect/LICENSE)

认证、token 刷新、加密凭据处理、产品区分、模型目录及请求协议等部分源码保留在 `vendor/dsh-workbuddy-connect/`，构建为 `bridge/core.cjs`。本项目将 DSH 数据目录解析替换为 PI 专用目录；PI 生命周期控制、管理 API、图形面板、配置及相关测试为本项目新增适配。

其他依赖：`@deepseek-ai/dsh-atomic-write`（MIT，用于锁及原子写入）；`esbuild`（MIT，仅构建工具）。上游对协议实现另致谢 [Sliverkiss/workbuddy2api](https://github.com/Sliverkiss/workbuddy2api)，详见第三方说明。

感谢 **Corrine Hu** 提供的开源实现。本项目不是 DSH 插件的官方 PI 版本，也不代表上游作者认可或维护本适配。
