---
title: "<Short description of the change>"
date: YYYY-MM-DD
status: complete | superseded | abandoned
owner: <primary author>
related-issues: []
related-prs: []
related-docs:
  - docs/logging/contract.md
  - docs/logging/architecture.md
  - docs/logging/design-decisions.md
tags: [logging, refactor, breaking-change]
---

## <!--

HISTORY TEMPLATE v1.1.0

🚫 **Do not edit this template directly in project repositories.** This template is maintained
in `docs-central` @ <https://github.com/obena-org/docs-central> and synchronized to project repos.

⚠️ This document captures **historical context** for a completed change. It is not normative
specification. Current behavior is defined in the Contract and Architecture docs. Do not restate.

✅ RECOMMENDED WORKFLOW: This template is now the preferred approach for most work, replacing
YYYY-MM-DD-template-project.md, which remains reserved for only complex multi-phase projects
requiring extensive upfront planning:

1. Fully update documentation to reflect the targeted state of the system.
2. Use this history template to capture completed changes with context, decision, tradeoffs.
3. Use agentic coder "plan" + execute mode for A→B phases/checklists/task tracking.
4. Let git history serve as the authoritative execution record.

LLM GUIDANCE:

- This template is for capturing WHY a change happened and what we learned
- Strip ALL comments when emitting final document
- Focus on: context, decision, tradeoffs, consequences, lessons learned
- NO phase tracking, task lists, timelines, or progress logs
- NO duplication of architecture or implementation documentation
- Git history remains the authoritative record of execution details
- Canonical docs describe the system *now*, not how we got there

---

-->

## 🧭 Context

<!--
1-2 short paragraphs (under ~150 words):
- What concrete problem or limitation triggered this change?
- What was breaking down in practice (operationally, conceptually, or ergonomically)?
- Why was the existing design insufficient?

Focus on the *pressure* that forced change, not the solution itself.
-->

## 🎯 Decision

<!--
State what we decided to do. Keep this concise and factual.

Format: Brief narrative intro (1-2 sentences) + bullet points of key outcomes.

Example structure:
- Brief statement of what was changed/clarified
- If applicable, name the architectural pattern introduced
  (e.g. ports-and-adapters, event sourcing, CQRS, adapter layer)
- Bullet points listing key outcomes:
  • Define X as Y
  • Document Z pattern
  • Clarify that A is B
  • Retain existing Z due to migration cost

Reasoning, alternatives, and tradeoffs belong in Tradeoffs, not here.
Avoid describing mechanics that are now documented elsewhere.
-->

### 🔄 Before / After (Optional)

<!--
Optional: briefly describe the architectural invariant introduced.

Example:

Before:
    logging implied per-function instrumentation

After:
    logging occurs only at operation boundaries

This clarifies the conceptual shift, not just the mechanics.
Place this before the narrative decision bullets to frame the decision.
-->

### 🧩 Mental Model (Optional)

<!--
Give the shortest accurate frame for understanding the change.

Helpful prompts:
- This is best thought of as...
- This is not X; it is Y
- The primary abstraction is...
- Future readers should mentally group this with...

Use this when the main risk is conceptual misclassification.
Keep it short: 2–6 bullets max.

Examples:
- Not a Redis wrapper; a backend-agnostic infrastructure layer
- Not per-function logging; boundary-outcome logging
- Not a scheduler; a lease-based coordination mechanism
-->

### 🧾 Stable Terms (Optional)

<!--
Define terminology introduced or clarified by this change.

Purpose:
- Prevent terminology drift
- Improve searchability
- Help LLMs map older terms to newer concepts

Format:
Term → Meaning

Example:
KV infrastructure → Backend-agnostic key-value store + pub/sub layer
Adapter → Concrete backend implementation (e.g. Redis)
Protocol → Interface defining backend contract
-->

## 🔍 Key Tradeoffs

<!--
List the 2–4 most important tradeoffs:
- What improved?
- What complexity or constraint did we accept?
- What alternatives were seriously considered but rejected (briefly)?
- Why did we choose this approach over alternatives?

This section contains the reasoning that supports the Decision section.
This section helps future maintainers understand why the design shouldn't
be casually "simplified" back into the original problem.
-->

## 🔄 Migration Shape (If Relevant)

<!--
Describe only the *nature* of the transition:
- Clean break vs compatibility layer
- Behavior changes visible to consumers
- Any assumptions about rollout or coordination

Do NOT include step-by-step migration details.
-->

## 📌 Enduring Constraints

<!--
Constraints discovered during this change that must continue to hold true,
even though they are not formal contract guarantees.

Examples:
- Performance assumptions (e.g., zero-allocation success paths)
- Observability or cardinality limits
- Lifecycle ordering requirements
- External system realities

Violating these risks reintroducing the original problem.
-->

## 📈 Consequences

<!--
What became true after this change?
- Capabilities unlocked
- Simplifications enabled
- Patterns that are now preferred
- Things that became easier or harder

Focus on structural impact, not implementation detail.
-->

## 🧨 Surprises / Edge Cases (Optional)

<!--
Anything discovered during implementation that wasn't obvious at design time:
- Unexpected complexity
- Behavior under load
- Tooling or language limitations

Skip if nothing notable occurred.
-->

## 🧠 Retrospective Notes (Optional)

<!--
Short reflections worth preserving:
- What we might do differently next time
- Assumptions that turned out wrong
- Practices that worked particularly well (e.g., doc-driven design, LLM workflow)

Keep this brief — not a full post-mortem.
-->

## 🔗 Where to Look Now

<!--
Point readers to the canonical sources that define the system today.
Do not restate their contents.
-->

- Contract: `docs/logging/contract.md`
- Architecture: `docs/logging/architecture.md`
- Implementation: `docs/logging/implementation-guide.md`
- Rationale (living): `docs/logging/design-decisions.md`

## 🗂️ One-Sentence Summary

<!--
A plain-language description of what changed.

Example:
"Clarified that `o.kv` is a backend-agnostic KV store and pub/sub messaging infrastructure layer, rather than a Redis-specific client."
