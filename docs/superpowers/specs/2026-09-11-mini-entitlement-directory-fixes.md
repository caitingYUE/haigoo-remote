# Mini Program Entitlement and Directory Fixes

## Goal

Ensure a refunded account loses member-only Mini Program behavior immediately, company/job data is complete or fails visibly, and the company directory's latest/relevance choices produce the intended ordering.

## Design

1. Refresh the authoritative WeChat session before member-sensitive Match, company directory, and company detail loads. Do not render cached member fields as authoritative while the profile dashboard is still loading.
2. Keep the existing server-side membership calculation and retained-resource scoping, but add a hard completeness guard for company detail jobs. If a company advertises open jobs while the formal job metadata is empty, retry the company-specific formal feed and fail the request instead of displaying a false empty state.
3. Make relevance sorting deterministic even when the user has no role profile by ranking current opportunity breadth before recency. Preserve profile-role overlap as the stronger signal when available.

## Acceptance Criteria

- A refreshed/refunded session cannot show member daily refresh or the full company directory from a retained pre-refund response.
- A company with `openJobCount > 0` never renders a successful detail response with `jobs: []`.
- `latest` and `relevance` use distinct, documented ranking rules and have regression coverage.
- Existing payment/refund and directory tests remain green.
