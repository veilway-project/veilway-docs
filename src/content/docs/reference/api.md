---
title: Control API reference
description: The HTTP and JSON API a Veilway node serves on a unix socket, with every route, error code and event.
---

The control API is how a panel, a script or the TypeScript client reads and changes a running node. It is HTTP/1.1 with JSON bodies, served by `veilway run` on one unix socket. Every route is under `/v1`, and `GET /v1/openapi.json` returns the OpenAPI 3.1 document of all of them.

Whoever can open the socket is the administrator of the node. They can read the running config (without its secrets), replace it, and watch every user. There is no token, no TLS and no TCP listener: access is decided by the file permissions of the socket alone.

The API is built on Unix only. On other systems `veilway run` has no `--api` or `--no-api` flag and the node runs without an API.

## The socket

| | |
|---|---|
| Path | `--api <path>`, default `veilway.sock` next to the config file |
| Mode | `600`: the user the node runs as, and root |
| Turned off | `--no-api` |

- **Mode from the start.** The socket is made inside a new directory of mode `700`, given mode `600` there and only then linked to its path, so it is never open to anybody else, whatever the umask is.
- **Stale socket.** A socket file that nobody answers on, left by a node that did not shut down, is replaced and the replacement is logged at info.
- **Live socket.** If another process answers on the path, the node refuses to start and says so.
- **Anything else.** A file at the path that is not a socket is never removed. The node refuses to start and names the path.
- **Start-up failure.** A socket that cannot be made stops the node. A node that was meant to be administered does not run where nobody can reach it.
- **Shutdown.** The API is stopped before the engine, and the socket file is removed. A socket that another node has taken over in the meantime is left alone.

```
curl --unix-socket /srv/veilway/veilway.sock http://veilway/v1/status
```

The host name in the URL is never looked up over a unix socket, so any name works.

## Requests and answers

- All bodies are JSON. A request that carries a config document must be sent with `Content-Type: application/json`.
- Every answer that is not a success has this shape, with a status that fits it:

```json
{"error": {"code": "stale_revision", "message": "The running config is not the one If-Match names. Read it again and apply the change to what runs now.", "details": [{"path": "revision", "message": "0f1e2d3c..."}]}}
```

| Field | Meaning |
|---|---|
| `code` | Stable snake_case name, for programs. |
| `message` | One plain sentence, for people. |
| `details` | List of `{"path", "message"}`. For a refused config, every error with the path of its field. Empty when there is nothing to add. |

No answer, event or log line of the API contains the value of a secret (`private_key`, `preshared_key`, `username`, `password`), only paths. A `details` entry never holds a value from the document.

### Error codes

| Status | `code` | When |
|---|---|---|
| 400 | `bad_request` | The body could not be read to its end. |
| 400 | `bad_json` | The body is not one JSON document. |
| 404 | `not_found` | No such route. |
| 404 | `user_not_found` | `GET /v1/users/{name}` for a name the running config does not have. |
| 405 | `method_not_allowed` | The route does not take that method. |
| 408 | `request_timeout` | The request was not finished within 30 seconds. For an apply, see below. |
| 409 | `stale_revision` | `If-Match` does not name the revision that runs. |
| 413 | `body_too_large` | The body is larger than 4 MiB. |
| 415 | `unsupported_media_type` | The body was not sent as `application/json`. |
| 422 | `config_invalid` | The document has errors. `details` lists them. Nothing was changed. |
| 422 | `config_not_prepared` | The document is valid but the node could not prepare it (for example a listener that cannot bind). Nothing was changed. |
| 428 | `precondition_required` | An apply without the header `If-Match`. |
| 503 | `too_many_connections` | The node already serves 64 connections. |
| 503 | `too_many_streams` | The node already serves 32 event streams. |

## Routes

