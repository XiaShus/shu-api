# Nexiv 行为架构

对方 GitHub 没有可编译源码。下文是演示站行为，以及这些行为落到本仓库现有入口的对照。函数名、表名、错误码凡是仓库里不存在的，一律写「源码不可得」，不补。

菜单、字段和 API 的原始清单见 [01-materials.md](./01-materials.md)。

## 结论

Nexiv 的公开仓库是 README 加 38 张截图。演示站 `demo.nexiv.me` 是一套前后台分开的创作系统：用户侧是工作台，运营侧是 `/admin`。授权售卖在另外两个域名上。

本仓库是已有的 API 网关。对话、绘图体验、视频路由、画布草稿、渠道、模型、用户、额度、钱包和兑换码已经存在。复刻是在这些入口上补齐对方工作台里还没有的能力，不新建第二套管理后台，不替换现有侧栏，不把演示站或授权站当成上游。

界面实现时不使用 Nexiv 商标。文档用该名称指称对方产品。

## 信息架构

| 面 | 对方形态 | 本仓库落点 |
|---|---|---|
| 用户工作台 | 顶栏加左侧导航，主区是对话、画布或参数面板 | 现有 `web/` 应用中心、playground、画布。新能力按 [03-replication-plan.md](./03-replication-plan.md) 的 feature 路径加，不另起一套壳 |
| 运营后台 | `/admin` 左侧菜单 | 已有渠道、模型、用户、计费、钱包、兑换码、`system-settings`。缺的页面挂在这些设置上，不复制对方菜单树 |
| 授权中心 | 两个独立站，演示站 `/admin/system/license` 只做展示和外链 | 永久不做 |

已观察的布局区域：

- 营销首页：顶栏、主内容、页脚。
- 创作、对话、搜索、视频、PPT：左侧导航、主画布或对话区、参数或提示词面板。
- 管理后台：顶栏、左侧管理菜单、表格或表单。
- AIPPT：列表区加生成设置。
- 充值：套餐与订单、自定义金额、钱包区块。

## 请求路径

演示站上看到的只有 HTTP 路径。没有服务层函数。源码不可得。

登录后首页会取公开设置、功能开关、当前用户、模型列表、供应商列表、应用列表和后台概览。对话会话走 `/api/chat/sessions`，绘图会话路径带 `ArtDraw`。通知有未读计数、列表和 `sse-ticket`。活动与轮播按页面名或位置查询。文案按设置 id 拉取翻译。

`GET /api/license/check` 与 `POST /api/behavior-verification/prepare` 是演示站行为。前者属于授权，本仓库不实现。后者只说明登录前有行为验证准备请求，字段与判定规则源码不可得。

`/api/admin/...` 除 `GET /api/admin/overview` 外未全量抓包。不编造子路径。

## 模块对照

「无」表示本对话没有对应 feature 入口。实现期路径以第 3 份文档为准。

| 模块 | 演示路径 | 已观察行为 | 本仓库落点 |
|---|---|---|---|
| 对话 | `/chat`；`/admin/chat-models`；`/admin/chat-channels`；`/admin/chat-records` | 会话、上下文、多种布局、语音输入。后台分模型、渠道、记录 | `web/src/features/playground`、`controller/playground.go` 的 `Playground`、`router/relay-router.go` 的 `POST /pg/chat/completions`。模型与渠道对照 `web/src/routes/_authenticated/models/index.tsx`、`web/src/features/channels/index.tsx`。对话记录的独立页面路径本对话未给出 |
| Agent | `/chat` 的 Agent 模式；`/admin/agent-tools/global`；`/admin/agent-tools/servers`；`/admin/agent-tools/tools`；`/admin/agent-tools/skills`；`/admin/agent-tools/runs`；`/admin/ai-agent` | 对话里切换 Agent。全局设置含开关、规划模型、默认绘图与视频模型、计费模式与按次价格。另有用自然语言改后台配置的页面。`/agent` 为 404 | 无独立 feature。对话壳复用 playground |
| 绘图 | `/create`；`/admin/models`；`/admin/draw-presets`；`/admin/image-channels`；`/admin/image-tasks` | 文生图工作台，可选布局，有提示词和预计消耗。模型表有显示名与请求名。渠道表有端口节点、支持模型、成功率与优先级 | `web/src/features/apps/experience`、`router/app_center.go` 的 `registerAppCenterRoutes`、`controller/app_center.go`。模型与渠道同上 |
| 视频 | `/video`；`/admin/video-models`；`/admin/video-channels`；`/admin/video-tasks` | 镜头生成，含模型、参数、参考媒体 | `router/video-router.go` 的 `SetVideoRouter`，以及 experience 视频面板 |
| AI 搜索 | `/search`；`/admin/web-search`；`/admin/chat-web-search`；`/admin/ai-search-records` | 独立搜索工作台，可切模式和图片搜索。后台有搜索引擎、模式、工具和计费规则 | 无 |
| AIPPT | `/ppt`；`/admin/ppt/service`；`/admin/ppt/pricing`；`/admin/ppt/templates`；`/admin/ppt/records` | 按标题、描述、详细程度、页数、联网、绘图、模型和模板生成大纲 | 无 |
| 无限画布 | `/canvas` | 顶栏有入口。页面内部字段未逐页抄 | `web/src/features/canvas` 的 `CanvasPage`、`CanvasBoard`；`controller/canvas.go` 的 `GetCanvasDraft`、`PutCanvasDraft`；`model/canvas_draft.go` 的 `CanvasDraft` |
| 应用广场 | `/apps`；`/admin/apps`；`/admin/banners` | 对话与绘图应用市场，可搜索。后台管应用和轮播 | `web/src/features/apps` 的 `AppCenter`、`APP_CENTER_APPS` |
| 知识库 | `/kb`；`/admin/kb`；`/admin/embedding-models`；`/admin/embedding-channels`；`/admin/kb-settings` | 顶栏与后台菜单已出现。内部字段未逐页抄 | 无 |
| 画廊 | `/gallery`；`/admin/gallery`；`/admin/gallery-pending`；`/admin/gallery-settings` | 前台入口已出现。后台分列表、待审核、分类 | 无 |
| 电商绘图 | `/ecom`；`/admin/ecom-templates`；`/admin/ecom-bundles` | 顶栏与后台模板、作品菜单已出现。内部字段未逐页抄 | 无 |
| 模型擂台 | `/chat` 的擂台布局；`/admin/chat-arena/settings`；`/admin/chat-arena/records` | 擂台是对话布局，不是另一条前台路径 | 无独立页面。对话壳复用 playground |
| IDE | `/ide`；`/admin/ide/basic`；`/admin/ide/billing`；`/admin/ide/projects` | 顶栏与后台基础、计费、项目菜单已出现。内部字段未逐页抄 | 无 |
| 微信机器人 | 前台路径未证实；`/admin/wechat-claw`；`/admin/wechat-claw/bots`；`/admin/wechat-claw/presets`；`/admin/wechat-claw/policy`；`/admin/wechat-claw/logs` | 用户菜单和侧栏有名称。后台有总览、机器人、预设、策略与配额、运行日志 | 无 |
| AI 影视 | 前台路径未证实；`/admin/film-settings` | 侧栏有名称，未点开。后台只有影视模块设置这条已出现路径 | 无。禁止把前台写成 `/film` |
| 桌面端 | `/admin/desktop/basic`；`/admin/desktop/work-mode`；`/admin/desktop/browser-worker` | 只有后台三条路径 | 实现前确认 `electron/`。本文件不判断该目录 |
| 站点与支付等 | 见下一节 | 充值、公示价、站点、账号、风控、开发者 API | 见下一节 |

