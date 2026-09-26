# AI Development Workflow

## Standard task

1. Create a GitHub Issue with goal, acceptance criteria, scope, and checks.
2. Choose one builder.
3. Builder creates `codex/<task>` or `claude/<task>`.
4. Builder opens a draft PR early.
5. Builder finishes implementation and deterministic checks.
6. Mark PR ready.
7. Opposite AI reviews:
   - Codex branch -> Claude
   - Claude branch -> Codex
8. Builder verifies findings and performs at most one focused remediation pass.
9. Deterministic checks rerun.
10. Human decides whether to merge.

## Parallel bake-off

Use only for high-impact or genuinely uncertain design choices.

Create two branches from the same base and Issue:
- `bakeoff/codex/<task>`
- `bakeoff/claude/<task>`

The implementations stay independent. Compare acceptance-criteria coverage, test evidence, regression risk, complexity, and maintainability. Do not merge both blindly.

## Review command

From the control-plane repo on the Windows machine:

```powershell
.\scripts\invoke-cross-review.ps1 -Repo owner/repo -Pr 123
```

The script routes to the opposite AI and prevents duplicate/unbounded reviews.
