---
title: Node links
description: How two Veilway nodes are joined so that users connect to one and their traffic leaves from the other, how the two are paired, and what each can do to the other.
---

:::caution[Draft]
This page is a draft specification. Node links are built: the entry's translation and the link state in the node (`veilway-core`), `veilway link offer` and `veilway link answer`, and the panel's pairing screens. No one outside the project has reviewed it, and the key agreement at pairing is new. Do not rely on any property described here.
:::

A node link joins two nodes. Users connect to one of them, the **entry**, and their traffic leaves from the other, the **exit**. The two nodes may belong to two operators. Each has its own config and its own panel, and neither controls the other. Read [Protocol overview](../overview/) and [Transports](../transports/) first: on the wire a link is nothing new. It is one device session on a native transport, with WireGuard inside, exactly as a user's connection is.

Three rules shape the page:

- **A link reuses what exists.** The listening side treats the link as a peer on a `veilway` inbound. The dialing side runs the client side of the transports. No new wire format or proof is added. Pairing adds one key agreement, from parts the protocol already uses.
- **Neither node takes the other's word.** The exit applies its own gate, rules and limits to everything that arrives. The entry delivers only what answers a flow it sent.
- **A link that is down carries nothing, and nothing goes round it.** Traffic routed to it is answered as unreachable.

## Numbers that are judgement calls

Every range written "a to b" is inclusive at both ends. None of these numbers has a measurement behind it.

| Name | Value |
|---|---|
| Lifetime of an offer code | 600 s by default, at most 3,600 s |
| Offer code | at most 2,048 characters |
| Answer code | 123 characters |
| Links on one node | at most 64 |
| Parallel links behind one `chain` exit | 1 to 4 |
| Flows of one link at the exit | 16,384 by default, set by the exit's operator |
| ICMP errors and resets the exit sends a link | 200 at once, then 100 a second |
| Direct pings of one link at the exit | 256 |
| Translated ports and echo identifiers at the entry | 1024 to 65535, drawn at random |
| Rest before a translated port is used again for the same remote address and port | 120 s |
| Hop limit the entry writes on a packet it sends into a link | 64 |
| Hop limit a node writes when it continues a link's packet into another link (`allow_chain`) | the received one, at most 64, minus 1 |
| Lowest hop limit a node writes into a link | 62, so a chain has at most 3 links |
| Time a pin of a `tls` transport is shown as changed | 30 days |
| A pasted answer waiting for its confirmation | until the offer's `expires_at`, then the pairing is discarded |
| A size warning on a link | cleared 600 s after the last report |
| A link reported as "ended or misconfigured" | after 24 h of nothing but refusals, or 24 h without a handshake. From then on the dialler tries once a day. |
| Link `mtu` | 1280 to 1500, default 1390 when the link lists `udp-obfs`, 1420 otherwise |

Reconnection uses the client's waits from the transports page and adds no numbers of its own.

## Roles and directions

A link has two pairs of roles, and they are independent.

| Role | What it does |
|---|---|
| Entry | Has the users. Sends their packets into the link and delivers the answers. |
| Exit | Sends what arrives from the link out to the internet, under its own rules. |
| Listener | Has a `veilway` inbound that the link connects to. Its address must be reachable from the other node. |
| Dialler | Opens the transport session, with the client side of the transports. Its address need not be reachable from outside at all. |

| Direction | Listener | Dialler | Use it when |
|---|---|---|---|
| Forward | Exit | Entry | The entry can open connections outwards. The exit's address is known to the entry and reachable from it. |
| Reverse | Entry | Exit | The entry cannot open connections outwards, or its outward connections are filtered, while connections into it pass. The exit needs no reachable address. |

In both directions:

- The dialler is the WireGuard initiator, starts every handshake and every rekey, and follows the client rules of the transports page (keepalives, opening packets, reconnecting). The listener follows the node rules. Nothing on the transports page changes for a link.
- One WireGuard tunnel carries packets both ways. Which way users' packets flow depends on the roles above the transport, not on who dialed.

Above the transport the two halves behave the same in a forward and in a reverse link. Only who dials differs.

## A link is a peer on an inbound

On both nodes a link's identity is the dialler's WireGuard public key for it. On the listener, a link is a peer on a `veilway` inbound: a WireGuard public key, a transport secret, and one tunnel address per family from that inbound's pool. It is found by its tag, proves itself, is bound to its WireGuard key, is rate limited and can be cut off as a user's device is.

It is a new kind of peer, and not a small exception to a device. In the engine a peer leads to a device and a device to a user, for counters, limits and the memory of names. A link has no user. It has counters, limits and rules of its own, listed under "What each node enforces". Validation refuses a link whose key is also a device's.

A separate inbound type for links was considered and not chosen: it would repeat the listener, the proof, the replay rule and the pools. What a link's peer does differently from a device is this, and nothing else:

- It is never served the control channel.
- When the listener is the entry (a reverse link), its ingress check is the entry half's rule under "Addressing", not "a device sends only from its own addresses".
- When the listener is the exit (a forward link), it is held to the exit half's rules and limits.
- **Until one device can no longer crowd an inbound's packet queue, an inbound that carries a link carries no users' devices.** An inbound's queue is shared by all its peers today (threat model G7), and a link is by nature the heaviest peer on it. A link therefore has an inbound to itself, or shares one only with other links. That costs the link a listen address of its own for `udp-obfs`, which an observer can tell from the users' one. Two links on one inbound can still crowd each other.

## Addressing

### The choice

The entry's users have tunnel addresses from the entry's pools. What source address should the exit see?

| | The user's own address | One address for the whole link |
|---|---|---|
| How | The entry forwards packets unchanged. | The entry translates every flow to the link's address, as a home router does. |
| What the exit is given | A stable address per user device, for as long as the user has it. It can count users and follow each one over time with no effort. | One address. |
| What it needs | Pools that do not overlap between two operators, routes at the exit back to every pool, and an exit that accepts sources it cannot check. | A translation table at the entry. |
| What it costs | The exit must trust the entry about which source is which user, which this page forbids. | Protocols without ports are limited, see below. |

