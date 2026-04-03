---
title: "ADR: short, sentence-case title"
date: YYYY-MM-DD
status: Proposed
deciders: [names/roles]
reviewers: [names/roles]
consulted: [names/roles]
informed: [names/roles]
domain: system/area
tags: [tag1, tag2]
supersedes: null
superseded-by: null
---

## <!--

ADR TEMPLATE v1.0.1

🚫 **Do not edit this template directly in project repositories.** This template is maintained
in `docs-central` @ <https://github.com/obena-org/docs-central> and synchronized to project repos.

LLM GUIDANCE:

- This template is for Architecture Decision Records (ADRs)
- Strip ALL comments when emitting final document
- Focus on: context, options, decision rationale, consequences
- Keep concise and decision-focused—link to details rather than duplicating
- Status flow: Proposed → Accepted → Amended (optional) → Superseded/Deprecated (or Rejected)

---

-->

## ADR: `Short, sentence-case title`

**Status**: `status` — **Decider(s)**: `deciders` — **Date**: `YYYY-MM-DD` *(see YAML front matter for more)*

<!--
How to use this template
- Copy this file and rename it to the next sequential number + short title, e.g. `0012-user-auth-flow.md`.
- Replace placeholders in the YAML front matter above and in the sections below.
- Keep sections concise and decision-focused. Prefer links over long inline content.
- Status flow usually goes: Proposed → Accepted → Amended (optional) → Superseded/Deprecated (or Rejected).
-->

<!-- Inline metadata moved to the YAML front matter above. -->

## Options summary table (optional)

<!-- Provide a concise comparison of options across key criteria relevant to this ADR.
Tip: Use checkmarks (✅/❌), short text, or links where helpful. Add/remove columns as needed.
Common criteria to consider (flexible — pick what's relevant):
- Cost (licensing, infra, TCO), time to implement, complexity
- Risk (security/privacy/compliance, vendor lock-in, failure modes)
- Developer experience, maintainability, testability, observability
- Scalability, performance, availability, disaster recovery (RTO/RPO)
- Ecosystem/integrations, community maturity, support/SLA
- Product fit (features, data model fit, constraints), accessibility, i18n
-->

| Option     | Criterion 1     | Criterion 2     | Criterion 3     | Notes                   |
| ---------- | --------------- | --------------- | --------------- | ----------------------- |
| `Option A` | value / ✅ / ❌ | value / ✅ / ❌ | value / ✅ / ❌ | short note or reference |
| `Option B` | value / ✅ / ❌ | value / ✅ / ❌ | value / ✅ / ❌ | short note or reference |
| `Option C` | value / ✅ / ❌ | value / ✅ / ❌ | value / ✅ / ❌ | short note or reference |

Legend:

- 🌟 = above & beyond
- ✅ = supports / meets criterion
- ❌ = does not support
- ➖ = partial or unknown
- n/a = not applicable

## Context and problem statement

<!-- What is the business/technical problem? Why is this needed now? Provide the minimal background needed to understand the decision. -->

- Problem: `one-sentence problem statement`
- Goals:
  - `goal`
- Non-goals:
  - `non-goal`

## Assumptions (optional)

- `assumption`

## Decision drivers

<!-- Factors that influenced the decision (requirements, constraints, risks). -->

- `driver 1`
- `driver 2`
- `driver 3`

## Considered options

<!-- List the options that were seriously considered. -->

- `option A`
- `option B`
- `option C`

## Decision

<!-- The selected option and a crisp description of what will be done. -->

- Chosen option: `option` because `rationale`
- Scope: `systems/components affected`
- Ownership: `team/owner`

### Why not the other options? (optional)

- `option B` — `key reasons not chosen`
- `option C` — `key reasons not chosen`

## Detailed comparison (optional)

<!-- Use this section to compare options. Keep each bullet short and specific. -->

<!-- markdownlint-disable MD033 -->
<details>
<summary>Expand to see pros and cons of each option</summary>

### Option A

- Advantages:

  - `pro`
  - `pro`

- Disadvantages:
  - `con`
  - `con`

### Option B

- Advantages:

  - `pro`

- Disadvantages:
  - `con`

### Option C

- Advantages:

  - `pro`

- Disadvantages:
  - `con`

</details>
<!-- markdownlint-enable MD033 -->

## Consequences

<!-- What happens because of this decision? Include trade-offs, limitations, and follow-ups. -->

- Positive:

  - `benefit`

- Negative / risks:

  - `risk and mitigation`

- Security / privacy:

  - `impact and mitigation`

- Operational:

  - `monitoring/alerts/runbooks`

- Performance / cost:
  - `impact and mitigation`

## Open questions (optional)

- `question`

## Implementation plan

<!-- High-level plan with milestones. Reference tickets/PRs instead of duplicating details. -->

- Milestone 1: `description` (issue: `link`)
- Milestone 2: `description`
- Rollout plan: `envs, feature flags, canary, migration steps`
- Backout plan: `how to revert safely`

## Measuring success

- KPIs / SLIs: `metrics and target thresholds`
- Validation: `tests, canaries, load tests`

## Alternatives considered (optional)

<!-- Briefly note options dismissed early and why. -->

- `option` — `reason dismissed`

## References

- Related ADRs: `links`
- Prior art / docs: `links`
- Decision meeting notes: `link`
- Code / PRs: `links`

## Changelog

- `YYYY-MM-DD`: Proposed
- `YYYY-MM-DD`: Accepted
- `YYYY-MM-DD`: Amended — `note`
- `YYYY-MM-DD`: Superseded by `ADR-####-title`
