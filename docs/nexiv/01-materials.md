# Nexiv 公开资料

事实来自本对话已完成的仓库只读查询、演示站走查和授权站只读查看。对方 GitHub 仓库没有可编译源码。下文不记录口令、cookie、token、授权码、DSN 和支付密钥，也不收录对方截图文件。

## 仓库身份

公开仓库 `Nexiv-AI/Nexiv-AI` 能打开。它是用户仓库，不是 Organization，不是 fork，`mirror_url` 为空。该用户公开仓库数为 1，公开 gist 数为 0。账号创建时间为 `2026-09-11T14:47:34Z`。

| 项 | 值 |
|---|---|
| 默认分支 | `main` |
| HEAD | `2640c427c6e7b6ddbb0248a8b5fda4a2d6f755da` |
| 最近提交 | `2026-09-13T02:15:25Z`，说明为 `Update README.md`，只改 `README.md` |
| `pushed_at` | `2026-09-13T02:15:25Z` |
| `updated_at` | `2026-10-07T14:28:30Z`（元数据刷新，之后无新提交） |
| 许可证 | 无。许可证接口与 `LICENSE` 路径均为 404 |
| 语言统计 | 空 |
| 分支 / tag / release | 仅 `main`；tag 与 release 均为空 |
| 体积 | `size=18637`（KB） |
| 全树 | 递归树未截断，41 个节点：1 个 Markdown，38 个 PNG |

历史提交 `fe561d951a`（说明 `v2.3.0`，`2026-09-11T14:50:46Z`）把产品写成「原 ArtDraw-AI」。13 次提交里，除 PNG 外只改过 `README.md`。`go.mod`、`package.json`、`docker-compose.yml`、`Dockerfile`、`Cargo.toml`、`LICENSE`、`web`、`cmd`、`server`、`backend`、`frontend`、`src`、`docs`、`.github` 在 `main` 上均为 404。

`GET /repos/xxxx/nexiv-ai`、`GET /repos/ArtDraw-AI/ArtDraw-AI`、`GET /repos/artdraw-ai/artdraw-ai` 均为 404。`Nexiv-AI/nexiv-ai` 与 `Nexiv-AI/Nexiv-AI` 是同一仓库。

## 顶层树

```
README.md
dist/
  admin/          admin-01.png … admin-13.png
  agent.png
  chuangzuo.png
  creation.png
  creation2.png
  dashboard.png
  frontend-01.png … frontend-17.png
  model.png
  retouch_2026091203090990.png
  search.png
```

同 blob 复用：`frontend-03.png` 与 `chuangzuo.png`，`frontend-04.png` 与 `creation.png`，`frontend-05.png` 与 `search.png`，`frontend-10.png` 与 `creation2.png`，`frontend-15.png` 与 `agent.png`。`dist/` 里没有 `index.html`、脚本、样式或 source map。`dist/admin/` 是截图，不是管理后台构建产物。

## README 自称、仓库中不存在

README 写过 React、TypeScript、Vite、TailwindCSS、Golang、Tauri、Rust、MySQL、Redis、Go 服务与 Docker Compose。仓库里没有对应工程文件。历史 README 要求截图放在 `docs/assets/`，该目录 404，截图实际在 `dist/`。

下列模块在 git 树和全部提交中都不存在。README 只有产品名，没有入口、类型、路由或表名：

| 模块 | 仓库结论 |
|---|---|
| Agent 工具链 | 仓库中不存在 |
| AI 搜索 | 仓库中不存在 |
| 绘图 | 仓库中不存在 |
| AIPPT | 仓库中不存在 |
| 商业化计费 | 仓库中不存在 |
| 多节点授权 | 仓库中不存在 |

README 能读到的产品名，没有符号：

- Agent：MCP、技能插件、工具池、规划模型、Ctrl+K
- 搜索：Tavily、Meta-So
- 绘图：OpenAI、Midjourney、Google、Flux、Kling、豆包、Grok；参考图、蒙版、节点画布
- AIPPT：自研 PPTX 模板
- 计费：8 位小数点数、按模型 / 子动作 / 工具扣点、充值套餐、兑换码
- 授权：多节点、离线授权、www 子域名、RBAC、JWT