Version 1 uses one address for the whole link. The entry translates.

### The link's addresses

Pairing fixes the dialler's address, one per family, from the listener's inbound pool. It is the link peer's address. A reverse link fixes one more, the listener's link address, also from that pool and reserved for this link. A forward link has no use for a second address and has none.

The entry's link address is the dialler's address in a forward link and the listener's link address in a reverse link.

| Half | Rule |
|---|---|
| Entry | Rewrites the source of every packet it sends into the link to its link address, and remembers the flow. From the link it accepts only a packet whose destination is its link address and that answers a remembered flow. Everything else from the link is dropped and counted. This is the rule the `l3` exit has for what its interface hands back. |
| Exit | Accepts from the link only a packet whose source is the entry's link address. It answers to that address. Everything else is dropped and counted. |

Two more rules keep the link's addresses out of everyone else's way:

- A link address is never a destination for delivery, on either node, whatever the routing rules say. A user's packet to a link address is refused. Without this, a user of the listener's inbound could send to the link's address and the packet would be delivered into the link with the user's own tunnel address on it.
- At a dialler, a link's addresses belong to that link and are looked up only for it. Two links from two other operators may carry the same addresses, since each took them from its own pool.

The node that pastes an offer refuses it when an address in it lies inside one of its own inbound pools. On a node that dials two links as the exit half, the two cannot carry the same entry address.

### Translation at the entry

- **TCP, UDP and SCTP.** The source address becomes the link address and the source port a port drawn at random from the range in the table of numbers. A flow keeps its translation for as long as the flow table keeps the flow. When a flow has gone, its port is not given to a new flow to the same remote address and port before the rest time has passed, because the exit forgets flows by its own clock and may still hold the old one. The rest time is a guess against idle times that can be longer. Ports are drawn at random from about 64,000, so a clash is rare, and an exit treats a TCP opening packet on a flow it still holds as a new flow.
- **Ping.** The echo identifier is translated in the same way. A translated identifier counts against the device's and the user's shares of the flow table, like a flow, and when the table is full the ping is answered with an unreachable error.
- **Other ICMP from a user** is not sent into a link. Every ICMP message but an echo request carries the user's own tunnel address inside the packet it quotes, and translation would have to rewrite a packet the user chose.
- **Checksums** are corrected for every rewritten packet: TCP, UDP and ICMPv6 cover the addresses, and SCTP has a checksum of its own over the whole packet.
- **ICMP errors** that arrive for a translated flow are found by the packet they quote, translated back, quote included and with the quote's checksum corrected, and delivered to the user's device. An error that quotes nothing the entry sent is dropped.
- **IPv6** is translated in the same way, to the link's IPv6 address. That is address translation for IPv6, which the protocol's designers did not want, and it is chosen here for the privacy reason above.
- **Other IP protocols** have no ports to tell flows apart. For each protocol and remote address, one user at a time holds the translation. Another user's packet to the same remote address under the same protocol is refused with an ICMP error until the first flow has gone idle. A user can hold a remote address on purpose and so keep others from it under that protocol.
- **Fields that are rewritten on every packet sent into a link**, because they show which device a packet came from: the hop limit is set to the value in the table of numbers (64 from an entry, one less at each middle node, see "Chaining"), the IPv4 identification field is drawn anew, the IPv6 flow label is set to zero, and the traffic class is set to zero with its two congestion bits kept. A fixed hop limit has a visible cost: a user who traces a route through a linked exit sees nothing between the entry and the destination.
- **Packets the entry makes itself.** The entry's resolver sends its lookups through the exit a flow was routed to, and the node may send a ping on a user's behalf. Through a link these are packets like any other: their source is the entry's link address, they take a translated port or identifier, and they count against the exit's cap for the link. The resolver asks through a `chain` exit over UDP only, and an answer that arrives truncated stays truncated for the user's device, which can ask again over TCP itself.
- **No policies for what an exit cannot carry.** A `chain` exit carries whole packets of every IP protocol, so the per-exit `unsupported` policies of the config reference do not exist for it. What the far node cannot carry, the far node refuses.
- **Answers do not keep a flow alive by themselves.** An answer from the link never extends a flow that is closing or closed, and refreshes a flow's idle time only while the device itself has sent on that flow within its idle time. An exit cannot hold the entry's table full by sending.
- **The table.** Finding a flow from a translated port needs a second index beside the flow table. It holds one entry per flow and is bounded by the flow table's own limits. A user's flow limits are those of the config reference.
- **When the exit's cap for the link is reached,** the exit refuses the flow with an ICMP error or a reset, and the entry passes that back to the user as it passes any answer.

### What the exit learns about the entry's users

Translation keeps users' tunnel addresses from the exit, and it removes the fields above. It does not make the entry's users look like one.

- **The exit is not given:** a user's tunnel address, key or name, the number of users, or a mark of which flow is whose.
- **The exit sees:** every destination, every DNS name that the entry's resolver asks through it, the volume and timing of the traffic, and the entry's address.
- **The exit can still tell devices apart, and often count them.** A forwarded packet keeps what the entry cannot cheaply rewrite: the timestamps and options of TCP, initial sequence numbers, how a device sizes its windows, and the timing of its packets. Counting hosts behind an address translator from such fields is a known technique. One device is the same device across all its flows, so its flows can be tied together, and a user who is tied together once can be followed for as long as they stay. When the exit's own backend ends TCP connections itself (`netstack`), these fields end at the exit and go no further. The exit node itself has read them either way.
- With few users, or one, the sum is the user.
- Through a chain (`allow_chain`), the last exit sees the middle node's link address and not the first entry's. The middle node reads everything the last exit would, for the flows it forwards.

