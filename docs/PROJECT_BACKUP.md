下面是我“深度回看”这次聊天后，认为**可能还漏掉/没写透**的点（以及为什么重要），然后给你一份**更细、更完整的备份文档 v2**（把每个细节都补齐到可以交给任何人接手继续干的程度）。

---

## 我们可能漏掉的点（深度回看结论）

### 1) **Undo/Redo（本地）**没有被明确落入里程碑

* 我们聊过命令/事件（Commands）作为变更协议，也聊过 Yjs（但你后来明确 7/协作先不做）。
* 但**真实用户场景下，没有 Undo/Redo 基本不可用**，即使不做协作，也要做“本地命令栈 Undo/Redo”。
* 结论：需要把 **Undo/Redo（不依赖 Yjs）**列为近期能力（建议插到 M9 前后，或作为 M19）。

### 2) **Copy/Paste、框选、多选、对齐/吸附**等“编辑器基本功”没有系统化规划

* 蓝图/流程编辑器的真实使用场景里，这些是刚需，不然用户会极慢且崩溃。
* 结论：要把这些列为“编辑器基础 UX 能力包”，并补充 E2E/手工验收。

### 3) **Rete 交互的测试可控性**没写透（如何让 Playwright 稳）

* 我们规定了 data-testid，但 Rete 的 DOM 结构可能变化、拖拽连线在 E2E 里也容易 flaky。
* 结论：需要一个“Rete Adapter 测试层/测试 API（仅测试环境启用）”，让 E2E 更稳定（比如通过命令面板或测试专用按钮触发连接，而不是纯拖拽）。

### 4) **Script 节点的安全/资源预算/确定性**需要更硬的规范

* 我们提了 Worker 沙箱、timeout、白名单，但真实场景还需要：

  * step/time/memory budget
  * 禁止/控制随机数、Date、console 污染
  * 输出必须可序列化（避免返回 function/class）
  * 错误栈/日志收敛与脱敏
* 结论：Script 节点需要单独的“安全与确定性规范 + 测试清单”。

### 5) **Graph Contract（输入/输出外化）**还缺“命名空间/类型校验/默认值/示例输入”的细节

* 真正可用的 contract 不只是 inputs/outputs，还要：

  * required/default/desc
  * 示例 inputs（用于模板/演示）
  * 输出 completeness（未写全输出是否报错/警告）
* 结论：Contract 设计要更产品化，同时要影响 validator、Inspector、Runner UI、Trace。

### 6) **可观测性**除了 trace/IO 之外，还缺 “重放 replay 所需信息”

* 你暂时不做多环境/发布，但真实问题定位仍需要：

  * 运行输入（contract inputs/preset）
  * 用户事件序列（choice 的选择）
  * 版本信息（graph schema version、node type versions）
  * 随机种子（如果有随机）
* 结论：至少把 “Trace 可重放最小信息”写进规范（即便暂时不做完整 replay）。

### 7) **可访问性与键盘效率**（不是锦上添花，是蓝图类工具的基础易用性）

* 你计划做 Ctrl+K 命令面板（很好），但还缺：

  * 键盘移动节点/聚焦 pins
  * 错误导航快捷键
  * A11y（tab 顺序、aria）
* 结论：作为后续 UX 能力包列入规划（不影响你“不做协作/权限”的约束）。

---

# 备份文档 v2（更细、更全，事无巨细）

> 你可以直接保存为 `PROJECT_BACKUP.md`。

---

## 0. 背景与起点（前因后果）

### 0.1 初始愿景

构建“交互游戏自动生成”体系，分三层：

1. **Layout 层**
   AI 生成 JSON（布局/页面/组件结构） → Render Engine 解析 JSON → UI（React 组件）

2. **逻辑层（核心）**
   组件化 + 底层框架 + 护栏 + 意图与实现分离
   目标是“像搭积木”：逻辑块是稳定库，AI 负责组装串联

3. **配置层**
   交互游戏编辑器（可视化配置与编辑）

### 0.2 参考系与目标

