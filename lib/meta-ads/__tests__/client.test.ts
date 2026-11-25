import assert from "node:assert/strict";
import test from "node:test";
import { MetaGraphClient, MetaTokenExpiredError } from "@/lib/meta-ads/client";

test("Meta Graph client only uses GET, follows pagination, and never leaks the token in the URL", async () => {
  const requests: Array<{ url: string; method: string | undefined; authorization: string | null }> = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    requests.push({ url, method: init?.method, authorization: headers.get("authorization") });
    const body = requests.length === 1
      ? { data: [{ id: "1" }], paging: { next: "https://graph.facebook.com/v24.0/items?after=next&access_token=should-be-removed" } }
      : { data: [{ id: "2" }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = new MetaGraphClient({ accessToken: "secret", apiVersion: "v24.0", fetchImpl: fetchImpl as typeof fetch });
  const rows: Array<{ id: string }> = [];
  for await (const page of client.paginate<{ id: string }>("items", { limit: 1 })) rows.push(...page);

  assert.deepEqual(rows, [{ id: "1" }, { id: "2" }]);
  assert.equal(requests.every((request) => request.method === "GET"), true);
  assert.equal(requests.every((request) => !request.url.includes("secret") && !request.url.includes("should-be-removed")), true);
  assert.equal(requests.every((request) => request.authorization === "Bearer secret"), true);
});

test("Meta Graph client retries transient failures", async () => {
  let calls = 0;
  const client = new MetaGraphClient({
    accessToken: "secret",
    apiVersion: "v24.0",
    maxRetries: 2,
    sleep: async () => undefined,
    random: () => 0,
    fetchImpl: (async () => {
      calls += 1;
      return calls === 1
        ? new Response(JSON.stringify({ error: { message: "busy", is_transient: true } }), { status: 503 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch
  });
  assert.deepEqual(await client.get("me"), { ok: true });
  assert.equal(calls, 2);
});

test("Meta Graph client surfaces an expired token distinctly", async () => {
  const client = new MetaGraphClient({
    accessToken: "expired",
    apiVersion: "v24.0",
    fetchImpl: (async () => new Response(JSON.stringify({ error: { code: 190, message: "expired" } }), { status: 400 })) as typeof fetch
  });
  await assert.rejects(() => client.get("me"), MetaTokenExpiredError);
});