A user who must not be told apart by the exit's operator has no protection from this page. The protection it gives is narrower: the exit holds no address or key of a user, and nothing in the link tells it who is who.

## What each node enforces

**The entry** treats the link as one exit, of the backend `chain`.

- Its own users, quotas, expiry, routing rules and entitlement decide who may use it, as for any exit. Usage is counted per user before translation.
- It shows in the exit catalog with a name and a country, marked as leaving through a second node (see "Ratings and what users are told"). The country, and whether the exit carries every IP protocol, depend on the other node. In the catalog they are the entry operator's statement.
- The destination gate of the config reference applies before a packet is sent into the link.

**The exit** treats the link as one peer and trusts nothing it says.

- **Source.** The source check above. A hostile entry cannot send from any address but one.
- **Destinations that are always refused for a link,** whatever the routing rules say: everything the destination gate refuses, every address inside any inbound pool of the exit, and every link address. A link never reaches the exit's users. This does not rest on rules the operator wrote for users, since a config without those rules is valid.
- **Private networks** are refused for a link unless the link has `allow_private` set, and are then decided by the rules.
- **Rules.** A routing rule can match on `link`, a list of link tags. A link has a default exit of its own, `exit`, used when no rule names one, and a list of exits it may leave through. Both are set by the exit's operator.
- **Port 53.** `dns.hijack` does not apply to a link. Its DNS traffic was already answered by the entry's resolver, which chose its own servers, and it is routed like any other flow. So a link uses none of the exit's waiting queries and none of its memory of names. One consequence must be known to the exit's operator: the exit never learns which name an address of a link's flow was looked up for, so a rule of the exit that matches by `domain` never matches a link's traffic. A block by name does not cover a link. Validation warns when a rule with a `domain` condition could apply to a link.
- **A link leaves through another link only with `allow_chain`.** It is off by default. Validation refuses a link that is entitled to a `chain` exit without it, directly or through a `via` policy, and through a balancer once the config has balancers. The engine also refuses, at the moment it decides a flow, to send a packet that arrived from a link into a link when the link does not allow it. An `upstream` exit is never allowed. With `allow_chain` the hop rule of "Chaining" bounds the chain. This binds nodes that follow this page. A node that does not could forward on, and no other node could tell. What bounds the cost then is the link's caps.
- **Limits of a link**, each its own and not a user's share: flows, ICMP errors and resets, and direct pings, with the values in the table of numbers, and an optional quota and expiry.
- The exit counts bytes and packets per link.

Neither node can read or change the other's config, see the other's users, or learn more of the other's state than "the link is up".

## Pairing

Pairing is done by two people, each at their own panel, with two short texts that they pass to each other. No node fetches anything, no private key travels, and neither text holds a secret.

### Two codes

1. **The listener's operator creates the link** and gets an **offer code**. In a forward link that is the exit's operator, in a reverse link the entry's.
2. **The dialler's operator pastes the offer.** The panel checks it, shows every address the link would dial, generates a new WireGuard key pair and a new pairing key pair for this paste, and shows an **answer code**.
3. **The listener's operator pastes the answer.** Both panels now hold the same pairing hash, and each shows its own value made from it.
4. **Each operator types the other side's value.** Each panel shows its own value, all 8 groups. Each operator reads it to the other over a channel they trust, and types the 8 groups they were told into their own panel. A panel accepts the link only when what was typed equals the other side's value, which it computes itself. Its own value is refused. There is no button that confirms without it.
5. Only then is the link put into that node's config, and only then does the listener's tag table hold the link.

A single code that carries everything, a private key for the dialler included, was considered. It needs one paste, and it puts a private key into chat histories and clipboards, and whoever copies it can be the dialler. With two codes each side makes its own private keys.

**New keys for every paste.** Every paste of an offer makes a new WireGuard key pair and a new pairing key pair on the dialler and discards any made before. A panel never shows one answer for two offers, and never shows an answer again once it has left the screen. An offer that was answered once is spent on the dialler too: pasting it again is refused until it has expired. The reason is the length of the fingerprint. Sixteen bytes are enough because someone in the middle has to send its altered offer before it has seen the dialler's keys, and must then hit one fixed value. If it could see an answer first, it could search for two codes that collide, which takes far less work. Nobody should shorten the fingerprint or cache an answer.

**Between the paste and the confirmation.** A pairing that is not confirmed is held in the panel's memory only: the open offer and its pairing private key on the listener, and the new WireGuard private key, the pairing private key and the derived secret on the dialler. Nothing of it is written to disk, so that no private key and no secret of a link that was never agreed outlives the attempt. A restart of the panel cancels every pending pairing, and the operators start again with a new offer. A pasted answer must be confirmed before the offer's `expires_at`. After that the pairing is discarded with everything made for it.

**When only one operator finishes.** Each panel puts the link into its own node's config when the other side's value typed into it matched. If the other operator never finishes, the other node never has the link. The node that has it reports "connecting" and then "ended or misconfigured", carries nothing, and its operator removes the link. Nothing is half trusted: a link works only when both nodes hold it, and each holds it only after its own check.

### The link's transport secret

Neither code carries it. Each side makes a fresh X25519 key pair for this one pairing and puts the public half in its code. When the answer is in, both sides compute:

```
shared = X25519(own pairing private key, the other side's pairing public key)
S      = HKDF(salt = "veilway v1 link secret", ikm = shared, info = pairing hash, 32)
```

`S` is the link peer's transport secret, used from there exactly as a device's is. The pairing hash is defined under "The fingerprint". A `shared` of all zero bytes refuses the pairing. Both pairing private keys are destroyed as soon as `S` is computed. The label follows the notation of the transports page.

