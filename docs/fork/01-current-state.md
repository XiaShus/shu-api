# 系统现状

调研基线：本地仓库 `e:\code\shu-api`，远程 `origin=XiaShus/shu-api`、`upstream=QuantumNous/new-api`，当前分支 `main`。下文是代码事实，不是方案。

## 本地开发形态

完整双进程，不是 Docker、不是占位页：

| 入口 | 用途 |
|---|---|
| `http://localhost:5173` | 前端 Rsbuild HMR，`/api` 代理到 3000 |
| `http://localhost:3000` | Go 网关 + 嵌入的 `web/dist` |
| `http://127.0.0.1:8005/debug/pprof/` | 本机性能剖析 |

- 后端：`air` 热重载（`.air.toml` → `tmp/shu-api.exe`）
- 前端：`web/` 下 `bun run dev`
- 数据库：本机 MySQL `127.0.0.1:3306`，库名 `shu_api`，`SQL_DSN` 在 `.env`
- 缓存：本机 Redis `127.0.0.1:6379`，无密码
- 表结构由 `model.InitDB()` / `AutoMigrate` 创建，无专项 SQL migration 目录

改 Go 等 `air` 重启 3000；改 `web/` 刷 5173。要把前端打进 3000 的嵌入包，再跑一次 `web/` 下 `bun run build`。

## 生图链路

### 入口

| 路径 | 分发 |
|---|---|
| `POST /v1/images/generations` | `controller.Relay` → `RelayFormatOpenAIImage` → `relay.ImageHelper` |
| `POST /v1/images/edits` | 同上 |
| `POST /v1/edits` | 同上（别名） |
| `POST /v1/images/variations` | `RelayNotImplemented` |
| `POST /v1/responses` | `relay.ResponsesHelper` |
| `POST /v1/chat/completions` | 通用 chat；Gemini 图走 markdown data URI |
| `POST /v1beta/models/*` | `RelayFormatGemini` 原生透传 |

路由：`router/relay-router.go`。校验：`relay/helper/valid_request.go` `GetAndValidOpenAIImageRequest`，`n` 上限 `dto.MaxImageN = 128`。

DTO：`relaykit/dto/openai_image.go` — `ImageRequest` / `ImageResponse` / `ImageData{Url, B64Json, RevisedPrompt}`。`response_format` 为普通字符串（`url` / `b64_json`）。

### 各渠道回写

| 渠道 | 文件 / 符号 | 回写行为 |
|---|---|---|
| OpenAI / 默认 | `relay/channel/openai/relay_image.go` `OpenaiImageHandler` | 非流式读 body 只解析 usage，按 `data.#` 计数，**原字节回写**，不反序列化 `data[]` |
| OpenAI 流式 | 同文件 `OpenaiImageStreamHandler` / `openaiImageJSONAsStreamHandler` | SSE 透传；JSON-as-stream 用 sjson 拷 `url` / `revised_prompt` / `b64_json` |
| Gemini Imagen | `relay/channel/gemini/relay-gemini.go` `GeminiImageHandler` | `Predictions[].BytesBase64Encoded` → `ImageData{B64Json}`，重建 JSON |
| Vertex imagen | `relay/channel/vertex/adaptor.go` | 委托 `GeminiImageHandler` |
| Gemini chat / nano-banana | `relay/channel/gemini/relay-gemini.go` `GeminiChatHandler` / `GeminiChatStreamHandler` | `relaykit` `ResponseGeminiChat2OpenAI` 把 `inlineData` 写成字符串 `![image](data:{mime};base64,{data})` |
| Gemini 原生 | `relay/channel/gemini/relay-gemini-native.go` `GeminiTextGenerationHandler` | **原 Gemini JSON 透传**，`inlineData` 不变 |
| Responses | `relay/channel/openai/relay_responses.go` `OaiResponsesHandler` | 原字节回写；`output[].result` 就是 base64 |
| Ali / Replicate / MiniMax / Jimeng / Zhipu | 各自 `*2OpenAIImage` | 已重建 `dto.ImageResponse`（Ali 在 `b64_json` 时会把 URL 下载成 base64） |

