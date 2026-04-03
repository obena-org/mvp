---
title: "Project Name"
date: YYYY-MM-DD
owner: Name(s)
related-ADRs: []
related-docs: []
tags: []
---

## <!--

PROJECT TEMPLATE v2.1.1 (SEMI-DEPRECATED)

🚫 **Do not edit this template directly in project repositories.** This template is maintained
in `docs-central` @ <https://github.com/obena-org/docs-central> and synchronized to project repos.

⚠️ SEMI-DEPRECATED: This project template is being semi-deprecated; it remains available
for complex multi-phase projects requiring upfront planning, but most work is served by the
agentic workflow described in YYYY-MM-DD-template-history.md.

LLM GUIDANCE:

- This template is for LLM consumption — emit clean project docs by stripping ALL comments.
- "Canonical" means: describes the current intended state, not the historical path taken.
- Git history is the authoritative execution record; do not duplicate it here.
- Phases describe INTENT and EXIT CRITERIA only, not step-by-step progress.
- Architecture describes the end-state design, updated as it evolves (not versioned history).
- Commit/PR references: do not include in phases. References section may link 1-3 "anchor PRs"
  only if they represent major architectural shifts. Otherwise, trust git.
- When to split docs: Use ADRs for irreversible decisions; separate docs for deep investigation.
  Default to single doc unless complexity clearly justifies decomposition (e.g., irreversible
  design choice or multi-week investigation).
- Optional sections: "Risks/Constraints/Open Questions" and "Status Updates" may be omitted or
  folded into other sections. They exist as escape hatches, not default structure.

---

-->

## 🧭 Context & Motivation

<!--
1-2 short paragraphs (under ~150 words):
- What concrete problem or opportunity are we addressing?
- Why does this matter now?
- What does "better" look like at a high level?

Keep this concise. If it grows large, move deep analysis to an ADR or separate doc.
-->

## 🎯 Goals & Success Criteria

<!--
List outcomes, not tasks. These should remain stable throughout the project.
If goals change materially, note it in the optional "Status Updates" section.
-->

- [ ] Outcome 1
- [ ] Outcome 2
- [ ] Outcome 3

**Out of Scope:**

- X
- Y

## 🧩 Proposed Solution

<!--
Describe the chosen approach at a high level:
- What strategy are we taking?
- Why is this approach reasonable?
- What obvious alternatives were not chosen (briefly)?

No step-by-step plans. No implementation details. No commit history.
-->

## 🏗️ Architecture (Current Canonical State)

<!--
Describes how the system will work when this project is "done."

Include:
- Key components and their responsibilities
- Dependency direction
- Public interfaces / contracts (if applicable)

This is a living specification — update it as the architecture evolves.
Do NOT append historical versions or narrative here.
-->

## 🛠️ Phases (Conceptual)

<!--
Phases describe INTENT and EXIT CRITERIA only.
- Do NOT log execution steps, commits, or day-by-day progress.
- If you feel the urge to add sub-phases (2.1a, 2.1b), you're leaking execution detail.
  Use git for that.
-->

### Phase 1: <Name> ⏲️ PENDING | 🚧 IN PROGRESS | ✅ COMPLETE

**Intent:** What this phase unlocks

**Exit Criteria:** What must be true to move on

- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3
- ...

### Phase 2: <Name> ⏲️ PENDING | 🚧 IN PROGRESS | ✅ COMPLETE

**Intent:** What this phase unlocks

**Exit Criteria:**

- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3
- ...

...

## ✅ Results & Outcome

<!-- 🚫 DO NOT FILL UNTIL PROJECT COMPLETE -->

<!--
Once the project is complete, capture:
- What actually changed
- Which goals were met or not met
- Notable surprises or scope changes
- Measurable improvements (if applicable)

Keep this factual and outcome-focused.
Reflection and generalized lessons belong in a separate post-mortem.
-->

## ⏭️ Follow-Ups & Next Steps

<!--
Optional. List natural sequels, deferred ideas, or cleanups intentionally not done.
-->

## 🔗 References

<!--
Links only — no summaries.
Examples: ADRs, related project docs, 1-3 anchor PRs (only if they represent major shifts).
-->

<!--
The following sections can be added if needed, but are not required by default.
They serve as escape hatches rather than standard structure.
-->

## ❗ Risks, Constraints, & Open Questions

<!--
Use this section (or fold into other sections) to capture:
- Known risks
- Hard constraints (time, infra, people)
- Questions expected to be resolved during execution

This section may shrink over time.
-->

## 🔔 Status Updates (High-Signal Only)

<!--
Use ONLY when something materially changes:
- Goals shift
- Architecture pivots
- A major risk is discovered or resolved

This is NOT a diary or progress log.

Example:
- 2025-02-14 — Discovered deeper config coupling; federation added as prerequisite.
-->
