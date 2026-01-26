# AGENT.md — Graph Studio (Blueprint-first) Dev Guide

## 0. Goal
We already have v1 runner (IR + registry + validator + runtime + Renderer).
This phase builds a Visual Graph Studio (Blueprint-first semantics, n8n-grade maintainability).

Non-negotiable:
- Exec pins and Data pins are distinct concepts in IR and in UI.
- Strong typing on Data pins (type mismatch must be caught and surfaced with nodeId/pinId).
- Node UI config must be metadata-driven from registry (no hand-written per-node forms).
- Debuggability: current node highlight, breakpoints, run/step/reset.
- Observability: node I/O inspector, trace log, copy trace.
- Editor changes must preserve existing runtime/validator semantics.

## 1. Architecture Boundaries
### Engine (source of truth semantics)
- IR types: exec/data pins, edges, node instances.
- Registry: type@version, pin definitions, defaults, form meta, optional migrate.
- Validator: schema + graph integrity + type compatibility.
- Runtime: deterministic step engine; supports latent nodes; breakpoints; trace.

### Editor (visualization + authoring)
- Visual layer reads/writes the same IR as JSON.
- Editor never “reinterprets” semantics; it only edits IR and shows validator/runtime outputs.
- All node property forms MUST be generated from registry metadata.

## 2. Repo Structure (recommended)
src/
  engine/
    ir.ts
    registry/
    validator/
    runtime/
  studio/
    state/          (zustand store, selectors)
    canvas/         (React Flow nodes/edges adapters)
    inspector/      (metadata form renderer + IO inspector)
    palette/
    json/
  ui/
    renderer/       (ViewModel -> React)
  App.tsx

## 3. IR Editing Rules (Blueprint-like)
### Pins
- Exec pins:
  - Exec output pin: max 1 connection per output pin (branching uses multiple output pins like Then/Else).
  - Exec input pin: max 1 incoming connection.
- Data pins:
  - Data output pin: fan-out allowed (one output to many inputs).
  - Data input pin: max 1 incoming connection.

### Type compatibility (Data)
- Allowed types: string | number | boolean | json
- Default rule:
  - Same type connects.
  - json can connect to any input (or strictly only to json; decide and document in validator).
  - No implicit casts unless explicitly represented by nodes (e.g., ToString node).

## 4. Validation & Error UX
- Validation runs on every edit (debounced).
- Errors are structured: { nodeId, pinId?, message, severity }.
- Visual feedback:
  - Node card/box red outline for node errors.
  - Pin-level indicators for pin errors.
  - Tooltip/Inspector shows exact message and references.

## 5. Runtime ↔ Studio Linking
- Runtime provides:
  - currentNodeId
  - breakpoints set
  - trace (per node run: inputs/outputs/duration/error)
- Studio must:
  - highlight currentNodeId node on canvas
  - allow toggling breakpoint from node UI
  - show node run details in inspector when node selected

## 6. Milestone Workflow (PR-sized increments)
Each milestone must:
- keep `npm run dev` working
- keep existing runner behavior intact
- include a short manual test checklist
- include Chrome MCP verification (see section 8)

Recommended milestone order:
1) React Flow canvas showing nodes positions from IR (read-only)
2) Select node + Inspector (metadata form, no edits yet)
3) Add node from palette + persist to IR
4) Connect pins (exec/data) + validator integration
5) Live validation overlays (node/pin UI)
6) Runtime highlighting + breakpoints
7) IO inspector + trace copy
8) JSON tab 2-way sync (canvas <-> JSON)

## 7. Coding Standards
- TypeScript strict, avoid `any`.
- Pure functions in engine. UI side-effects isolated.
- No duplicated source of truth: IR lives in studio store and is validated against engine validator.
- Registry is the only place new node types are declared.
- Keep functions small; include comments for tricky graph ops.

## 8. Mandatory Chrome MCP Verification
Every delivery must end with Chrome MCP validation:
- Start dev server
- In browser:
  1) Add a node from palette
  2) Connect exec pins correctly, see no errors
  3) Attempt invalid data connection (type mismatch) → see error on node/pin + in inspector
  4) Fix connection → error disappears
  5) Run → see current node highlight
  6) Toggle breakpoint → Step halts at breakpoint
  7) Trigger WaitForChoice and choose option → flow continues
  8) Open IO inspector → verify inputs/outputs visible
  9) Copy trace JSON → confirm clipboard contains valid JSON

Output required:
- A short “MCP report” with steps executed + observed results.

## 9. Deliverable Format (when AI generates code)
- Output file-by-file with full contents (no ellipses).
- Include a brief Plan first, then code changes grouped by milestone/commit.
- Finish with the MCP report.
