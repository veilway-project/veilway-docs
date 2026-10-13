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

- All bodies are JSON. A request that carries a body must be sent with `Content-Type: application/json`.
- Every answer that is not a success has this shape, with a status that fits it:

```json
{"error": {"code": "stale_revision", "message": "The running config is not the one If-Match names. Read it again and apply the change to what runs now.", "details": [{"path": "revision", "message": "0f1e2d3c..."}]}}
```

| Field | Meaning |
|---|---|
| `code` | Stable snake_case name, for programs. |
| `message` | One plain sentence, for people. |
| `details` | List of `{"path", "message"}`. For a refused config, every error with the path of its field. Empty when there is nothing to add. |

No answer, event or log line of the API contains the value of a secret (`private_key`, `preshared_key`, `transport_secrets`, `username`, `password`), only paths. A `details` entry never holds a value from the document.

### Error codes

| Status | `code` | When |
|---|---|---|
| 400 | `bad_request` | The body could not be read to its end. |
| 400 | `bad_json` | The body is not one JSON document. |
| 404 | `not_found` | No such route. |
| 404 | `user_not_found` | `GET /v1/users/{name}` or a usage reset for a name the running config does not have. |
| 405 | `method_not_allowed` | The route does not take that method. |
| 408 | `request_timeout` | The request was not finished within 30 seconds. For an apply and a usage reset, see below. |
| 409 | `stale_revision` | `If-Match` does not name the revision that runs. |
| 409 | `replay_absent` | A reset of the replay memory on a node that keeps none, because it has run no obfuscated transport. Nothing was changed. |
| 409 | `replay_busy` | A reset of the replay memory while an earlier one is not known to be on disk, or while the node stops. Nothing was changed. |
| 500 | `replay_unwritten` | A reset of the replay memory whose file could not be written. See the route. |
| 500 | `replay_writing` | A reset of the replay memory whose write has not ended after 10 seconds and may still land. Do not ask again. See the route. |
| 413 | `body_too_large` | The body is larger than 4 MiB. |
| 415 | `unsupported_media_type` | The body was not sent as `application/json`. |
| 422 | `config_invalid` | The document has errors. `details` lists them. Nothing was changed. |
| 422 | `body_invalid` | The body of a usage reset is JSON but not `{"totals": true}` or `{"totals": false}` or `{}`. Nothing was changed. |
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
| POST | `/v1/users/{name}/usage/reset` | Starts the user's quota count over, and answers with the user |
| POST | `/v1/replay/reset` | Resets the replay memory of the obfuscated transports, and answers with it |
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
| `dns`, `log`, `routing_default`, `rules_reordered`, `notices`, `replay` | `true` when that part changed. For `replay`, the rate per source is in force at once and the cache size from the next start of the node. |
| `inbound_changes` | Per changed inbound: `tag`, `restart` (the tunnel restarts and its sessions drop), `transports_stopped` and `transports_started` (indexes). An inbound whose `type` or `padding` alone changed is listed with `restart` false and both lists empty. Adding a `udp-obfs` transport to an inbound with no `mtu` written is a `restart`: its `mtu` goes from 1420 to 1390. |
| `user_changes` | Per changed user: `name`, `devices_added`, `devices_removed`, `devices_readdressed`, `devices_rekeyed`, `devices_secrets_changed` (devices by public key) and `lost_access`. `devices_secrets_changed` lists the kept devices whose `transport_secrets` are not the ones they were; a control connection that proved a secret that is gone is closed, and a `udp-obfs` session that was opened with it ends. |

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

`GET /v1/config` never returns a secret: `private_key`, `preshared_key`, `username` and `password` hold the string `"<redacted>"`, and every entry of `transport_secrets` holds a marker that names it, `"<redacted:1a2b3c4d>"` with eight hex digits. The digits tell the secrets of one device apart and say nothing about either. They are made anew by every node process, so a document read before a restart has to be read again. A panel edits that document and sends it back to `validate`, `diff` or `PUT /v1/config` as it is. In a document sent to the node, the marker means "keep the running value of the same object":

| Field | Taken from |
|---|---|
| inbound `private_key` | the running inbound with the same `tag` |
| device `preshared_key` | the running device with the same `public_key` |
| an entry of a device's `transport_secrets` | the secret that this marker names, of the running device with the same `public_key`, wherever either stands in its list. An entry that is left out is removed: to end a rotation, drop the marker of the old secret and keep the other. To begin one, write the new secret out next to the marker of the one that stays. |
| outbound `username` and `password` | the running `socks5` outbound with the same `tag` and the same `server` |