This is a key agreement, and it is the one new construction on this page: an unauthenticated exchange of X25519 public keys with HKDF over the result, made safe against someone in the middle only by the two operators comparing the fingerprint. It uses the two primitives as they are meant to be used, and it needs the same review as the stream proof. The pairing keys are made for this purpose alone. No WireGuard key is used for it, in keeping with the rule that no transport key comes from a WireGuard private key.

### The offer code

One line of text: `vwlink1.`, then a strict JSON object in base64url without padding, then `.`, then the first 4 bytes of the SHA-256 of the object's bytes in base64url, 6 characters. The checksum catches a text that was cut or mistyped. It protects nothing. The object is parsed by the strict rules of the [subscription format](../subscription-format/) ("Contents"): strict JSON, the same limits on depth and strings, the same rules for keys and host names, and a member this page does not define refuses the code.

| Member | Type | Meaning |
|---|---|---|
| `v` | integer | 1 |
| `id` | 22 base64url characters | The link's id, 16 random bytes |
| `direction` | `"forward"` or `"reverse"` | The creator is always the listener, so this also says which half the creator is. |
| `expires_at` | integer, Unix seconds | The offer is refused after this time. |
| `name` | display text, 1 to 64 characters | The creator's label for the link, shown as the other operator's word |
| `inbound_public_key` | key | The WireGuard public key of the listener's inbound |
| `transport_public_key` | key | The listener's node transport public key. Required when a `tls` or `ws` transport is listed. |
| `pairing_public_key` | key | The listener's X25519 public key for this pairing |
| `addresses` | object | `dialler`, a list of 1 or 2 addresses, IPv4 first, and in a reverse link `listener`, the same |
| `mtu` | integer, 1280 to 1500 | The link's MTU |
| `transports` | list of 1 to 8 | The listener's transports with their endpoints or candidates and pins, in the shape of "Transports of a profile" in the subscription format, in the listener's order of preference |

**Which transports a link may list.** `udp`, `udp-obfs`, `tls` and `ws`. Not `ws-plain`. Not `fronted` in version 1: a link carries the traffic of many users, and polling that through a CDN multiplies the requests a third party serves. A `ws` candidate that goes through a CDN puts the same volume on that CDN, in fewer requests. It is allowed, and it is shown to both operators at pairing with the warning the transports page gives for `fronted`: the CDN's terms may forbid it, the operator pays for the traffic, and the CDN sees it.

**Where a link may dial.** The refusals of the subscription format hold: no loopback, link-local, unspecified or multicast address, and none of the forms that carry an IPv4 address inside an IPv6 one. They are refused in the offer and again before every dial. Its two rules that depend on a user do not fit a server and are replaced. There is nobody to ask before a private address is dialed, and two nodes in one data center are a likely pair. So a private address, or one inside a network the dialing node is itself on, is shown plainly on the dialler's panel at step 2 and is accepted there by the operator or the offer is declined.

### The answer code

One line of text: `vwlinka1.`, then 80 bytes in base64url without padding, then `.` and a 6 character checksum as above. 123 characters in all. The 80 bytes are the link's `id` (16), the dialler's WireGuard public key for the link (32) and the dialler's pairing public key (32). A public key of small order, or an `id` the panel has no open offer for, refuses it.

### The fingerprint

The pairing hash is the SHA-256 of these bytes in this order: the label `"veilway v1 link pairing"`, the length of the offer's object as 4 bytes, the exact bytes of the offer's object as they stand between the two dots of the code after decoding, and the 80 bytes of the answer.

From the pairing hash, two values are made, one for each side:

| Value | Derivation | Shown by |
|---|---|---|
| The listener's value | the first 16 bytes of SHA-256(`"veilway v1 link listener"` \|\| pairing hash) | The listener's panel |
| The dialler's value | the first 16 bytes of SHA-256(`"veilway v1 link dialler"` \|\| pairing hash) | The dialler's panel |

Each is shown as 8 groups of 4 hexadecimal digits. A label is its ASCII bytes followed by one zero byte, as on the transports page.

- Each panel shows its own value and accepts only the other side's, all 16 bytes, compared in constant time. Typing the value on one's own screen is refused. With one shared value an operator could confirm by copying their own screen, which skips the comparison; two values make the comparison the only way through. Checking only half of a value would not do either: someone in the middle sees one side's code first and can change its own codes until the half the other side checks matches, which takes about 2^64 tries, not 2^128.
- It covers everything either side acts on: where to dial, the transport key, the pins, the direction, the addresses, the MTU and all four public keys. Any change to an offer or an answer on its way shows as two different fingerprints.
- **The listener's panel computes it from the offer it issued and kept, never from anything that was sent back to it.** The dialler's panel computes it from the bytes it received. Nothing is parsed and written out again on either side.
- Both panels hold it before the link exists in either config.

### Rules

- **An offer is used once.** The listener keeps a list of its open offers. When an answer for an offer has been accepted, or its time has passed, it is spent, and a second answer for the same `id` is refused.
- **What a copied offer allows.** Its reader learns the listener's addresses, names, paths and public keys, which is enough to block the listener and to know that it is a node. It cannot work out the link's transport secret, so it cannot make a proof for the link, hold its pending places, or pick the link's packets out by their tag, during pairing or after. One thing it does gain: the offer holds the inbound's public key, from which the mask on `udp-obfs` opening packets is derived, so its reader can remove that mask and see when two opening packets to that inbound come from the same peer. If the reader sends an answer of its own to the creating operator in the real peer's place, the fingerprints on the two honest panels differ. The typed fingerprints are what stop it. If the two operators are fooled all the same, for example by reading the halves to each other over a channel the same party controls, the cost is the whole link: that party's own keys are in the two codes it forged, so it ends the tunnel on both sides and reads and can change all traffic of every user of the link, as an exit can.
- **A copied answer allows nothing.** It holds public keys and an id.
- **What each panel stores once the link is confirmed.** The listener: the link's id, the dialler's public key, the transport secret, the addresses and the direction. The dialler: the same, the listener's keys and transports, and its own private key. Neither keeps a code or a pairing key after that, and before that everything is in memory only.