HEAD 上的 README 指向 `https://demo.nexiv.me`、`https://nexiv.me`、`https://docs.nexiv.me`、`https://nexivai_auth.nexiv.me`、`https://artdraw-auth.l11.top`。提交 `fe561d951a` 写的是 `https://license.nexiv.me` 与 `https://admin.nexiv.me`。GitHub 代码搜索对 `nexivai_auth`、`artdraw-auth.l11.top`、`docs.nexiv.me` 无命中。

请求从路由到服务再到扣费的函数链：源码不可得。

## 站点清单

| 站点 | 观察 |
|---|---|
| `https://github.com/Nexiv-AI/Nexiv-AI/` | 公开。内容为 README 与 `dist/` 截图 |
| `https://demo.nexiv.me` | 演示站。管理员登录后进入 `/admin` |
| `https://nexiv.me` | 走查未跳入该主站 |
| `https://docs.nexiv.me` | 本环境 DNS 解析失败，未纳入事实 |
| `https://nexivai_auth.nexiv.me` | HTTP 200，标题「Nexiv AI 授权管理」 |
| `https://artdraw-auth.l11.top` | HTTP 200，标题「Nexiv AI 授权管理」。README 称之为备用授权平台 |

两个授权站首页可见短句包括：「一站式 AI 绘图、AI 对话、电商套图、知识库、应用广场与 OpenAI 兼容 API 商业系统。」「从模型接入到商业授权，前后台一套跑通。」「支持套餐购买、续费、域名绑定、授权验证和查询。」页脚为「© 2026 Nexiv AI · 官方商业授权中心」。备用站首页能看到授权套餐 PRO 版 / MAX 版，套餐说明含「全部功能 + 优先支持 + 永久授权」「最多 1 个域名」。

本仓库不对接上述运行站，也不实现授权售卖。机制只在 [02-architecture.md](./02-architecture.md) 记录。

## 授权站公开流程

两个站都是 SPA。首页、`#/license-query`、`#/user-login`、`#/login` 可打开。本次未登录授权后台。

| 场景 | 字段 | 动作 |
|---|---|---|
| 用户注册 `#/register` | 邮箱地址、邮箱验证码、昵称（可选）、密码 | 发送验证码；注册并进入 |
| 用户登录 `#/user-login` | 邮箱地址、登录密码 | 登录。文案含查看授权、续费套餐和下载版本更新 |
| 购买 | 选择套餐 | 在线支付。页面写支付成功会自动签发授权码 |
| 兑换 | 授权兑换码 | 须先注册或登录授权站，在该账号中兑换。页面写兑换码不能直接用于软件激活 |
| 我的授权 | 域名、授权码 | 绑定域名、复制授权码、续费 |
| 公开查询 `#/license-query` | 域名或授权码 | 查询授权状态、套餐版本与有效期。无需登录 |
| 管理登录 `#/login` | 管理员账号、管理密码 | 登录后台。文案为管理授权、订单、版本与系统配置 |

README 只把第二个站写成「备用授权平台」，没有自动切换步骤，也没有客户端多节点环境变量名。授权站前端能看到「数据库容灾」：多个 MySQL 备库、主库异常时切换。这是单个授权站部署内部的备库，不是两个公开域名之间的客户端故障切换。备库 DSN 与支付密钥不记录。

产品 README 还写了「多节点商业授权系统」「离线授权支持，可隔离内网部署」「www 子域名自动授权」「可视化系统初始化，无需手动编辑 .env 文件」。没有对应配置键名。

## 演示站登录与信息架构

登录页为 `/sign-in`。`POST /api/auth/login` 返回 200 后进入 `/admin`，页面名「首页概览」。该次登录身份是管理员。普通用户入口预期是 `/` 或 `/create`。前台营销首页仍是「一站式 AI 创作平台」（`/`）。

| 类型 | 范围 |
|---|---|
| 终端用户 | 顶栏与左侧工作台。布局为顶栏或内嵌工具条、左侧全局导航、主画布或对话区、底部或侧栏参数区 |
| 运营后台 | `/admin/**`。布局为顶栏（面包屑、返回前台）、左侧管理菜单、主内容（表格、表单或图表） |
| 商用授权 | 独立域名，经 `/admin/system/license` 外链关联。本仓库不做 |

营销首页区域：顶栏（Logo、公告、语言、主题、用户或登录）、主内容、页脚。

## 顶栏

顶栏来自后台「导航菜单」配置，并在移动端抽屉核对。

