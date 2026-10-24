---
title: Several nodes from one panel
description: How a panel manages more than one node, how a node joins and is confirmed, the sealed requests and answers a node sends to the panel's subscription endpoint, the control jobs it runs, usage and quota across nodes, rotation and removal, and what each party can do.
---

:::caution[Designed for v0.3.0, not built]
Nothing on this page is built. It is the design of the owner's decisions of 2026-10-24, written before the code so that the threat model (section 5.19) and the code can be checked against it. Where the design leaves a detail open, the page says "To be decided:" and lists the options. No one outside the project has reviewed it, and the HPKE composition (Auth mode and AuthPSK) is new. Do not rely on any of it.
:::

One panel can manage several nodes. The node that runs next to the panel stays on the control socket exactly as today and is called node 1. Every other node is **remote**: it dials the panel, never the other way round. Read [Protocol overview](../overview/) and [Subscription format](../subscription-format/) first. This page reuses that page's encrypted exchange and its endpoint.

Four rules shape the page:

- **The node always dials.** Nothing new listens on any node. The control API stays on its unix socket. A remote node exposes nothing a scanner can find beyond its user transports.
- **The panel's endpoint is the only door.** A node sends sealed requests to the URLs users already fetch their subscriptions from. Through a CDN or a front, the path sees only sealed bytes.
- **Each node keeps its own part.** The panel writes the users list of a node. The node owns its inbounds, exits, routing and secrets. Every apply is a full replacement.
- **A node that cannot reach the panel keeps serving.** It keeps its last users, limits and expiry. It is never cut off because the panel is out of reach.

## Numbers that are judgement calls

Every number on this page that was chosen, not derived, is in this table. None has a measurement behind it. A range written "a to b" is inclusive at both ends.

| Name | Value |
|---|---|
| Lifetime of a join code | 1 h, one use |
| Wait of a joined node for the admin's confirmation | up to 1 h |
| Request padding buckets (plaintext) | 4, 16, 64 or 256 KiB |
| Largest request a node sends | 256 KiB. Larger results are cut by the node before sealing. |
| Answer padding buckets (plaintext) | 4 KiB up to 8 MiB in powers of 4. To be decided: the top bucket, see "Open questions". |
| Largest result of a control job | 256 KiB compressed |
| Clock window of `sent_at` | 10 minutes either way |
| Long-poll answer time when there is no work | 20 to 30 s, random |
| Requests in flight per node | at most 2 |
| Backoff after a failure | 5 s doubling to 10 min, with 20% jitter |
| Long-polls ending in a timeout or reset before the switch to short polls | 3 |
| Short-poll interval, and how long it lasts | 15 to 30 s, for 1 h, then long-polls are tried again |
| Wait of a panel sync for a remote node | 25 s, then "queued" |
| Deadline of an upstream preview job | 60 s |
| Usage report | at least every 30 s while there is traffic, at once at 80% and 100% of a known limit |
| Offset update threshold | other nodes moved a user by more than 1% of the quota or 64 MiB, and at once on 100% |
| Default maximum usage rate of a node | 1.25 GB/s |
| Node key rotation on schedule | every 180 days |
| Panel key rotation | the next key is used when every active node has acknowledged it, or after 30 days. The retired key stays 30 days. |
| Request body limit and read timeout of the web server on the subscription path | at least 1 MiB and 60 s |
| Opaque user id on a remote node | `u` and 12 base32 characters |

## Roles and keys

| Party | Holds | Where |
|---|---|---|
| Panel | The node-channel key: an X25519 key pair `skP`, `pkP` with a key id byte. It has a current, a next and a retired key, as the gateway key has. | `node-channel.key`, mode 600, next to the gateway key file. Separate from the gateway key, so that losing or rotating one never touches the other. Part of the backup. |
| Node | The node key: an X25519 key pair `skN`, `pkN`. The node's uid (16 bytes). The pinned panel keys (current and next). The panel endpoints (URL, pins, optional `via` outbound tag). The request sequence number. The last applied users revision. | `panel.state`, mode 600. Refused if group or others can read it, if it is not a regular file, or if the node's user does not own it. Read as hostile input. It is not part of the config document, so no config push can change it. |
| Panel, until used | The join secret `J`: 32 random bytes, stored hashed | Panel database |

