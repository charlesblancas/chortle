# Optional gameplay analytics

Create a PostHog Free project without adding a payment method. Copy its public
project token (`phc_...`) and region from project settings. Never put a personal
API key in Vite variables: these values are public in the browser bundle.

The public US project configuration is in `.env.production`. Cloudflare builds
load it automatically; production environment variables can override it. For
a different project, use these **production build** variables:

```
VITE_ANALYTICS_ENABLED=true
VITE_POSTHOG_TOKEN=phc_your_project_token
VITE_POSTHOG_REGION=us
```

Use `eu` for EU Cloud. Rebuild after setting or changing variables. Remove the
enabled flag and rebuild to disable. Preview builds may bundle the public
configuration, but collection allows only `chortle.charlesblancas.com`.
Development builds, tests, debug fixtures/day overrides, and missing configuration
send nothing. Configure production only after reviewing PostHog privacy and
retention settings and any applicable notice/consent requirements.

No SDK, session recordings, automatic pageviews, clicks, error text, URLs,
guessed words, FENs or move histories are sent. Explicit events cover puzzle
start, submitted guess, result, tutorial start/finish/skip, and
share request/success. "Share completed" means clipboard success or native-sheet
handoff, not proof that a post was published. Ad blockers and failed delivery
will undercount; analytics never participates in gameplay correctness.

A random browser ID is stored in localStorage to measure returning browsers,
not signed-in people or cross-device identities. No person profiles are created.
Requests still reach PostHog, which can observe network metadata; this is not
a promise of fully anonymous processing. DNT and Global Privacy Control suppress
events. To opt out manually, set `chortle:analytics-opt-out` to `1` in localStorage.

Start, guess and finish attempts use browser-local deduplication keys. Reloading
a completed game emits no completion event. Tracking is capped at 200 attempted
events per browser per UTC day with no retries/offline queue. Deduplication and
limits are best effort across tabs, cleared storage or blocked storage.
This is NOT an account-level spending cap: keep the account free-only and verify
its billing configuration. This integration cannot enforce PostHog's billing.

Dashboard setup: trend `puzzle_started` and `puzzle_finished`; filter results by
`solved`; break down by `day`; funnel tutorial_started →
tutorial_finished and puzzle_started → puzzle_finished; retention based on
puzzle_started. Create insights in PostHog once real events arrive.

Capture protocol: https://posthog.com/docs/api/capture
Free allowance/billing: https://posthog.com/pricing
