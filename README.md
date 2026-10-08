# PI WorkBuddy Connect 0.4.1

真正随 **PI-Desktop 插件启停** 的 WorkBuddy 本机桥接，插件内接入管理界面 + 保留的网页后台。非官方集成，限本人账号合理使用，遵守 WorkBuddy 服务条款。

## 安装与使用

最新安装包：[下载 WorkBuddy Connect 0.4.1](dist/community.workbuddy-connect-0.4.1.piplug)（在 GitHub 文件页点击 **Download raw file** 下载）。完整源码已包含运行所需的桥接文件，安装 `.piplug` 不需要额外执行 npm install。


1. 安装并登录 WorkBuddy（国内）或 WorkBuddy AI（国际）。
2. 在 **PI → 插件** 安装 `.piplug`，或加载本目录作为开发插件。当前实现已按 PI-Desktop **0.17.0** 的实际宿主接口适配。
3. 批准插件的后台服务权限，启用插件。服务由宿主在 onLoad 完成后启动，直接使用 PI 自带的 Node 插件运行进程；**无需另外安装 Node、打开终端或注册 Windows 登录任务**。
4. 从插件页面/命令面板打开 **WorkBuddy Connect: 接入管理**。界面自动授权，显示 Base URL、默认隐藏的本地 Key、认证状态和模型目录，支持复制、刷新、确认后重新生成 Key、暂停和重新启动。
5. 仍需首次在 **PI 设置 → 模型** 添加 OpenAI Chat Completions / `openai-completions` 连接，填入界面中的地址与 Key，并拉取模型或填入准确 ID。不是 Responses；本次没有自动修改 PI 模型列表。

| 渠道 | 默认 Base URL |
| --- | --- |
| WorkBuddy | `http://127.0.0.1:18765/workbuddy/v1` |
| WorkBuddy AI | `http://127.0.0.1:18765/workbuddy-ai/v1` |

## 随 PI 运行的边界

- 开启/加载插件：宿主启动声明的 `workbuddy-bridge` 后台服务。
- 关闭插件管理窗口：仅关闭界面，桥接继续运行。
- 禁用/卸载插件或退出 PI：停止插件拥有的 HTTP 服务；PI 强制终止时监听进程也会退出，不留下独立守护进程。
- 面板/网页中的“停止服务”：暂停当前连接；在 PI 插件面板点击“重新启动桥接”恢复，不会因状态轮询自行恢复。
- 端口已被同 Key 的手动桥接占用：复用外部实例，不冒充插件拥有的实例，插件面板停止和卸载均不会关闭它。退出 PI 也不会停止外部实例。
- 同端口其他服务/不同 Key：报错，不接管、不误杀；检查端口与数据目录。

## 网页后台

继续访问 `http://127.0.0.1:18765/dashboard/`，或者在插件面板点“网页后台”/使用 **WorkBuddy Connect: 打开网页后台** 命令。

插件内操作使用 PI 自己的 `onPanelInvoke` 面板通道，浏览器后台使用同源本机管理会话，两者复用同一份界面与管理 API。通过插件打开浏览器时用 60 秒有效的一次性票据授权，不把本地 Key 放入网址。浏览器会话有效期 30 分钟；插件面板不持久保存 Key 或管理会话。

本地 Key 第一次启动自动生成，后续保持不变。**重新生成会让旧 Key 立即失效，必须更新 PI 的模型设置**。只改变本机桥接 Key，不更改 WorkBuddy 登录，不显示原始客户端 token。

自动检查登录和刷新目录不发送聊天请求。实际聊天可能消耗账号额度。

## 从 0.3.x Windows 自启动版本迁移

先安装/加载新版并批准后台服务权限。原 Windows 任务存在时，新插件只复用外部实例。在插件面板点击 **切换为随 PI 运行** 并确认，即可停止/删除本项目旧任务，由 PI 接管；Key、凭据副本和缓存保留。无法确认任务身份时会拒绝操作。

