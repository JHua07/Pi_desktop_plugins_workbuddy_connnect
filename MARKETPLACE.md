# PI-Desktop 官方插件市场发布

## 当前状态

**0.4.1 已提交并显示为“已发布”，不等于源码审查完成。** 插件中心提交记录显示自动审计“通过”，插件详情显示仓库归属“已验证”，但同时显示“源码审查：未审查 / 该仓库无法读取”。目前不能声称源码审查或完整审核已通过。

复核时通过 GitHub 公共 API 确认 `v0.4.1` 固定到 commit `cb6998c14a0d7eb3b3a4ee44901f07e6908b2c40`，且 manifest、源码与许可文件可公开读取。控制台没有提供源码审查重试入口；请通过插件中心提供的联系/反馈渠道报告这一状态。不要重复创建相同插件/版本，也不要伪称审核已通过。
- 发布者源码仓库：`https://github.com/JHua07/Pi_desktop_plugins_workbuddy_connnect`
- 插件路径：`.`（仓库根目录）
- 插件 ID：`community.workbuddy-connect`
- 版本：`0.4.1`
- 建议发布标签：`v0.4.1`
- 打包文件：`community.workbuddy-connect-0.4.1.piplug`
- 许可证：MIT；上游引用和版权见 README、LICENSES.md、THIRD_PARTY_NOTICES.md。

## 官方入口

**插件中心：https://plugins.aiuo.net**

官方开发文档说明：发布者创建插件、绑定自有仓库、固定版本标签并提交；平台构建/核对安装包、进行权限和源码审查，再发布到官方目录。源码不复制到分发仓库，添加插件源码的 Pull Request 会被关闭。

- [官方插件开发与发布说明](https://github.com/vastsa/PI-Desktop/blob/main/docs/plugin-development.md)
- [官方插件市场规范](https://github.com/vastsa/PI-Desktop/blob/main/docs/zh-CN/spec/07-plugins/07-plugin-marketplace.md)
- [插件中心与归属校验](https://github.com/vastsa/PI-Desktop/blob/main/docs/zh-CN/spec/07-plugins/15-plugin-center.md)
- [发布者自有源码与安装包溯源](https://github.com/vastsa/PI-Desktop/blob/main/docs/adr/0102-publisher-owned-plugin-source-and-git-hosted-artifacts.md)

不要直接修改 `AIUO-Net/pi-desktop-plugins` 的 catalog 来冒充已发布，也不要自行声明 `verified`、审核通过或安全等级。

## 发布者需要完成的授权

1. 在插件中心使用 **JHua07 的 GitHub 账号**登录。
2. 按平台要求授权/安装 GitHub App，限制到本项目仓库即可，仔细核对只读权限范围。
3. 在发布者控制台绑定 `JHua07/Pi_desktop_plugins_workbuddy_connnect`。
4. 创建插件，确认平台允许当前 ID 和发布者归属。如果 namespace 被拒绝，不要擅自占用他人的命名空间；先确定新 ID 和旧插件迁移方案。

**Git Credential Manager 中已登录 GitHub，不代表已登录插件中心或已授权它访问仓库。**官方说明也指出个人访问令牌不是插件中心的受支持发布凭证。不要将 GitHub PAT、客户端 token、API Key 或 Cookie 提交到仓库/聊天。

## 版本提交

平台通常有两条安装包路径：

- **平台构建**：从已绑定仓库的固定 tag/commit 构建、打包并审查。选择该方式时确认仓库已包含 `main.js`、`bridge/core.cjs` 和界面运行文件。
- **发布者安装包**：将官方工具打出的 `.piplug` 附到本仓库该版本的 GitHub Release，再按平台要求提交安装包 URL、SHA-256 和大小。仓库 raw 文件下载链接不应冒充 Release asset。

可以用 PI 官方 `PluginPack` 生成安装包；官方 devkit 的 `pi-plugin publish` 能输出固定源码/包信息的 submission JSON，但**生成 JSON 不等于已提交或上架**。

提交前检查：

- 工作区干净，源码 commit 在远端可解析，tag 不应被强制移动。
- manifest ID、version、源码归属、安装包中的信息一致。
- SHA-256 和大小来自本次最终安装包；不要复制旧值。
- README 与许可证进入源码和安装包，明确上游 `https://github.com/corrinehu/dsh-workbuddy-connect.git`。
- 不包含任何真实 Key、凭据、日志或 node_modules。
- 当前 43 项测试和本地安装验证不能替代平台审核。

## 需要向审核披露的行为

本插件提供本机 OpenAI Chat Completions 桥接，随 PI 插件进程运行。它复用本人 WorkBuddy 的客户端凭据；只读原文件，刷新副本/Key/缓存保存在专用目录。

- 声明 `background.service`、`ui.panel`、`clipboard.write`、`shell.openExternal`。
- 原生 Node 会读取本机客户端凭据、执行已安装的对应 WorkBuddy Electron 解密助手，并访问 WorkBuddy 私有接口。
- 上述原生操作不受 PI fs/net 权限网关或 OS capability sandbox 保护。这个风险不能通过“只声明低风险权限”来隐藏，平台可能要求补充声明或拒绝收录。
- 默认仅监听 `127.0.0.1`；Key 与会话鉴权、同源管理、Key 默认隐藏；不自动发起聊天请求。
- 真实付费聊天、完整退出再启动 PI、国际版真实账号尚未实测，提交时如实说明。

审核结果由平台给出。若需要修改权限、插件 ID 或代码，再按具体结果处理，不绕过策略或伪造审核结论。