Node 1 has no key and no channel. It is called over the control socket, with the same calls.

## The join code

The panel makes a node row in the state `pending` and shows the join code once:

```
vwjoin1.<base64url(object)>.<checksum>
```

The code uses the `coded` form of the pairing codes of [Node links](../node-links/): the same checksum, which is the first 4 bytes of a SHA-256 over the text before it.

| Member of the object | Size | Meaning |
|---|---|---|
| version | 1 byte | 1 |
| node uid | 16 bytes | Chosen by the panel |
| `J` | 32 bytes | The join secret |
| panel key id and `pkP` | 1 + 32 bytes | The panel's current node-channel key |
| panel endpoint list | variable | URLs and pins, from the panel's endpoint settings |
| expiry | 8 bytes | Unix seconds, at most 1 h after creation |

To be decided: the exact byte layout and the maximum length of the object (the endpoint list sets it). The pairing codes cap their offer code at 2,048 characters, which is the likely bound.

The code is a secret. It is shown once, never logged, and never in the audit detail. The operator gives it to the node at the terminal, never in argv (argv lands in shell history and `ps`).

## The join and the fingerprint

1. **Join.** `veilway join` (or `veilway.sh install node --join`) reads the code, makes `skN` and writes `panel.state`. It refuses a node whose running config has users, unless `--replace-users` is given, since the panel will own the users.
2. **Join request.** The node sends a request in HPKE AuthPSK mode: psk is `J`, psk_id is the node uid, sender key is `skN`, receiver key is `pkP`. The body carries `pkN`, the node's version, a host name hint, and its running config with secrets redacted and without users.
3. **Panel checks.** The panel opens it, checks the uid, the expiry and that `J` is unused, marks `J` spent, binds `pkN` to the row and sets the state `unconfirmed`. A second use of the same code gets the decoy answer.
4. **Fingerprint.** Both sides compute `hash = SHA-256("veilway v1 node join" || object || pkN || first request transcript)` and show the 8 groups of 4 hex digits that `pairing::Fingerprint::of` makes from it. The node prints its fingerprint in the terminal.
5. **Confirm.** The admin compares the fingerprint on the real host with the panel's, and types the node's fingerprint into the panel, with re-authentication. Only then does the row become `active` and the panel send users. Until then the node gets empty answers.

To be decided: the exact bytes of "first request transcript" (the sealed request as sent, or the plaintext header and body) and the encoding of the hash input (length prefixes).

Why both a secret and a fingerprint: the code travels through whatever chat the admin uses. Someone who copies it and joins first gets no user data, and the fingerprint the admin reads on the real host does not match theirs. The panel authenticates to the node because `pkP` came inside the code.

## Sealing

Every request and answer is sealed with HPKE (RFC 9180), in the suite of the subscription exchange: DHKEM(X25519, HKDF-SHA256), HKDF-SHA256 and ChaCha20Poly1305, from the `hpke` crate. The suite is fixed by `v1`. No part of HPKE is written by hand.

| Message | Mode | Sender | Receiver | `info` string |
|---|---|---|---|---|
| The join request | AuthPSK, psk `J`, psk_id node uid | `skN` | `pkP` | `veilway v1 node request` |
| Every request after the join | Auth | `skN` | `pkP` | `veilway v1 node request` |
| An answer | Answer key from the exporter of the request's context, as in RFC 9458 and the subscription exchange | the panel | the node | `veilway v1 node response` |

`info` is the string, one zero byte and the 7-byte header `key_id || 00 20 || 00 01 || 00 03`, as on the subscription page.

**Mutual authentication without signatures.** Only the holder of `skN` can make a request that opens under `pkN`. Only the holder of the panel's private key can derive the answer key. A node that has pinned `pkP` therefore knows an answer is the panel's, and the panel knows a request is the node's.

