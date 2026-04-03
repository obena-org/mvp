---
title: "Brief Description of Issue"
date: YYYY-MM-DD
status: FIXED | MITIGATED | DOCUMENTED
severity: LOW | MEDIUM | HIGH | CRITICAL
related-projects: []
related-issues: []
tags: []
---

## <!--

ISSUE TEMPLATE v1.0.1

🚫 **Do not edit this template directly in project repositories.** This template is maintained
in `docs-central` @ <https://github.com/obena-org/docs-central> and synchronized to project repos.

LLM GUIDANCE:

- This template is for post-mortem documentation of resolved bugs/issues
- Strip ALL comments when emitting final document
- Focus on: problem, root cause, solution, impact, lessons learned
- One consolidated document per issue (don't fragment into multiple files)
- Keep factual and concise—this is a knowledge base entry, not a diary
- Git history contains execution details; don't duplicate it here

---

-->

## Problem

<!--
2-3 paragraphs describing what was broken:
- Symptoms observed
- Who was affected (external projects, specific services, etc.)
- Error messages or failure modes
- When/how the issue was discovered

Keep focused on observable behavior, not root cause (that comes next).
-->

## Root Cause

<!--
Technical explanation of why the issue occurred:
- What assumption was invalid?
- What changed to expose the bug?
- Code examples showing the broken behavior
- Why did existing tests not catch it?

Use code blocks to illustrate the problem clearly.
-->

## Solution

<!--
What was changed to fix the issue:
- Code changes (high-level, not line-by-line)
- Configuration updates
- New tests added
- Documentation updates

Reference specific commits if they represent major architectural shifts,
but trust git history for implementation details.
-->

## Impact

<!--
Who/what was affected and how:
- Severity assessment (who was blocked, what was broken)
- Scope (which systems, repositories, or projects)
- Duration (how long was it broken)
- Mitigation status (fixed, workaround available, documented)

Keep factual—this helps assess similar issues in future.
-->

## Lessons Learned

<!--
Key takeaways for preventing similar issues:
- What assumptions should we avoid?
- What testing gaps existed?
- What patterns should we follow/avoid?
- What documentation was missing?

These should be actionable insights, not blame assignment.
-->

## References

<!--
Links only—no summaries:
- Related project documents
- Related ADRs
- Commit hashes for major changes (sparingly)
- External resources (if applicable)
-->
