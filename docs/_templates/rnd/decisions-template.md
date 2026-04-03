# Decision Record Template

# 🚫 **Do not edit this template directly in project repositories.** This template is maintained in [docs-central](https://github.com/obena-org/docs-central) and synchronized to project repos

**Project:** [Project Name]  
**Date:** YYYY-MM-DD  
**Status:** Proposed / Accepted / Deprecated / Superseded  
**Decision ID:** DEC-XXX *(optional, for tracking)*

---

## Context and Problem Statement

*What is the issue we're trying to address? What forces are at play? What is the scope of this decision?*

## Decision Drivers

*What factors are important to this decision?*

- Driver 1: e.g., Performance requirements
- Driver 2: e.g., Development velocity
- Driver 3: e.g., Team expertise

## Considered Options

### Option 1: [Title]

**Description:** *Brief description of the option*

**Pros:**

- Pro 1
- Pro 2
- Pro 3

**Cons:**

- Con 1
- Con 2
- Con 3

### Option 2: [Title]

**Description:** *Brief description*

**Pros:**

- Pro 1
- Pro 2

**Cons:**

- Con 1
- Con 2

### Option 3: [Title]

**Description:** *Brief description*

**Pros:**

- Pro 1

**Cons:**

- Con 1

## Decision Outcome

**Chosen Option:** Option X - [Title]

**Rationale:**

*Explain why this option was chosen. What were the deciding factors? What trade-offs were made?*

## Implementation

**What needs to be done:**

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

**Timeline:** *When will this be implemented?*

**Owner:** *Who is responsible?*

## Consequences

### Positive

- Consequence 1
- Consequence 2

### Negative

- Consequence 1: *How we'll mitigate it*
- Consequence 2: *How we'll monitor for it*

### Neutral

- Side effect 1
- Side effect 2

## Validation

*How will we know if this decision was correct?*

**Success Criteria:**

1. Criterion 1
2. Criterion 2

**Review Date:** YYYY-MM-DD

## Links

- Related decision: [DEC-XXX]
- Related documentation: [Link]
- Discussion: [Slack/email thread]
- Research: [Papers, blog posts]

---

## Decision Log Format (Lightweight Alternative)

For quick decisions that don't need the full template above, use this format:

```markdown
### YYYY-MM-DD - [Decision Title]

**Context:** One-sentence problem statement

**Decision:** What we decided to do

**Rationale:** Why (1-2 sentences)

**Trade-offs:**

- ✅ Benefit 1
- ❌ Downside 1
```

---

## Usage Guidelines

**When to Use This Template:**

- ✅ Architecture or design decisions
- ✅ Technology or library choices
- ✅ Methodology or process changes
- ✅ Significant trade-offs affecting multiple people

**When NOT to Use:**

- ❌ Trivial implementation details
- ❌ Personal preferences without broader impact
- ❌ Temporary experiments (use [experiment log](experiment-log-template.md) instead)

**Difference from ADRs:**

This lightweight format is for R&D projects. For architectural decisions that should be migrated to the main OBENA monorepo, consider:

1. Using this template during R&D
2. Converting to a full ADR when productionizing
3. Referencing these decisions in the main repo's ADR

---

**Template Version:** 1.0  
**Inspired by:** Architecture Decision Records (ADR) and OBENA main monorepo patterns
