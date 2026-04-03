# Engineering Documentation Taxonomy

## Purpose

Define a clear, lightweight structure for engineering documentation that separates **intent** rather than organizing purely by topic.

This prevents single documents from trying to explain philosophy, architecture, implementation, and usage simultaneously.

This model is intentionally pragmatic and suitable for small–to–mid sized systems and libraries.

---

## The Core Principle

**Documents should be organized by the question they answer, not the subject they describe.**

A single domain (e.g., logging, configuration, crawling, etc.) spans multiple kinds of knowledge:

| Document Type  | Answers the Question                                      |
| -------------- | --------------------------------------------------------- |
| Concepts       | Why does this exist? How should we think about it?        |
| Architecture   | What is the system's shape and responsibility boundaries? |
| Implementation | How is this actually implemented?                         |
| ADR            | Why did we choose this over alternatives?                 |
| Guides         | How do I perform a specific task?                         |
| Reference      | What are the exact rules or APIs?                         |
| History        | How did we migrate from one state to another?             |

Mixing these leads to documents that grow uncontrollably and become difficult to maintain.

---

## 1. Concepts Documents

**Goal:** Teach the *mental model* behind a system.

**Audience:** Engineers trying to understand the problem space or philosophy.

**Characteristics:**

- Stable over time
- Minimal code references
- Focused on vocabulary, invariants, and reasoning
- Explains *why the world is shaped this way*
- Expected lifespan: years

**Good Content:**

- Design philosophy
- Operational worldview
- Domain language definitions
- System invariants

**Avoid:**

- Implementation details
- Class/function explanations
- Step-by-step instructions

**Think:** A textbook chapter, not a manual.

---

## 2. Architecture Documents

**Goal:** Describe the system’s structural design and boundaries.

**Audience:** Engineers designing, extending, or reviewing the system.

**Characteristics:**

- Defines responsibilities and relationships
- Explains separation of concerns
- Specifies what must remain decoupled
- Expected lifespan: persists through many refactors

**Good Content:**

- Major components and their roles
- Interaction patterns
- Data flow boundaries
- Intentional constraints

**Avoid:**

- Low-level implementation
- Language-specific mechanics
- Validation details

**Think:** A blueprint, not the construction notes.

---

## 3. Implementation Documents

**Goal:** Explain how the architecture is realized in code.

**Audience:** Contributors working inside the implementation.

**Characteristics:**

- Operational and concrete
- Evolves with refactors
- Explains tradeoffs made during implementation
- Expected lifespan: refactor-to-refactor

**Good Content:**

- Why composition was chosen over inheritance
- How validation is enforced
- Performance or runtime considerations
- Type system workarounds
- Internal mechanics that are not obvious

**Avoid:**

- Re-explaining philosophy already covered in Concepts
- Re-stating architectural intent

**Think:** A maintainer's field guide.

---

## 4. ADRs (Architecture Decision Records)

**Goal:** Capture a single consequential decision and its tradeoffs.

**Audience:** Future maintainers asking, “Why didn’t we do the obvious thing?”

**Characteristics:**

- Immutable historical record
- One decision per file
- Explicit alternatives considered
- Documents consequences and constraints
- **ADR-Worthy Threshold:** Use an ADR only when reversing the decision would require architectural change or migration

**Structure Typically Includes:**

- Context
- Decision
- Alternatives Rejected
- Consequences

**Examples of ADR-Worthy Decisions:**

- ✅ Separating schema definition from event code
- ✅ Choosing composition over inheritance for core abstractions
- ❌ Using `Annotated` vs helper function (belongs in Implementation)
- ❌ Specific naming convention (belongs in Reference or Implementation)

**Think:** A receipt for a hard choice.

---

## 5. Guides (Task-Oriented Documentation)

**Goal:** Help someone accomplish a specific task.

**Audience:** Engineers using the system.

**Characteristics:**

- Procedural and actionable
- Example-driven
- Narrow scope
- Expected lifespan: as workflows change

**Examples:**

- Adding a new module
- Instrumenting a boundary
- Running a migration

**Think:** A cookbook recipe.

---

## 6. Reference Documentation

**Goal:** Provide authoritative, lookupable facts.

**Audience:** Engineers needing exact rules or definitions.

**Characteristics:**

- Minimal narrative
- Highly precise
- Often tabular or enumerated
- **States what is allowed—not why it is allowed**

**Examples:**

- Field requirements
- Naming conventions
- Allowed types
- API contracts

**Avoid:**

- Validation logic explanations (those belong in Implementation)
- Rationale for constraints (those belong in Concepts or ADR)

**Think:** A dictionary, not an essay.

---

## 7. History / Migration Documents

**Goal:** Explain a transition from one design to another.

**Audience:** Maintainers during a refactor window.

**Characteristics:**

- Temporary but useful
- Explains sequencing and rationale of change
- Can be archived once the transition is complete
- Expected lifespan: temporary (duration of migration/refactor)

**Think:** Change log with context.

---

## A Practical Structure

A small system rarely needs deep hierarchies. A simple intent-based structure is sufficient:

```
docs/
  concepts/
  architecture/
  implementation/
  adr/
  guides/
  reference/
```

**Folder Creation Rule:** Do not create a subfolder unless you have ≥3 documents of that type in that domain.

Avoid premature subdivision by package unless documentation volume justifies it.

---

## Writing Heuristic

Before writing a document, ask:

> Am I explaining **why this worldview exists**,
> **what shape we chose**,
> or **how the code works**?

If the answer is "all three," the content should be split.

---

## Placement Test (When You're Unsure Where Something Belongs)

Ask which of these changes would require rewriting the document:

| If this change would require rewriting the doc…    | It belongs in… |
| -------------------------------------------------- | -------------- |
| A refactor changed class structure but not meaning | Implementation |
| We replaced one subsystem with another             | Architecture   |
| We reconsidered the philosophy or invariant        | Concepts       |
| We chose a different option after evaluation       | ADR            |
| The steps to perform a task changed                | Guide          |
| Field names or allowed values changed              | Reference      |

**Rule of Thumb:** If code churn breaks the doc → it is not Concepts.

---

## Anti-Pattern to Avoid

**The Monolithic Engineering Doc**

A single document that:

- Teaches philosophy
- Explains architecture
- Describes implementation
- Provides how-to guidance
- Records history

This type of document becomes difficult to maintain because each section changes at a different rate.

---

## Summary

Good engineering documentation separates:

- **Meaning (Concepts)**
- **Structure (Architecture)**
- **Realization (Implementation)**
- **Decisions (ADR)**
- **Usage (Guides)**
- **Facts (Reference)**
- **Transitions (History)**

Organizing by intent ensures each document can evolve at the correct pace without dragging unrelated material along with it.

## Practical Example: Decomposing an Overloaded Document

Consider a monolithic "logging.md" that tries to cover everything. Using this taxonomy, it would decompose into:

| Content                           | Where It Belongs |
| --------------------------------- | ---------------- |
| "Log once at boundary" philosophy | Concepts         |
| Boundary vs operation model       | Architecture     |
| Dataclass + ClassVar mechanics    | Implementation   |
| Schema-code migration             | History          |
| How to add a new event            | Guide            |
| Allowed fields / constraints      | Reference        |

Each piece can now evolve independently at its natural rate.
