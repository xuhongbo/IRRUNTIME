下面是一份“事无巨细”的**项目备份文档（Markdown）**，把我们到目前为止的**前因后果、背景、目标、架构取舍、里程碑规划、验收与测试门禁、以及后续增强方向**全部串起来。你可以直接复制到 Notion/Docs/仓库里当备份。

---

# 交互游戏/蓝图式可视化编排 Studio 项目备份文档（全量）

> 版本：当前对话总结备份
> 目的：把项目缘起、决策过程、目标与规划、验收方法、下一步要做什么完整记录，便于在其他地方继续推进。

---

## 0. 项目缘起：我们在解决什么问题

### 0.1 初始问题（用户提出）

你想做一个“交互游戏自动生成”的系统，整体结构是三层：

1. **Layout 层**：AI 生成 JSON → Render Engine 解析 JSON → UI（React 组件）
2. **逻辑层**：组件化 + 底层框架 + 护栏 + 意图与实现分离（主要关注）
3. **配置层**：交互游戏编辑器（正在建设）

核心疑问：

* 逻辑层是否能像写一个 threejs 库一样：AI 只负责“串联逻辑块”，逻辑块本身由你们提供？
* 这种“搭积木”的上限高吗？
* n8n 与 Unreal Blueprints 有啥参考价值？
* 希望 AI 帮你写一套前端 demo：给提示词与 plan，让 AI 直接写出可运行项目
* 希望以 **Blueprint 的语言设计**拉满表达力，同时用 **n8n 的工程设计**拉满可维护性
* 希望后续开发能做成可视化（编辑器/蓝图）

---

## 1. 总目标：Blueprint × n8n

我们最终把目标明确为：

### 1.1 Blueprints（表达力拉满）

* Exec/Data pins 清晰分离（控制流 vs 数据流）
* 强类型数据连线（string/number/boolean/json）
* 典型图能力：分支、多输出 exec pin（Then/Else）、异步等待（latent）
* 调试体验：当前节点高亮、断点、单步、Reset 能中断 latent

### 1.2 n8n（可维护性拉满）

* 节点定义来自 registry（插件化/元数据驱动）
* Inspector 配置 UI **必须由元数据自动生成**（禁止每节点手写表单）
* 实时校验（结构化错误：nodeId/pinId/message）
* 运行可观测：每节点 IO、trace、可复制 JSON
* 版本/迁移（type@version，至少 1 个 migrate 示例）

### 1.3 单一事实来源（Single Source of Truth）

* 图的真实语义必须来自 **IR（Graph Intermediate Representation）**
* Studio 编辑器只编辑 IR，不引入第二套解释器/语义
* Canvas（画布）只是 UI

---

## 2. 你们当前已有的基础：v1 runner（确认）

你明确说明你们已经有 v1 runner，因此我们把工作重心放在 “v2 Studio 可视化编辑器”。

v1 runner 具备：

* Graph IR（Exec/Data pins 分离）
* Node registry（type@version、pins、defaults、form meta、migrate 可选）
* Validator（schema/完整性/类型/连接规则，输出结构化错误）
* Runtime（确定性 run/step/reset、breakpoints、latent、trace）
* Renderer（ViewModel → React UI）

---

## 3. 技术路线决策：Rete.js + XState + ECS（最终选择）

你提出希望使用：

* **XState**
* 符合 **ECS（Entity-Component-System）**
* **Rete.js**

我们据此把 Studio 架构定为：

### 3.1 Rete.js：负责画布/节点/连线交互（可视化层）

* 节点展示、pins、连线拖拽、选择、移动等交互由 Rete 承担
* 但 Rete 不拥有真实语义：只是 UI 映射 IR

### 3.2 XState：负责工作流/模式（n8n 式编排的核心）

* 编辑模式 vs 运行模式 vs 调试暂停等状态机化
* validate debounce、apply JSON、run/step/reset、debug pause 等通过事件驱动与状态转换保证可预测性

