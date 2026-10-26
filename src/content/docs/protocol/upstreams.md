---
title: Upstream providers
description: How a node uses another provider's Veilway subscription as an exit, what the other provider sees and can do, and the limits that hold whatever it sends.
---

:::caution[Built in v0.2.15, not reviewed from outside]
Upstreams are built on the node and in the control API. The panel's screens are not built yet. No one outside the project has reviewed them. Do not rely on any property described here.
:::

An upstream is another provider's Veilway subscription that a node holds one device on. The node uses it as the way out for an exit: users connect to the node as usual, and the traffic routed to that exit leaves through the other provider's network. Read [Node links](../node-links/) first. An upstream is a link whose far end is not a node of yours. The client engine of the apps runs inside the node, and the entry half of a [node link](../node-links/) does the rest.

Four rules shape the page:

- **The other provider is hostile.** Its document, its transports, its dial addresses, its control channel and every packet it returns are untrusted input. The operator trusts it with the traffic it carries, and with nothing else.
- **Nothing the provider sends reaches a device** except the answer to a flow that device sent through that exit.
- **An upstream exit that is down carries nothing, and nothing goes round it.** There is no fallback to the provider's default exit, to another exit of the node or to a direct connection.
- **Nothing latches.** Every failure is tried again, at a pace that grows to an hour or a day and no further.

## Numbers that are judgement calls

Every range written "a to b" is inclusive at both ends. None of these numbers has a measurement behind it.

| Name | Value |
|---|---|
| Upstreams on one node | at most 8 |
| Exits that name one upstream | 1 |
| Previews waiting or being fetched at once | at most 4 |
| Life of a preview | 600 s, then its place at the provider is given back |
| Wait for the provider to answer `leave` | at most 10 s |
| Time a profile may stay unconnected, while the provider cannot be reached or refuses, before the node tries the next one | 120 s |
| Refresh while the exit carries | the document's `update_interval`, held between 3,600 s and 86,400 s, plus up to 20% |
| Refresh after a refusal, an expired document or a refresh that failed | 3,600 s plus up to 20% for the first 24 h, then 86,400 s plus up to 20% |
| Wait before the tunnel is made again after it failed | 30 s, doubling to 3,600 s, plus up to 10%. A run that carried for 30 s or more starts the waits over. |
| Tunnel the provider stopped, or with nothing to try | asked to connect again after 3,600 s |
| Exit the provider refused | not asked for again for 3,600 s |
| Link `mtu` | the profile's, lowered by the engine to 1280 at the least (a profile below 1280 keeps its own) |
| Notices kept | 8, of at most 200 characters each |
| Exits of the provider shown | 16, tags of at most 64 characters |
| Provider name and profile names shown | at most 80 characters |
| Refresh hosts shown | at most 16, of at most 200 characters |
| Usage warning in the log | at 90% of the quota |

## Config

An upstream is an entry in `upstreams`, and an exit uses it with the backend `{"type": "upstream", "upstream": "<tag>"}`. The [config reference](../../reference/config/) has the schema.

| Field | Required | What it does |
|---|---|---|
| `tag` | yes | The upstream's name. Not `preview`: the control API uses that word for its preview route. |
| `link` | yes | A native `veilway://sub/` link of the provider. It holds the account's token, so it is a secret. Carried, file, legacy and plain links are refused. |
| `signing_key` | yes | The provider's signing key that the operator confirmed, as the fingerprint (8 groups of 4 hex digits) or the key (43 characters of base64url). The key in the link must be this one. |
| `private_key`, `device_secret` | yes | The node's device key and device secret for this provider, both secrets. The operator's panel makes them. |
| `profile` | no | The profile of the document to use. Without it every profile is tried in the document's order (automatic). |
| `failover` | no | With a `profile`: also try the other profiles when that one cannot be used. Off by default, so a named profile is the only one used. |
| `transport` | no | The transport type to connect over: `udp`, `udp-obfs`, `tls`, `ws`, `ws-plain`, `fronted` or `fronted-shaped`. Without it the engine picks from the profile's transports. |
| `exit` | no | The provider's exit to leave through. Without it the provider's default, which the provider chooses. A change of it alone is taken on the running tunnel. |
| `via` | no | A `direct` or `socks5` outbound the node reaches the provider through, for the fetch and for TCP transports. `udp` and `udp-obfs` cannot go through a `socks5` outbound, and a profile that lists nothing else is not used. A proxy on a loopback, unspecified or link-local address is refused. |
| `allow` | no | Classes of transport besides `cover` that the node may use: `no_cover`, `exposed`, `plain`. Empty: `tls`, `ws`, `fronted` and `faketls` only. |
| `allow_private` | no | Whether the provider may have the node dial private addresses. Off by default. |
| `enabled` | no | On by default. A disabled upstream is checked and neither fetched nor connected. |