也可以手动迁移，在旧源码目录执行一次：

```powershell
node .\bridge\cli.cjs automation stop
```

这会停止本项目旧任务及其服务。再在 PI 插件面板点击 **重新启动桥接**，确认显示“本插件运行中”；之后取消本项目 Windows 登录自启动：

```powershell
node .\bridge\cli.cjs automation uninstall
```

卸载命令保留本地 Key、凭据副本和缓存，但会移除本项目旧任务及桌面网址入口。不要删除数据目录或重新生成 Key 来迁移。若新版未批准权限，不要先停掉旧服务。

## 插件设置

设置中的端口默认 `18765`，数据目录空值默认 `~/.pi-workbuddy-connect`。可选填写国内/国际凭据文件路径或 WorkBuddy Electron 程序的绝对路径。修改设置后重新加载插件。

PI 会过滤插件环境变量，插件不会从宿主环境读取账号密钥；路径以插件设置为准，并可复用专用目录里旧 `automation.json` 的四个 WorkBuddy 路径覆盖值，不沿用 Node 启动路径或 token。原始客户端凭据只读，刷新副本和缓存仍写入专用目录，保持旧 Key 不变。

## 权限与信任边界

插件声明 `background.service`、`ui.panel`、`clipboard.write`、`shell.openExternal`。

后台服务复用原仓库的原生 Node 代码读取本人客户端凭据、必要时执行已安装的对应 WorkBuddy Electron 解密助手，并请求 WorkBuddy 的认证、模型目录与聊天接口。**这些原生文件/网络操作不是 PI 的 fs/net 权限网关沙箱**；应只加载可信来源的此插件。同一操作系统用户的其他进程仍可能读取专用目录。

不创建隐藏 PowerShell `.lnk`；不注册持久的脚本启动任务。先前被火绒拦截的入口不会恢复，不需要关闭火绒或加白名单。网页 API 只监听回环地址、要求会话和同源校验，聊天 API 要求本地 Key。Key 响应不缓存，不放宽 CORS。

## 独立模式与开发

网页后台/CLI 独立模式继续保留，但不属于“随 PI 启停”。自行运行 CLI 时需要 Node 22.19+：

```powershell
node .\bridge\cli.cjs start
node .\bridge\cli.cjs service
node .\bridge\cli.cjs ui
```

发行插件已包含桥接运行文件，不需要 npm install。源码重建：

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
```

使用 PI 官方 PluginCheck / PluginPack 校验打包。原协议模块固定来自 corrinehu/dsh-workbuddy-connect 0.7.1，提交 `fa570627016f56adfd2f91ccd706356b9157f2a7`；MIT 许可保留在 vendor，见 `LICENSE`、`THIRD_PARTY_NOTICES.md`。WorkBuddy 私有接口可能随客户端更新而失效。

## 验证范围

43 项自动测试覆盖协议、认证初始化、管理安全、插件生命周期、迁移保护及状态同步。PI 0.17.0 原版宿主代码（隔离 IPC）和 Edge 验证加载、面板授权、复制、网页入口、暂停/恢复及卸载释放端口。最终真实实例报告 0.4.1 并由 PI 插件持有，国内认证及上游目录正常（19 个模型），旧 Windows 任务与脚本快捷方式不存在。排查中未手动重启 PI；开发热加载可能已应用修改，已打开的旧界面请刷新。未测试真实聊天或完整退出/重启 PI。新增修复与验证记录见 `AUDIT.md`。

## 0.4.1 排查修复

- 上游目录刷新失败时明确显示缓存降级，不再误报实时上游与刷新成功。
- 显示/复制 Key 前读取当前授权配置，避免网页更新 Key 后插件面板仍复制旧值。
- 退出登录后清空旧模型行；重新登录及手动刷新同步认证状态。
- 自动目录变化在状态刷新后更新表格与数量。

此版本不添加新权限、不自动更换 Key。升级需要重新安装 `.piplug` 或重新加载开发插件。
