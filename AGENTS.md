# AGENT.md — Graph Studio (Rete.js + XState + ECS)
Blueprint-first × n8n-grade
+ Jest unit tests (function-level) + Playwright E2E + Chrome MCP manual gate
+ Canvas Route/Detach for dual-screen workflow
+ Next phase: Graph Contract I/O + Presets + Script Node + Layout + Lint/Fix + Command Palette

## 0) Context & What "Done" Means
We already have a working v1 runner:
- Graph IR: Exec/Data pins separated (Blueprint-like)
- Registry: type@version, pins, defaults, form metadata, optional migrate
- Validator: structured errors (nodeId/pinId/message)
- Runtime: deterministic run/step/reset, breakpoints, latent, trace
- Renderer: ViewModel -> React UI

This Studio work is "DONE" only if we have evidence:
- M0 audit completed with proof (tests + reports)
- Each milestone passes:
  - Jest (function-level) + coverage gates
  - Playwright E2E relevant flows
  - Chrome MCP manual report (human-in-the-loop)

A screenshot is NOT evidence. Tests + reports are evidence.

Execution mode (must follow):
- Continuous execution: do NOT stop after each milestone/phase to ask for confirmation.
- Only stop when all requested tasks are complete or when blocked by an external dependency.
- Intermediate progress may be logged, but do not pause the workflow.

---

## 1) Non-negotiables (Do not violate)
### N1. Single Source of Truth = IR
- Studio edits the SAME IR consumed by runtime.
- Rete is UI only; no second interpreter / “visual semantics”.

### N2. Blueprint semantics
- Exec pins and Data pins are distinct in IR and UI.
- Connection rules enforced in BOTH validator and UI.
- Data pins strongly typed.

### N3. n8n-grade maintainability
- Node config UI MUST be generated from registry metadata (NO per-node hand-coded forms).
- Errors are first-class and visible in 3 places: node/pin/inspector.
- Node run is inspectable: inputs/outputs/duration/error.
- Trace is copyable as valid JSON.

### N4. XState governs workflows
- Editor modes/flows are modeled in XState (avoid scattered booleans).
- Validate debounce, apply JSON, run/step, debug pause/resume are state-driven.

### N5. ECS governs derived model
- Use ECS for derived overlays/state: selection, validation overlays, runtime highlight, breakpoints, trace snapshots.
- Systems compute derived artifacts from IR + validator + runtime outputs.

### N6. Robustness
- Reset cancels latent tasks (no ghost timers).
- JSON Apply is safe: invalid draft NEVER overwrites last-known-good graph.

---

## 2) Required Tech Stack
- Rete.js + rete-react-plugin (canvas/editor)
- XState (+ @xstate/react if needed)
- ECS: bitecs recommended
Testing gates:
- Jest (+ @swc/jest or ts-jest) + @testing-library/react when needed
- Playwright (@playwright/test)
Manual gate:
- Chrome MCP

Avoid:
- Redux/MobX, Monaco (textarea ok for JSON & script MVP)

---

## 3) IR Requirements & Layout (must exist)
IR must support layout to be editable:
- nodes[nodeId].pos: { x: number, y: number }
Viewport may live in Studio state (optional):
- viewport: { x: number, y: number, zoom: number }

All Studio edits MUST be represented as Commands (for undo/log/sync):
- ADD_NODE, DELETE_NODE
- MOVE_NODE
- CONNECT, DISCONNECT
- SET_PROP
- APPLY_JSON
(Commands are the canonical “change protocol” for cross-window sync and later features.)

---

## 4) Pins & Connection Rules (Blueprint-style)
### Data types
string | number | boolean | json

### Exec rules
- Exec output pin: max 1 connection per output pin
- Exec input pin: max 1 incoming connection

### Data rules
- Data input pin: max 1 incoming connection
- Data output pin: fan-out allowed

### Cross rules
- Exec <-> Exec only
- Data <-> Data only

### Type policy (must be explicit & implemented)
- same-type connects
- json policy explicit (recommended: json-output may connect to any input; non-json output to json-input optional)
- no implicit casts (use explicit conversion nodes)

---

## 5) Validation & Error UX
Validator returns structured errors:
{ nodeId: string, pinId?: string, message: string, severity?: 'error'|'warning' }

Every error must be visible in:
1) Canvas node decoration
2) Canvas pin decoration (when pinId)
3) Inspector error list (click focuses node/pin)

Validation pipeline:
- Runs on every IR change (debounced 200–400ms)
- UI shows status: idle/validating/valid/invalid

---

## 6) Runtime ↔ Studio integration
Studio supports:
- Run / Step / Reset
- Current executing node highlight on canvas
- Breakpoints toggle on nodes
- WaitForChoice interaction in Runner
- Node Run Inspector: last inputs/outputs/duration/error
- Copy Trace JSON

---

## 7) Testability Requirements (data-testid for stable E2E)
Must exist:
- data-testid="studio-root"
- data-testid="canvas-root"
- data-testid="runner-root"
- data-testid="inspector-root"
- data-testid="json-tab"
- data-testid="apply-json"
- Nodes: data-testid="node-<nodeId>"
- Pins: data-testid="pin-<nodeId>-<pinId>"
- Palette items: data-testid="palette-<type@version>"

Canvas separate view:
- data-testid="canvas-only-root"
- data-testid="open-canvas-window" (detach button)

If Rete DOM is opaque, wrap key interactive elements in React components to add testids.

---

## 8) Testing Policy (Hard Gate)
### 8.1 Jest — “Every function must be tested”
- Every NEW/CHANGED exported function MUST have unit tests.
- For complex internal helpers: test via exported API OR export an internal module function and test it.
- Use fake timers for debounce/latent behaviors.
- Prefer deterministic tests; avoid brittle DOM snapshots.

