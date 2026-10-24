---
title: Several nodes from one panel
description: How one panel manages more than one node through node links, the management port inside a link, the routes a managed node serves, the limits, trial and rollback of pushed configs, usage and quota across nodes, per-node secrets, and what each party can do.
---

:::caution[Designed for v0.3.0, not built]
Nothing on this page is built. It is the design of the owner's decisions of 2026-10-24, written before the code so that the threat model (section 5.19) and the code can be checked against it. Where the design leaves a detail open, the page says so under "Open questions". No one outside the project has reviewed it. Do not rely on any of it.
:::

One panel can manage several nodes. The node that runs next to the panel stays on the control socket exactly as today and is called node 1. Every other node is **remote**: it is joined to node 1 by a [node link](../node-links/), and the panel reaches the remote's control API inside that link, through node 1's own control socket. Read [Node links](../node-links/) first. This page adds one thing to a link (a management port) and describes what the panel does with it.

Four rules shape the page:

- **Nothing new listens.** The control API stays on its unix socket. Management is a TCP port inside one link's WireGuard session. There is no new cryptography.
- **Trust runs one way.** Node 1 calls out and never accepts a call. A seized remote cannot call node 1 or any other node.
- **The managed side agrees in words, and the fingerprint covers it.** A remote serves management only because its operator said so at pairing.
- **A node that cannot be reached keeps serving.** It keeps its last users, limits and expiry.

## Numbers that are judgement calls

Every number on this page that was chosen, not derived, is in this table. None has a measurement behind it.

| Name | Value |
|---|---|
| Management port | TCP 47874 inside the link, fixed (47873 is the control channel) |
| Management connections per link | 4 at once on the remote (a fifth is reset), 4 at once on node 1 (a fifth waits up to 5 s, then `busy`) |
| Wait for a connection to open | 10 s |
| Deadline of a request | 30 s, and 75 s for the upstream preview routes |
| Request body | 4 MiB |
| Answer body | 8 MiB |
| Window per connection | 256 KiB each way |
| Trial of a pushed config | 120 s |
| Poll of a remote node's usage | every 30 s (node 1: every 10 s) |
| Default maximum usage rate of a node | 1.25 GB/s |
| Profiles in one subscription | at most 64 |

## Roles

| Party | Config | Does |
|---|---|---|
| Node 1 | A link with `manage: "peer"` for each remote | Opens management connections into the link. Never accepts one. Offers the relay route on its unix socket. |
| Remote | One link with `manage: "by_peer"` | Serves management connections from that link's peer, on the allowlist, and nothing else. |
| Panel | Node 1's socket | Keeps one row per node, syncs each, adds up usage, cuts users. |

A link's two halves are the usual ones (listener and dialler, entry and exit). Management is independent of both: either side may dial, and either side may be the remote. It needs a `listener` address and a `dialler` address, whatever the direction.

## Config members

On a link:

| Member | Type | Meaning |
|---|---|---|
| `manage` | `"peer"` or `"by_peer"` | `"peer"`: this node may call the other. `"by_peer"`: this node serves the other. Absent: no management. |

Rules, checked in validation:

- At most one `by_peer` link per node. One panel manages a node.
- A node with a `by_peer` link has no `peer` link. There are no management chains.
- `manage` is refused on a link that has an `upstream` carrier.
- A managed link has both `addresses.dialler` and `addresses.listener`, whatever its direction. A forward link otherwise has no use for the second address, and the offer of a managed one carries it.

## Pairing

The offer code of the node-links page gets one optional member:

| Member | Type | Meaning |
|---|---|---|
| `manage` | `"listener"` or `"dialler"` | The side that manages. The other side is the remote. When present, `addresses` must carry `listener` whatever the `direction`. |

`manage` is part of the offer object. The pairing hash and both fingerprints cover its bytes, so a code changed on the way to add or drop it shows as two different fingerprints. A node older than v0.3.0 refuses the offer as an unknown member, which is the right failure.

The remote's operator agrees in words:

- When the remote listens, it makes the offer with `veilway link offer --managed`.
- When the remote dials, `veilway link answer` names what the other node will be able to change (users, inbounds, exits, outbounds, links, upstreams) and needs `yes` typed.

Each side then writes its own `manage` into its own config. The local config is the authority: a remote serves only while its own entry says `by_peer`.

## Addresses

Both nodes read both in-link addresses from their own `links[]` entry. Nothing is learned at run time.

| | Node 1's in-link address (source) | Remote's in-link address (target) |
|---|---|---|
| Remote dials node 1 | `addresses.listener` | `addresses.dialler` |
| Node 1 dials remote | `addresses.dialler` | `addresses.listener` |

The target is a link address, never an address a user can send to: every link address is refused as a destination on both nodes. So a management packet is never a user's flow, and a user flow's answer never carries a link address as its source. On the listener, the extra address comes from its inbound pool and is reserved like a reverse link's.

Who is calling is decided by the link's WireGuard session the packet arrived on, as for the control channel. The source address only has to be routable inside the tunnel. A link to the same remote from another operator is a different link and is never served.