| 名称 | 路径 |
|---|---|
| 视频 | `/video` |
| 创作 | `/create` |
| 对话 | `/chat` |
| AI 搜索 | `/search` |
| 应用 | `/apps` |
| AIPPT | `/ppt` |
| 电商绘图 | `/ecom` |
| 知识库 | `/kb` |
| 无限画布 | `/canvas` |
| IDE编程 | `/ide` |
| 画廊 | `/gallery` |
| 定价 | `/pricing` |
| 文档 | `/docs` |
| API | `/api-keys` |

## 侧栏与用户菜单

侧栏主项：首页 `/`，对话 `/chat`，AI 搜索 `/search`，创作 `/create`，AIPPT `/ppt`。

「查看更多」展开名称：无限画布、AI 影视、视频、微信机器人、画廊、应用、知识库、电商绘图、定价、文档、API、个人中心。其中与顶栏同名的项使用顶栏路径。AI 影视、微信机器人、个人中心的独立路径未证实。

用户菜单：通知、个人中心、切换全屏、微信机器人、电商作品、充值、API、吉祥物、控制台（`/admin`）、退出登录。

`/agent`、`/profile`、`/settings` 打开后是 404。前台 Agent 在 `/chat` 的 Agent 模式，不在 `/agent`。

## 管理后台菜单

| 分组 | 名称 | 路径 |
|---|---|---|
| 概览 | 首页概览 | `/admin` |
| 概览 | AI 智能体 | `/admin/ai-agent` |
| 用户 | 用户管理 | `/admin/users` |
| 充值 | 支付通道 | `/admin/pay-providers` |
| 充值 | 充值套餐 | `/admin/recharge-packages` |
| 充值 | 充值记录 | `/admin/recharges` |
| 充值 | 兑换码 | `/admin/redeem-codes` |
| 绘图 | 绘图模型 | `/admin/models` |
| 绘图 | 绘图预设 | `/admin/draw-presets` |
| 绘图 | 绘图渠道 | `/admin/image-channels` |
| 绘图 | 绘图记录 | `/admin/image-tasks` |
| 视频 | 视频模型 | `/admin/video-models` |
| 视频 | 影视模块设置 | `/admin/film-settings` |
| 视频 | 视频渠道 | `/admin/video-channels` |
| 视频 | 视频记录 | `/admin/video-tasks` |
| 对话 | 对话模型 | `/admin/chat-models` |
| 对话 | 对话渠道 | `/admin/chat-channels` |
| 对话 | 对话记录 | `/admin/chat-records` |
| 模型擂台 | 擂台设置 | `/admin/chat-arena/settings` |
| 模型擂台 | 擂台记录 | `/admin/chat-arena/records` |
| AIPPT | 模型与生成边界 | `/admin/ppt/service` |
| AIPPT | 价格设置 | `/admin/ppt/pricing` |
| AIPPT | PPTX 模板 | `/admin/ppt/templates` |
| AIPPT | 生成记录 | `/admin/ppt/records` |
| 知识库 | 向量模型 | `/admin/embedding-models` |
| 知识库 | 向量渠道 | `/admin/embedding-channels` |
| 知识库 | 知识库列表 | `/admin/kb` |
| 知识库 | 知识库设置 | `/admin/kb-settings` |
| AI 搜索 | 对话联网搜索 | `/admin/chat-web-search` |
| AI 搜索 | AI 搜索 | `/admin/web-search` |
| AI 搜索 | AI 搜索使用记录 | `/admin/ai-search-records` |
| IDE | 基础设置 | `/admin/ide/basic` |
| IDE | 计费设置 | `/admin/ide/billing` |
| IDE | 项目列表 | `/admin/ide/projects` |
| AGENT 配置 | 全局设置 | `/admin/agent-tools/global` |
| AGENT 配置 | MCP 服务器 | `/admin/agent-tools/servers` |
| AGENT 配置 | MCP 工具 | `/admin/agent-tools/tools` |
| AGENT 配置 | Agent Skills | `/admin/agent-tools/skills` |
| AGENT 配置 | 运行日志 | `/admin/agent-tools/runs` |
| 微信机器人 | 总览 | `/admin/wechat-claw` |
| 微信机器人 | 全部机器人 | `/admin/wechat-claw/bots` |
| 微信机器人 | 预设模板 | `/admin/wechat-claw/presets` |
| 微信机器人 | 策略与配额 | `/admin/wechat-claw/policy` |
| 微信机器人 | 运行日志 | `/admin/wechat-claw/logs` |
| 画廊管理 | 画廊列表 | `/admin/gallery` |
| 画廊管理 | 待审核 | `/admin/gallery-pending` |
| 画廊管理 | 画廊分类 | `/admin/gallery-settings` |
| 应用广场 | 应用管理 | `/admin/apps` |
| 应用广场 | 轮播图/顶部公告 | `/admin/banners` |
| 电商绘图 | 电商模板 | `/admin/ecom-templates` |
| 电商绘图 | 电商作品 | `/admin/ecom-bundles` |
| 平台配置 | 模型信息管理 | `/admin/model-info` |
| 平台配置 | 供应商 | `/admin/providers` |
| 平台配置 | 语音设置 | `/admin/speech` |
| 平台配置 | 价格设置 | `/admin/pricing` |
| 平台配置 | 存储设置 | `/admin/storage` |
| 平台配置 | 模型状态统计 | `/admin/model-stats` |
| 开发者 API | API 设置 | `/admin/api-settings` |
| 开发者 API | API 调用日志 | `/admin/api-logs` |
| 桌面端 / Browserless | 基础 | `/admin/desktop/basic` |
| 桌面端 / Browserless | 工作模式 | `/admin/desktop/work-mode` |
| 桌面端 / Browserless | Browser worker | `/admin/desktop/browser-worker` |
| 站点运营 | 基础设置 | `/admin/settings` |
| 站点运营 | 网站 UI | `/admin/site-ui` |
| 站点运营 | 首页内容 | `/admin/home-content` |
| 站点运营 | 导航菜单 | `/admin/nav-menu` |
| 账号与通知 | 授权登录 | `/admin/auth-login` |
| 账号与通知 | 第三方登录 | `/admin/oauth` |
| 安全风控 | 行为验证 | `/admin/behavior-verification` |
| 系统服务 | 系统授权 | `/admin/system/license` |