Validation refuses a link that is not a native one, a link whose key is not `signing_key`, two upstreams with one account or one device key, two exits for one upstream, an unknown `via` and the tag `preview`. A node link may not leave through an upstream exit. `veilway check` warns about an upstream no exit names, an upstream with no `exit` set, an upstream exit while `routing.fallback` exists (users then fall back while the provider is down), and an exit nothing routes to. Add a rule that refuses `tunnel:users`, as for any exit.

The node needs a state file it can write. `veilway run` keeps it as `upstreams.state` next to the usage state file. The link and the two secrets are read as secrets, shown as markers in the control API, and a marker sent back stands for the running value only while the tag and the link are the running ones.

## Enrollment

Enrollment is the fetch. It runs on the node, so the other provider sees the node's address and never the panel's. The operator goes through three steps, which mirror the consent of a user to a new provider.

1. **Link and fingerprint.** The panel reads the link without the network and shows the provider's host and the fingerprint of its signing key. Nothing has been sent.
2. **Fetch and review.** The panel makes the device key and secret and calls `POST /v1/upstreams/preview`. The node fetches the document with that device, which takes a place at the provider, checks it under the key in the link, and keeps it in memory under an id for 600 s. The answer holds the provider, the profiles with their transport kinds, classes and rating, the private addresses they name, the exits, the quota, the expiry, the device limit, and for each profile why this node would not use it. Nothing is written to the config or the state file. A device limit that is reached fails here, and nothing is stored.
3. **Confirm.** The operator confirms with re-authentication, and the panel applies a config with the new upstream. The node takes the document it was shown and asks the provider for nothing. If the preview ran out, it fetches with the same device. Either way the document must be signed by `signing_key`, or it is refused and its place given back.

`POST /v1/upstreams/preview/{id}/decline` says no: the provider is told to release the place. A preview that is not answered in 600 s is released the same way. At most 4 places are taken at once, counting fetches still running, and a fifth is refused. A preview of the same link and device again replaces the older one.

The users are not asked. The operator is adding a second provider to their path and must tell them.

## The carrier

The node runs the client engine for one device of the subscription: WireGuard over the profile's transports, its choice of candidates, its control channel and its MTU walk. The upstream is a link in the node's plan with the profile's device addresses as its own, and the exit that names it is a `chain` exit over that link. The entry half of [Node links](../node-links/) applies unchanged: the translation of every flow to the link's address and port, the filtering of what comes back, the ICMP errors and the clamp of the segment size.

- **Only answers come back.** A packet out of the tunnel is delivered to a device only when it answers a live flow of a device routed through this exit. Everything else is dropped and counted. While the carrier is not up, nothing from it is delivered at all.
- **No flow reaches the provider's gateways.** The gateways of the profile in use are where the engine keeps its control channel and probes. A flow routed to the exit that is addressed to one of them is refused on any port, as a DNS server of the node's resolver and as a destination of the Xray add-on's hop. The refusal covers the flows of this exit only.
- **The Xray add-on cannot use the exit.** What the add-on routes to an upstream exit is refused as unsupported.
- **DNS** for these flows is asked by the node's resolver through the exit, so the provider answers it.
- **Up** means the tunnel is connected and, when `exit` is set, the provider says that exit is the one in use. Until the provider has listed its exits the carrier is down. If it does not offer the exit, or refuses it, the exit stays down and is asked for again after an hour.
- **Down** has a reason in plain words: the provider stopped the connection, the document ran out, the profile cannot be used, and so on. Every change is logged at info once, and `GET /v1/upstreams` shows it.

