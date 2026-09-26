# 上游合并与分支卫生

## 1. 目标

本仓库后期持续吃进 `QuantumNous/new-api` 的更新，但**永不把二开推回上游**。见上文 Q8。

## 2. 决策清单

- `main`：只镜像 `upstream/main`，禁止直接在 `main` 上提交二开。
- `shu`：二开主干，GitHub 默认分支。
- 每个 Phase 从 `shu` 切 `shu/a-object-storage`、`shu/b-midjourney`、`shu/c-user-billing`，完成后 PR 合回 `shu`（本 fork 内）。
- 同步只走 `upstream → main → shu`，方向不可逆。
- 二开优先新文件；改上游文件只做钉子式插入（一个调用点、一段 Register、一行 AutoMigrate）。
- 不改 README 系列、许可证头、Go module 路径、Docker 镜像名、以及任何受保护标识。
- 不向 `upstream` push；不 force-push `main`。

## 3. 日常同步

首次（尚未建 `shu` 时）：

```
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main
git checkout -b shu
git push -u origin shu
```

然后在 GitHub 把默认分支设为 `shu`。

之后周期：

```
git fetch upstream
git checkout main
git merge --ff-only upstream/main
git push origin main
git checkout shu
git merge main
# 冲突只解决二开钉子，不要把上游新逻辑删掉
git push origin shu
```

`--ff-only` 失败说明有人在 `main` 上提交了二开：停下来，把那些 commit cherry-pick 到 `shu`，把 `main` 复位到 `upstream/main`（需老板明确授权才允许 reset）。

合完 `shu` 后在本机跑：`go build .`、`cd relaykit && GOWORK=off go build ./...`、`cd web && bun run build`。涉及 schema 再跑三库 AutoMigrate。

## 4. 冲突高发文件

这些文件上游改得勤，二开只钉最小插入，冲突时先保上游再把钉子补回去。

| 文件 | 二开钉子 | 合入时注意 |
|---|---|---|
| `model/user_cache.go` | `BillingProfile` 字段、schema 2→3 | 上游若已升 schema，改用下一个整数，不要覆盖他们的字段 |
| `model/user_auth_cache.go` | HSET 多一个字段 | 与 Lua 脚本字段列表对齐 |
| `model/main.go` | `AutoMigrate` 多一张表、Midjourney 多列 | 插在现有列表末尾 |
| `model/option.go` | 新 option 键 | 跟现有 `Mj*` 分支走 |
| `relay/helper/price.go` | `HandleGroupRatio` 乘用户因子；MJ 分模式查价 | 上游若重写 Helper，把乘法接到新出口 |
| `middleware/auth.go` | 可用组改 `GetUserUsableGroupsForUser` | 只换函数，不改鉴权顺序 |
| `relay/channel/openai/relay_image.go` | completed 事件改写 b64 | 插在写出前，不要改 usage 解析 |
| `relay/channel/openai/relay_responses.go` | 重写 `result` | 计费观察之后、或保持 result 非空 |
| `relay/channel/gemini/relay-gemini.go` | markdown URI 改写 | 不进 relaykit |
| `relay/image_handler.go` | 缓冲 ResponseWriter | 失败路径要能回退 |
| `router/relay-router.go` | 新 MJ 路由 | 加在 `registerMjRouterGroup` 内 |
| `router/api-router.go` | billing_profile 路由 | RootAuth 组 |
| `setting/ratio_setting/model_ratio.go` | 两个默认价 | 只追加键 |
| `setting/midjourney.go` | 三个新 option | 追加 |
| `controller/system_task_handlers.go` | MJ 落盘 + mode 日志 | 不要改 15s / list-by-condition 主流程 |
| `web/src/features/users/components/users-mutate-drawer.tsx` | 计费覆盖区块 | 独立请求，主保存失败不写 profile |
| `web/src/features/system-settings/content/drawing-settings-section.tsx` | 模式倍率 / 组策略 | 追加控件 |
| `web/src/features/system-settings/integrations/section-registry.tsx` | object_storage section | 追加一项 |
| `go.mod` | s3 模块 | 只加 s3/config，不动 bedrock 版本集，除非升级整组 |

优先落在新文件、合入时零冲突的部分：

- `pkg/objstore/**`
- `service/image_storage.go`
- `service/midjourney_mode.go`
- `model/user_billing_profile.go`
- `controller/user_billing_profile.go`
- `setting/system_setting/object_storage.go`
- `web/src/features/system-settings/integrations/object-storage-section.tsx`

## 5. 发布与 Actions

本 fork 的 workflow（名称）：

| 文件 | 触发 |
|---|---|
| `ci.yml` | 仅 `pull_request` |
| `release.yml` | `workflow_dispatch` 或 push tags（排除 `*-alpha*`） |
| `docker-build.yml` | push tags 或 `workflow_dispatch` |
| `electron-build.yml` | push tags 或 `workflow_dispatch` |
| `docker-image-branch.yml` | 仅 `workflow_dispatch` |
| `sync-release-to-gitcode.yml` | 仅 `workflow_dispatch` |

推 `main` / `shu` **不会**跑 CI。打 tag 可能触发 Release / Docker / Electron——fork 上若未关 Actions，先确认不会把带二开的镜像推到上游同名仓库。本 fork 镜像名、release 目标只指向 `XiaShus/shu-api`。

没有仓库根 `CHANGELOG` / `VERSION` 文件。版本字符串仍用 `-ldflags -X ...common.Version=`。

## 6. 禁止事项（本仓库长期）

- `git push upstream`
- 在 `main` 上直接开发
- 为了少冲突而把二开逻辑塞进 `relaykit/`（relaykit 必须独立可编译，且合上游更痛）
- 删除或改写受保护标识
- 把七牛 AK/SK 写进仓库、文档、issue、日志样例
- 声称「已与上游兼容」但没跑三库迁移（凡改了 AutoMigrate / 模型标签的 Phase）

## 7. 建议合入节奏

1. 先建 `shu` 并设默认分支（无业务 diff）。
2. Phase A → 合 `shu` → 同步一次 upstream（趁钉子少）。
3. Phase B → 合 `shu`。
4. Phase C → 合 `shu`。
5. 之后每周或每个上游 release 按第 3 节同步一次。
