---
title: TypeScript SDK
description: Using the typed clients of the Veilway control API and the panel's admin API from TypeScript.
---

`@veilway/sdk` is a typed client for the [control API](../../reference/api/) of a Veilway node. It needs Node 20 or newer and has no runtime dependencies. The version is `0.2.10-alpha`.

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

## The panel SDK

`@veilway/panel-sdk` is a typed client for the [admin API](../../manuals/panel/#the-admin-api) of the Veilway panel, for scripts that hold an API token. It needs Node 20 or newer and has no runtime dependencies. The version is `0.2.9`.

```
npm install @veilway/panel-sdk
```

If the registry has no version of it yet, build it from `sdk/` in the [panel repository](https://github.com/veilway-project/veilway-panel) with `npm ci && npm run build`.

It takes a `fetch` function, the panel's API address and a token. The address is the panel's `prefix` followed by `/api`, such as `https://panel.example.com/<prefix>/api`. Make the token under **API tokens** in the panel. Its scope decides which calls it may make, and a call outside the scope fails with `forbidden`. See [API tokens](../../manuals/panel/#api-tokens).

- Users: `listUsers`, `getUser`, `createUser`, `updateUser` and `deleteUser`.
- Devices: `listDevices`, `createDevice` and `removeDevice`.
- Links and usage: `getSubscription`, `resetSubscription`, `resetUsage`, `getExits`, `statsNow`, `statsUsage` and `statsHistory`.

Every failed call throws `VeilwayError` with `status`, `code` and `message`. The `code` is the panel's code, such as `forbidden` or `unauthorized`. An answer that is not JSON, or not an error document, throws `bad_response`.

### List users

```ts
import {Client} from "@veilway/panel-sdk";

const client = new Client(fetch, "https://panel.example.com/<prefix>/api", process.env.VEILWAY_TOKEN ?? "");
const users = await client.listUsers({group: "family", enabled: true});
for (const user of users) console.log(user.id, user.name);
```

### Create a user and a device

```ts
import {Client, VeilwayError} from "@veilway/panel-sdk";

const client = new Client(fetch, "https://panel.example.com/<prefix>/api", process.env.VEILWAY_TOKEN ?? "");
try {
	const created = await client.createUser({name: "ana", groups: ["family"]});
	const {device, weaker} = await client.createDevice(created.user.id, "ana-phone");
	console.log(created.user.id, device.id, weaker);
} catch (e) {
	if (e instanceof VeilwayError) console.log(e.status, e.code, e.message);
}
```

`created.link` holds the subscription link when the panel could make one, and `created.link_error` says why it could not. Anyone with the link can enroll a device, so send it over a channel you trust.

`createDevice` makes the device's key on the panel. That is the weaker choice, and `weaker` is `true` in the answer. A device that enrolls from its own app keeps its key there, and the SDK does not do that step.

### Types

The panel SDK's types are generated from the panel's OpenAPI document, which the panel serves at `{prefix}/api/openapi.json`. `sdk/src/schema.ts` is generated from `server/openapi.json` in the panel repository, and `npm run generate` in `sdk/` rebuilds it after the panel's routes change. `sdk/src/index.ts` is written by hand.
