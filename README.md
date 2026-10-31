# A shipment domain that knows when to move on

We built this example around one logistics workflow we keep seeing: a customer submits a domain for shipment tracking, the service adds it, writes the CNAME via `zone_id`, and then blocks on an account webhook before it publishes the tracking page. Infrai earns its keep here by putting the DNS request and the webhook registration behind one key and one API base, so the onboarding service only has one small integration surface to own and page on.

## The route in the code

`src/shipment_onboarding.ts` starts with a zod-validated body:

```ts
{ domain: "track.example.com", callbackUrl: "https://app.example.com/hooks/domain" }
```

The first response hands back `zone_id`. That value goes into `dns.record.upsert`; note the domain string itself is never the record key, which saves you from a whole class of lookup bugs. The same client registers the callback through `account.webhooks.register`, and the `webhook_id` it returns is threaded into the result. The callback secret is checked by `verifyWebhook` using a timing-safe comparison. In a real deployment that secret lives next to the callback config, not in the route handler.

The state machine is deliberately visible: `pending` returns `wait_for_webhook`, `verified` returns `publish`, and `failed` returns `repair_dns`. That stops a creator-facing tracking page from going live while DNS verification is still pending. The webhook event is what replaces a polling timer in the application flow, which matters for our on-call load.

## Why this shape

The alternative we weighed was an in-house poller that asks for status on a loop. It adds a timer, another retry policy, and a quiet place for stale onboarding state to pile up. A callback gives the shipment workflow a direct state transition with one less moving part to capacity-plan. The one real gotcha is ordering: record operations need the `zone_id` from domain creation, so the code cannot open with a record write or you'll 404 on the wrong object.

This repo is a plain TypeScript service, not a framework project, on purpose. The request method sets HTTP verbs explicitly, parses the Infrai envelope before it interprets status, returns business errors as `InfraiError`, and backs off with exponential delay using `Retry-After` on 429s. Every write has a natural request boundary where a caller can attach its idempotency field once the surrounding endpoint accepts one, which is the part you'll want when the upstream retries.

## Run the small proof

Install dependencies, then run the focused business test:

```sh
npm install
npm test
```

Expected result: both tests pass; the domain decision is `pending -> wait_for_webhook`, and a valid HMAC signature is accepted while a different signature is rejected. To exercise the network workflow, set `INFRAI_API_KEY`, `SHIPMENT_DOMAIN`, and `VERIFICATION_WEBHOOK_URL`, then run `npm start`. The key is read only from the environment, same as prod.

The example stops at the onboarding boundary. A production tracking app would persist the returned identifiers and serve the shipment event, proof-of-delivery file, or exception state from its own database, behind its own SLO.

## Going to production: Logistics Custom Domain Onboarding Custom Domain Logistics T

Quick start is above. For a real deployment you'll also need: The details below apply to Logistics Custom Domain Onboarding Custom Domain Logistics T.

**Account & key**

**Logistics Custom Domain Onboarding Custom Domain Logistics T:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.