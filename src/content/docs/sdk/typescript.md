---
title: TypeScript SDK
description: Using the typed client of the Veilway control API from TypeScript.
---

`@veilway/sdk` is a typed client for the [control API](../../reference/api/) of a Veilway node. It needs Node 20 or newer and has no runtime dependencies. The version is `0.1.0-alpha`.

```
npm install @veilway/sdk
```

If the registry has no version of it yet, build it from `packages/sdk` in the [repository](https://github.com/veilway-project/veilway) with `npm ci && npm run build`.

## What it does

- It calls every route of the control API: `status`, `getConfig`, `validateConfig`, `diffConfig`, `applyConfig`, `listUsers`, `getUser`, `resetUsage`, `resetReplay`, `stats`, `listSessions`, `listExits`, `listInbounds`, `listLinks` and `events`.
- It takes a `fetch` function and a base URL. The node serves the API on a unix socket only, so how the bytes reach the socket is your choice.
- Every failure is thrown as `VeilwayError` with `status`, `code`, `message` and `details`.
- `events` is an async iterator over the event stream. It tells a slow reader how many events it missed.

## What it does not do

- It does not speak the Veilway protocol. It has no WireGuard, no transports and no tunnel, so it cannot connect as a client.
- It does not reach a node over the network. There is no remote access to the API, only the unix socket.

## Example

```ts
import {Agent, fetch as undiciFetch} from "undici";
import {Client, VeilwayError, type Fetch} from "@veilway/sdk";

const dispatcher = new Agent({connect: {socketPath: "/srv/veilway/veilway.sock"}});
const fetch: Fetch = (url, init) => undiciFetch(url, {...init, dispatcher}) as unknown as ReturnType<Fetch>;
const client = new Client(fetch, "http://veilway");
const running = await client.getConfig();
try {
	await client.applyConfig({...running.document, log: {level: "debug"}}, running.revision);
} catch (e) {
	if (e instanceof VeilwayError) console.log(e.status, e.code, e.details);
}
```

`getConfig` returns the config with every secret replaced by `"<redacted>"`. Send it back as it is and the node keeps the real values. The revision it returns is what `applyConfig` needs, and a stale one fails with the code `stale_revision`.

## Types

The types in `src/schema.ts` are generated from `crates/veilway-api/openapi.json`, the OpenAPI document that the node also serves at `GET /v1/openapi.json`. `src/index.ts` is written by hand. The types describe the control API, not the wire formats of the native protocol, which are in the protocol pages.
