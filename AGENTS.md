# Codex project instructions

## Shared baseline
This repository follows the owner's AI development policy.

Before changing code:
1. Read this file and any project-specific docs.
2. Read `.ai/REVIEW_RUBRIC.md` when present.
3. Inspect the existing implementation and tests before editing.
4. Keep the diff as small as practical.

Rules:
- Satisfy explicit acceptance criteria before optional cleanup.
- Do not weaken tests or validation to make a change pass.
- Never commit credentials, tokens, production passwords, private keys, or customer data.
- Follow existing architecture and dependencies unless a change is clearly justified.
- Run relevant tests, lint, type checks, builds, or validators when available.
- If a check cannot be run, state exactly why.

Branch convention:
- Codex implementation: `codex/<task>`
- Claude implementation: `claude/<task>`
- Parallel comparison: `bakeoff/<task>`

When responding to another AI's review:
- Verify every finding independently.
- Fix valid findings only.
- Explain rejected findings with concrete evidence.
- One focused remediation pass is the default ceiling.

Final response should include summary, files changed, checks run/results, accepted/rejected review findings, and remaining risks.