## Through an outbound

A dialling node may reach the other node through one of its `socks5` outbounds, for when the direct path is blocked. The dialler's `links[].via` names that outbound, and the link's TCP transports open their connection through the outbound's chain, as the config reference's `outbounds` section sets out. Every TCP transport a link can list goes through the chain: `tls` and `ws`. The client library sends `fronted` and `fronted-shaped` through a chain too, but a link cannot list either in this version: validation refuses `fronted`, and `fronted-shaped` is not a link transport. Nothing else changes: the proofs, the pins, the certificate checks and the WireGuard session are the same as on a direct path.

- **Only on the node that dials.** A link the node is dialled for, with `inbound`, cannot have `via`.
- **A `socks5` outbound.** `via` names one, and the same rules hold for its chain: no loop, at most 8 proxies, and no `direct` outbound in it.
- **TCP transports only.** `udp` and `udp-obfs` cannot pass through a TCP chain. Their candidates are skipped. The node logs at info when a link that starts this way skips them, and validation warns about each skipped transport and refuses the link when it lists no other one.
- **Nothing goes round it.** When the chain cannot be dialled, the link is unreachable. The dialler does not try the direct path.
- **What the proxies see.** SOCKS5 is plain text. Each proxy of the chain sees the user name and password of the proxies after it, the CONNECT targets and the bytes of the flows it carries. The link's own payload stays protected end to end: the TLS session or the WebSocket inside the chain is opaque to every proxy, and so is WireGuard. The server name a candidate shows in its TLS handshake is in the clear, as on a direct path, so the proxies see it too.

## Pins and self-signed links

A `tls` candidate of a link needs 1 to 4 pins: the SHA-256 of the SubjectPublicKeyInfo of the listener's certificate, in base64. The offer carries them, so the fingerprint both operators compare covers them.

**Two ways to trust the certificate.**

- **From a certificate authority.** The chain, the name and the dates are checked, and a pin is a second condition. A pin never replaces the chain.
- **Self-signed** (`self_signed: true` on the candidate, from v0.3.6). For a node with no domain. The node makes its own certificate (`"tls": {"self_signed": true}`), and the dialler trusts it through its pins alone: no chain, name or date is checked, TLS 1.3 only, and the handshake must be signed by the pinned key. The candidate needs 1 to 4 pins and no `verify_name`, and `sni` may be empty. It is allowed on `tls` only, never on `ws`. At pairing the dialler's screen and `veilway link answer` mark such a candidate as self-signed, pin only.

A self-signed link is as strong as the fingerprint the two operators compared. No certificate authority stands behind it. Whoever steals the key file of that transport can pose as the exit of the link until the link is paired again. Like a self-signed certificate on a profile, it is visible to anyone who completes the handshake.

**Where a pin comes from.** The node works out the pin of every `tls` transport it listens on, for a self-signed certificate and for one read from `cert` and `key` alike. Read it from:

- `veilway doctor`, which prints the pin of each `tls` transport;
- `GET /v1/inbounds` (`pin` on the transport) and `GET /v1/status` (`certificates`);
- the panel, which puts it into the offers it makes.

To check one by hand, against the certificate the server really serves:

```sh
openssl s_client -connect 192.0.2.10:443 -servername example.org </dev/null 2>/dev/null \
  | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | base64
```

For a file, use `openssl x509 -in cert.pem -pubkey -noout` in place of the first two lines. The result must equal the pin in the offer. For a self-signed transport, pass the address of the transport itself.

**A key that changed.** The pin changes when the transport gets a new key: a lost or replaced key file, or a certificate renewed with a new key. A self-signed transport keeps its key across renewals, and only makes a new one when the key file is missing.

- **On the listener.** The node remembers the pin of each `tls` transport in `tls-pins.state` next to the config file (read as hostile input, mode 600). When the pin differs at a start, a reload or a certificate file change, the node logs one warning naming the links on that inbound that pin the old key. It never refuses the new certificate. `GET /v1/inbounds` shows `key_changed_at`, `previous_pin` and `pin` for 30 days, and `veilway doctor` warns.
- **On the dialler.** A certificate whose key matches none of the candidate's pins ends the attempt as `pin_mismatch`, not as unreachable, and a warning says to pair the link again (at most once in 10 minutes). The dialler keeps trying at the usual waits and never falls back to no pin.
- **Pair again.** A new key breaks every link that pins the old one until the link is paired again, or its `peer.transports[].candidates[].pins` are edited by hand.
- **Keep the key of a CA certificate.** When the certificate renews with a new key, the pin changes. Ask certbot to keep the key: `certbot renew --reuse-key`, or `reuse_key = true` in the certificate's renewal file.

## Chaining

By default a link may not leave through another link. Since v0.3.6 the operator of the exit half can allow it for one link, so that a chain of nodes can stretch a path.

- **Off by default.** `links[].allow_chain: true` on the exit half lets that link's `exits` and `exit` name a `chain` exit of this node. It is an error on the entry half. Without it validation refuses a `chain` exit there, and the engine refuses the flow when it decides it.
- **Never through an upstream.** An `upstream` exit is one device on another provider's account, and the users of a third node may not spend it. Validation refuses it for a link with or without `allow_chain`, and the engine refuses it again when it decides a flow.
- **Hop limit.** The entry writes 64 on every packet it sends into a link. A node that continues a link's packet into another link writes `min(received, 64) - 1` and drops the packet when that is below 62. So a chain has at most 3 links, a loop between nodes dies after 3, and an entry that writes 255 gains nothing. The drop is counted as `link_hops` and as `dropped` on the link, sends no error back, and is logged at warn at most once in 10 minutes for each link.
- **Translation.** The middle node sees the incoming link's packet as a flow of that link and translates it as the entry does: its source becomes the middle's own address on the next link, with a translated port. Answers go back by the same table.
- **Nothing is fragmented toward a link.** What does not fit the next link is answered as too big, at every hop.
- **Reload.** Flows are decided again at every reload, so turning `allow_chain` off cuts the chained flows within a second. The node logs at info when the setting changes, with the `chain` exits the link then reaches.
- **What each side knows.** The last exit sees the middle node's link address, never the first entry's or a user's. The first entry is not told that its traffic continues, and cannot see or limit what happens at the middle. The middle node shows `chained` in `GET /v1/links`: the packets it forwarded from the link into another link.
- **Whose limits apply.** The last exit's `max_flows` and quota cover what the middle forwards together with the middle's own users.