| Method | Path | Answers with |
|---|---|---|
| GET | `/v1/status` | Version, config generation and revision, uptime, counts |
| GET | `/v1/config` | The running config without secrets, and its revision |
| POST | `/v1/config/validate` | The validation report of a document |
| POST | `/v1/config/diff` | What an apply of a document would change, and the report |
| PUT | `/v1/config` | Puts a document in force |
| GET | `/v1/users` | Every user |
| GET | `/v1/users/{name}` | One user |
| GET | `/v1/stats` | All counters with live rates |
| GET | `/v1/sessions` | Devices with a live session |
| GET | `/v1/exits` | Every exit with its upstream health |
| GET | `/v1/events` | Server-Sent Events |
| GET | `/v1/openapi.json` | The OpenAPI 3.1 document |

Every route can also answer `408`, `503`, `404` and `405` as in the table above. The tables below list only what is specific to a route.

### `GET /v1/status`

| Field | Type | Meaning |
|---|---|---|
| `version` | string | Version of the build. |
| `generation` | integer | Starts at 1 and grows by one with every config put in force. |
| `revision` | string | What `If-Match` takes. See Revisions. |
| `uptime_secs` | integer | Seconds since the engine started. |
| `inbounds`, `exits`, `users` | integer | How many the running config has. |
| `flows` | integer | Flows in the flow table right now. |

### `GET /v1/config`

Answers `{"revision", "generation", "document"}`. `document` is the running config with every secret replaced by the marker `"<redacted>"`. The revision is also sent as the `ETag` header.

### `POST /v1/config/validate`

Body: a config document. Nothing changes. The answer is `200` whether or not the document is valid:

| Field | Meaning |
|---|---|
| `valid` | `true` when the document has no errors. |
| `report` | `errors` and `warnings` (lists of `{"path", "message"}`), `more_errors` and `more_warnings` (counts beyond the first 100 of each), `shadow_cut_short` (the check for rules covered by an earlier rule stopped at its budget). |

A body that is JSON but no valid config is a document to report on and answers `200` with `valid: false`. A body that is no JSON at all is `400 bad_json`.

### `POST /v1/config/diff`

Body: a config document. Nothing changes. The answer holds `valid`, `report` as above, and `diff`, which is `null` when the document is not valid. Unlike `validate`, it does not look for rules covered by an earlier rule.

| `diff` field | Meaning |
|---|---|
| `inbounds`, `outbounds`, `exits`, `rules`, `users` | `{"added", "changed", "removed"}`, each a list of tags (names for users). |
| `dns`, `log`, `routing_default`, `rules_reordered` | `true` when that part changed. |
| `inbound_changes` | Per changed inbound: `tag`, `restart` (the tunnel restarts and its sessions drop), `transports_stopped` and `transports_started` (indexes). |
| `user_changes` | Per changed user: `name`, `devices_added`, `devices_removed`, `devices_readdressed`, `devices_rekeyed` (devices by public key) and `lost_access`. |

An outbound whose `username` or `password` is written out in the document, instead of left as the marker, is listed as changed whatever the values are. Otherwise "not changed" would tell whoever guessed a password that the guess was right.

### `PUT /v1/config`

Body: a config document. Header: `If-Match` with the revision the change was made on. It puts the document in force by the same reload as `SIGHUP`, and then writes it to the config file the node was started with.

| Status | Meaning |
|---|---|
| 200 | In force. |
| 409 | `If-Match` is not the revision that runs. The `ETag` header and the single `details` entry (path `revision`) hold the revision that runs. |
| 422 | `config_invalid` or `config_not_prepared`. The running config is untouched. |
| 428 | `If-Match` is missing. |

A `200` answer holds:

| Field | Meaning |
|---|---|
| `revision`, `generation` | Of the config now in force. The revision is also the `ETag`. |
| `saved` | `false` when the config is in force and could not be written to the config file, so a restart would come back with the config before. Sending the same document again tries the write again. |
| `save_error` | Why the write failed, as the system names it. `null` when `saved` is `true`. |
| `diff` | What the apply added, changed and removed, as in `/v1/config/diff`. |
| `report` | The warnings of the config now in force. |

