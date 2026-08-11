# AI Review Rubric

Review only changes introduced by the pull request.

## Scoring
- Functional correctness: 30
- Acceptance-criteria coverage: 15
- Regression risk / compatibility: 15
- Test quality and missing tests: 15
- Security / privacy / secret handling: 10
- Maintainability / readability: 10
- Performance / unnecessary complexity: 5

Total: 100

## Finding format
For each material finding:
- Severity: Critical / High / Medium / Low
- File and smallest relevant location
- What is wrong
- Evidence or failure scenario
- Minimal recommended fix

Do not invent findings. Distinguish verified defects from hypotheses. Prefer executable evidence over preference.

## Final output
- Score: X/100
- Verdict: APPROVE / REQUEST_CHANGES
- Blocking findings: N
- Non-blocking findings: N
- Top risks
