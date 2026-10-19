# Nexiv 复刻排期

本文件是排期。本轮只写文档，不改业务代码，不打开演示站，不新建目录。

实现期凡是含界面的工作，完成标准都包含同一句：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。工具是 Cursor 浏览器（cursor-ide-browser），站点是 `https://demo.nexiv.me`。对照布局、区域、字段、按钮和信息层级。禁止凭记忆写，禁止自行改版。路径未证实的，先打开确认再写该页，确认前不写。界面不使用 Nexiv 商标。

事实与路径以 [01-materials.md](./01-materials.md) 为准。落点含义以 [02-architecture.md](./02-architecture.md) 为准。分期顺序不得重排。

## 本轮

不改路由、控制器、模型、前端和文案。不访问演示站、授权站和 GitHub。

## IN

P1 到 P17，加上下面的贯穿项。对方演示站上已看到的创作、搜索、绘图、PPT、画布、应用、知识库、画廊、电商、擂台、IDE、微信、影视、桌面端，以及站点、支付、开发者 API、账号与风控，都在范围内。

## 贯穿项

不单独立期。额度计算沿用 `service/quota.go`。兑换码沿用 `web/src/routes/_authenticated/redemption-codes/index.tsx`。用户沿用 `web/src/routes/_authenticated/users/index.tsx`。侧栏键沿用 `web/src/hooks/use-sidebar-config.ts` 的 `section` 与 `module`。已有页只补缺口。缺的能力写在对应期里，不因为已有对照就删掉。

## OUT

- 授权站、域名绑定售卖、`GET /api/license/check`、`/admin/system/license`。
- 对接 `demo.nexiv.me`、`nexivai_auth.nexiv.me`、`artdraw-auth.l11.top` 作为运行时依赖。
- 用对方 `/admin` 菜单替换本仓库管理侧栏。
- 新做 8 位小数点数账本。
- 本轮改代码。

## P1 对话工作台

- 演示路径：`/chat`、`/admin/chat-models`、`/admin/chat-channels`、`/admin/chat-records`。
- 落点：`web/src/features/playground`、`controller/playground.go`、`router/relay-router.go`。模型与渠道对照现有 models、channels。对话记录对照现有日志；本对话没有单独日志页面路径，对不上的写「无」并留在本期。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。会话、上下文、布局和已观察到的输入区控件可用，模型与渠道仍走现有管理页。

## P2 Agent 工具链

- 演示路径：`/chat` 的 Agent 模式、`/admin/agent-tools/global`、`/admin/agent-tools/servers`、`/admin/agent-tools/tools`、`/admin/agent-tools/skills`、`/admin/agent-tools/runs`、`/admin/ai-agent`。
- 落点：实现期新建 feature。后台配置挂现有 system-settings，不新起 admin 壳。对话壳继续用 P1。
- 依赖：P1。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。Agent 开关、规划模型、MCP、Skills、运行日志和自然语言配置助手都有页面。`/agent` 保持不作为入口。

## P3 绘图

- 演示路径：`/create`、`/admin/models`、`/admin/draw-presets`、`/admin/image-channels`、`/admin/image-tasks`。
- 落点：`web/src/features/apps/experience`、`router/app_center.go`。模型对照 `web/src/routes/_authenticated/models/index.tsx`。渠道对照 `web/src/features/channels/index.tsx`。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。创作台含已观察到的布局、提示词和预计消耗；预设与绘图记录有落点。

## P4 视频

- 演示路径：`/video`、`/admin/video-models`、`/admin/video-channels`、`/admin/video-tasks`。
- 落点：`router/video-router.go`，以及 experience 视频面板。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。镜头生成、模型、参数和参考媒体按演示页做出。

## P5 AI 搜索

- 演示路径：`/search`、`/admin/web-search`、`/admin/chat-web-search`、`/admin/ai-search-records`。
- 落点：实现期新建 `web/src/features/search`。总结与规划模型复用 P1 的对话模型，不新做额度账本。
- 依赖：P1。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。搜索模式、图片搜索和后台引擎、工具、计费规则按已观察 Tab 做出。

## P6 AIPPT

- 演示路径：`/ppt`、`/admin/ppt/service`、`/admin/ppt/pricing`、`/admin/ppt/templates`、`/admin/ppt/records`。
- 落点：实现期新建 `web/src/features/ppt`。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。生成设置含标题、描述、详细程度、页数、联网、绘图、模型和模板，并能生成大纲。