* **Unreal Blueprints**：表达力/控制流语义/调试体验/可视化编程语言设计
* **n8n**：节点插件化/工程可维护/运行可观测/错误可解释/配置易扩展

最终目标明确为：

> **Blueprint 的语言设计把表达力拉满 + n8n 的工程设计把可维护性拉满**

---

## 1. 现状：你们已有 v1 runner（重要前提）

你确认：第一版 runner 已实现，所以本轮重点是 **后续可视化 Studio**。

v1 runner 具备：

* Graph IR：Exec/Data pins 分离
* Registry：`type@version`、pins 定义、defaults、form meta、（可选 migrate）
* Validator：结构化错误 `nodeId/pinId/message`
* Runtime：deterministic run/step/reset，breakpoints，latent，trace
* Renderer：ViewModel → React UI

---

## 2. Studio 技术栈最终决策

你要求并确定使用：

* **Rete.js**：画布/节点/连线交互层
* **XState**：编辑器工作流/模式/状态编排
* **ECS（建议 bitecs）**：复杂状态与派生视图的可维护组织方式

测试与验收门禁确定为：

* **Jest：函数级单测（每个函数都要测试）**
* **Playwright：E2E 自动回归门禁**
* **Chrome MCP：手工验收报告（体验兜底）**

---

## 3. 不可违背原则（Non-negotiables）

### 3.1 单一事实来源

* IR 是真实语义来源
* Studio 只编辑 IR，不引入第二套解释器/语义
* Rete 只是 IR 的 UI 映射

### 3.2 Blueprint 语义硬约束

Exec 与 Data pins 分离，且连接规则必须在 **UI + validator** 同时生效：

**Exec pins**

* output pin：每个 output pin 最多 1 条连接
* input pin：最多 1 条入边

**Data pins**

* input pin：最多 1 条入边
* output pin：允许 fan-out

**Cross**

* Exec 只能连 Exec
* Data 只能连 Data

**Data types**

* `string | number | boolean | json`
* json 兼容策略必须明确并一致（写进 validator + UI）
* 禁止隐式 cast（要转换必须用显式节点）

### 3.3 n8n 工程化硬约束

* Inspector 表单必须由 registry metadata 自动生成（禁止为每个节点手写表单）
* 错误是“一等公民”：node/pin/inspector 三处一致展示
* 运行可观测：节点 IO、trace、可复制 JSON

### 3.4 鲁棒性

* Reset 必须取消 latent（无幽灵定时器）
* JSON Apply 必须安全：invalid 不覆盖 last-known-good graph

---

## 4. Studio 的系统分层（推荐模块边界）

### 4.1 领域层（Domain）

* IR 类型与 schema
* Command 定义（变更协议）
* Validator（已存在）
* Registry（已存在）
* Runtime（已存在）

### 4.2 Studio Core（编辑器内核）

* **XState machine**：工作流状态（editing/validating/applyingJson/running/debugPaused…）
* **Command Bus**：所有编辑操作统一以命令形式提交
* **ECS World**：把派生状态（selection、overlays、runtime highlight、breakpoints、trace snapshots）组件化

### 4.3 Adapter 层（Rete Adapter）

* IR → Rete nodes/edges 的映射
* Rete 交互事件（move/select/connect）→ Commands
* 错误/高亮 overlays → Rete decorations

### 4.4 UI 层

* Studio Page Layout：Canvas / Runner / Inspector / JSON Tab
* Inspector：registry meta 自动表单 + errors + pins 状态 + node IO
* Runner：run/step/reset + WaitForChoice + trace 入口
* JSON：draft/apply/reset-to-graph

---

## 5. 证据链验收（为什么要新增 M0 审计）

你提供截图但不确定完成。我们明确：

* **截图不是证据**
* 完成必须由：Jest + Playwright + MCP 报告支撑

因此新增 **M0：Completion Audit**：

* 对照 M1–M9 验收逐条标记 ✅/❓/❌
* 必须附：Jest coverage summary、Playwright summary、MCP report
* 决定是否需要更新 AGENT.md（如果实现与规范不一致，必须更新）

---

## 6. 核心里程碑（M0–M9）