## The relay route

Node 1 gets one control API route:

```
ANY /v1/links/{tag}/api/{path}
```

It checks the path and method against the allowlist, checks that the link has `manage: "peer"` and is up, opens a TCP connection to the remote's in-link address on port 47874 (a userspace TCP stack, as the engine already uses for tunnel inbounds), sends the request as HTTP/1.1, and hands back the answer. One request uses one connection.

Only the method, the path with its query, `if-match` and `content-type` cross toward the remote. Only the status, `etag` and `content-type` come back.

| Status | Code | When |
|---|---|---|
| 404 | `no_such_link` | No enabled link of that tag |
| 403 | `not_managed` | The link has no `manage: "peer"` |
| 404 | `not_allowed_through_link` | The path or method is not on the allowlist (checked on node 1, and again on the remote) |
| 503 | `link_down` | The link is not up. Answered at once, with the state and the last failure in `details`, and no packet is sent |
| 503 | `busy` | Four connections are open and none freed in 5 s |
| 502 | `peer_refused` | The connection was reset: the remote does not serve management |
| 504 | `peer_silent` | No answer to the connection in 10 s, or the deadline passed |
| 502 | `answer_too_large`, `bad_answer` | The answer is over 8 MiB, or is not HTTP/1.1 |

## The management port

On the remote, one branch at the top of the ingress path, before any link rule, looks at a packet that came through a link:

- The link has `by_peer` and the packet is TCP to the remote's own in-link address, port 47874: it goes to the management listener. A small userspace TCP stack answers it, with at most four connections per link.
- Every other packet to a link address is refused exactly as today.

The accepted stream goes to the remote's own control API router, which has only the allowlist, with the API's usual limits and its own connection cap. On node 1, a packet from the remote's in-link address with source port 47874 goes to the live management connection it answers. Anything else from the remote's link address is dropped as today. In particular a connection attempt from the remote to node 1 is never accepted, because node 1 has no listener.

Management packets never enter the flow table, address translation, user or link quotas, the link's flow cap or the rules. They count in the link's traffic counters and in counters of their own (connections, refusals, bytes), shown in `GET /v1/links`.

## The allowlist

A managed node serves these routes, and no others:

`GET /v1/status`, `GET` and `PUT /v1/config`, `POST /v1/config/validate`, `POST /v1/config/diff`, `GET /v1/users`, `GET /v1/users/{name}`, `POST /v1/users/{name}/usage/reset`, `GET /v1/stats`, `GET /v1/sessions`, `GET /v1/exits`, `GET /v1/inbounds`, `GET /v1/links`, the upstream routes, and `POST /v1/replay/reset`.

Not the events stream, not `openapi.json`, and never `/v1/links/{tag}/api/...` itself: a managed node cannot be used as a hop.

## Pushing a config through a link

A config pushed to the remote that drops its own management link would strand it. Two guards run on the remote for a `PUT /v1/config` that arrived through a link:

1. **Refused at once** (422 `managing_link`): a document in which that link is missing, disabled, or has a different `id`, keys, addresses, `manage`, `inbound` or `peer`. The one exception is removal of the node (see "Removal"): a document that drops the managing link must then also have no users.
2. **Applied on trial.** The remote keeps the previous document and puts it back after 120 s unless a management request confirms it: one that comes through the same link at least 10 s after the push, over a WireGuard session made after it. Both ends open a new session within seconds of the push, so a config that breaks the next session is put back. The panel waits 12 s, then reads `GET /v1/status` every 5 s for up to 100 s. This catches what guard 1 cannot judge: the listen port or transports of the link's inbound, the `via` outbound, an MTU that breaks the path.

A push to node 1 is local and can always be undone from the panel. The panel still refuses a document for node 1 that removes a managed link outside "Remove node".

## Panel: nodes and sync

- Node 1 is the local node. Every other node is a link of node 1 with `manage: "peer"`, bound to a panel row by the link's `id`. The row has its own random 16-byte `uid` for derivations, so re-pairing a link changes no user's secret.
- A node's state is read from node 1's list of links at each upkeep pass. A node whose link is not up is skipped without a request.
- Each node has its own revision, lock, dirty flag and backoff. A change to a user marks every node the user is on as dirty.
- A sync is the panel's usual one: read the config, fill in the users, push with `If-Match`, retry a conflict up to 3 times, then read the status.
- A down node keeps its dirty flag and gets the whole users list at its next sync, never a diff. A lost answer to a push is settled by the next sync reading the revision.
- Edits that belong to one node (inbounds, routing, DNS, links, upstreams, Xray, profiles) need that node online. Users, devices, quotas and resets never wait.

## Usage and quotas