## 管理端已有页

对照表是落点，不是排除项。已有页补缺口；对话里没有的后台能力仍要做，排期在 P17。

| 对方页面 | 本仓库 |
|---|---|
| `/admin/models`、对话与视频模型菜单 | `web/src/routes/_authenticated/models/index.tsx` |
| `/admin/image-channels` 以及对话、视频、向量渠道 | `web/src/features/channels/index.tsx`，处理函数 `GetAllChannels`、`AddChannel` |
| `/admin/users` | `web/src/routes/_authenticated/users/index.tsx` |
| `/admin/pricing` 与计费类设置 | `web/src/features/system-settings/billing/index.tsx` 的 `BillingSettings` |
| `/admin/redeem-codes` | `web/src/routes/_authenticated/redemption-codes/index.tsx` |
| `/recharge`、`/wallet` | `web/src/features/wallet/index.tsx` 的 `Wallet` |
| `/admin/settings`、`/admin/site-ui`、`/admin/home-content`、`/admin/nav-menu` | `web/src/routes/_authenticated/system-settings/site/`、`content/`。对不上具体子页的写「无」 |
| `/admin/auth-login`、`/admin/oauth` | `web/src/routes/_authenticated/system-settings/auth/` |
| `/admin/behavior-verification` | `web/src/routes/_authenticated/system-settings/security/`。子页路径未证实 |
| 运营类公告与活动，路径未证实 | `web/src/routes/_authenticated/system-settings/operations/`。路径未证实则不配对到具体文件 |
| 侧栏显隐 | `web/src/hooks/use-sidebar-config.ts` 的 `section` 与 `module`。分组 id 见 `web/src/hooks/use-sidebar-data.ts` |

`/admin/pay-providers`、`/admin/recharge-packages`、`/admin/recharges`、`/admin/speech`、`/admin/storage`、`/admin/model-info`、`/admin/providers`、`/admin/model-stats`、`/admin/api-settings`、`/admin/api-logs` 在上表没有单独一对一文件。落点写「无」，仍属于要复刻的范围。

## 计费对照

对方 README 把计费写成 8 位小数点数，并按模型、子动作和工具扣点。演示站充值页用元、积分和时长卡；搜索、Agent、PPT、IDE 后台各自有价格或计费设置。

本仓库继续用 `service/quota.go` 的 `PostConsumeQuota`，钱包用 `web/src/features/wallet`，兑换码和订阅用现有路由。不新做 8 位小数点数账本。公示价页 `/pricing` 与充值页 `/recharge` 是两套界面，实现时都要有，额度仍走 quota。

## 授权

对方机制，本仓库永久不做：

- 授权站注册、购买、兑换、域名绑定和公开查询。
- 演示站 `GET /api/license/check`。
- `/admin/system/license` 的授权码激活。
- 离线授权、www 子域名自动授权、多节点授权客户端。配置键名在公开资料里不存在，源码不可得。
- 对接 `demo.nexiv.me`、`nexivai_auth.nexiv.me`、`artdraw-auth.l11.top`。

`/admin/system/license` 只在本文记录，不进入任何实现期。