A marker that finds no such object is a validation error at the path of that field. That includes an outbound whose `server` changed: the document must then spell out its username and password. It also includes a marker in `transport_secrets` that names no secret of that device, such as the plain `"<redacted>"` or the marker of another device's secret. A `username` or `password` that is the marker in a config file read from disk is a validation error as well.

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
| `period_start` | When the count last started over, in Unix seconds. `0` for a user who never had a `quota_period`, or who had none when their usage was last reset. |
| `dns_set` | The tag of the DNS set that names the user, or else one of their groups. `null` when no set does: the user's queries then go to the set that names the inbound they come through, or to `dns.servers`. |
| `traffic` | Lifetime counters: `up_bytes`, `up_packets`, `down_bytes`, `down_packets`. Up is from the device into the node. |
| `devices` | Per device: `name`, `public_key`, `addresses`, `handshake_age_secs` (seconds since its session was made, `null` without a session). |

A preshared key is never part of it.

### `POST /v1/users/{name}/usage/reset`

Starts one user's quota count over. This is the route behind `veilway usage reset`.

| | |
|---|---|
| Body | Optional. `{"totals": true}` or `{"totals": false}`. No body means `false`. |
| `used_bytes` | Set to `0`. |
| `period_start` | Set to the start of the quota period the node's clock is in (00:00 UTC of the day, of Monday or of the 1st). `0` for a user without a `quota_period`. |
| `traffic` | Kept. With `"totals": true` the four lifetime counters go back to `0` as well. |

| Status | Meaning |
|---|---|
| 200 | Done. The body is the user, exactly as `GET /v1/users/{name}` gives them. |
| 404 | `user_not_found`. Nothing was changed. |
| 400, 413, 415 | `bad_json`, `body_too_large`, `unsupported_media_type`, for a body that is sent and is not usable. Nothing was changed. |
| 422 | `body_invalid`: the body is JSON but has another field than `totals`, or `totals` is not `true` or `false`. Nothing was changed. |

- **Over quota.** A user who was cut off for quota can connect again as soon as the answer is sent. No reload is needed. A user who is disabled or expired stays denied, and `denied` in the answer says so.
- **Nothing else changes.** Sessions, flows and the config stay as they are. Other users are not touched.
- **State file.** The reset is written to the state file before the answer, not at the next 10-second write. If that write fails or takes longer than 5 seconds, the reset is still in force, the failure is logged and counted in `state_write_failures`, and the write is tried again.
- **Repeat.** Sending the same request again is safe. It sets the count to `0` again and changes nothing more.
- **Events.** A `usage_reset` event is sent, followed by `user_restored` when the user was out of quota.
- **Log.** One info line with the user's name, the count before the reset and whether the totals were zeroed.
- **Time limit.** The 30 seconds cover reading the body. Once the node has begun the reset, the answer waits for it, and a `408` is never sent for a reset that then happens.

```
curl --unix-socket veilway.sock -X POST http://veilway/v1/users/alice/usage/reset
curl --unix-socket veilway.sock -X POST http://veilway/v1/users/alice/usage/reset -H 'Content-Type: application/json' --data '{"totals": true}'
```

### `POST /v1/replay/reset`

Resets the replay memory of the obfuscated transports. This is the route behind `veilway replay reset`, and it is for one state only: the floor of the replay memory is ahead of the node's clock, after the clock ran ahead, and the node refuses every device. The [config reference](../config/) describes that state under `replay`.

The request has no body. The cache of accepted proofs is emptied, and the floor and the limit become the node's clock plus 60 seconds, also when that is lower than before. The replay file is written before the answer and before the next proof is accepted.

It costs two things:

- Every client is refused for 60 seconds.
- A proof that was accepted with a timestamp above the new floor is forgotten. Whoever recorded it can use it once more when the clock reaches that timestamp.

| Status | Meaning |
|---|---|
| 200 | Done and on disk. The body is the replay memory after the reset, as `replay` of `/v1/stats` gives it. |
| 409 | `replay_absent`: the node has run no obfuscated transport and keeps no replay memory. `replay_busy`: an earlier reset is not known to be on disk yet, or the node is stopping. Nothing was changed. |
| 500 | `replay_unwritten`: the replay file could not be written, so the reset may or may not be on disk. The node accepts no proof until it has written the floor and the limit it had back, which it tries once a second. Then they are in force again and the reset has to be asked for again. `replay_writing`: the write has not ended after 10 seconds. The reset is in force when it does, so do not ask again: poll `GET /v1/stats`, where `replay.resets` grows by one when the reset has landed and `replay.ready` is false while the node accepts no proof. |

