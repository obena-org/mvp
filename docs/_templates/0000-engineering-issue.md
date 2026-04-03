# NNNN — [Short Title]

## <!--

ENGINEERING ISSUE TEMPLATE v1.0.1

🚫 **Do not edit this template directly in project repositories.** This template is maintained
in `docs-central` @ <https://github.com/obena-org/docs-central> and synchronized to project repos.

LLM GUIDANCE:

- This template is for documenting engineering decisions, workarounds, and migrations
- Strip ALL comments when emitting final document
- Focus on: problem, solution/approach, when to use, alternatives, consequences
- Include working code examples showing both wrong and right approaches
- This is canonical reference documentation, not historical narrative

---

-->

## Summary

[2-3 sentence summary of the decision, workaround, migration, or architectural note. State the "what" and "why" clearly.]

---

## Context

[Describe the background and motivation. What problem are we addressing? What technologies or systems are involved? What might someone naively try to do?]

[Example patterns from existing docs:

- "We use [Technology X] as the [role] and [Technology Y] for [purpose]."
- "In several places, we need [capability or requirement]."
- "Naively, we might [describe the obvious-but-wrong approach]."]

---

## Problem

[Clearly articulate the specific problem or challenge. What breaks? What doesn't work? What are the failure modes?]

[Bullet points work well here:

- [Failure mode 1]
- [Failure mode 2]
- [Impact on the system or developers]]

[For migrations: What schema issue, data inconsistency, or technical debt are we fixing?]

---

## Approach / Decision

[Describe the solution or decision in detail. Include code examples where applicable.]

**Instead of:**

```[language]
[problematic code example]
```

**We do:**

```[language]
[correct approach with example]
```

**Key points:**

- [Important detail 1]
- [Important detail 2]
- [Important detail 3]

[For migrations: Describe the migration strategy, including any safety checks or preconditions.]

---

## Where to use this pattern

[OR: "Implementation Details" for migrations]

[Describe when and where this pattern/decision should be applied. Provide concrete examples.]

Use [this pattern] when:

- [Use case 1]
- [Use case 2]
- [Use case 3]

**Example:**

```[language]
[complete working example showing the pattern in context]
```

[For migrations: Include details about the upgrade/downgrade process, safety checks, and any manual steps required.]

---

## Alternatives Considered

[List alternative approaches that were evaluated and explain why they were not chosen.]

1. **[Alternative 1]**

   - [Pro or con]
   - [Pro or con]
   - [Why it was rejected]

2. **[Alternative 2]**

   - [Pro or con]
   - [Pro or con]
   - [Why it was rejected]

3. **[Alternative 3]**
   - [Pro or con]
   - [Why it was rejected]

[Conclude with why the chosen approach is superior]

Using [chosen approach] is the [superlative] option that:

- [Benefit 1],
- [Benefit 2],
- And [benefit 3].

---

## Consequences

[Describe the impact of this decision or change. What are the trade-offs? What should developers be aware of going forward?]

- [Consequence 1: How this affects future development]
- [Consequence 2: Any limitations or caveats]
- [Consequence 3: What developers need to know or do differently]

[For migrations: Note any runtime behavior changes, performance implications, or data integrity considerations.]

---

## When we can revisit / remove this

[OR: "Future Considerations" for migrations]

[Describe the conditions under which this decision could be reconsidered or this workaround could be removed.]

If [future condition or technology improvement]:

- [Specific change that would enable revisiting], and
- [Validation or stability requirement],

…we can:

1. [Step to revisit]
2. [Step to migrate away from the current approach]

Until then, **[restate the canonical approach]**.

[For migrations: Describe any follow-up work, monitoring needs, or future schema improvements.]

---

## References

[List relevant links, documentation, GitHub issues, pull requests, or related internal docs.]

- [Link with description]
- [Link with description]
- [Related internal doc or decision]

---

## Metadata

**Type:** [Workaround | Decision | Migration | Pattern | Architecture]  
**Date:** [YYYY-MM-DD]  
**Author(s):** [Name(s)]  
**Status:** [Active | Deprecated | Superseded by NNNN]  
**Tags:** [relevant, searchable, keywords]

---

## Notes

### Template Usage Instructions

**For architectural decisions and patterns:**

- Use sections: Summary, Context, Problem, Approach/Decision, Where to use this pattern, Alternatives Considered, Consequences, When we can revisit/remove this
- Include code examples showing both the wrong and right approaches
- Focus on the "why" behind the decision

**For database migrations:**

- Use sections: Summary, Context, Problem, Approach/Decision, Implementation Details, Alternatives Considered, Consequences, Future Considerations
- Include safety checks and preconditions
- Document both upgrade and downgrade paths
- Note any data integrity requirements

**General guidelines:**

- Number docs sequentially (0001, 0002, etc.)
- Use clear, descriptive titles
- Write for future maintainers who lack context
- Include runnable code examples
- Link to external references
- Use horizontal rules (---) to separate major sections
- Keep summaries concise but informative
- Use bullet points for lists and key points
- Use code blocks with appropriate language tags
- Bold important terms and section headers where appropriate