### Dial addresses

A provider names where the node connects. The node refuses a profile if any address it can dial is loopback, link-local, multicast, unspecified, IPv4-mapped, inside one of the node's inbound pools, an address of the node itself, or private or shared (the `geoip:private` ranges) while `allow_private` is off. One refused address makes the whole profile unusable, and the reason says how many were refused, never which. The check runs before the engine sees the profile, at every start, and again whenever a refresh changes the profile's keys, addresses, MTU or candidates. Which transports the node may use is the operator's: `cover` classes, and the ones `allow` adds. A profile marked unsafe is never used. `faketls` and other alpha transports are not used.

### What the control channel may do

The engine's control channel reports the provider's exits, the device's usage, notices and `bye`. The node shows them to the operator and applies one thing: a lower MTU, never below 1280 (or the profile's MTU if that is lower) and never above the profile's. Text from the provider is cut and stripped of control, zero-width, separator and direction characters. Nothing from the channel changes routes, addresses, resolvers or the exits the node's own users see. An oversized packet of a user gets the ICMP error with the link's MTU.

## Choosing the profile, the transport and the exit

From v0.3.6 the node chooses as the apps do. Three keys steer it, and each can be left out for automatic.

- **Profile.** Without `profile` the node tries every profile of the document in its order, starting with the last one that carried (kept in memory only). With `profile` and no `failover` it uses that profile alone, as before. With `profile` and `failover: true` it tries that one first, then the rest.
- **Transport.** Without `transport` the engine picks among the profile's transports, keeps what worked and moves on when one is blocked. With it, only that type is used. The classes in `allow`, the datagram check for a `socks5` `via` and the rules for `faketls` (alpha, not used by the node) still apply, and a type outside them is refused when the config is checked.
- **Exit.** `exit` is the provider's exit to leave through. A change of `exit` alone does not make the tunnel again. The node asks the running tunnel for the other exit. The carrier stops carrying at that moment and carries again only once the provider says the new exit is the one selected for the device, so nothing leaves through the old exit in between.

Failover is bounded, so that a provider cannot walk the node through its profiles:

- A profile is given up when its tunnel failed, when it has not connected for 120 s while the engine says the provider cannot be reached, refuses or answers wrongly, or when the pinned exit is not one it offers.
- A device that is offline, and a provider that stops the account on purpose (quota, expired, disabled, stopping), never move the node to another profile.
- Every profile is held to the same checks before its tunnel starts: the dial addresses, the datagram check, the allowed classes and the chosen transport. One that fails is skipped with a reason shown to the operator and never an address.
- The profiles that failed make a round, kept in memory. The next attempt skips them. When all have failed the round starts over with the usual wait, which doubles to an hour.
- The engine's memory of what worked is one store per upstream, shared by its profiles, so its hourly budget of new addresses covers all of them.

## Refresh and failure

The node refreshes the document in a task of its own, so packets go on while the provider answers. The interval is the document's, held between an hour and a day, plus up to 20%.

