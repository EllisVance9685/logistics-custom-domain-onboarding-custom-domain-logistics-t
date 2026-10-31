import test from "node:test";
import assert from "node:assert/strict";
import { chooseNextStep, verifyWebhook } from "../src/shipment_onboarding.ts";
import { createHmac } from "node:crypto";

test("pending shipment domains wait for the verification webhook", () => {
  assert.equal(chooseNextStep("pending"), "wait_for_webhook");
  assert.equal(chooseNextStep("verified"), "publish");
});

test("webhook signatures are checked with the registration secret", () => {
  const body = JSON.stringify({ domain: "track.example.com", status: "verified" });
  const signature = createHmac("sha256", "local-secret").update(body).digest("hex");
  assert.equal(verifyWebhook(body, signature, "local-secret"), true);
  assert.equal(verifyWebhook(body, "bad-signature", "local-secret"), false);
});