### 3.3 ECS：负责组织复杂状态与派生视图（长期可维护）

* 把 selection、error overlays、runtime highlight、breakpoints、trace snapshots 等派生数据抽为组件/系统
* 系统根据 IR 与 validator/runtime 输出更新 UI 所需的 view-model

---

## 4. 我们制定的核心验收方式：证据链（不是截图）

你后来给了一个截图，说“已经写好了逻辑，但不确认是否真的完成”。

我们统一了一个原则：

> **截图不是完成证据，测试与验收报告才是证据。**

因此引入三重门禁：

1. **Jest**：函数级单测（你要求“每个函数都要做 Jest 进行验收”）
2. **Playwright**：E2E 自动化回归（因为有 MCP，但仍需要自动化回归门禁）
3. **Chrome MCP**：每里程碑的手工验收报告（人类体验与可视化兜底）

并新增一个阶段：

* **M0 完成度审计（Completion Audit）**：在任何新开发前，先跑测并对照验收点，证明“已完成/未完成”。

---

## 5. Blueprint 规则（硬约束，必须在 UI + validator 两边同时生效）

### 5.1 Exec pins

* Exec output pin：每个 output pin 最多 1 条连接（分支靠多个 output pins）
* Exec input pin：最多 1 条入边

### 5.2 Data pins

* Data input pin：最多 1 条入边
* Data output pin：允许 fan-out（一个输出连多个输入）

### 5.3 Cross rules

* Exec 只能连 Exec
* Data 只能连 Data

### 5.4 强类型（Data）

* 类型集：string | number | boolean | json
* json 的兼容策略必须写死在 validator + UI（例如 json output 可连任意 input）
* 不允许隐式 cast（需要转换必须用显式节点）

---

## 6. Studio 基础 UI 形态（最小但完整）

* Canvas（Rete）
* Runner（Renderer + Run/Step/Reset + WaitForChoice）
* Inspector（registry meta 自动表单 + pins 状态 + errors + node IO）
* JSON tab（textarea + Apply + Reset）

Playwright 稳定性要求：

* 必须有 data-testid（studio-root/canvas-root/runner-root/inspector-root/json-tab/apply-json 等）
* 节点与 pin 也要有稳定 testid：node-<nodeId>、pin-<nodeId>-<pinId>、palette-[type@version](mailto:type@version)

---

## 7. 里程碑规划（核心闭环 M1–M9）

最初我们规划 M1–M9：

* M1：Shell + store + validate pipeline + JSON Apply 防护
* M2：只读画布（节点/pins/位置）
* M3：Inspector（metadata 表单）+ Palette
* M4：Add/Delete 节点
* M5：连线编辑（规则+类型）
* M6：错误覆盖（node/pin/inspector）
* M7：runtime 联动（高亮+断点+step+choice）
* M8：IO inspector + trace + copy JSON
* M9：JSON 双向同步 + Apply 防护完善

后来因为你已经实现了一版但不确定完成，我们新增了：

* **M0：完成度审计（必须先做）**
  逐条映射 M1–M9 的验收点，提供 Jest/Playwright/MCP 的证据输出，判断是否真的完成；必要时更新 AGENT.md。

---

## 8. 新增需求：双屏（/canvas 独立路由 + Detach 新窗口）

你提出：中间连线区域希望单独路由或窗口打开，便于双屏查看蓝图或逻辑。

我们把它明确为两件事（都做）：

### 8.1 /canvas 路由（必须）

* 全屏画布视图（最小 toolbar）
* 使用同一份 IR（单一事实来源）

### 8.2 Detach 新窗口（必须）

* Studio 提供 “Open Canvas Window” 按钮：window.open('/canvas')
* 必须支持跨窗口同步：

  * 打开时 snapshot 同步（detach 请求 graph；主窗口回复）
  * 后续 command 广播（ADD_NODE/MOVE_NODE/CONNECT/SET_PROP…）
* 推荐 BroadcastChannel + sourceId + seq 去重，避免消息回环