## Lifetime

**Connecting and reconnecting.** The dialler follows the client rules of the transports page, with two rules of version 1 on top: it tries one candidate at a time, never two in flight, and every attempt that did not open is followed by a wait of at least the 2 to 10 s that those rules give between transports, whatever its outcome. Otherwise the client rules hold without change: the order of transports in the offer, candidates and their marks, the difference between a refusal, an unreachable candidate and a fault of the node itself, the waits and their doubling, and "the last transport is never set aside". There is no user to ask, so there is no consent to a class: the listener's operator decided which transports the offer lists, and the dialler's operator accepted them at pairing.

**State**, as each node reports it:

| State | Meaning |
|---|---|
| Up | A WireGuard handshake completed within the last 180 s. |
| Connecting | The dialler is trying, or the listener has not heard a handshake yet. |
| Unreachable | Dialler only: no candidate answers. |
| Pin mismatch | Dialler only: the other node answers, but its certificate's key matches none of the candidate's pins. It has a new key, and the link has to be paired again. See "Pins and self-signed links". |
| Refused | Dialler only: the listener answers and does not accept the proof. |
| Ended or misconfigured | The state after the time in the table of numbers. From then on the dialler tries once a day, because the address it dials may by then be someone else's. The state says so, so that nothing keeps trying without telling its operator. |
| Up, with a size warning | The link is up and the system has reported "packet too big" for the link's own outer packets, which suggests the link's `mtu` is too high for the path. The warning clears when no such report has come for the time in the table of numbers. Anyone on the path can forge such a report, which is why it only warns and changes nothing. |

Every change of state is logged at info with the link's tag, and counted.

**Ending a link.** Either operator removes it from their config. If the listener removes it, the dialler's proofs are refused like a stranger's, and the dialler reports "refused" and then "ended or misconfigured". If the dialler removes it, the listener reports "connecting" and then "ended or misconfigured". Neither node is told by the other. The sessions and the tunnel are dropped within one second on the node that removed it.

**Rotating keys.** A link's keys and its transport secret are not changed in place, since the secret comes from the pairing and travels nowhere. The operators pair a second link beside the first, put both behind the same `chain` exit, and end the first when the second is up. New flows use the new link, and flows on the old one are reset when it ends.

**A changed address of the listener.** The dialler knows only what the offer listed. When the listener's addresses change, the operators pair again. An offer may list several candidates and endpoints so that one of them changing does not end the link.

## Several links

- **Parallel links between the same two nodes.** A `chain` exit may name 1 to 4 links. Each has its own keys and its own addresses. A new flow goes to one of the links that are up by the rule the transports page has for parallel connections: for each link the entry hashes the flow together with the link's id and takes the link with the highest result. The hash is the implementation's choice and is keyed with a value the node draws at start. Nothing of it is on the wire. A flow stays on its link. When that link goes down the flow is reset, and it is not moved to another link, because its translated address belongs to the link.
- **One entry, several exits.** Each exit node is its own `chain` exit in the entry's config, with its own name and country, and rules and users choose between them as between any exits. Spreading users over several exit nodes by load is not part of this page.

## Tunnels

A tunnel forwards one TCP or UDP port of the entry to one address on the far side of a link, with no client and no user. A port on a public node can reach a service behind a home node that has no open port of its own: the public node is the entry, the home node is the exit, and the home node dials the link, which is a reverse link.

| Rule | |
|---|---|
| Where | A tunnel is on the entry half only, and names a `chain` exit. The node listens on the tunnel's address and opens each connection, or each UDP session, inside the link to the tunnel's target. |
| The other way round | A tunnel from the exit's side towards the entry's side is a tunnel on a second link whose roles are swapped: the node that was the exit is that link's entry. Either node can dial either link. A link's exit never opens flows towards its entry, so nothing on this page about what the entry accepts from the link changes. |
| What the exit sees | A flow from the entry's link address, like any user's flow. It is decided by the exit's rules for the link, its `exits` and its caps. A target on a private network needs `allow_private` on the exit half, which is the exit operator's consent to being reached at home. The exit cannot tell a tunnel's flow from a user's, and is not told. |
| Addresses and ports | Source: the entry's link address. Source port: drawn from the entry's translation, from the same range and the same table as users' flows, with the same rest time. The target is never a link address, an address of the entry's pools, a listen address of the entry, or anything the destination gate refuses. |
| Which link | For each connection or session, the rule for parallel links, hashed over the client's address and port. A connection stays on its link and is reset when that link goes down. While the `chain` exit is down, a connection is refused at once and a UDP datagram is dropped, and both are counted. |
| TCP | The entry ends the client's TCP connection with the system's TCP, and opens its own TCP connection inside the link with a userspace TCP stack. Bytes are copied both ways, a half close is passed on, and a reset on either side resets the other. An opening that is not answered within 10 s closes the client's connection. A connection with no byte either way for 1 hour is closed, and one that has carried no byte in either direction 60 s after it opened is closed too. The segment size the entry announces fits the link's MTU. |
| UDP | A session per client address and port, with its own translated port. A datagram from the link reaches a client only when it answers that client's session, by the tunnel's target address and port. A session ends 60 s after the client last sent. A datagram larger than the link carries is dropped and counted. A session's answers may come to at most 3 times the bytes the client sent since its last datagram plus 4096 bytes, and what is past that is dropped and counted, so that a forged client address does not make the entry a reflector. |
| Who may connect | Anyone who reaches the address, unless `sources` lists networks: then the connection or datagram from another address is refused (TCP) or dropped (UDP) and counted. A UDP tunnel on an address that is not loopback needs `sources`, and a TCP tunnel there without it is a warning. For UDP, `sources` decides who gets answers, not who can send: a source address can be forged, so a UDP target authenticates its own clients. |
| Limits | `max_connections` TCP connections or UDP sessions at once per tunnel, at most 16 of them for one source (an IPv4 address or an IPv6 /64, as on the transports page), and at most 8 new ones per second for one source. The `max_connections` of all tunnels together come to at most 16,384, a quarter of the flow table, so tunnels cannot fill the translation that users' flows need; a config past it is refused. No user's quota is charged: a tunnel belongs to the operator. Its traffic does count at the exit against the link's `max_flows` and `quota_bytes`, so a busy tunnel can use up a link that users share. |
| Counters | Per tunnel: connections or sessions opened, refused for each reason, open now, and bytes and packets in each direction. |
| Reload | A tunnel whose keys did not change keeps its connections. A narrower `sources` closes the connections and sessions from sources it no longer lists, and a lower `max_connections` closes the newest ones past it. Any other change, a removed tunnel, or a change to the links of its `chain` exit closes its listener and its connections. |