- **What is saved.** The file is not the bytes you sent. The node writes the document it now runs, with the real secrets restored for every marker, formatted by the node. Mode `600`, a temporary file in the same directory, `fsync`, rename, then `fsync` of the directory. If the config path is a symbolic link, the file it points to is replaced.
- **Write timeout.** A write that was given up on after 10 seconds is not stopped, so the file may still come to hold this config. It never goes back to an older one.
- **Time limit.** The 30 seconds of an apply cover reading and checking the document. Once the node has begun to put a config in force, the answer waits for it however long that takes, and a `408` is never sent for a config that then goes into force.
- **Failure.** A document that is refused, or fails to prepare, leaves everything as it was. A document the engine refuses at validation or at prepare is announced as a `config_refused` event. A document the API already finds invalid while reading it is answered `422` and is not announced.

## Revisions and `If-Match`

The revision is 64 hex digits that name the bytes of the running config. It is a keyed hash with a key the node picks at random when it starts, so nobody can work it out from a document, and after a restart the same config has another revision.

An apply needs the header `If-Match` with the revision the caller read. The quotes of an `ETag` are optional. A revision that is not the one that runs, whatever it is, is `409 stale_revision`, and the answer carries the current revision so the caller can read the config again and redo its change. A missing header is `428 precondition_required`. The check is repeated against the running config before the document is applied.

```
curl --unix-socket veilway.sock -X PUT http://veilway/v1/config -H 'Content-Type: application/json' -H 'If-Match: "0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0"' --data @config.json
```

## Editing a config without seeing secrets

`GET /v1/config` never returns a secret: `private_key`, `preshared_key`, `username` and `password` hold the string `"<redacted>"`. A panel edits that document and sends it back to `validate`, `diff` or `PUT /v1/config` as it is. In a document sent to the node, the marker means "keep the running value of the same object":

| Field | Taken from |
|---|---|
| inbound `private_key` | the running inbound with the same `tag` |
| device `preshared_key` | the running device with the same `public_key` |
| outbound `username` and `password` | the running `socks5` outbound with the same `tag` and the same `server` |

A marker that finds no such object is a validation error at the path of that field. That includes an outbound whose `server` changed: the document must then spell out its username and password. A `username` or `password` that is the marker in a config file read from disk is a validation error as well.

## Users, stats, sessions, exits

### `GET /v1/users` and `GET /v1/users/{name}`

The list answers `{"users": [...]}`. The single route answers one user, or `404 user_not_found`.

| Field | Meaning |
|---|---|
| `name` | The user's name. |
| `enabled` | `false` only when the config says `"enabled": false`. |
| `denied` | Why the user cannot connect right now: `disabled`, `expired` or `quota`. `null` for a user who can. |
| `expires_at` | As in the config, or `null`. |
| `quota_bytes`, `quota_period` | As in the config, or `null`. |
| `used_bytes` | Bytes in both directions since `period_start`. |
| `period_start` | When the count last started over, in Unix seconds. `0` for a user who never had a `quota_period`. |
| `traffic` | Lifetime counters: `up_bytes`, `up_packets`, `down_bytes`, `down_packets`. Up is from the device into the node. |
| `devices` | Per device: `name`, `public_key`, `addresses`, `handshake_age_secs` (seconds since its session was made, `null` without a session). |

A preshared key is never part of it.

### `GET /v1/stats`

One snapshot of every counter, with rates in bytes per second. The node samples its counters once a second, and a rate is the growth between the oldest and the newest of the last 5 seconds of samples.

| Field | Meaning |
|---|---|
| `window_secs` | Seconds the rates were taken over: 5 once the node has run that long, 0 before its second sample. |
| `users`, `inbounds`, `exits` | Lists of `{"name", "traffic", "up_bytes_per_sec", "down_bytes_per_sec"}`. `name` is the user name or the tag. A name that is new in the window has rate 0. |
| `drops` | Packets that were not carried since start, by reason name. |
| `dns` | `answered`, `refused`, `failed`, `malformed`, `throttled`. |
| `flows` | Flows in the flow table right now. |
| `ws_stalled`, `ws_refused` | WebSocket connections dropped because they never finished the upgrade, and refused at accept. |
| `state_write_failures` | Writes of the usage state file that failed since start. |