Playwright 至少覆盖：

* /canvas 可打开并渲染
* Detach 新窗口可打开并渲染快照
  （加分：主窗口移动节点后，新窗口同步更新）

---

## 9. 测试与验收门禁（最终定稿）

### 9.1 Jest（函数级）

你要求“每个函数都要做 Jest”，我们把它落为：

* 每个新增/修改的 exported function 都必须有单测
* 复杂内部 helper：通过外部 API 测 或 导出内部模块测试
* 覆盖率阈值建议（写入 coverageThreshold）：

  * engine/validator/runtime ≥ 90%
  * studio core（xstate machine/command bus/ecs systems/rete adapters）≥ 85%
  * 全局 ≥ 80%

### 9.2 Playwright（E2E）

* 从 M1 起就有 smoke test
* 每里程碑扩展脚本
* 到 M9 必须通过完整脚本（见下）

### 9.3 Chrome MCP（手工）

* 每里程碑必须提供 MCP report（步骤+观察 Pass/Fail）
* MCP 是体验兜底，Playwright 是自动回归门禁

---

## 10. 最终 E2E 脚本（M9 必须全通过）

1. 打开 Studio
2. Palette 添加节点（ShowText/WaitForChoice/End）
3. 连 exec：Start → ShowText → WaitForChoice → End
4. 连 data：ConstString → ShowText.text
5. 尝试错误连接：ConstNumber → ShowText.text（阻止或报错，定位 nodeId/pinId）
6. 修复后错误消失
7. Inspector 改 props（metadata 表单）生效
8. Run：节点高亮，Runner 显示内容
9. Choice 推进，高亮更新
10. 断点命中暂停；Step 推进
11. Node IO 可见 inputs/outputs/duration
12. Copy trace JSON 合法且包含 nodeId/type/duration
13. JSON 改文案 Apply 后画布+结果同步
14. Reset 后 latent 不幽灵推进
15. 打开 /canvas 路由可用
16. Detach 新窗口可打开并显示快照（加分：同步 move）

---

## 11. “无限逼近真实用户场景”讨论与调整（重新规划）

我们讨论了如何无限逼近真实用户使用场景与易用性/可靠性，并提出一批能力（自动布局、lint、协作、发布、多环境等）。

你随后明确：

* **7（协作/CRDT）先不用做**
* **9（权限/多环境/发布流）先不用做**
* 当前 graph 也没有“输入/输出外化”
* 希望添加 n8n 一样的 JS 脚本能力

因此我们重新规划后续能力为 **M13–M18**，重点落在：

* Graph I/O 外化（工作流契约）
* Presets（运行预设）
* Script Node（n8n 式脚本）
* 自动布局/理线
* Lint + 一键修复
* 命令面板/搜索

---

## 12. 后续增强里程碑（M13–M18）

### M13 — Graph Contract I/O（输入/输出外化）

* IR 新增 graph.contract：

  * inputs: name/type/required/default/desc
  * outputs: name/type/desc
* 新增节点：

  * GraphInput（Data 输出 pin，按 name 引用 contract input）
  * GraphOutput（Exec + Data 输入 pin，把值写入 contract output）
* runtime：run(graph, { inputs }) 返回 outputs
* Studio：Graph Settings 面板编辑 contract
* 校验：未知 input/output 名称、类型不匹配、未写全 outputs 等

### M14 — Presets（运行预设）

* IR：graph.presets[]，预设一组 inputs
* Runner：选择 preset 运行
* E2E：切换 preset 输出变化

### M15 — Script Node（n8n-like JS 脚本，受限沙箱 MVP）

* Script 节点 props：code、timeoutMs…
* pins：Exec in/out + onError；Data in/out
* 行为：注入 inputs/context/graph inputs，return outputs
* 必须：timeout 生效；错误走 onError；trace/IO 可见
* MVP UI：textarea 编辑器；可加 dry-run script 按钮
* 安全：受限沙箱（MVP 可用 Web Worker + API 白名单）