- The panel reads each user's usage from node 1 every 10 s and from each online remote every 30 s. The counters are absolute. A repeat changes nothing. A counter that went down inside the same period is banked. A newer period starts a new row and an older one is ignored.
- Growth per poll is capped at the node's maximum rate times the time since the last poll. A larger jump is clipped and logged.
- A user's total is the sum over counted nodes of the banked and current bytes of the panel's current period (UTC, the rules of the node's usage periods). An admin can stop counting a node.
- Every node gets the user's full quota and period, so each node still enforces it alone. That is a backstop, and it holds while the panel cannot reach the node.
- When the total reaches the quota, the panel writes `quota_bytes = max(1, that node's used bytes)` for the user on every node. Each node then cuts the user itself with the quota reason, so apps say "quota reached", not "disabled".
- At the next period each node's own count restarts, which lets the user in even before the panel's next sync, and the panel writes the full quota again.
- A usage reset in the panel is sent to each node at its next sync, with the full quota again.
- The overrun is bounded by one poll and one sync on nodes that are up, and by a full quota on a node that cannot be reached.

## Per-node names and secrets

- On a remote node a user's name is `u` and 16 base32 characters of HMAC-SHA256 under the panel's secret key, over a label, the node's `uid` and the user's record id. Node 1 keeps real names. The panel maps names back when it reads usage, sessions and stats.
- A remote node's transport secret is HKDF-SHA256 of the stored secret, with its own salt, and the node's `uid` as info. A proxy password uses the same derivation with its own label. Xray client secrets are made per node, tag and user.
- A device's WireGuard key stays one per device, and nodes hold the public half only.

These are uses of HMAC and HKDF as they are meant to be used, not new constructions.

## Subscriptions

A subscription carries one set of profiles per node the user may use, in node order. Node 1's profile ids are unchanged byte for byte, since apps key their consent and memory by id. Other nodes' ids are `<slug>-<id>`. A name gets the node's name in front only when the user has more than one node.

A node's profiles appear once that node has applied the device, and stay while it is down. The panel refuses a change that would pass 64 profiles and names the nodes and inbounds that add up. A node takes a new device within seconds, so a device's first document can leave out the nodes that do not hold it yet. While one is left out that way, the document's `update_interval` is 900 s, the shortest allowed, so the app comes back soon. A device pending confirmation reaches no node. Confirming it takes an address in every allowed node's pool in one step, and a node with a full pool is left out of that device's document, with a warning.

## Removal

- **Remove node.** The panel asks the remote, through the link, to apply a document with no users and without the managing link. This is the one change guard 1 allows, and it is not put on trial. The remote writes it to its config file and drops any trial, answers 202, and puts it in force 10 s later, since the answer goes back through the link it removes. A restart in between comes back emptied. If the answer is lost, the node may be emptied all the same, and the panel says to remove it as taken. Then the panel removes the link from node 1.
- **Taken.** If the node was seized or is gone, the panel skips asking and removes the link from node 1. After that nothing the node sends is served and nothing is sent to it.
- Either operator can remove the link from their own config at any time, which ends management at once.

## Offline behavior

A node that cannot be reached keeps serving its last config, including its local quota and each user's expiry. The panel shows "out of date since" on the node and on each affected user. Changes made meanwhile wait for the link. Nothing is latched: the state clears when the link is up again.

## Security considerations

- **No new listener.** A scanner finds nothing: the port is inside a WireGuard session and answers only that session's peer.
- **One-way trust.** Node 1 never accepts a management connection, a managed node cannot also manage, and the relay route lives on node 1's unix socket only. A seized remote can read and change that node, lie to the panel, and drop the link. It cannot call node 1 or any other node, and it cannot read another node's secrets.
- **Consent is in the offer.** `manage` is covered by both fingerprints, and the managed operator types `yes` or runs `--managed`. An older node refuses it.
- **The allowlist is the whole surface.** It is checked on node 1 and again on the remote. It is still full control of that node through its config. Secrets stay redacted in answers, and it is not a shell.
- **Management is separate from users.** It uses link addresses no user can send to, its own connections and caps, and its own counters. It never counts as a user's usage.
- **Answers are hostile.** The panel reads them with size caps and strict JSON. Only three headers cross.
- **A node can lie about usage.** The growth cap bounds how fast it can move a user toward a cut, usage is shown per node, and an admin can stop counting a node. A node that reports too little only lets users pass the quota.
- **A new parser.** The in-link TCP server reads packets from a link peer. It serves only a `by_peer` link, and its router has only the allowlist.
- **A taken panel or node 1** controls every managed node. Removing the link on the remote is the remote operator's answer.
- **No failure is latched.** A link that is down, a refused push or a rolled-back trial each has a log line, a counter and an end.

## Open questions

Each is listed with the default this page takes.

| Question | Default |
|---|---|
| Should a remote accept management through a second link to node 1, for redundancy? | No. One `by_peer` link per node in v0.3.0. A later version could allow several to the same peer. |
| Should a sync use `GET /v1/config?users=omit` to halve traffic on slow links? | Not needed for v0.3.0. |
| Does the userspace TCP stack move an 8 MiB answer over a 1280-byte path fast enough? | Assumed. The 4 MiB transfer test in the build measures it. |
| A panel with no local node | Later. v0.3.0 assumes node 1 runs next to the panel. |
| Test vectors for an offer with `manage` | To be written by the script that makes the node-links vectors. |
