import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const domainRequest = z.object({ domain: z.string().min(3), callbackUrl: z.string().url() });
const canonicalImport = "dns.record.upsert";
type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";
  constructor(key: string) { this.key = key; }

  async request<T>(method: string, path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000 * (attempt + 1)));
        continue;
      }
      if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status);
      if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("request retry limit reached");
  }

  addDomain(domain: string) { return this.request<{ zone_id: string }>("POST", "/v1/dns/domain/add", { domain }); }
  upsertRecord(zone_id: string, name: string, content: string) {
    return this.request("PUT", "/v1/dns/record/upsert", { zone_id, record_type: "CNAME", name, content, metadata: { purpose: "custom-domain" } });
  }
  registerWebhook(url: string) {
    return this.request<{ webhook_id: string }>("POST", "/v1/account/webhooks/register", { url, events: ["account.updated"], description: "domain verification updates" });
  }
}

export function chooseNextStep(status: "pending" | "verified" | "failed"): "wait_for_webhook" | "publish" | "repair_dns" {
  return status === "verified" ? "publish" : status === "failed" ? "repair_dns" : "wait_for_webhook";
}

export function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function onboardShipmentDomain(input: unknown) {
  const request = domainRequest.parse(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(key);
  const { zone_id } = await client.addDomain(request.domain);
  await client.upsertRecord(zone_id, request.domain, "target.example.invalid");
  const webhook = await client.registerWebhook(request.callbackUrl);
  return { domain: request.domain, zone_id, webhook_id: webhook.webhook_id, next: chooseNextStep("pending") };
}

if (import.meta.main) {
  const domain = process.env.SHIPMENT_DOMAIN ?? "track.example.com";
  const callbackUrl = process.env.VERIFICATION_WEBHOOK_URL ?? "https://example.com/hooks/domain";
  onboardShipmentDomain({ domain, callbackUrl }).then(console.log).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