站点运营里还有公告、页面公告、活动弹窗、联系方式、SEO、页脚、页面内容、多语言。账号与通知里还有邀请奖励、邮件、短信。安全风控下还有策略、内置、日志、测试等子页。系统服务里还有功能介绍、反馈流程、系统更新、系统维护。这些只有名称，路径未证实。

`/admin/system/license` 可见域名、版本、模块清单和授权码激活，并外链两个授权站。本仓库不实现该页。

## 已观察的页面行为

### 对话与 Agent

`/chat`：Agent 模式、开启上下文、新建会话、高级配置、粘贴链接、按住说话。输入区文案为「给 Nexiv AI 发送消息」。布局有沉浸、三栏、擂台。

`/admin/ai-agent`：用自然语言驱动后台配置，页面有使用记录、修改记录、新对话、发送，以及配置意图输入框。

`/admin/agent-tools/global`：是否开启 Agent、工具规划模型、默认绘图模型、默认视频模型、全局计费模式、全局按次价格。按钮有配置指南、刷新、保存设置。MCP 服务器、MCP 工具、Skills、运行日志只有路径，控件未逐页抄录。

### AI 搜索

`/search`：搜索记录、切换搜索模式、图片搜索、开始搜索、示例问题。输入区文案为「输入你想了解的问题」。

`/admin/web-search`：保存配置。页内 Tab 为总览、搜索引擎、搜索模式、工具配置、计费规则。字段有启用 AI 搜索、默认搜索模式、默认总结模型、AI 规划模型。

### 绘图

`/create` 示例曾打开 `/create/26`。布局有分栏、对话流、三栏、聚焦、画板。控件有选择模型、预设、优化、翻译、生成。侧栏为创作设置，含提示词和预计消耗积分。

`/admin/models` 列：显示名、请求名、供应商、状态、操作。按钮有新增模型。

`/admin/image-channels` 列：名称、供应商、端口节点、支持模型、KEYS、成功率/失败率、倍率、优先级、状态、操作。页面提示端口节点在渠道设置中选择。按钮有新增渠道。

`/admin/draw-presets`、`/admin/image-tasks` 只有菜单路径，列名未抄。

### 视频

`/video`：视频镜头生成。控件有模型选择、参数、高级设置、参考媒体、生成。视频模型、渠道、记录的列名未逐页抄。

### AIPPT

