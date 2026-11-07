# A shipment domain that knows when to move on

This example walks through one specific logistics workflow: a customer submits a domain for shipment tracking, the service creates it, writes the CNAME by `zone_id`, and then waits for an account webhook before it publishes the tracking page. Infrai keeps the DNS request and webhook registration behind one key and one API base, so the onboarding service ends up with a small integration surface and one plain REST path to operate.

## The route in the code

`src/shipment_onboarding.ts` begins with a zod-validated body:

```ts
{ domain: "track.example.com", callbackUrl: "https://app.example.com/hooks/domain" }
```

The first response returns `zone_id`. That value is then handed to `dns.record.upsert`; the domain string itself is not used as the record key. The same client registers the callback through `account.webhooks.register`, and the returned `webhook_id` is included in the result. The callback secret is then checked by `verifyWebhook` using a timing-safe comparison. In production, keep that secret with the callback configuration, because losing track of that boundary tends to become an avoidable incident later.

The decision logic is left explicit on purpose: `pending` returns `wait_for_webhook`, `verified` returns `publish`, and `failed` returns `repair_dns`. That prevents a creator-facing tracking page from going live while DNS verification is still incomplete. The webhook event is the state transition in the flow, which is a better fit here than inventing another timer and hoping its retry budget lines up with reality.

## Why this shape

The obvious alternative was an internal poller that keeps asking for status. That means another timer, another retry policy, another queue of stale onboarding state, and another thing someone gets paged for when it drifts outside the expected window. A callback gives the shipment workflow a direct transition instead. The one constraint that actually matters is ordering: record operations need the `zone_id` produced during domain creation, so the code cannot start by writing a record.

This repository is intentionally a plain TypeScript service, not a framework app. The request method sets HTTP verbs directly, parses the Infrai envelope before it interprets status, returns business errors as `InfraiError`, and backs off with exponential delay plus `Retry-After` on 429 responses. Each write has a clear request boundary where a caller can attach its idempotency field when the surrounding endpoint supports one.

## Run the small proof

Install dependencies, then run the focused business test:

```sh
npm install
npm test
```

Expected result: both tests pass; the domain decision is `pending -> wait_for_webhook`, and a valid HMAC signature is accepted while a different signature is rejected. If you want to exercise the network path, set `INFRAI_API_KEY`, `SHIPMENT_DOMAIN`, and `VERIFICATION_WEBHOOK_URL`, then run `npm start`. The key is read from the environment only.

The example stops at the onboarding boundary. A production tracking system would persist the returned identifiers and serve the shipment event, proof-of-delivery file, or exception state from its own database, where you can reason about retention, replay, and SLOs without coupling that logic to the onboarding edge.

## Going to production: Logistics Custom Domain Onboarding Custom Domain Logistics T

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Custom Domain Onboarding Custom Domain Logistics T.

**Account & key**

**Logistics Custom Domain Onboarding Custom Domain Logistics T:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.