> 每个里程碑必须输出：Plan → 全量文件 → Jest+coverage → Playwright → MCP 报告。

* **M0**：完成度审计（必须先做）
* **M1**：Studio shell + XState + ECS + safe JSON apply + validation debounce + 测试脚手架
* **M2**：Rete 渲染 IR（只读起步）+ selection + move（pos 回写）
* **M3**：Inspector（registry meta 自动表单）+ pins 状态
* **M4**：Palette add/delete
* **M5**：连线编辑（规则+类型）
* **M6**：错误覆盖（node/pin/inspector）+ 点击定位
* **M7**：runtime 联动（run/step/reset，高亮，断点，choice）
* **M8**：Node IO inspector + trace panel + copy JSON
* **M9**：JSON 双向同步 + apply 防护完善

**最终 E2E 脚本（M9 必须全通过）**

1. 打开 Studio
2. 添加节点（ShowText/WaitForChoice/End）
3. 连 exec：Start→ShowText→WaitForChoice→End
4. 连 data：ConstString→ShowText.text
5. 错误连接：ConstNumber→ShowText.text（阻止或错误可定位）
6. 修复后错误消失
7. Inspector 改 props 生效
8. Run：高亮+输出
9. Choice 推进
10. breakpoint 暂停 + Step 推进
11. Node IO 可见
12. Copy trace JSON 合法
13. JSON apply 生效
14. Reset 无幽灵推进

---

## 7. 双屏能力（新增强需求）

你提出“中间连线区域”希望独立路由/窗口打开，方便双屏。

### 7.1 /canvas 独立路由（必须）

* 全屏画布 + 最小 toolbar
* 共享同一份 IR（单一事实来源）

### 7.2 Detach 新窗口（必须）

* Studio 按钮 `window.open('/canvas')`
* 跨窗口同步要求：

  * open 时 snapshot 同步（detach 请求 graph，main 回复）
  * ongoing command broadcast（MOVE_NODE/CONNECT/SET_PROP…）
* 推荐 BroadcastChannel + sourceId + seq 去重（避免回环）
* E2E 覆盖：

  * /canvas 可打开
  * detach window 可打开并显示快照
  * 加分：移动节点同步到新窗口

---

## 8. 测试门禁（补齐细节）

### 8.1 Jest（函数级）

**规则**

* 每个新增/修改的 exported function 必须有单测
* internal helper：

  * 要么通过外部 API 测
  * 要么导出 internal module 并直测

**覆盖率阈值（建议写入 coverageThreshold）**

* engine/validator/runtime：≥ 90%
* studio core（xstate/command bus/ecs/rete adapters）：≥ 85%
* global：≥ 80%

**测试策略细节**

* debounce/latent 用 fake timers
* 纯函数直接断言
* side-effects 用 mock（BroadcastChannel、timers、window.open）

### 8.2 Playwright（E2E）

**稳定性原则**

* 全部用 data-testid
* 对 Rete 拖拽不稳定的场景：优先通过命令面板/测试 API 或“点击连接模式”提高稳定性

**建议增加（仅测试环境启用）**

* `window.__studioTestApi`：允许 programmatic 执行 add/connect/move（避免 flaky 拖拽）
* 或提供测试专用 UI（隐藏按钮/快捷键）执行连接动作

### 8.3 Chrome MCP（手工）

* 每里程碑提供 MCP report：步骤 + 观察 Pass/Fail
* MCP 用于检查体验、可视化正确性、交互细节（Playwright 捕捉不到的）

---

## 9. 后续增强（你明确：不做协作/不做权限多环境）

你明确：

* 7（协作/CRDT）先不用
* 9（权限/多环境/发布流）先不用
  同时提出：
* graph 还没有输入/输出外化
* 希望增加 n8n 风格 JS script 能力

因此新增增强里程碑：**M13–M18**。

---

## 10. 增强里程碑（M13–M18，补齐细节）

### M13 — Graph Contract I/O（输入/输出外化）

**IR**

