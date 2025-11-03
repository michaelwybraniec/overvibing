# Task ID: 1
# Title: Discovery & triage (analyze hover handlers, render loop, shader uniforms)
# Status: [x] In Progress
# Priority: high
# Owner: Dev Team
# Estimated Effort: 4h

## Description
Discovery & triage (analyze hover handlers, render loop, shader uniforms) - This phase focuses on achieving the project goals: Maintain current calendar hover animation behavior; investigate perceived reset after hover-out, Fix and cleanup hover/camera/shader/reset logic without visual regressions, Preserve performance and UX; keep config-driven behavior with hover-effects.json/presets.json. Technology stack: Three.js, GLSL shaders, JavaScript (ES modules), CSS, Webpack, JSON configs (hover-effects.json, presets.json).

## Dependencies
- None

## Testing Instructions
Verify that this phase meets the requirements and contributes to the success criteria: Hover-out decays to effect baseline; no perceived reset after waiting, No change to on-hover animation experience, No hidden idle/reset behaviors; deterministic behavior, Config-driven parameters; simplified code with comments where needed, No performance regressions; consistent across presets/effects

## Security Review
Apply appropriate security measures for this phase

## Risk Assessment
Delays in this phase may impact overall project timeline

## Strengths
Essential for achieving project goals and success criteria

## Notes
Phase 1 of 8: Discovery & triage (analyze hover handlers, render loop, shader uniforms)
Started: Set status to In Progress per AWP next (3.2)

## Findings
- Explicit reset on mouseleave sets `targetHoverIntensity` to 0 and restores "normalButtons" multipliers, producing the perceived return to default after a short easing period.
- Brightness easing (`currentBrightnessMultiplier` → `targetBrightnessMultiplier`) is directed back to 1.0 on leave, which visually reads as a reset after waiting.
- Spin direction is reset to the normal button value on leave, further reinforcing the baseline look.
- No idle timers or auto-preset reapplication detected; behavior is deterministic and driven by hover state transitions only.

## Cleanup Candidates (no behavior change yet)
- Parameterize the mouseleave baseline via config (effect normal baseline) instead of hard-coded `1.0` for brightness, without altering current visual output.
- Centralize hover-out reset logic to reduce duplication and magic values.
- Ensure spin direction resets consistently from config to avoid surprises.

## Sub-tasks
- [ ] Analyze requirements for this phase
- [ ] Implement core functionality
- [ ] Test and validate implementation
- [ ] Document phase completion

## Completed
[ ] Pending / [x] Completed