A tunnel publishes the target to whoever can reach the entry's address. The entry's operator decides who that is with `sources`, and the exit's operator decides what the link may reach. Neither node holds the other's configuration.

## Limits and failure

**A link that is down.** A `chain` exit is down when none of its links is up. While it is down, every flow routed to it is refused with the ICMP error or reset that an unreachable exit gives, new and live flows alike, and the refusal is counted. Nothing routed to it leaves through another exit, the node's own address or another link. It comes back when a link does, with no action by anyone. This is the behavior of a failed `l3` exit.

**MTU.** A user's packet is carried in the user's tunnel to the entry and then, translated, in the link's tunnel to the exit. Each tunnel has its own limit, from the arithmetic of the transports page:

| The tunnel runs over | Largest MTU on a 1500 byte path, IPv4 | Same, IPv6 |
|---|---|---|
| `udp` | 1440 | 1420 |
| `udp-obfs` | 1410 | 1390 |
| A stream transport | No limit from fragmentation | Same |

What a user can send end to end is the smaller of their own tunnel's MTU and the link's. A user on `udp` with an MTU of 1420 behind a link over `udp-obfs` with an MTU of 1390 can send 1390.

- **Nothing is fragmented for a link, in either direction.** The other node drops fragments. A packet that does not fit the link is dropped, and its sender gets the ICMP error "fragmentation needed" or "packet too big" with the link's MTU: the user's device from the entry, and the sender on the internet from the exit.
- **Both nodes lower the segment size in every TCP opening packet that crosses the link,** in both directions, to what fits the link's MTU. Most connections then never send a packet that is too big, and do not depend on an ICMP error getting through.
- **At the exit,** the link's `mtu` counts into the MTU of an `l3` exit's interface, so that the kernel does not hand back packets the link cannot carry. That lowers the MTU for that exit's own users as well. Validation warns when an `l3` exit that a link may use has a larger MTU than the link.
- An operator avoids all of this by setting the `mtu` of the entry's inbounds no higher than the link's.
- A link's device has no control channel and does not probe its path. A link `mtu` that is too high for the path loses full-size packets on a datagram transport. The size warning in the table of states is how that shows.

**TCP inside TCP inside TCP.** A user on a stream transport, behind a link on a stream transport, has their TCP connections inside two TCP connections, one after the other. Each stalls everything behind a lost segment, and the stalls add. This is plainly bad for anything interactive. Between two servers a datagram transport is more often possible than between a user and a server, and a link should list `udp-obfs` first wherever the path between the nodes allows it. A link over a stream transport works, and is slow under loss.

## Config keys

These keys are in the [config reference](../../reference/config/), which is the authority.

| Key | On | Meaning |
|---|---|---|
| `links[]` | both | A list of links. Each has a `tag`, an `id`, `direction`, `enabled`, `addresses` (`dialler`, and `listener` in a reverse link), `mtu` and `transport_secret`. Secret. |
| `links[].inbound` | listener | The tag of the `veilway` inbound the link connects to. That inbound carries no users' devices. |
| `links[].public_key` | listener | The dialler's WireGuard public key. |
| `links[].private_key` | dialler | The link's WireGuard private key on this node. Secret. |
| `links[].peer` | dialler | The listener's `inbound_public_key`, `transport_public_key` and `transports`, as the offer gave them. |
| `links[].via` | dialler | The tag of a `socks5` outbound whose chain the TCP transports of the link go through. See "Through an outbound". |
| `links[].exit`, `links[].exits` | the exit half | The link's default exit, and the exits it may leave through. |
| `links[].allow_chain` | the exit half | Whether the link may continue through a `chain` exit into another link. Default `false`. See "Chaining". |
| `links[].allow_private` | the exit half | Whether private networks are decided by the rules for this link. Default `false`. |
| `links[].max_flows`, `links[].quota_bytes`, `links[].quota_period`, `links[].expires_at` | the exit half | How much the link may use. The quota and its period mean what they mean for a user. |
| `routing.rules[].link` | the exit half | A condition: a list of link tags. |
| `exits[].backend` of type `chain` with `links` | the entry half | A list of 1 to 4 link tags that lead to the same exit node. |
| `tunnels[]` | the entry half | Ports forwarded through a `chain` exit to an address on the far side, see "Tunnels". |

Which half a node is follows from `direction` and from whether the link is listed with `inbound` or with `peer`.