### M16 — 自动布局 + 理线（ELK + reroute）

* Auto Layout（Exec-only / All）
* zoom-to-fit/minimap 增强
* reroute points 支持

### M17 — Lint + Fix actions

* Lint：可维护性建议（区别于 validator 的正确性）
* Fix：断开不兼容边、补默认值、建议/插入转换节点（可选）、补齐 GraphOutput 等

### M18 — 命令面板 + 搜索（Ctrl+K）

* Add node by typing
* Find node / jump to node
* Jump to error
* Toggle breakpoint
* Trigger auto layout

每个里程碑仍需：Jest + Playwright + MCP。

---

## 13. 最新 AGENT.md 与驱动 Prompt（我们产出的最终版本）

我们最终形成并多次更新了 AGENT.md，核心要点：

* Rete.js + XState + ECS 架构
* M0–M9 验收与证据链（Jest/Playwright/MCP）
* /canvas + Detach 双屏能力与同步要求
* M13–M18 作为下一阶段增强（不做协作/权限多环境）

同时提供了一个总 Prompt：

* 阶段 A：M0 审计（证明是否完成）
* 阶段 B：/canvas + Detach + 同步 + 测试
* 阶段 C：M13–M18（contract/script/layout/lint/command palette）

---

## 14. 当前建议的执行顺序（最短路径）

1. **先做 M0 完成度审计**

   * 用 Jest/Playwright/MCP 的证据判断“是否真的完成 M1–M9”
2. **做 /canvas + Detach**

   * 双屏效率提升大，也能暴露状态同步与命令系统的真实问题
3. **进入 M13–M18**

   * 优先 M13（contract）与 M15（script），再做 M16（layout）与 M17（lint/fix），最后 M18（command palette）

---

## 15. 关键决策摘要（便于回忆）

* 目标 = Blueprint（表达力）× n8n（工程化）
* 已有 v1 runner → 重点做 Studio
* Studio 架构 = Rete（UI）+ XState（工作流）+ ECS（派生状态）
* 验收必须证据化：Jest（每函数）+ Playwright（E2E）+ MCP（手工）
* 新增双屏能力：/canvas + Detach（BroadcastChannel 同步）
* 后续增强去掉协作与多环境，加入：

  * Graph Contract I/O
  * Presets
  * Script Node（受限沙箱）
  * Auto Layout + reroute
  * Lint + Fix
  * Ctrl+K 命令面板与搜索

---

## 16. 备份用的“总驱动 Prompt”（可直接复制给 AI）

### A) M0→双屏→M13+ 统一 Prompt

```text
遵守仓库根目录 AGENT.md。

阶段 A：M0 完成度审计
- 对照 M1–M9 验收逐条输出 ✅/❓/❌
- 跑 Jest + coverage、跑 Playwright、给 MCP report 作为证据
- 结论：是否真正完成；缺口修复顺序；如需更新 AGENT.md 则更新

阶段 B：/canvas + Detach 双屏能力
- 实现 /canvas 全屏画布路由
- Studio 增加 Detach window.open('/canvas')
- BroadcastChannel：snapshot sync + command broadcast sync（sourceId/seq 去重）
- 更新 Playwright 覆盖 /canvas 与 detach，更新 Jest 覆盖新增函数

阶段 C：推进 M13–M18
- M13 Graph Contract I/O（GraphInput/GraphOutput + runtime outputs）
- M14 Presets
- M15 Script Node（受限沙箱、timeout、onError、trace/IO、dry-run）
- M16 Auto Layout + reroute
- M17 Lint + Fix actions
- M18 Ctrl+K command palette + search + jump-to-error

每个阶段/里程碑交付必须：
Plan → 全量文件内容 → Jest/coverage 摘要 → Playwright 摘要 → MCP report
不要中途询问确认。
```

---

> 这份文档就是“项目备份”。你只要把它保存下来，就能在任何地方复原我们讨论过的前因后果、关键决策与下一步计划。