**Plaintext.** A small JSON header with `seq`, `sent_at`, `applied_rev` and `kind`, followed by a body compressed with deflate, then zero padding to the bucket. Requests use buckets of 4, 16, 64 and 256 KiB. Answers use 4 KiB up to 8 MiB in powers of 4.

To be decided: the exact plaintext layout (length fields in the style of the subscription page's `n`), the bound on the decompressed size (to refuse a compression bomb), and the exact exporter labels and lengths for the answer key. The aim is to copy the subscription exchange step by step and change only the strings.

**Wire.** `key_id || enc || ct`, with the top bit of the last byte of `enc` set to a random bit, as on the subscription page. Every request has a new ephemeral key.

**How the endpoint tells a node request from a subscription request, before any crypto.** A subscription request is exactly 1,073 bytes. A node request is never 1,073 bytes: its plaintext is a bucket of 4, 16, 64 or 256 KiB, so its body is 1 + 32 + bucket + 16 bytes. The endpoint reads the body length and dispatches. Same URL, `POST`, `application/octet-stream`. Anything that does not open is answered with the same decoy `not_found` as any unknown request: same status, headers, body and timing class. A removed node gets the same.

To be decided: how the panel finds which `pkN` to open an Auth-mode request with, since the receiver needs the sender's public key to open it. Options: (a) try the key of every active node, with the work bounded by a per-source limit and a cap on nodes; (b) a short tag in the clear that is derived from `pkN` and an hour, in the style of the tag table of the transports; (c) a first layer sealed in base mode to `pkP` that carries the uid and a second sealed Auth-mode layer. The design does not choose. Option (a) leaks nothing and costs one key operation per node.

Rate limits are per node. A key id that matches no panel key, a body that does not open, and a request for an unknown node count against the source's bucket like failed subscription requests.

## The request

Kinds: `join`, `poll`, `result`, `rotate`.

| Member of the header | Rule |
|---|---|
| `seq` | An integer that strictly increases per node. The node stores it in `panel.state` before sending. The panel keeps the last accepted value and refuses an equal or lower one. |
| `sent_at` | Unix seconds on the node's clock. Within 10 minutes of the panel's clock. |
| `applied_rev` | The users revision the node last applied. |
| `kind` | One of the four above |

A `poll` carries the usage report and asks for work. A `result` carries the result of a job. A `rotate` carries a new node key (see "Rotation"). A request that is replayed, out of window, or with a lower `seq` is refused with the decoy and counted.

To be decided: how `seq` works when two requests are in flight (a long-poll and a `result`) and may arrive out of order. Options: a window of recent values the panel remembers, one counter for polls and one for results, or sending `result` only when no poll is open.

## The answer

The answer is bound to the HPKE context of its request, so it cannot be moved to another request. Its members:

| Member | Meaning |
|---|---|
| Acknowledgement | The usage report it accepts, and the highest `seq` |
| Control jobs | Zero or more jobs, see "Jobs" |
| Users | The full users list of this node, with its revision, when `applied_rev` is behind (see "Sync") |
| `quota_offset` values | Inside the users list, per user |
| Endpoint list | An optional new list of panel endpoints |
| Next panel key | An optional next `pkP`, with its key id |
| Rotate | An optional request that the node rotates its key |
| Leave | An optional order to leave (see "Removal") |

To be decided: the exact JSON member names and the encoding of each member. The members above are the design's.

An answer that does not open under the pinned panel key, or whose context is not the request's, is dropped by the node and counted as a failure of the kind "bad answer".

## Jobs

A control call on a remote node is a job: a method, a path, an `If-Match` value, a body and a deadline. The node checks the allowlist again, runs the call in its own process against its own API router (so the API gains no listener), and returns the status and body, at most 256 KiB compressed.

The allowlist is the routes the panel uses today, nothing else:

| Route |
|---|
| `/v1/status` |
| `/v1/config` (GET, PUT, validate, diff) |
| `/v1/users`, `/v1/users/{name}`, `/v1/users/{name}/usage/reset` |
| `/v1/stats`, `/v1/sessions` |
| `/v1/exits`, `/v1/inbounds`, `/v1/links` |
| `/v1/upstreams` and its sub-routes |
| `/v1/replay/reset` |

Not `/v1/events`, which is a stream. A job for a route not on the list is refused by the node with a `refused` result and a log line. The node runs jobs one after another per node, so a job never races another on the config.

`GET /v1/config?users=omit` is a new query: the running document without `users` and without the `clients` of Xray inbounds, with the same revision. It keeps the node's upload small.

Editing a node's own part (inbounds, exits, routing, upstream previews, link pairing) needs the node online. When it is offline the panel says so and refuses the edit. Users and devices always change, and reach each node at its next contact. Upstream previews get the longer deadline of 60 s.

## Sync

The panel keeps one revision counter for users, `users_rev`, raised in the same transaction as any change that sets a dirty flag today. A node row has `wanted_rev` and `applied_rev`.

One sync, per node, is the steps of today's sync, through jobs:

1. `GET /v1/config?users=omit`.
2. The panel fills the users allowed on this node, with this node's addresses, secrets, ids and offsets.
3. `PUT /v1/config` with `If-Match`. A 409 retries up to 3 times, as today.
4. On 200, `applied_rev` is the `users_rev` at fill time. On refusal the row keeps the error text, cut to 300 characters, and the dirty flag stays.

**Catch-up** is the same sync. The panel always sends the whole users list for the node, never a diff, so a node that missed a thousand changes gets one document. A sync waits at most 25 s for a remote node, then returns "queued" and finishes when the node answers. One node's sync never holds another's lock.

**What is per node.**

| Part | Value on a remote node |
|---|---|
| Transport secret | `HKDF-SHA256(salt "veilway v1 node transport secret", ikm the device's stored secret, info the node uid, 32 bytes)` |
| Proxy password | The same derivation, shown per node on the user's proxy page |
| Xray client secrets | One per node, tag and user |
| User name | `u` and 12 base32 characters of `HMAC(node uid, user record id)`. The panel maps it back when it reads usage, sessions and stats. Node 1 keeps real names. |
| Device address | The device's address in this node's own pool |
| Device WireGuard key | The same public key on every node. Private keys never exist on nodes. |

To be decided: which HMAC hash and the exact input bytes of the opaque name, and the exact HKDF `salt` use (the design gives the salt string and the three inputs, not the byte encoding of `info`).

## Usage and quotas

**Reports.** Each `poll` carries, for each user that changed since the last acknowledged report, `[name, period_start, used_bytes, up_bytes, down_bytes]`. These are absolute counters, read from the engine's own state, the values `GET /v1/users` shows. The panel acknowledges the report in its answer.

**Merge.** The panel keeps one row per node and user for the current period.

1. A report with a repeated or lower-or-equal counter in the same `period_start` changes nothing. A replayed report adds nothing, so there is no double counting.
2. A counter that goes down within the same `period_start` means the node lost or reset its count. The old value is added to `banked_bytes`.
3. A report with a newer `period_start` starts a new row. A report for an older period is ignored.
4. The total for a user is the sum over nodes of banked plus used bytes in the panel's current period of that user.
5. A node's report is hostile input. Growth per report is capped by the node's maximum rate times the time since its last report (1.25 GB/s by default, a per-node setting). Anything above is clipped and logged at warn. An admin can stop counting a node, which removes it from every offset.

**`quota_offset`.** A user in config v1 may carry:

```json
"quota_offset": {"period_start": 1767225600, "bytes": 12345678}
```

`bytes` is a signed integer with an absolute value of at most `MAX_QUOTA_BYTES`. The field is valid only with `quota_bytes`. A node cuts the user off when `used_bytes + bytes >= quota_bytes`, and only while the node's own current period starts at `period_start`. In any other period the offset is ignored. Without the field, a node behaves as today.

- At a period boundary a node never cuts a user on the strength of last period's offset, even when it cannot reach the panel.
- A negative value is how a panel-side reset works: the panel sets offsets that cancel what each node counted, and the reset never has to reach every node.
- Periods are computed in UTC from `quota_period`, on the panel and on every node. A node whose clock disagrees by a few minutes ignores the offset in those minutes.

**Enforcement, "others' usage".** For node N and user U, `offset_N` is the sum of the other nodes' counted bytes, minus the reset baseline. Each node enforces the one limit against its own live counter. The panel sends a new offset when another node's report moved the user by more than 1% of the quota or 64 MiB, and at once when a report says a user crossed 100%, which answers the other nodes' waiting long-polls within seconds.

- The cut-off delay on the other nodes is one report plus one answer, about 1 to 30 s.
- The overrun is what the user moves through other nodes in that time. For a node out of contact, it is up to the quota that was left when contact was lost.
- Nothing is reserved, so a user is never cut early.

A stricter way, where the panel reserves a share of the quota for each node, uses the same field and needs no change in the core. It is not part of v0.3.0.

## Timing

- The node keeps one long-poll open. The panel answers at once when it has work, else after a random 20 to 30 s, under the idle limits of common web servers and CDNs.
- When a job finishes, the node posts its result in a second request without waiting for the poll. At most 2 requests are in flight.
- After a failure the node waits 5 s, doubling to 10 min, with 20% jitter. No failure is latched.
- After 3 long-polls that end in a timeout or reset, the node switches to short polls every 15 to 30 s for 1 h, then tries long-polls again. Each switch is logged at info.
- Endpoints are tried in order. A `via` names an outbound of the running config (`socks5` or `xray`). An endpoint whose `via` is missing from the config is skipped with a log line, not dropped.
- The panel may send a new endpoint list or a next `pkP`. The node keeps the old list until a request on the new one succeeds, so a wrong update cannot strand it.
- A node's counters (in `/v1/status` and `veilway doctor`): last contact, failures by kind, current endpoint, applied revision, mode (long or short poll).

The web server in front of the panel must allow a request body of at least 1 MiB and a read timeout of at least 60 s on the subscription path. The installer sets both when it writes the config.

## When the node cannot reach the panel

The node keeps serving the config it last applied. That config is in its file, so a restart changes nothing. Quotas keep working with the last `quota_offset`, and `expires_at` keeps working because it is a time.

Gaps until the next contact: a user disabled, removed or moved off the node, and a device removed, stay valid on that node. The panel shows "out of date since" on the node and on each affected user. An optional `stop_after_days` in `panel.state`, off by default, makes the node apply an empty user list after that many days without contact.

A node whose clock is off by more than 10 minutes cannot talk to the panel at all, and its row says so.

## Rotation

- **Node key.** The panel asks in an answer, or on a schedule. The node makes `skN'` and sends a `rotate` request under `skN` that carries `pkN'`. The panel holds both keys until the first request under `skN'` opens, then drops `pkN`. A node that is offline rotates at its next contact.
- **Panel key.** The panel puts a next `pkP` in answers. Nodes pin it. The panel switches when every active node has acknowledged it, or after 30 days, and keeps the retired key 30 days for nodes that were away.

## Removal

- **Remove a node** (re-authentication). If the node is online, the panel first sends a "leave" job: the node replaces its users with an empty list, deletes `panel.state` and stops the channel. In every case the row and `pkN` are deleted and later requests get the decoy. The node's pool addresses are freed, and users' documents drop its profiles at their next fetch.
- **This node was taken** (re-authentication). The same, without asking the node anything, with an audit entry, and with the option to rotate the panel's node-channel key so that a node that kept the old key cannot identify the panel's current one.

## Errors

| Case | What the panel does | What the node does |
|---|---|---|
| Body does not open, unknown key id, unknown node, replayed or out-of-window request | The decoy `not_found`, counted against the source | Counts a failure of that kind and backs off |
| Join code expired or already used | The decoy | Prints that the code was not accepted. It cannot tell expired from used, by design. |
| Node `unconfirmed` | Answers empty, no users | Waits, up to 1 h at the join, then keeps polling |
| Job route not on the allowlist | n/a | A `refused` result and a log line |
| Job result too large | n/a | Cut at 256 KiB compressed and marked as cut |
| Answer does not open, or is not bound to the request | n/a | Dropped, counted as "bad answer" |
| Clock outside 10 minutes | The decoy | Reports the clock difference in `veilway doctor` and `/v1/status` |
| Config refused by the node on `PUT` | Keeps the error text (300 characters) and the dirty flag, and shows the reason | n/a |

To be decided: the member names and codes of a result. The cases above are the design's.

## What each party sees

| Party | Sees | Cannot |
|---|---|---|
| The network, with TLS | The panel endpoint's host, the request sizes (buckets) and the rhythm | The content, the node's identity, the kind of request |
| The network, without TLS | Also the path, headers and the key id | The content |
| A CDN or front that ends TLS | The same as the network without TLS | Read or change anything, since the seal is end to end |
| A remote node | Its own config, the users on it as opaque ids, their device public keys and addresses, its own transport secrets and its own offsets | Another node's config, a user's name, any device private key, a secret valid on another node |
| The panel | Everything of every node it holds a key for, except secrets a node never sends (inbound private keys, transport keys, TLS keys), which return redacted | n/a |

## Security considerations

- **No listener on a remote node.** The control API stays on its unix socket. A job runs only a route on the allowlist, checked again on the node. The channel is counted in the node's connection limits.
- **The join code is a bearer secret for one hour.** It is shown once, spent on first use, and never logged. The fingerprint check means that a copied code alone gives a stranger nothing.
- **The fingerprint check needs a person.** An admin who does not compare the groups gives a copier the node. The panel makes the comparison a typed entry, with re-authentication, not a click.
- **Every answer is hostile input to the panel,** and every answer is hostile input to the node until it opens under the pinned key. Both read with size caps and strict JSON, and both have fuzz targets in the plan (`panel_channel`, `panel_node_request`).
- **A stolen `skN` or a seized node.** It can fetch that node's own config, its users as opaque ids with their device public keys, that node's transport secrets, proxy passwords and Xray secrets, report false usage within the rate cap, answer control calls with lies, and load the endpoint. It cannot read another node's config, change any user, sign a subscription, or speak as the panel to any node.
- **A stolen `skP`.** It speaks as the panel to every node, which is full control of every node. It is held like the gateway key and the signing key, and is in the backup.
- **A new HPKE composition.** Auth mode and AuthPSK have had no outside review. The page uses only the standard modes of the `hpke` crate, with test vectors, and an outside review is wanted before a beta.
- **The padding hides sizes, not the rhythm.** A request every 20 to 30 s from one server is a pattern a censor can learn.
- **Time.** The window of 10 minutes bounds replay of a request even for a node whose `seq` state was lost. A node that lost `panel.state` cannot rejoin without a new code.
- **A lost counter is banked, a replayed report adds nothing.** Usage totals can be too high only by a node's own over-reporting, which the rate cap bounds, and too low only by a node under-reporting, which only lets users pass the quota.
- **Per-node secrets.** A seized node cannot pass another node's transport proof, log in to another node's proxy inbounds, or use another node's Xray clients.
- **No failure is latched.** Every state in which a node refuses to talk (endpoint down, clock, bad answer, missing `via`) has a log line, a counter and an end.
- **Relay mirrors are not used** in v0.3.0. They forward only 1,073-byte bodies, and node sync needs larger ones.

## Open questions

- To be decided: the top answer bucket. The design says "4 KiB up to 8 MiB in powers of 4", and 4 KiB times powers of 4 gives 4 MiB or 16 MiB. Options: end at 4 MiB, end at 16 MiB, or use a final 8 MiB bucket.
- To be decided: the items marked above (join code layout, join transcript bytes, plaintext layout, exporter labels, how the panel finds the node key, `seq` with two requests in flight, JSON member names, opaque id hash).
- Whether node links between two nodes of the same panel should pair without codes, since the panel vouches for both.
- Whether stats history keeps per-node rows for 365 days or sums them after 30 days.
- Test vectors for the join code, a sealed join, a sealed poll and an answer, to be written by the same script that makes the subscription page's vectors.