- **A refusal, a revoked account or a document that ran out** takes the exit down. The node refreshes every hour for the first day, and every day after that. The first successful refresh lifts it.
- **A refresh that fails for another reason** (the network, a bad answer) leaves a working tunnel alone and is logged once.
- **A refresh that changes what the tunnel was made from** (the profile's keys, addresses, MTU or candidates) makes the tunnel again, after the checks of a start, and the exit is down meanwhile. Its flows end, so they are decided again against the new profile. One that does not, leaves it alone.
- **A tunnel that ended** is made again after 30 s, doubling to an hour. A device the provider cut off is asked about again every hour, so nothing stays down for ever on the word of a moment.
- **The last refresh attempt** is kept across tunnel restarts, so a provider that keeps ending the tunnel cannot starve the refresh.
- **A key rotation** is taken only from a document signed by a key the node already holds. A key that was never held is refused. If the state file is lost after a rotation, the reason gives the new key's fingerprint, and the operator must confirm it and use the provider's new link.
- **A move of the subscription endpoint, and new refresh hosts,** wait for the operator. The old endpoint and hosts are used meanwhile, and `GET /v1/upstreams` shows what waits. `POST /v1/upstreams/{tag}/confirm` confirms the move, the hosts or both, and a confirmed move is tried at once.
- `POST /v1/upstreams/{tag}/retry` asks the tunnel to connect now and starts every wait over.

The refresh goes from the node's host, or through `via`. Through a `socks5` outbound the proxy looks the provider's name up itself, so the node's resolver never sees which provider is asked. Plain `http` links are refused through such a proxy, and on the direct path the node's own addresses are dropped from what a name resolves to.

## State file

The signed document of each upstream with its keys and the operator's answers about hosts and moves is kept in `upstreams.state`. The per-device transport secrets are in the document, so the file is as secret as the config. The node does not read or replace a file that is not a regular file owned by its own user, or that group or others can read, and it says why. It repairs nothing. A write is a new file beside it, synced and moved over. What is read is hostile input: bounded in size, entries and tag length, and every document is verified again under its held keys. The link, the device key and the device secret are never written to it. The file is bound to the link and the device's public key: a config that points a tag at another link or device finds nothing held. A lost file is fetched again with the same device, only under `signing_key`. An entry whose upstream left the config is removed from the file at the next reload. A removal mark (the tag and the binding, at most 8) stays until a config without that tag or binding is in force, so a restart does not enroll the device again. The marks hold no secret.

## Removing an upstream

`DELETE /v1/upstreams/{tag}` tells the provider that the device left, waiting at most 10 s. The answer's `confirmed` says whether the provider took the word. When it did not, the document and the keys stay in the state file, and the same call tells the provider again. When it did, they are removed. The upstream stops at once, and its removal mark keeps a config that still names it from starting it, even after a restart. Apply a config without it, or one with another link or device, to finish. A config applied without the upstream, with no call to this route, never tells the provider anything: the place stays until the provider removes it.

## What the provider sees

It sees the node's address, one device, and for the flows routed to it every destination, DNS name, unprotected byte and the timing, all mixed together. It does not see the node's users, their tunnel addresses, their device keys or the other exits.

The provider can inject packets (dropped unless they answer a live flow), forge DNS answers, send hostile documents and control messages, name addresses for the node to dial, cut the device off, refuse the account, and correlate the flows of all the users routed to it. It cannot reach users unasked, the node's host or networks, or change the node's routes, addresses or resolvers.

Not defended: anonymity from the provider, the integrity of DNS answers and unprotected content, and availability. See the [threat model](../../security/threat-model/) section 5.15 and the [operator guide](../../guides/upstream-provider/).

## Control API

| Route | What it does |
|---|---|
| `GET /v1/upstreams` | Every enabled upstream: phase (`fetching`, `connecting`, `up`, `down`), reason, provider, the fingerprint of the signing key in use (`signing_key`), profile, transport and exit in use, quota, notices, MTU, last refresh and why one failed, a move or hosts that wait, and counters. Since v0.3.6 also the tunnel's own state and how long it has been connected, the transports of the profile in use, every profile with whether it is usable and why not, the provider's exits with the selected one, the provider's notices with their severity, the quota's period and the account's end, and the choice the config makes now. No key, secret, link or address. |
| `PATCH /v1/upstreams/{tag}` | Changes `profile`, `failover`, `transport` and `exit`, and nothing else. A field left out stays, and `null` is automatic. A body with any other field is refused, so the link, the keys, `allow`, `allow_private` and `via` cannot be changed this way. The result goes through the same checks and the same apply as a pushed config, at the revision that runs now, and is saved to the config file. Only `exit` is taken on the running tunnel (`live: true` in the answer). |
| `POST /v1/upstreams/preview` | Step 2 of enrollment. |
| `POST /v1/upstreams/preview/{id}/decline` | Gives a preview's place back. |
| `POST /v1/upstreams/{tag}/confirm` | Confirms a move, new refresh hosts or both. Without a body both. |
| `POST /v1/upstreams/{tag}/retry` | Connects now. |
| `DELETE /v1/upstreams/{tag}` | Removes the device. `confirmed` in the answer says whether the provider took it. The same call again tells it again. |
