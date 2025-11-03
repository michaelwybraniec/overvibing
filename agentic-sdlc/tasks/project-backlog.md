# Project Backlog

## Planned Tasks

- [ ] [Task 1: Discovery & triage (analyze hover handlers, render loop, shader uniforms)](tasks/planned/task-1.md)
- [x] [Task 2: Backlog creation (ASDLC)](tasks/planned/task-2.md)
- [ ] [Task 3: Config cleanup (remove magic values; align defaults with effect baselines)](tasks/planned/task-3.md)
- [ ] [Task 4: Refactor hover-out behavior to decay to baseline without snap/reset](tasks/planned/task-4.md)
- [ ] [Task 5: Stabilize spin direction handling on leave without visual change](tasks/planned/task-5.md)
- [ ] [Task 6: Testing/QA (visual regressions, FPS, cross-browser)](tasks/planned/task-6.md)
- [ ] [Task 7: Docs & AWP compliance & handoff](tasks/planned/task-7.md)
- [ ] [Task 8: Release](tasks/planned/task-8.md)

## Unplanned Tasks

*No unplanned tasks yet*

## Completed Tasks

*No completed tasks yet*

---

**Project Goals:** Maintain current calendar hover animation behavior; investigate perceived reset after hover-out, Fix and cleanup hover/camera/shader/reset logic without visual regressions, Preserve performance and UX; keep config-driven behavior with hover-effects.json/presets.json
**Technology Stack:** Three.js, GLSL shaders, JavaScript (ES modules), CSS, Webpack, JSON configs (hover-effects.json, presets.json)
**Success Criteria:** Hover-out decays to effect baseline; no perceived reset after waiting, No change to on-hover animation experience, No hidden idle/reset behaviors; deterministic behavior, Config-driven parameters; simplified code with comments where needed, No performance regressions; consistent across presets/effects