* `graph.contract.inputs[]`：name/type/required/default/description
* `graph.contract.outputs[]`：name/type/description
* 建议加：`examples[]`（样例输入）、`schemaVersion`（契约版本）

**节点**

* GraphInput（Data output）：按 name 读取输入
* GraphOutput（Exec + Data input）：按 name 写输出（可要求 run 结束前写全 outputs）

**runtime**

* `run(graph, { inputs })` → `{ outputs, trace }`

**validator**

* GraphInput 引用不存在 → error
* GraphOutput 引用不存在 → error
* 类型不匹配 → error
* outputs 未写全 → warning/error（政策明确）

**Studio**

* Graph Settings 面板编辑 contract
* Runner 支持编辑输入值并运行

### M14 — Presets（运行预设）

* `graph.presets[] = { id, name, inputs }`
* Runner 选择 preset 一键运行
* 记录每次运行使用的 preset id 到 trace metadata

### M15 — Script Node（n8n 风格脚本，安全 MVP）

**目标**

* 用户写 JS，读 data inputs/context/graph inputs，返回 outputs
* 支持 timeout、onError、trace/IO

**安全与确定性（必须写进规范）**

* Worker 沙箱（MVP）
* API 白名单（Math、JSON、受控 helpers）
* 禁止访问 window/document，默认禁 fetch/websocket
* 输出必须可 JSON 序列化（否则报错）
* timeoutMs 强制执行
* 记录：执行耗时、错误栈（可裁剪）、console logs（可选）

**UX**

* textarea 编辑器（先不引 Monaco）
* dry-run（仅执行 script 节点，展示输出/错误）
* 提供模板（return { out: ... }）

### M16 — 自动布局与理线

* Auto Layout（exec-only / all）
* zoom-to-fit、minimap
* reroute points

### M17 — Lint + Fix actions

**Lint（可维护性）**

* exec 深度过深
* crossing edges 过多
* 孤儿节点
* GraphOutput 未覆盖 outputs
* 过多重复模式（建议宏/子图，未来）

**Fix actions**

* 断开不兼容连线
* 补默认值
* 自动插入转换节点（可选）
* 自动补 GraphOutput（针对 contract）

### M18 — Ctrl+K 命令面板 + 搜索

* Add node by typing
* Find node / jump
* Jump to error
* Toggle breakpoint
* Trigger auto layout

---

## 11. 仍需补上的“编辑器基本功包”（本次聊天未完全落地，但强烈建议加入）

> 这是我认为我们之前“漏掉或没明确落里程碑”的部分。

建议新增一个能力包（可作为 M19 或穿插到 M9/M16 前后）：

* 本地 Undo/Redo（基于 Commands 栈，不依赖 Yjs）
* 多选/框选
* Copy/Paste（含跨图粘贴的 id 重写策略）
* 对齐/吸附/网格
* 分组/折叠（最小版本：节点分组容器）
* 键盘操作（方向键微调、delete、duplicate、zoom 快捷键）

这套能力会极大提高真实用户效率与满意度。

---

## 12. 最新 AGENT.md 与驱动 Prompt（用于持续开发）

（你已要求并已生成最新版 AGENT.md 与总 Prompt，用于 M0 审计→双屏→M13+）

核心驱动方式：

* **Plan 模式**：先审计是否完成目标，必要时更新 AGENT.md，再继续开发
* 所有交付必须带：Jest/Playwright/MCP 三份报告

---

# 最后：我建议你立刻把“漏掉的能力”合并进 AGENT.md 的方式

你已经有一份最新 AGENT.md（我上一条消息给的）。如果要把本次“补漏”也纳入规范，我建议只追加两块：

1. 在 “Next Phase” 后新增 **M19：Editor Fundamentals（Undo/Redo + Copy/Paste + Multi-select）**
2. 在 Script Node 一节新增 “安全/确定性/序列化/预算”硬约束与测试清单

这样不会打乱现有节奏，但能保证你们无限逼近真实使用场景。

---

如果你愿意，我也可以把“AGENT.md 的补丁版（包含 M19 与 Script 安全细则）”直接写出来，做到你粘贴覆盖即可用。