Coverage gates (minimum thresholds):
- engine + validator + runtime: >= 90% lines/branches/functions
- studio core (xstate machine, command bus, ecs systems, rete adapters): >= 85%
- global minimum: >= 80%
Enforce via Jest coverageThreshold.

### 8.2 Playwright E2E — Regression Gate
- Start from M1: at least a smoke test.
- Expand per milestone; by M9 full E2E script must pass.
- Use data-testid selectors only.

### 8.3 Chrome MCP — Manual Gate
- Required per milestone (human-in-the-loop UX + visual validation)
- Report format: steps + observations (Pass/Fail)

Recommended scripts (must exist in package.json):
- npm run test:unit
- npm run test:e2e
- npm run test:all
- npm run verify (test:all + build)

---

## 9) Dual-screen Canvas Requirement (Route + Detach)
### 9.1 /canvas route (required)
- Route `/canvas` displays the canvas full-screen with minimal toolbar.
- Must operate on the same IR as Studio (single source of truth).

### 9.2 Detach new window (required)
- “Open Canvas Window” button opens `/canvas` with window.open.
- Cross-window sync MUST exist:
  - Snapshot sync on open (detached asks for graph snapshot; main responds)
  - Command broadcast sync ongoing (ADD_NODE/MOVE_NODE/CONNECT/SET_PROP…)
- Recommended: BroadcastChannel + sourceId + seq (dedupe to prevent loops)

Playwright must cover:
- /canvas route loads and renders
- Detach window opens and renders snapshot
Stretch: a move in main updates detached (command sync)

---

## 10) Milestones — Core Studio (M0, M1–M9)
Every milestone deliverable must include:
- Plan + code (full file contents) + Jest summary/coverage + Playwright summary + MCP report

### M0 — Completion Audit (must run BEFORE new development)
Deliver:
- A Compliance Report mapping current repo to M1–M9 acceptance criteria:
  - ✅ satisfied / ❓ uncertain / ❌ missing
- Evidence:
  - Jest run + coverage summary
  - Playwright run summary
  - MCP manual report (short)
- Decide if AGENT.md needs updates based on reality; update it if necessary.

### M1 — Studio shell + XState + ECS + safe JSON apply + validation debounce + test scaffolding
### M2 — Rete render from IR + selection + node move (pos persisted)
### M3 — Inspector (registry metadata-driven form) + pins status
### M4 — Palette add/delete nodes (defaults + cleanup edges)
### M5 — Edge editing with rule/type enforcement
### M6 — Live error overlays (node/pin) + focus navigation
### M7 — Runtime linking (run/step/reset, highlight, breakpoints, choice)
### M8 — Node IO inspector + trace panel + copy JSON
### M9 — JSON bidirectional sync + apply protection (final core loop)

---

## 11) Mandatory Final E2E Script (by M9)
1) Open Studio
2) Add nodes (ShowText, WaitForChoice, End)
3) Connect exec Start -> ShowText -> WaitForChoice -> End
4) Connect data ConstString -> ShowText.text
5) Attempt invalid data connection ConstNumber -> ShowText.text (blocked or error with nodeId/pinId)
6) Fix connection and confirm error disappears
7) Edit props via metadata form and confirm it affects output
8) Run and confirm current node highlight + Runner shows text
9) Next/Choose advances flow and highlight updates
10) Toggle breakpoint and confirm run pauses; Step continues
11) Node I/O inspector shows inputs/outputs/duration
12) Copy trace JSON is valid JSON
13) Edit JSON -> Apply -> canvas + output updated
14) Reset cancels latent (no ghost progress)
15) Open /canvas and confirm canvas renders
16) Open detached window and confirm snapshot renders

---

## 12) Next Phase — Real-world usability (M13–M18)
(We are explicitly NOT doing collaboration/CRDT and multi-env permissions in this phase.)

### M13 — Graph Contract I/O (externalized inputs/outputs)
- IR: graph.contract.inputs/outputs (typed)
- Nodes: GraphInput (data output), GraphOutput (exec + data input)
- Runtime: run(graph, { inputs }) returns outputs
- Studio: Graph Settings panel (contract editor)
- Validation: unknown names, type mismatches, missing outputs

### M14 — Presets (run configurations)
- IR: graph.presets[]
- Runner: choose preset, run
- E2E: switching presets changes outputs

### M15 — Script Node (n8n-like JS scripting, safe MVP)
- Script node with code + timeout
- Reads inputs/context/graph inputs, returns outputs
- onError path + trace/IO visible
- MVP: textarea editor; optional dry-run for script node
- Safety: sandbox (MVP can be Worker-based; enforce timeout; strict API whitelist)

### M16 — Auto Layout + routing polish
- Auto layout (ELK optional), exec-only vs all
- zoom-to-fit/minimap improvements
- reroute points support

### M17 — Lint + Fix actions
- Lint (maintainability suggestions) distinct from validator
- Fix actions for common issues (disconnect invalid, fill defaults, suggest insert conversion, etc.)

### M18 — Command palette + search (Ctrl+K)
- Add node by typing, find node, jump to error, toggle breakpoint, trigger auto layout

Each milestone keeps gates:
- Jest (function-level) + coverage gates
- Playwright E2E additions
- MCP report

---

## 13) Output Format (for AI changes)
For each milestone:
1) Plan (goals, files, acceptance + test plan)
2) Full file contents for all changed/new files (no ellipses)
3) Jest summary + coverage summary
4) Playwright summary
5) Chrome MCP report
No mid-way confirmation questions.