### `GET /v1/sessions`

`{"sessions": [...]}`, one entry per device with a live session on an inbound: `user`, `device`, `public_key`, `inbound`, `transport` (`udp` or `ws`, `null` when the transport the device came over is gone), `handshake_age_secs` and `flows` (the flows of the device across all its inbounds).

The address a device connects from is not part of a session. It is never put in an answer, whatever `log.destinations` says.

### `GET /v1/exits`

`{"exits": [...]}`.

| Field | Meaning |
|---|---|
| `tag`, `name` | `name` is the tag when the config gives none. |
| `backend` | `netstack`, `l3` or `block`. |
| `outbound` | The outbound tag of a `netstack` backend, else `null`. |
| `udp` | Whether the SOCKS5 proxy of the exit relays UDP as far as the node knows. `null` for an exit without a SOCKS5 proxy. |
| `udp_down_secs` | Seconds since the proxy last refused to relay UDP. The node tries again once a minute. `null` unless `udp` is `false`. |
| `udp_flips` | How often the proxy switched between relaying UDP and not. |
| `traffic` | Counters, as for a user. |

## Events

`GET /v1/events` is a Server-Sent Events stream (`text/event-stream`). Each event has an increasing `id`, an `event` name and one JSON document as `data`.

| Event | Data |
|---|---|
| `config_applied` | `generation`, `revision`, `diff`. A reload on `SIGHUP` or an apply. |
| `config_refused` | `stage` (`validate` or `prepare`) and `errors` (their count). A reload or apply that left the running config in force. |
| `user_cut_off` | `user` and `reason`: `disabled`, `expired`, `quota` or `removed`. |
| `user_restored` | `user`. |
| `exit_udp_changed` | `exit` and `udp` (the new state). |
| `stats` | The snapshot of `/v1/stats`, once a second. Only made while somebody reads the stream. |
| `lagged` | `missed`. Has no `id`. |

```
event: user_cut_off
id: 42
data: {"user":"alice","reason":"quota"}
```

- **Slow readers.** The node never buffers without bound. A reader that falls behind loses the oldest events and is sent `lagged` with the number it missed, counted from the gaps in the ids. That covers events the node itself could not keep as well as events this reader was too slow for. The `lagged` event comes just before the next event that was kept.
- **Keep-alive.** A comment line (`: keepalive`) is sent every 15 seconds.
- **Slow connection.** A connection whose reader takes nothing for 30 seconds while the node has something to send is closed.
- **After a gap.** There is no replay. A client that reconnects should read the state again from the routes.

## Limits

| Limit | Value |
|---|---|
| Request body | 4 MiB |
| Request line and headers together | 16 KiB, at most 64 headers |
| Connections at once | 64. One more is answered `503 too_many_connections` and closed. |
| Event streams at once | 32, among those connections |
| Time for a request, from its first byte to its answer | 30 seconds. The same time a connection may wait for its next request. |
| Config documents checked at once | 2. A third waits for its turn within the time of its request. |
| Events kept for a slow reader | 256 |

The body of a refused request is read and thrown away up to four times the limit, so a client that is still sending can read why it was refused. Past that the connection is cut.

## TypeScript client

`@veilway/sdk` is a typed client generated from the OpenAPI document. It has no runtime dependencies. It takes a `fetch` function and a base URL, so how to reach the unix socket is your choice. The example uses `undici`:

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
for await (const event of client.events()) {
	if (event.event === "user_cut_off") console.log(event.data.user, event.data.reason);
}
```

Methods: `status`, `getConfig`, `validateConfig`, `diffConfig`, `applyConfig`, `listUsers`, `getUser`, `stats`, `listSessions`, `listExits` and `events`. Every failure is thrown as `VeilwayError` with `status`, `code`, `message` and `details`. `events` ends when the node closes the stream or the signal aborts, and yields `lagged` events too.

## Not built yet

- Remote access: a TCP listener, tokens and mutual TLS. For now the socket is the only way in.
- A logs endpoint.
- Disconnecting a session by hand.
