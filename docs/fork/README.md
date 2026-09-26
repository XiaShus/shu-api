# 二开总览

本目录是 `XiaShus/shu-api` 相对上游 `QuantumNous/new-api` 的二开说明。需求原文：

1. 将 GPT、Gemini 等常见生图引擎返回的 base64 存到自有七牛云，而不是直接把 base64 输出给用户。
2. Midjourney 支持快慢速分别计费，并适配最新 Midjourney 功能。
3. 后续补充：限制某些用户只能跑快速/慢速；编辑用户弹窗支持额外绑定多级分组、按模型单独降价、用户级倍率。

原则：后期会把上游变更合并进本仓库，但**永不把本仓库改动推回上游**。受保护的上游标识（项目名、组织名）一律不改。

本轮只产出报告，不改业务代码。

## 文档索引

| 文件 | 内容 |
|---|---|
| [01-current-state.md](./01-current-state.md) | 系统现状：本地开发形态、生图链路、MJ 能力、用户分组与倍率 |
| [02-image-object-storage.md](./02-image-object-storage.md) | Phase A：生图 base64 落七牛（S3 兼容） |
| [03-midjourney.md](./03-midjourney.md) | Phase B：MJ 快慢速分账 + 对齐 trueai v11.x |
| [04-user-billing-profile.md](./04-user-billing-profile.md) | Phase C：用户级计费覆盖（额外分组 / 模型折扣 / 用户倍率） |
| [05-upstream-merge.md](./05-upstream-merge.md) | 双分支模型、日常同步命令、冲突高发文件 |

## 分支策略

- `main` 只镜像 `upstream/main`，不写二开代码。
- `shu` 为二开主干，设为 GitHub 默认分支。
- 周期同步：`git fetch upstream && git checkout main && git merge --ff-only upstream/main && git checkout shu && git merge main`。
- 二开代码尽量放新文件；对上游文件只做最少钉子式插入。
- 永不 `git push upstream`。

命令细节见 [05-upstream-merge.md](./05-upstream-merge.md)。

## 实施顺序

1. Phase A 生图落七牛
2. Phase B Midjourney
3. Phase C 用户级计费

每个 Phase 从 `shu` 切独立分支，完成后合回 `shu`。涉及 schema 的 Phase 完成前必须按 `AGENTS.md` 跑 SQLite / MySQL / PostgreSQL 三库迁移验证。

## 决策速查

| 项 | 决策 |
|---|---|
| 对象存储协议 | S3 兼容（七牛 Kodo S3 端点），引入 `aws-sdk-go-v2/service/s3` |
| 存储配置 | 统一表 `image_storages`（`user_id=0` 系统）；option 只留开关 |
| `cdn_key` | JSON 顶层优先，header `X-CDN-Key` 兜底；失败回 base64，不退系统默认 |
| MJ 与 OSS | 不接 `cdn_key`，只走 `mj_media_persist_enabled` + 系统默认桶 |
| base64 改写范围 | a+b+c：`/v1/images/*` + Responses `image_generation_call` + Gemini chat markdown data URI；Gemini 原生默认不改，另给关闭态开关 |
| 上传失败 | 回退原 base64 + `SysError`；`strict_mode` 默认关 |
| MJ 媒体落七牛 | 独立开关 `mj_media_persist_enabled`，默认关 |
| MJ 价格 | 先查 `mj_{mode}_{action}`，未配置则 `mj_{action}` × `MjModeRatio` |
| MJ 模式判定 | 提交时判定并扣费；轮询不一致只记日志不重算 |
| MJ 模式限制 | 分组级 `MjGroupModePolicy`，不碰渠道模型列表 |
| MJ 功能范围 | 全量对齐 trueai v11.x |
| 用户覆盖存储 | 新表 `user_billing_profiles`，独立 `GET\|PUT /api/user/:id/billing_profile` |
| 额外分组语义 | 并入个人可用组表；主组 `group` 不变 |
| 模型降价形态 | 按模型折扣系数，折进 `HandleGroupRatio` |
| 设置注册 | `GlobalConfig.Register` + `options` 表；`/api/option/` 只需 `RootAuth`，不加 Casbin |