`/ppt`：打开生成设置、搜索历史记录。生成设置含标题、描述内容、详细程度、页数（1–30）、联网搜索、AI 绘图、生成模型、参考文件、版式模板，以及「生成大纲」。后台四个子页未逐页展开。

### 定价、充值、用户

`/pricing` 是模型公示价，不是充值套餐页。可在绘图、对话、视频模型之间切换，并有方案筛选、查看模型详情、按名称或描述搜索。

`/recharge`：套餐选择、订单记录、去支付、兑换、积分明细、邀请好友。字段有充值金额（元）、兑换码。页面有主账户积分和时长卡。订单区写「最近 20 条充值记录」，当时为空。

`/admin/recharge-packages` 列：套餐、类型、价格、权益、排序、状态、操作。当时 0 条。按钮有新增套餐。`/admin/recharges` 的列名未打开。

`/admin/users` 列：用户、邮箱、角色、总积分、已使用、当前时长卡、状态、注册时间、操作。按钮有新增用户、编辑用户、禁用。当时可见 10 个用户。

### 其他已打开页面

`/apps`：对话应用与绘图应用市场，可搜索应用。当时对话应用为 0。

`/admin`：今日与累计任务、收款、访问、对话、绘图、视频，以及 7 天趋势。

`/admin/image-channels` 的「端口节点」是渠道上的上游接入，不是独立的节点管理一级菜单。

## 已观测 API

只记录方法和路径。各 `/admin/*` 子页另有 `/api/admin/...`，本轮未全量抓包，不编造子路径。

| 方法 | 路径 |
|---|---|
| POST | `/api/auth/login` |
| POST | `/api/behavior-verification/prepare` |
| GET | `/api/setup/state` |
| GET | `/api/setting/public` |
| GET | `/api/setting/features` |
| GET | `/api/license/check` |
| GET | `/api/user/self` |
| GET | `/api/model/list` |
| GET | `/api/provider/list` |
| GET | `/api/ArtDraw/sessions` |
| GET | `/api/ArtDraw/sessions?layout=chat` |
| GET | `/api/ArtDraw/list?limit=5` |
| GET | `/api/chat/sessions?with_groups=1` |
| GET | `/api/apps` |
| GET | `/api/admin/overview` |
| GET | `/api/notifications/unread-count` |
| GET | `/api/notifications?page=1&page_size=30` |
| POST | `/api/notifications/sse-ticket` |
| GET | `/api/campaigns?page={create\|home\|apps}` |
| GET | `/api/banners?position=apps` |
| GET | `/api/translations/setting/{id}` |

`/api/license/check` 只说明演示站会请求授权状态。本仓库不实现、不调用。

## 本仓库落点索引

这些路径是本仓库已有入口，不是对方源码。