`service/response_converter.go` 只做协议转换，不改写图片字节。仓库里**没有**统一的「把 base64 换成托管 URL」中间件。

### 计费与内容解耦

计费看张数 / usage token / `result` 非空，**不依赖 b64 本体**：

- Images API：`service/image_billing.go` `PrepareImageBillingForRequest` 用请求 `n`；回写后 `info.UpdateImageCount(data.#)`
- Responses：`relay/common/tool_usage.go` `ImageGenerationCallCounter`，`Result != ""` 且状态非失败才计；`tool_price_setting.prices` 默认 `$150 / 1K calls`
- Gemini chat：优先 `usageMetadata`；缺失时 `imageCount * 1400`，`imageCount` 来自 `InlineData.MimeType != ""`
- Gemini Imagen：`258 * len(Data)`

把 `b64_json` 换成非空 URL、把 markdown data URI 换成 http URL，只要数组长度 / `result` 非空 / `MimeType` 还在，计费不变。清空 `result` 会停计。

### 存储现状

| 项 | 事实 |
|---|---|
| Qiniu / OSS / MinIO SDK | **不存在** |
| `github.com/aws/aws-sdk-go-v2/service/s3` | **不存在**（go.mod 只有 Bedrock 用的 aws-sdk-go-v2） |
| `setting/system_setting/task_artifact_store.go` `TaskArtifactStoreConfig` | ENV 预留 S3 字段；`Mode=="s3"` **强制回退 `upstream`**，注释写未实现 |
| `service/task_artifact_store.go` | 接口 `Enabled/Resolve/Persist/Serve` 存在，实现禁用 |
| 管理端对象存储 UI | **不存在**（`web/src/features/settings/**` 也不存在，实际树是 `system-settings`） |
| `controller/image.go` `GetImage` | 空 stub |
| `GET /mj/image/:id` | 无鉴权代理上游 `ImageUrl` |
| `/v1/tasks/:key/artifacts/:artifact_key/content` | Token 或 HMAC `access=`，代理上游，不落本地 |

Worker（`WorkerUrl`）只负责出站拉图，不是本进程对象存储。

### 设置注册范例

新管理设置走分层配置，不要抄 `TaskArtifactStore`（那是 ENV-only）：

1. 结构 + `config.GlobalConfig.Register("模块", &struct)` — 例：`setting/system_setting/fetch_setting.go`
2. 库键 `{模块}.{json字段}`，`model/option.go` `InitOptionMap` / `handleConfigUpdate`
3. `GET|PUT /api/option/` + `middleware.RootAuth()`（不是 AdminAuth，不加 Casbin）
4. 前端 `web/src/features/system-settings/**`，`useUpdateOption().mutateAsync({ key, value })`
5. i18n：`web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json`，键=英文明文，`bun run i18n:sync`

## Midjourney 现状

### 路由

`router/relay-router.go`：`/mj` 与 `/:mode/mj` 共用 `registerMjRouterGroup`。`c.Param("mode")` **从未被读取**。没有写死的 `/mj-fast/` 路由组，但 `/{任意}/mj/...` 都能进同一 handler。

`relay.getMjRequestPath`（`relay/mjproxy_handler.go`）：仅当 URL **包含** `"/mj-"` 时截成 `/mj/` + 后缀（`/mj-fast/mj/submit/imagine` → `/mj/submit/imagine`）。`/fast/mj/...` 不改写，会原样拼到渠道 `baseURL`。

已挂端点：`submit/imagine|change|simple-change|describe|blend|action|modal|shorten|edits|video`、`insight-face/swap`、`submit/upload-discord-images`、`task/:id/fetch`、`task/:id/image-seed`、`task/list-by-condition`、`GET /mj/image/:id`（TokenAuth 之前，无鉴权）。

`POST /mj/notify` handler 在，**路由注释掉**。

动作常量：`constant/midjourney.go` — `IMAGINE` … `VIDEO` `EDITS`。运行时模型名：`service.CovertMjpActionToModelName` → 默认 `mj_` + 小写动作；例外 `SWAP_FACE` → `swap_face`。