## P7 无限画布

- 演示路径：`/canvas`。
- 落点：`web/src/features/canvas`。
- 依赖：P3。依赖只表示节点能力用到绘图，不表示写文档要等 P3。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。在现有画布草稿上对齐演示页，不另起一套画布应用。

## P8 应用广场

- 演示路径：`/apps`、`/admin/apps`、`/admin/banners`。
- 落点：`web/src/features/apps`。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。应用市场、搜索、后台应用管理和轮播按演示页做出。

## P9 知识库

- 演示路径：`/kb`、`/admin/kb`、`/admin/embedding-models`、`/admin/embedding-channels`、`/admin/kb-settings`。
- 落点：实现期新建 `web/src/features/kb`。向量渠道优先对照现有 channels。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。前台内部字段走查未抄的，先打开页面再写。

## P10 画廊

- 演示路径：`/gallery`、`/admin/gallery`、`/admin/gallery-pending`、`/admin/gallery-settings`。
- 落点：实现期新建 `web/src/features/gallery`。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。列表、待审核和分类都要有。

## P11 电商绘图

- 演示路径：`/ecom`、`/admin/ecom-templates`、`/admin/ecom-bundles`。
- 落点：实现期新建 `web/src/features/ecom`。
- 依赖：P3。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。模板与作品管理按演示页做出，生图复用 P3。

## P12 模型擂台

- 演示路径：前台是 `/chat` 的擂台布局，不另造路径。后台 `/admin/chat-arena/settings`、`/admin/chat-arena/records`。
- 落点：挂在 P1 的对话工作台。后台挂现有 system-settings。
- 依赖：P1。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。擂台只作为 `/chat` 的一种布局。

## P13 IDE

- 演示路径：`/ide`、`/admin/ide/basic`、`/admin/ide/billing`、`/admin/ide/projects`。
- 落点：实现期新建 `web/src/features/ide`。计费设置对照现有 billing，不新做点数账本。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。内部字段未抄的，先打开再写。

## P14 微信机器人

- 演示路径：前台 URL 未证实，只记菜单名「微信机器人」。后台 `/admin/wechat-claw`、`/admin/wechat-claw/bots`、`/admin/wechat-claw/presets`、`/admin/wechat-claw/policy`、`/admin/wechat-claw/logs`。
- 落点：实现期新建 `web/src/features/wechat-bot`。
- 依赖：P2。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。前台路径确认前不写前台页。后台五页按已证实路径做。

## P15 AI 影视

- 演示路径：前台未点开，禁止写死 `/film`。后台只写 `/admin/film-settings`。
- 落点：实现期新建 feature。视频能力复用 P4。
- 依赖：P4。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。前台路径确认前不写前台页。

## P16 桌面端与 Browserless

- 演示路径：`/admin/desktop/basic`、`/admin/desktop/work-mode`、`/admin/desktop/browser-worker`。
- 落点：实现前确认 `electron/`。本轮不新建目录。
- 依赖：无。排在最后。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。目录未确认前不新建桌面端工程。

## P17 站点、支付、开发者 API、账号与风控

- 演示路径：`/admin/pay-providers`、`/admin/recharge-packages`、`/admin/recharges`、`/admin/speech`、`/admin/storage`、`/admin/model-info`、`/admin/providers`、`/admin/model-stats`、`/admin/pricing`、`/admin/api-settings`、`/admin/api-logs`、`/admin/settings`、`/admin/site-ui`、`/admin/home-content`、`/admin/nav-menu`、`/admin/auth-login`、`/admin/oauth`、`/admin/behavior-verification`。
- 名称已见、路径未证实：公告、页面公告、活动弹窗、联系方式、SEO、页脚、多语言、邀请奖励、邮件、短信、系统更新、系统维护。页面内容与功能介绍、反馈流程同样只有名称。
- 前台：`/`、`/pricing`、`/docs`、`/api-keys`、`/wallet`、`/recharge`。
- 落点只许对照 `system-settings` 的 site、auth、content、security、operations、billing，以及 wallet、redemption-codes、subscriptions。对不上的写「无」。
- 依赖：无。
- 完成标准：实现时先用 Cursor 浏览器打开该期已证实页面，对照演示页一比一复刻。路径未证实的名称先打开确认再写。额度仍走 quota。授权页不在本期。