- **Nothing else changes.** Usage, quotas, sessions that are open, flows and the config stay as they are.
- **Log.** One warn line with the floor and the limit before and after, and how many proofs were forgotten.
- **Time limit.** The answer waits for the node for 10 seconds. A write that has not ended by then is answered `replay_writing`, never "ask again": a second reset would cost another 60 seconds. A `408` is never sent for a reset that then happens.

```
curl --unix-socket veilway.sock -X POST http://veilway/v1/replay/reset
```

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
| `send_failed` | Datagrams the node made for a device and no socket took, over every transport of every inbound. A `veilway` inbound never fragments, so a packet larger than the host's interface carries is counted here and not sent, and logged at info once a minute: lower the inbound's `mtu` when this grows. |
| `control` | What the control channel of the `veilway` inbounds did since start: `accepted` and `authenticated` connections, connections closed for `auth_failed`, `malformed`, `timed_out` (the opening took over 10 seconds) and `replaced` (a newer connection of the device took the place), requests answered `rate_limited`, `exits_selected`, `exits_refused` and `exits_dropped` (by a reload), `probe_runs`, `probes_confirmed`, `probes_sent`, `probes_refused`, `mtus_set`, `byes`, and `open`, the authenticated connections right now. All zero on a node without a `veilway` inbound. |
| `udp_obfs` | What the `udp-obfs` transports did since start, and what they hold now. See below. All zero on a node without one. |
| `replay` | The replay memory of the obfuscated transports. `null` on a node that has run none. See below. |

`udp_obfs`. No counter names an address, a tag or a key, and a datagram that is dropped got no answer whatever its reason:

| Field | Meaning |
|---|---|
| `pending`, `sessions` | Right now: sessions whose opening packet was accepted and on which WireGuard has not authenticated yet, and established sessions. `sessions` includes those that a newer session from the same source replaced and that stay readable for 10 seconds. |
| `tags` | Epoch tags in the tag tables right now: three for each transport secret of each device that may connect. |
| `opened`, `established` | Opening packets that were accepted, and sessions that became established. |
| `sent` | Packets the listeners made for a socket. Every one is a data packet of an established session, so a node that only strangers talk to has 0 here. |
| `waited`, `spent` | Opening packets that were kept until a higher limit was written and then taken to the replay rule again, and opening packets a limit refused whose salt was recorded as used, so that nobody who saw one can use it later. A device has an allowance of 16 such records at once and 1 a second; a refused packet beyond it is not recorded. |
| `short`, `unknown`, `open_failed` | Datagrams shorter than a data packet. Datagrams that are no packet of a session at their source and whose tag is not in the tag table: every datagram of a stranger is counted here. And datagrams whose tag is in the table and that do not open: the sender holds a tag of this epoch without the device's secret, or the packet was changed on its way. |
| `window`, `floor`, `seen`, `cache_full` | Opening packets of a device that the replay rule refused: a timestamp more than 60 seconds off the node's clock, one at or below the floor, a packet that was accepted before, and any while the cache is full. `window` that grows for one device points at a wrong clock on that device or on the node. |
| `limit`, `no_replay` | Opening packets with a timestamp above the written limit that were dropped, because the listener already kept 64 others or no write ended within 2 seconds, and those that came while the node took no proof at all. |
| `source_devices`, `pool`, `pending_full`, `device_rate`, `source_rate` | Opening packets refused by a limit: the source has sessions of 4 other devices, the listener's `limits.sessions` is reached, the device has 2 pending sessions, the device's allowance (16, then 1 a second) or the source's (`replay.per_source`) is spent. |
| `handshakes`, `tunnel`, `unsendable` | WireGuard handshake initiations above a session's allowance (3, then 1 a second), datagrams inside a session that WireGuard did not take as a packet of the session's device, and packets the node could not make. |
| `ended_deadline`, `ended_idle`, `ended_packets`, `ended_replaced`, `ended_displaced`, `ended_revoked` | Sessions that ended: no WireGuard packet within 10 seconds of the opening packet, no activity for 180 seconds, 2^31 packets sent, a newer session of the same source and device, the device's ninth session, and a device that was cut off for any reason or a transport secret the config no longer has. |
| `table_rebuilds`, `table_rebuilds_late`, `table_build_failures`, `tag_collisions` | How often a tag table was built for a new epoch (every 120 seconds for each inbound), how often that was more than 10 seconds late, how often a build did not end and the table before stayed, and tags that were left out because another secret had the same, which never happens with random secrets. |

`replay`. Times are Unix seconds on the node's clock:

| Field | Meaning |
|---|---|
| `ready` | `false` while no proof is accepted at all: a reset whose file is not known to be on disk. |
| `clock`, `floor`, `limit` | The node's clock, the time up to which proofs are refused, and the time above which a proof is not accepted before a higher limit is written. While the node runs, `limit` is 10 to 20 seconds ahead of `clock`. |
| `disk_limit` | The highest limit that may be on disk, which a start after a kill takes as its floor. |
| `entries`, `capacity` | Proofs in the cache, and `replay.cache` as the node was started with. |
| `refusing_secs` | How many seconds the floor is ahead of the clock, whatever the cause. For that long proofs with a right clock are refused. Up to 80 after a start or a reset, which passes by itself. |
| `floor_ahead`, `refused_floor_ahead` | Whether the floor is ahead of the clock in a way no start explains, more than 80 seconds or risen while the node ran, which refuses every device until the clock passes it or the memory is reset, and how many proofs were refused for it. |
| `writes`, `write_failures`, `slow_writes` | Writes of the replay file that went through, that failed, and that took more than 2 seconds. While `write_failures` grows the node accepts no new proof. |
| `limit_lowered`, `resets` | How often the node brought its own limit down after a clock that had run ahead, and how often the memory was reset. |

### `GET /v1/sessions`

`{"sessions": [...]}`, one entry per device with a live session on an inbound: `user`, `device`, `public_key`, `inbound`, `transport` (`udp`, `ws` or `udp-obfs`, `null` when the transport the device came over is gone, or its `udp-obfs` session has ended), `handshake_age_secs`, `flows` (the flows of the device across all its inbounds), `selected_exit` (the exit the device chose on the control channel, `null` when it chose none and leaves through its user's exit), `control_connections` (its authenticated control connections) and `mtu` (the MTU the device set, `null` when it set none and its tunnel has the inbound's).

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
| `interface_up` | Whether the interface of an `l3` backend is up. While it is `false`, traffic routed to the exit is answered as unreachable and the node tries to bring the interface up again: 2 seconds after it went down, then after twice the wait each time, once a minute at most. `null` for any other backend. |
| `interface_down_secs` | Seconds since the interface went down. `null` unless `interface_up` is `false`. |
| `interface_flips` | How often the interface switched between up and down. |
| `traffic` | Counters, as for a user. |

## Events

`GET /v1/events` is a Server-Sent Events stream (`text/event-stream`). Each event has an increasing `id`, an `event` name and one JSON document as `data`.

| Event | Data |
|---|---|
| `config_applied` | `generation`, `revision`, `diff`. A reload on `SIGHUP` or an apply. |
| `config_refused` | `stage` (`validate` or `prepare`) and `errors` (their count). A reload or apply that left the running config in force. |
| `user_cut_off` | `user` and `reason`: `disabled`, `expired`, `quota` or `removed`. |
| `user_restored` | `user`. |
| `usage_reset` | `user` and `totals` (whether the lifetime counters were zeroed too). Sent for every usage reset. |
| `exit_udp_changed` | `exit` and `udp` (the new state). |
| `stats` | The snapshot of `/v1/stats`, once a second. Only made while somebody reads the stream. A snapshot counts as one event in the buffer of a slow reader, and a reader that is behind is sent the newest snapshot there is for each one it has not yet taken, not the one of that second. |
| `lagged` | `missed`. Has no `id`. |

```
event: user_cut_off
id: 42
data: {"user":"alice","reason":"quota"}
```

- **Slow readers.** The node never buffers without bound. A reader that falls behind loses the oldest events and is sent `lagged` with the number it missed, counted from the gaps in the ids. On a node with many users a snapshot is large, and a reader that needs longer than a second for each falls behind on snapshots alone and then loses other events too. That covers events the node itself could not keep as well as events this reader was too slow for. The `lagged` event comes just before the next event that was kept.
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

Methods: `status`, `getConfig`, `validateConfig`, `diffConfig`, `applyConfig`, `listUsers`, `getUser`, `resetUsage`, `resetReplay`, `stats`, `listSessions`, `listExits` and `events`. Every failure is thrown as `VeilwayError` with `status`, `code`, `message` and `details`. `resetUsage(name, {totals: true})` resets a user's usage and returns the user. `resetReplay()` resets the replay memory and returns it; read what it costs under `POST /v1/replay/reset` first. `events` ends when the node closes the stream or the signal aborts, and yields `lagged` events too.

## Not built yet

- Remote access: a TCP listener, tokens and mutual TLS. For now the socket is the only way in.
- A logs endpoint.
- Disconnecting a session by hand.