`CoverPlusActionToNormalAction` 只认 upsample / variation / pan / reroll / Outpaint / CustomZoom / Inpaint。video / animate / retexture / omni 的 customId → `unknown_action:`。

### 计费

**不按** fast/relax/turbo 分价。价格就是 `ModelPrice` 里的 `mj_*`。未找到 `MjActionPrices`、`MjModeEnabled`、`mj_fast_*`。

默认价在 `setting/ratio_setting/model_ratio.go` `defaultModelPrice`（`setting/billing_setting/builtin_billing.go` **无 mj 条目**）：

| 模型 | 默认价 |
|---|---|
| `mj_video` | 0.8 |
| `mj_imagine` `mj_edits` `mj_variation` `mj_reroll` `mj_blend` `mj_modal` `mj_zoom` `mj_shorten` `mj_high_variation` `mj_low_variation` `mj_pan` | 0.1 |
| `mj_describe` `mj_upscale` `swap_face` `mj_upload` | 0.05 |
| `mj_inpaint` `mj_custom_zoom` | 0 |

查价：`relay/helper/price.go` `ModelPriceHelperPerCall`，按 `OriginModelName`（动作模型）× `QuotaPerUnit` × `groupRatio`。查找串里没有 mode。

扣费时机：提交前只检查余额，**不预扣**；上游成功后 `PrepareMidjourneyTaskBilling` + `SettleMidjourneyTaskBilling` 一次扣完。失败退款只在 poller：`RefundMidjourneyQuota`。订阅套餐路径直接拒绝（`legacy Midjourney billing does not support subscriptions`）。

`setting/midjourney.go` 选项：`MjNotifyEnabled`、`MjAccountFilterEnabled`、`MjModeClearEnabled`（从 prompt 剥 `--fast/--relax/--turbo`，**不读不存 mode，不改价**）、`MjForwardUrlEnabled`（默认 true，fetch/日志把 `image_url` 改成本域 `/mj/image/{mjId}`）、`MjActionCheckSuccessEnabled`。

### 数据与轮询

`model/midjourney.go` `Midjourney`：**无 mode 列**。已有 `ImageUrl`、`VideoUrl`、`VideoUrls`、`Buttons`、`Properties`、`Quota`、`TokenId`、`BillingChannelId`。靠 `AutoMigrate` 加列，无专项 migration。

MJ **不走** `service/task_polling.go`（对 `TaskPlatformMidjourney` 直接 return）。真正轮询：`controller.midjourneyPollHandler`，15s，`POST {BaseURL}/mj/task/list-by-condition`。`VideoUrl` / `VideoUrls` **不改写**，没有 `/mj/video/`。

### 前端

设置：`web/src/features/system-settings/content/drawing-settings-section.tsx`，路径 `/system-settings/content/drawing`。无分模式定价表单。

任务日志：`/usage-logs/drawing`。列只有 image，没有 video / mode / quota。`MJ_TASK_TYPE_MAPPINGS` 缺 `MODAL`。

渠道类型：2 `MjProxy`，5 `MjProxyPlus`。渠道默认模型列表为空，需手填 `mj_*`。

### 上游与官方（2026-09）

