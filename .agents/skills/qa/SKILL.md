---
name: qa
description: Independently verify meaningful code changes through testing, regression analysis, code review, edge cases, builds, linting, type checks, and relevant security or reliability checks.
---

# Purpose

Independently determine whether an implementation satisfies the requested
behavior without introducing unacceptable regressions.

QA verifies implementation.

QA does not exist merely to approve changes.

# Use When

Use after meaningful implementation work or whenever independent
verification materially improves confidence.

Use QA for:

- requirement verification
- acceptance-criteria verification
- targeted tests
- regression analysis
- code review
- edge cases
- build verification
- lint verification
- formatting verification
- type checking
- security review when relevant
- reliability review when relevant

Do not require heavyweight QA orchestration for trivial low-risk edits.

# Workflow

1. Understand the original requirement.
2. Identify acceptance criteria.
3. Inspect the resulting diff.
4. Identify affected behavior.
5. Locate repository-defined validation commands.
6. Run targeted validation first.
7. Run broader validation when justified by scope or risk.
8. Inspect edge cases.
9. Inspect likely regressions.
10. Review implementation correctness.
11. Review security when relevant.
12. Review reliability when relevant.
13. Record exactly what was and was not tested.
14. Produce an explicit verdict.

# Verdicts

## PASS

Relevant validation was actually executed successfully and no blocking
defect was identified.

## FAIL

A requirement failed or relevant validation identified a defect.

## BLOCKED

Validation could not be completed because of an environment, dependency,
permission, tooling, or external-system problem.

## NOT TESTED

Relevant validation was not executed.

Never convert NOT TESTED into PASS.

Never report PASS merely because the code looks correct.

# Failure Handling

When QA finds an implementation defect:

QA
→ Root
→ Implementer
→ QA

Report:

- failing requirement
- evidence
- command/test when applicable
- affected files or behavior
- recommended corrective direction

Do not blindly retry failing operations.

# Validation Rules

Use repository-defined commands.

Do not invent:

- test commands
- build commands
- lint commands
- formatting commands
- type-check commands

Prefer targeted validation first.

Use broader validation when justified.

Never hide command failures.

# Security and Reliability

When relevant, inspect for:

- unsafe input handling
- authentication/authorization regressions
- accidental secret exposure
- injection risks
- unsafe data handling
- destructive operations
- error-handling regressions
- race/concurrency risks
- resource leaks
- reliability regressions

Do not perform irrelevant security theater for low-risk changes.

# Safety

QA should normally report production-code defects rather than silently
changing production code.

Do not:

- commit
- push
- merge
- rewrite Git history
- perform destructive Git operations

# Expected Output

## Verdict

PASS / FAIL / BLOCKED / NOT TESTED

## Requirements Checked

## Commands Executed

## Passed

## Failed

## Blocked

## Not Tested

## Regression Risks

## Security / Reliability Concerns

## Recommended Action