| 能力 | 路径 | 符号或挂载 |
|---|---|---|
| 路由总入口 | `router/main.go` | `SetRouter` |
| 管理 API | `router/api-router.go` | `SetApiRouter` |
| 中继 | `router/relay-router.go` | `SetRelayRouter`，内调 `registerAppCenterRoutes` |
| 应用中心路由 | `router/app_center.go` | `registerAppCenterRoutes` |
| 仪表盘 | `router/dashboard.go` | `SetDashboardRouter` |
| 任务 | `router/task-router.go` | `SetTaskRouter` |
| 任务插件协议 | `router/task-plugin-protocol-router.go` | `SetTaskPluginProtocolRouter` |
| 视频 | `router/video-router.go` | `SetVideoRouter` |
| 插件 | `router/plugin-router.go` | `SetPluginRouter` |
| 前端静态 | `router/web-router.go` | `SetWebRouter` |
| 应用中心页 | `web/src/features/apps/index.tsx` | `AppCenter` |
| 应用卡片 | `web/src/features/apps/constants.ts` | `APP_CENTER_APPS`，`id` 如 `chat`、`canvas`、`image` |
| 应用体验 | `web/src/features/apps/experience/index.tsx` | `AppExperience` |
| 应用中心处理 | `controller/app_center.go` | 含 `PlaygroundImage` 等 |
| 对话页 | `web/src/features/playground/index.tsx` | `Playground` |
| 对话路由 | `web/src/routes/_authenticated/playground/index.tsx` | 已有 |
| 对话处理 | `controller/playground.go` | `Playground`，`POST /pg/chat/completions` |
| 画布页 | `web/src/features/canvas/index.tsx` | `CanvasPage`、`CanvasBoard` |
| 画布路由 | `web/src/routes/_authenticated/apps/canvas/index.tsx` | 已有 |
| 画布处理 | `controller/canvas.go` | `GetCanvasDraft`、`PutCanvasDraft` |
| 画布模型 | `model/canvas_draft.go` | `CanvasDraft` |
| 模型迁移 | `model/main.go` | `InitDB`、`migrateDB`、`InitLogDB`、`migrateLOGDB` |
| 计费设置页 | `web/src/features/system-settings/billing/index.tsx` | `BillingSettings` |
| 计费路由 | `web/src/routes/_authenticated/system-settings/billing/index.tsx` | 已有 |
| 钱包 | `web/src/features/wallet/index.tsx` | `Wallet` |
| 钱包路由 | `web/src/routes/_authenticated/wallet/index.tsx` | 已有 |
| 额度 | `service/quota.go` | `PostConsumeQuota` |
| 兑换码 | `web/src/routes/_authenticated/redemption-codes/index.tsx` | 已有 |
| 订阅 | `web/src/routes/_authenticated/subscriptions/index.tsx` | 已有 |
| 用户 | `web/src/routes/_authenticated/users/index.tsx` | 已有 |
| 渠道页 | `web/src/features/channels/index.tsx` | `Channels` |
| 渠道处理 | `controller/channel.go` | `GetAllChannels`、`AddChannel` |
| 模型管理 | `web/src/routes/_authenticated/models/index.tsx` | 已有 |
| 站点设置 | `web/src/routes/_authenticated/system-settings/site/` | 已有 |
| 认证设置 | `web/src/routes/_authenticated/system-settings/auth/` | 已有 |
| 内容设置 | `web/src/routes/_authenticated/system-settings/content/` | 已有 |
| 运营设置 | `web/src/routes/_authenticated/system-settings/operations/` | 已有 |
| 安全设置 | `web/src/routes/_authenticated/system-settings/security/` | 已有 |
| 侧栏数据 | `web/src/hooks/use-sidebar-data.ts` | `NavGroup.id`：`chat`、`general`、`personal`、`admin` |
| 侧栏配置 | `web/src/hooks/use-sidebar-config.ts` | `section`、`module` |
| 顶栏模块 | `web/src/lib/nav-modules.ts` | `appCenter`、`pricing`、`rankings` 等 |
| 权限 | `service/authz/enforcer.go` | `authz.Init` |
| 鉴权中间件 | `middleware/auth.go` | `AdminAuth`、`RequirePermission` |
| 多实例 | `model/main.go`、`middleware/distributor.go`、`service/system_instance.go` | `IsMasterNode`、`Distribute`、`StartSystemInstanceReporter` |
| 文案 | `web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json` | 扁平 JSON，key 为英文源句 |

本仓库没有独立的 AI 搜索、AIPPT、Agent 工具池、知识库、画廊、电商绘图、IDE、微信机器人、影视或 Browserless 的 feature 入口。

## 未证实清单

- AI 影视的前台路径。侧栏有该名称，走查未点开。禁止写成 `/film`。
- 微信机器人的前台路径。只确认用户菜单和侧栏名称，以及后台 `/admin/wechat-claw` 各页。
- 个人中心的独立路径。`/profile` 与 `/settings` 为 404。
- `/agent` 为 404。
- 公告、页面公告、活动弹窗、联系方式、SEO、页脚、页面内容、多语言的路径。
- 邀请奖励、邮件、短信的路径。
- 功能介绍、反馈流程、系统更新、系统维护的路径。
- 行为验证子页（策略、内置、日志、测试）的精确路径。已证实前缀为 `/admin/behavior-verification`，以及 `POST /api/behavior-verification/prepare`。
- `/admin/recharges`、`/admin/providers`、AIPPT 后台四页、对话模型、视频模型的列名和按钮。
- `/admin/*` 子页对应的 `/api/admin/...` 全量路径。
- `/docs`、`/api-keys`、`/wallet`、`/pricing`、`/kb`、`/canvas`、`/ide`、`/gallery`、`/ecom` 的页面内部字段。路径本身已在顶栏或信息架构中出现的，路径算已证实，内部控件未逐页抄。
- `https://docs.nexiv.me` 的页面内容。
- `electron/` 是否作为桌面端落点。实现前再确认，本文不新建目录。
- 对方任何服务函数、数据表、错误码。源码不可得。