- 官方默认模型 **V8.2**（不是 V7）。速度档仍是 Relax / Fast / Turbo；V8.1/V8.2 **不支持 Turbo**。另有 Draft（`--draft`），不是第四档 GPU 池。
- 官方成本轴是 **GPU 分钟**（Turbo ≈ 2× Fast；Relax 不扣 Fast；V8 Draft 约 0.4 min / prompt）。
- 主流代理：`trueai-org/midjourney-proxy` v11.11.1（2026-09-10）。每个 submit/task 有四套前缀：`/mj/`、`/mj-fast/mj/`、`/mj-turbo/mj/`、`/mj-relax/mj/`。模式优先级：路径 > `accountFilter.modes[0]` > prompt `--fast/--relax/--turbo` > 默认 FAST。
- 已有（相对 plus）：video、edits、upload-discord-images、list-by-condition。上游 PR [#1321](https://github.com/QuantumNous/new-api/pull/1321) 已合 `mj_video` / `mj_edits`。
- 未实现：retexture、`/mj/submit/edit` 别名、task cancel、list-by-ids、video-swap、notify 路由、video extend 语义校验、视频 URL 本地转发、日志页 mode/视频列、draft/omni/V7 专用逻辑。
- Issue [#1245](https://github.com/QuantumNous/new-api/issues/1245) 讨论过 `mj_fast` / `mj_relax` 当模型名做分组倍率，**不是**读 proxy 的 mode 后分账；已关闭。

测试：几乎只有 `service/task_billing_test.go`。无 `*midjourney*_test.go` / `mjproxy*_test.go`。

## 用户分组与倍率

### 用户只有一个 `group`

`model/user.go` `User`：`Group varchar(64)` 默认 `default`；`Setting text` 存 `dto.UserSetting`（通知 / 语言 / `AcceptUnsetRatioModel` / `BillingPreference`，**无价格字段**）。无 `*Ratio*`、无 `extra_groups`。

管理员 `PUT /api/user/` → `controller.UpdateUser` → `EditWithTx` 只写 `username, display_name, group, remark`（及非空 password）。不写 quota / setting / role。

前端不是独立 Dialog，是侧栏 `web/src/features/users/components/users-mutate-drawer.tsx`，zod 在 `users/lib/user-form.ts`。组选项来自 `GET /api/group/`（`GroupRatio` 的 key 列表）。用户自助不能改 group。

### 计费组 vs 用户组

| context key | 含义 |
|---|---|
| `user_group` | 用户真实组 |
| `group`（`ContextKeyUsingGroup`） | 本次计费/选渠组：token.group 非空则用之（须在可用组内），否则 user.group；`auto` 再解析 |
| `token_group` | token 原始 Group，可能为空 |

可用组：`service.GetUserUsableGroups(userGroup)` = 站级 `UserUsableGroups` + `GroupSpecialUsableGroup[userGroup]` 加减。**没有按个人的可用组。**

选渠：`CacheGetRandomSatisfiedChannel`，按 `usingGroup`。普通 `/v1` 请求 body 的 `group` 不参与选组。

### 最终价只乘一个分组倍率

`relay/helper/price.go` `HandleGroupRatio`：

1. 若存在 `GroupGroupRatio[userGroup][usingGroup]`，**整段替换** `GroupRatio[usingGroup]`（`HasSpecialRatio=true`），不是相乘。
2. 否则用 `GroupRatio[usingGroup]`。
3. 固定价：`quota = modelPrice * QuotaPerUnit * GroupRatio * OtherRatios`
4. 按次（MJ）：`ModelPriceHelperPerCall` 同一套 `HandleGroupRatio`

`RelayInfo` **没有** `UserGroupRatio` 字段。日志里的 `user_group_ratio` 来自 PR #1281，值是站点级 `GroupSpecialRatio`，不是 per-user。

表达式计费：组前成本算出后再 `* GroupRatio`。`billing_expr_request.go` 不含用户倍率变量。

预扣 `PreConsumeBilling` / 后结 `SettleBilling` **不再读用户表**，只消费已算好的 quota。

### 缓存热路径

`model/user_cache.go` `UserBase`：`Id, Group, Email, Quota, Status, Role, Username, Setting, AuthVersion, CacheSchema`。`userCacheSchemaVersion = 2`。Redis key `user:%d`。

`UserBase.WriteContext` 写入 `user_group` / `user_quota` / `user_setting` 等。热路径（TokenAuth → `GenRelayInfo` → `HandleGroupRatio`）只读 context，不再打用户表。

新 per-user 字段无论存哪，都必须进 `UserBase` 并升 `CacheSchema`。`users.setting` 用户自己可写，**不能**放计费覆盖。

### 明确不存在

- `UserModelPrice` / `user_ratio` / `PersonalRatio` / `extra_groups`
- 订阅计划的 per-model 价
- `model/user_test.go`、`group_ratio*_test.go`
- `GetUserGroupCache` 导出符号（仅内部 `getUserGroupCache`）