**The control API** (`GET /v1/links`) reports for each link: its tag and id, the half and the role of this node, the state and since when, the time of the last handshake, the transport and candidate in use on the dialler, flows, `chained` (on the exit half, the packets forwarded into another link) and bytes and packets in each direction. It reports no key and no secret.

**`veilway doctor`** checks, without dialing anything: that a link's addresses lie in the inbound's pool on a listener and in none of this node's pools on a dialler, that a link's inbound carries no users, that no link key is a device's key, that the clock is set, that the link's `mtu` is not below the `mtu` of an inbound whose users are routed to it nor below the MTU of an `l3` exit it may use, that a link is not entitled to a `chain` exit unless it has `allow_chain`, the pin of each `tls` transport (against the pin the node served last and the links that name it), and, from a running node, each link's state.

## Ratings and what users are told

- **The rating of a profile is about the hop from the user to the entry.** A link changes nothing in it. The link's own transport is the two operators' concern, and no rating is shown for it.
- **A user of a linked exit trusts two operators.** The exit node sees the destinations and the unencrypted content of that user's traffic, as any exit does, and it may be run by someone else. The catalog must say so. In the subscription, an exit that leaves through a link carries `"linked": true` (see "A profile" in the subscription format), and the app shows on that exit: "leaves through a second server, which may be run by someone else". The panel sets the member from the config, never by hand. The control channel's catalog has no bit for this in its version 1, so while connected the app takes the mark from the subscription's entry with the same tag. A provider whose panel leaves the mark out is not found out by the app. Like the rating cap, it is the provider's word.

## Security considerations

- **No new wire format, and one new construction.** A link is a device session. Everything the transports page says about proofs, replay, binding and what a transport leaves visible holds for a link, including that a link's long-lived, high-volume connection between two servers is visible to whoever watches either of them. The pairing's key agreement is new and unreviewed.
- **Pairing rests on two values that the operators exchange.** Both come from a hash over every byte of both codes, each panel shows one and accepts only the other, and a panel cannot be made to accept a link by typing its own screen or by any button. A comparison that is fooled all the same costs everything the link carries: whoever sits in the middle of the pairing ends the tunnel on both sides, and reads and can change all traffic of every user of the link.
- **A hostile or compromised entry** can send the exit anything from the one address the exit accepts, up to the link's caps. It reaches what the exit's rules let that link reach, which never includes the exit's users or other links, and private networks only if the exit's operator switched that on. It can use up the link's allowance. It cannot change anything on the exit.
- **A hostile or compromised exit** sees and can alter everything that passes through it that is not encrypted end to end, can answer DNS falsely, and can drop or delay. It can fill any live flow with bytes, which the entry counts against that user before the user's device throws them away, so an exit can use up users' quotas. It can tell the entry's users' devices apart and often count them, as "What the exit learns" says. It cannot learn a user's address or key from the link, cannot send the entry a packet that reaches a user unless it answers a flow that user opened, and cannot reach the entry's own addresses or other users.
- **Each node learns the other's address, and the dialler learns more.** The dialler holds the listener's names, paths and keys: in a forward link the entry holds the exit's, and in a reverse link the exit holds the inbound key, transport key and paths of the entry's link inbound. That inbound carries no users, so these are not what the entry's subscribers hold. Either is enough to block the listener. An operator pairs with someone they are willing to give that to.
- **A link multiplies what a leak costs.** The link's keys on a compromised node let its holder act as that side of the link until the other operator ends it.
- **A self-signed link rests on the fingerprint.** There is no authority to ask, so the pins in the offer are the only check of the listener's certificate. A key file that leaks lets its holder pose as the listener until the link is paired again. A new key breaks the link and is never worked around.
- **A chain hides a hop from the entry.** The entry's operator picked the middle node, and the traffic leaves at a node the entry never saw. The entry cannot detect this. The middle node sees every destination of the flows it forwards. The hop rule is only a loop guard between nodes that follow it.
- **Parsers.** The offer and the answer are hostile input to a panel, pasted by a person. Each has a fuzz target in the same change as its parser, and a code that fails any check changes nothing.

**Where this page differs from the threat model's invariants.** Invariant 8 says every decrypted packet is checked for a source its device owns, and a reverse link's peer is checked by another rule. Invariant 10 says a returning packet goes to the device that holds its destination address, and with translation that address is the link's.

## Open questions

Each is listed with the default this page takes.

| Question | Default |
|---|---|
| Is the pairing's key agreement sound: fresh X25519 keys in two codes, HKDF over the result with the pairing hash, and a fingerprint compared by two people? | As written. It is new and has not been reviewed from outside. |
| A link as a peer on an inbound, or an inbound type of its own? | A peer. With the rule that a link's inbound carries no users, the difference from an inbound type is small, and it goes away when one device can no longer crowd an inbound's queue. |
| One address for the whole link. Is the limit on protocols without ports acceptable? | Yes for version 1. An entry whose users need such protocols at the same remote address at the same time has no answer here. |
| Should the entry also rewrite TCP timestamps and sequence numbers, so that the exit can tell devices apart less easily? | No. That is a TCP proxy in all but name, and timing would remain. The page says what the exit can still do. |
| `fronted` for links | Refused in version 1, for the load on a CDN. A link between nodes that can reach each other only through a CDN has `ws`. |
| Should the control channel's catalog carry the "linked" mark itself? | Not in its version 1, which does not grow. It is a point for the next version. |
| Should a link find its path MTU by probing? | No. The operators set `mtu`, both nodes lower TCP segment sizes, and a warning state shows a value that is too high. |
| Should a node tell its peer that it is ending the link? | No. A message would be one more thing a node believes from the other. |
| Chains of more than two nodes | Off by default. With `allow_chain` on the exit half of a link, at most 3 links in a row, never through an upstream. Conforming nodes refuse the rest in validation and in the engine. |
| Spreading users over several exit nodes by load | Not on this page. |
