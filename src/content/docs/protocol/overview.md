---
title: Protocol overview
description: The layers of the Veilway protocol, what each one is responsible for, and what each transport does and does not give.
---

:::caution[Draft]
This page is a draft specification. It has had three rounds of internal adversarial review and was revised against each. It has not been reviewed by anyone outside the project, and nothing in it is implemented except where a row says "built". Do not rely on any property described here.
:::

Veilway is a VPN: the client has a virtual network interface, whole IP packets go into a tunnel, and the node at the other end sends them on. The native protocol has three layers. Only the outer two are new.

| Layer | What it is | Specified in | New cryptographic constructions |
|---|---|---|---|
| Tunnel | WireGuard, unchanged: its handshake (Noise IK), ChaCha20-Poly1305, its timers, key rotation and replay protection, as the boringtun library implements them | The WireGuard paper | None |
| Transport | How WireGuard datagrams cross the network: `udp`, `udp-obfs`, `tls`, `ws`, `fronted`, later `faketls` and `quic` | [Transports](../transports/) | None invented. Standard constructions combined in a way nobody outside the project has reviewed. |
| Control channel | A small request and push protocol on one port of the gateway address, inside the tunnel | [Control channel](../control-channel/) | One mutual challenge and response with HMAC-SHA-256 |

Confidentiality, integrity and authentication of user traffic come from the tunnel layer alone. No key or construction of the transport or the control channel is relied on for them, so a flaw in the outer cryptography cannot decrypt what a user sends. It can make a user or a node recognisable, which on a hostile network is the harm that matters. That is why the outer layers carry the label "experimental, not externally reviewed" (see [Obfuscation layer status](../../security/obfuscation/)).

One part of the outer layers does matter for whether traffic stays protected: the client logic that keeps packets inside the tunnel while transports change or fail (the kill switch and transport fallback). A bug there can send traffic outside the tunnel. The fail-closed rules below are written for that logic.

## Goals

1. Carry WireGuard datagrams so that the byte patterns and exact sizes by which WireGuard is recognised do not appear on the wire.
2. Make a listener answer anyone who is not a user with nothing (datagram transports) or with the bytes of the operator's own web site (stream transports).
3. Give a client several ways to reach one node, chosen from a signed list, so that the loss of one address or one name is not the loss of the node.
4. Give a connected client what plain WireGuard lacks: the exits it may use and a way to pick one, a check of its addresses and resolver for IPv4 and IPv6, a working MTU, its usage and quota, and operator notices.
5. Fail closed everywhere. See "Fail-closed rules".
6. Bound everything an unauthenticated peer can make a node do: bytes read, time waited, memory held, connections kept, bytes sent. Pressure from strangers must land on strangers before it lands on users.

## Non-goals

These are not provided, and no page or screen may suggest they are.

- **Undetectability.** No transport is claimed to be undetectable or unblockable. The strongest claim this project can make is that named tests, on a stated date, did not tell a transport apart from its cover.
- **Defence against traffic analysis.** Volume, timing and direction of a flow stay visible on every transport. Padding blurs sizes and proves nothing.
- **Anonymity from the node.** The node ends the tunnel. Its operator sees the client's address, the device's key, every destination and every DNS name.
- **Unlinkability of a device over time.** A device's WireGuard key is its identity and the node recognises it at every handshake.
- **Good performance of IP inside TCP.** It can be reduced, not removed. See "Stream transports and TCP inside TCP" on the transports page.
- **Protection of a compromised device or node.**

The binding list is section 9 of `THREAT_MODEL.md` in the main repository.

## The adversary

The specification is written against the adversary of the threat model, section 5.1, described abstractly:

- **An observer on the path** sees every packet between client and node: addresses, ports, sizes, timing, direction. It keeps records and can analyse them later.
- **A prober** connects to any address and port the observer has seen, sends anything, and replays bytes captured from real clients.
- **An interferer** drops, delays, injects and resets packets, and blocks by address, port, server name or traffic pattern.
- **A subscriber.** The adversary can get the client software and a valid subscription the way any user does, so it knows the protocol, and every address, name, path and public key in that subscription.
- **A holder of a trusted certificate authority, or a content delivery network (CDN) in the path,** ends TLS and reads what is inside it.

Two more adversaries shape the control channel: a node that lies to its clients (a malicious or compromised provider) and a client that attacks the node it is allowed to use.

## What exists today

| Part | Status |
|---|---|
| `udp` transport on a `wireguard` inbound | Built. Plain WireGuard datagrams. |
| `ws` transport on a `wireguard` inbound, called legacy `ws` on these pages | Built. One WireGuard datagram per binary WebSocket frame. No proof, no padding, no decoy. |
| `veilway` inbound with the `udp` transport, and the node side of the control channel on it | Built. No client speaks the control channel yet. |
| `udp-obfs` on a `veilway` inbound, and the replay rule with its file | Node side built: the listener, its sessions and limits, the tag table, the replay memory with its file, `veilway replay reset` and the `doctor` check. No client speaks `udp-obfs` yet. |
| `tls` on a `veilway` inbound, and the stream listener for a direct peer | Node side built: the listener with its undecided, relayed and session pools, the accept state machine of a direct peer, the handoff to the decoy origin, the stream proof against the replay memory, the upgrade answer and the WebSocket session, with `veilway genkey --transport` and a `doctor` check of the decoy origin. No client speaks `tls` yet. It is rated Detectable. |
| Native `ws`, `fronted`, the proxy path of the stream listener, and every client part | Not built. Specified by these pages. Wire formats of some have a first implementation, see "Implementation status of this draft". |
| `faketls`, `quic` | Not built and not specified. The transports page lists goals and open questions only. |

## Terms

| Term | Meaning |
|---|---|
| Node | A running Veilway core that serves inbounds. |
| Inbound | One WireGuard tunnel: one key, one address pool, one or more transports. |
| User, device | As in the [config reference](../../reference/config/). A device is a WireGuard public key with fixed tunnel addresses. A user has one or more devices. |
| Gateway address | The node's own address inside an inbound's pool. The client's resolver and the control channel live there. |
| Profile | What one device needs to connect to one inbound. It reaches the client inside a signed subscription. |
| Datagram, stream | A datagram transport (`udp`, `udp-obfs`) sends each packet on its own and may lose or reorder it. A stream transport (`tls`, `ws`, `fronted`) runs over TCP, which delivers bytes in order and retransmits. |
| Class | Cover (`tls`, `ws`, `fronted`: imitates a known protocol), no cover (`udp-obfs`: hides WireGuard's bytes, imitates nothing), exposed (`ws-plain`: hides WireGuard's bytes, shows the server's name and the shape of a tunnel in clear), plain (`udp`, legacy `ws`: hides nothing). That is the order from strongest to weakest. |
| Proof | The bytes by which a client shows a listener that it is a known device, before the node sends anything of its own. |
| Session | One authenticated use of a transport: one WebSocket connection, one `fronted` polling session, one `udp-obfs` association. |
| Chunk | The unit of framing on obfuscated transports: one encrypted message that holds zero or more WireGuard datagrams and padding. |
| Decoy origin | The operator's own web server. A stream listener relays its answers to anyone who is not a user. |
| Obfuscated transport | Every transport except `udp` and legacy `ws`. |
| Refusal | An answer that shows the node or its front was reached and did not accept the proof. Different from being unreachable. |
| AEAD | Authenticated encryption with associated data: encryption that also detects any change to the message. Here always ChaCha20-Poly1305. |
| HPKE | Hybrid Public Key Encryption, RFC 9180: a standard way to encrypt a message to the holder of a public key. |

Integers on the wire are big-endian unless a row says otherwise. Sizes are in bytes. Every range written "a to b" is inclusive at both ends, and a time drawn from a range is drawn in whole milliseconds. Reserved bits and bytes are zero, and a receiver refuses a message in which one is set.

## What each transport gives and does not give

"Hidden" in this table means "not readable from the bytes on the wire". It never means an observer cannot tell.

| | `udp` | `udp-obfs` | `tls` | `ws` | `fronted` |
|---|---|---|---|---|---|
| Class | Plain | No cover | Cover | Cover | Cover |
| Carried over | UDP | UDP | TCP, TLS 1.3 ended by the node | TCP, TLS ended by the operator's web server or by a CDN | HTTP requests through a CDN |
| WireGuard's fixed bytes and exact sizes | Visible | Hidden | Hidden | Hidden, also from whoever ends TLS | Hidden, also from the CDN |
| Answer to a prober | Silence, with two known exceptions (see transports page) | Silence | The operator's own site, behind a TLS handshake that is the node's and not the site's | The operator's own site | The operator's own site |
| Looks like a known protocol | No, it is WireGuard | No. Uniformly random bytes, which is its own class | TLS to a web server, with a handshake that does not match the site | TLS to a web server | HTTPS polling |
| Node's address visible to the path | Yes | Yes | Yes | Yes, unless a CDN is in front | No, the CDN's address is |
| Client's address visible to | Path, node | Path, node | Path, node | Path, node, the CDN if any | Path, CDN, node |
| Volume, timing and direction | Visible | Visible | Visible | Visible | Visible, with the rhythm of polling |
| Survives blocking of unknown UDP | No | No | Yes | Yes | Yes |
| Survives blocking of the node's address | No | No | No | Only behind a CDN | Yes, until the CDN or the front is blocked |
| TCP inside TCP | No | No | Yes | Yes | Yes, and slow |
| Recognisable in recorded traffic by a holder of this device's secret | n/a | Yes | No. It takes the node's transport key and the TLS plaintext to link a device's connections. | Same | Same |
| Highest rating in version 1 | Detectable | Detectable, for good | Detectable, whatever its tests show | Detectable until the tests are recorded | Detectable until the tests are recorded |

In version 1 every native profile is rated Detectable. `ws` and `fronted` are the only transports that could be rated higher later, and only when the tests the threat model names are recorded for a release, and only on an address that carries no datagram listener and no legacy listener. The rating is explained on [Obfuscation layer status](../../security/obfuscation/).

## Keys and who holds them

| Key | Size | Held by | In a profile | Used for |
|---|---|---|---|---|
| Inbound WireGuard key | 32 | Node (private half), every device of the inbound (public half) | Public half | The tunnel. Called `inbound_pub` below. |
| Device WireGuard key | 32 | Device (private half), node (public half) | The public half. The private half only when the provider issued the key. By default the device makes it and it never leaves the device. | The tunnel. The public half, `device_pub`, is the device's identity. |
| Node transport key | 32 | Node (private half), every device of the inbound (public half) | Public half | Receiving the proof on `tls`, `ws` and `fronted`. An X25519 key, separate from every WireGuard key. |
| Device transport secret `S` | 32 | Node and that device | Yes, for that device only | Names the device inside a proof, proves the device per proof, keys `udp-obfs`, authenticates the control channel. Uniformly random bytes from the system's secure random source. |

Rules:

- No transport key is derived from a WireGuard private key. Validation refuses a node transport key equal to any WireGuard key in the config, and a transport secret that two devices share.
- A node holds no device private key.
- Every key derived from `S` uses HKDF-SHA-256 with a label that starts with `veilway v1` and names its one purpose. The full list is under "Keys derived from the device transport secret" on the transports page.
- An inbound's WireGuard key and its transport keys belong to one node and are never copied to a second one. The transports page says why.

### Rotation

| What | How | Effect on clients |
|---|---|---|
| Device transport secret | A device may have two secrets in the config at once. The node accepts both. The provider adds the new one, ships it in the subscription, and removes the old one later. | None while both are present. When the old one is removed, sessions opened with it are dropped within one second, by the path that cuts off a disabled user. |
| Node transport key | An inbound may have two transport keys at once. The node tries a proof against both. Profiles carry the first. Rotate on a schedule, at least every 30 days, and destroy the retired key: a retired key still opens old tokens that were logged somewhere. | None while both are present. When a key is removed from the config, sessions that were opened with it are dropped within one second, by the same path that cuts off a removed device secret. Their keys came from that key's exchange, and removal is the operator's one answer to a leaked key. |
| Inbound WireGuard key | By hand. A new key restarts the tunnel. | Every profile must be reissued. No overlap is possible, because WireGuard has one static key per tunnel. |
| Device WireGuard key | By hand, as the config reference describes. | That device's sessions are dropped within one second. |
| TLS certificate | By the operator. A candidate in a profile may carry up to 4 pins, so the next key can be pinned before it is used. | None if the next pin was shipped first. Otherwise the client fails closed. |

Revoking a device is removing it or its secret. From the next reload its proofs take the unauthenticated path, the same path as a stranger's, so a prober cannot tell a revoked device from an unknown one.

What each key reveals when it leaks is listed under "What a leaked key or a compromised node reveals" on the transports page.

## Versioning and negotiation

There is as little negotiation as possible, because every negotiated choice is something the path could try to steer.

- **Proof version.** Every proof carries one version byte. This specification defines version 1. A node treats any other version exactly as an invalid proof: the decoy on streams, silence on datagrams. There is no error and no version reply.
- **Transports.** A transport is identified by its name in the signed profile. A change that a version 1 peer cannot read is a new transport name, never a new meaning of an old one. Transport names are part of the proof, so a proof made for one transport is not valid on another.
- **Parameters.** Limits and timers are fixed by this specification. A few ranges (padding, keepalive) may be set in the signed profile and in the node's config, inside bounds this specification fixes. None is negotiated on the wire.
- **Control channel.** The client sends the highest version it speaks, the node answers with one version, both are covered by the credential, and the client refuses a version below `min_control_version` of its signed profile. See the control channel page.
- **No downgrade by the path or by the node.** Which transports a client may use, in which order, which addresses and names it may dial, and the lowest control version it accepts all come from the signed profile. Nothing a node or the path sends can add a transport, an address, a name or a lower version.

## Fail-closed rules

These hold for every transport and for the control channel. A design choice that conflicts with one of them is wrong.

1. **No plaintext, ever.** A transport carries WireGuard datagrams and nothing else. There is no mode in which an inner packet travels outside WireGuard, and no "try without encryption" path.
2. **No traffic outside the tunnel on error.** While the user has asked to be connected, a lost session, a failed handshake, a refusal, transport fallback and a crash of the client engine all leave the kill switch in force: nothing leaves the device except the transport's own connection to the node or front (threat model invariant 24).
3. **No silent move to a weaker class.** The client moves between transports only within the signed profile. It uses a transport of a lower class than the best class in the profile (cover, then no cover, then exposed, then plain) only when the user has agreed to that class for this profile. The transport in use, its class and its rating are always on screen.
4. **Certificate checks do not bend.** A certificate that does not validate, or does not match a pin where the profile has one, ends the attempt. There is no "continue anyway" and no retry without the check. The transport `ws-plain` reaches a front over plain HTTP with no TLS. It exists only where the signed profile names it, is a class of its own below every other obfuscated transport, needs its own consent, and is never reached as a retry or fallback from a transport with TLS.
5. **A refused proof looks like a stranger.** The node gives a refused client exactly what it gives anyone else. The client reports a refusal and waits. It never retries without a proof or with a weaker one.
6. **Unknown means refused.** An unknown version, message type, transport name or field value is refused, by both sides. Nothing is skipped or guessed.
7. **A full table refuses the newcomer.** A full replay cache or a full session table refuses new proofs. Nothing a stranger does displaces a device's session, and no check is loosened to make room. The refusal takes the unauthenticated path.
8. **A node that cannot keep its replay protection accepts nobody,** and says so in its log, its counters and `veilway doctor`. See "The replay rule" on the transports page.
9. **A node configures nothing on the client's network.** The only value from the control channel that a client applies is a lower MTU, inside a bound. Addresses, resolvers and routes come from the signed profile alone. No node message can weaken the kill switch, the resolver setting or the rating.
10. **A wrong clock is an error, not an exception.** A client whose clock is too far off cannot make a valid proof. It tells the user. It does not get a looser check.

## Config and profile fields this draft assumes

These keys do not exist in the [config reference](../../reference/config/) yet. The names are proposals. The config reference is the authority once they are added.

| Proposed key | Type | Meaning |
|---|---|---|
| `inbounds[].type` value `veilway` | enum value | A tunnel that serves the native transports and the control channel. |
| `inbounds[].transport_keys` | list of 1 or 2 keys, secret | The node transport keys. Required when the inbound has a `tls`, `ws` or `fronted` transport. |
| `inbounds[].padding` | object | The node's upper bounds for wide and normal padding, inside the spec's bounds. |
| `inbounds[].upgrade_cookie` | cookie name, no default | The name of the cookie on the WebSocket upgrade answer. Required with a `tls` or `ws` transport. It is also required with a `ws-plain` transport, where it is the name of the cookie that carries the client's token, and where the answer sets no cookie. |
| `inbounds[].upgrade_headers` | ordered list of header field names, default `Server`, `Date` on `tls` and empty on `ws` | The fields the upgrade answer takes from the decoy origin, in this order. |
| `users[].devices[].transport_secrets` | list of 1 or 2 keys, secret | The device transport secrets. Required for a device with an address on a `veilway` inbound. |
| `transports[].type` values `udp-obfs`, `tls`, `fronted`, `ws-plain` | enum values | See the transports page. On a `veilway` inbound, `ws` is the native format and has no `tls` key. `ws-plain` is `ws` over plain HTTP and carries its own transport key. A `ws`, `ws-plain` or `fronted` listener that is not on loopback or a unix socket is a warning. |
| `transports[].appearance` on a `ws-plain` transport | fixed identifier | Optional. Dresses the frames as another kind of content. A design, not built. |
| `transports[].tls` on a `tls` transport | `cert` and `key` files | As on the built `ws`. |
| `transports[].decoy` | object with `origin` and optional `proxy_protocol` | The decoy origin of a `tls`, `ws` or `fronted` listener: the operator's own web server. There is no default. |
| `transports[].trusted_proxies`, `client_address_header` | list of networks, header name | The reverse proxies or CDN ranges from which a `ws` or `fronted` listener accepts a forwarded client address. |
| `transports[].limits` | object | Node capacity numbers: `sessions`, `undecided`, `undecided_per_source`, `relayed`, `proxy_connections`, `decoy_requests_per_source`, `fronted_sessions`. Defaults on the transports page. |
| `replay` | object | Replay cache size and the accepted proofs per source. |
| `notices` | list of at most 4 | Operator notices served on the control channel. A notice's `text` is a string, or a map from language tags to strings with a required `default`. |
| `exits[].name` as a map | string, or a map from language tags to strings with a required `default` | An exit's display name in several languages. The node sends the default on the control channel, and the panel puts the map in the subscription. The tags and limits are those of "Text in several languages" on the subscription format page. |

Proposed commands and flags: `veilway run --replay <file>` for the replay file (by default next to the usage state file), `veilway replay reset` and its route on the control API, and `doctor` checks for the replay file and for a decoy origin that loops.

A profile is defined on the [subscription format](../subscription-format/) page, with these member names: `inbound_public_key` (`inbound_pub`), `device` (its `public_key`, its `private_key` only when the provider issued the key, `addresses` and `transport_secrets`), `gateways`, `mtu`, `transport_public_key`, `transports` in order, each with its `endpoints` or its `path` and `candidates`, where a candidate may carry `pins` (see "Fronting options" on the transports page), `min_control_version`, `stream_first`, `parallel`, `padding`, `notices`, and `rating_cap`, which can only lower the rating. Display text in a subscription (names, labels, notices, card texts) may be given in several languages, as that page defines.

## Numbers that are judgement calls

This page chooses four numbers: at most 2 transport secrets per device and 2 transport keys per inbound at once, at most 4 certificate pins per candidate, at most 4 notices, and a transport key age of at most 30 days. Every other chosen number is in the table of that name on the transports page or on the control channel page.

## To measure before implementing

These pages deliberately do not state how browsers, web servers, CDNs and libraries behave. Several items below were claims from memory in an earlier draft. Each must be measured, with a dated capture, before the part of the specification that depends on it is built, and the specification is corrected where a measurement disagrees.

| What to measure | What depends on it |
|---|---|
| A plausible set of HTTP header fields for a plain WebSocket upgrade, which the whole path reads | The plain variant of the fingerprint pack, used by `ws-plain` |
| Whether plain HTTP passes on networks that slow or filter TLS to the same addresses, with a date | Whether `ws-plain` is worth its exposure on a given network |
| Whether the WireGuard library pads a short inner packet to a multiple of 16 bytes | The sizes padding has to blur, and the wording of the `udp` layout |
| What systems other than Linux need for "do not fragment" on outer packets. On Linux it is set for `veilway` inbounds, in the probing mode that ignores the cached path MTU. | The "no outer fragmentation" rule and MTU discovery on those systems |
| How common web servers treat a request line that is malformed, slow or never finished: at which byte they answer, and after how long | The request line rule of the stream listener and its timing residual |
| How common web servers behave under many parallel connections from one source, and when their accept queue is full | The pools of the stream listener |
| Which response header fields common web servers send on an upgrade answer, in which order, whether a cookie on it is ordinary, and which fields a front web server adds to an upgrade answer it passes on | The upgrade answer and the default of `upgrade_headers` |
| How common web servers close a TLS handshake that is not finished in time | What a `tls` listener does with an unfinished handshake |
| Whether the node's TLS library can pad records | An alternative to the cookie for varying the length of the upgrade answer |
| What the node's TLS library answers in its handshake (versions, protocols offered, tickets, alerts), next to common web servers | The cap on `tls`, and whether it can ever be lifted |
| Which protocols a mainstream browser offers in its ClientHello for a WebSocket connection, and which HTTP version it then uses | The fingerprint pack and the upgrade request |
| How CDNs treat the request: path rewriting, retries, the format of the forwarded-address header with more than one hop, the HTTP version towards the origin, limits on body size and request rate | `ws` behind a CDN and `fronted` Also whether a CDN passes a plain WebSocket upgrade at all, and which fields it adds. |
| How much later an answer arrives through the node than from the origin | The published timing residual |
| The length and timing shape of each transport under idle, browsing and bulk load, including the first two records of each direction | Every padding and timer range |
| That the WireGuard library lets a client start a handshake and send a keepalive at a time the transport chooses | The rekey and keepalive rules |
| That the WireGuard library on the node sends its own keepalive when it has received data and has nothing to send, and after how long | The rule that an upload with nothing coming back does not look like a lost node |

## Security considerations

- **Where the security comes from.** Tunnel content is protected by WireGuard and by nothing else on these pages. The outer layers are about recognisability and reachability, and the client's kill switch is what keeps traffic inside the tunnel.
- **The outer layers are unreviewed.** They use only standard building blocks (X25519, HKDF-SHA-256, HMAC-SHA-256, ChaCha20-Poly1305, HPKE as in RFC 9180, TLS 1.3 from a mainstream library), each with a label that separates its use from every other. The way they are combined has had no outside review and has no proof. Each page lists what is unproven under "Open questions".
- **A subscription is a secret and a map.** Whoever holds one can connect as that device, confirm that each node in it is a Veilway node, and block every address and name in it. No design can stop a user from recognising the service it uses. What the design does prevent is that one subscription lets its holder read, unwrap or name other users' traffic.
- **The weakest listener decides.** If any service on a node's address identifies it (a plain `wireguard` inbound, a legacy `ws` transport, a `udp-obfs` or `udp` transport, a panel, a subscription endpoint), the address is identified, whatever the strongest transport on it does. The client applies this cap itself for what it can see in its own subscription, which is a `udp` or `udp-obfs` endpoint on the address of a cover transport. Everything else on the list it cannot see, and for that it depends on the provider saying so.
- **Third parties.** A decoy origin is the operator's own site, with no exception in version 1. `fronted` and `ws` behind a CDN put load and risk on the CDN. The transports page sets limits and the obfuscation page states the considerations in plain words.

## Open questions

Each is listed with the default this draft takes. The pages are written to the defaults.

| Question | Default |
|---|---|
| Is the transport secret per user or per device? | Per device. The proof then names exactly one WireGuard key, which is what binds a session to a tunnel, and one device can be revoked alone. The cost is one more secret per device in the config and in the subscription. |
| What is the top rating called, and does version 1 have one? | Version 1 rates every native profile Detectable. The name of a higher rating, and whether "Protected" invites a wrong reading, is undecided. |
| The config keys, commands and profile fields in the section above | As proposed. The config reference, its schema and the subscription format page must be changed before implementation. This draft does not change them. |
| Does the first subscription fetch use the fronting options? (threat model Q15) | Not specified here. It belongs to the subscription format page. |
| Should the client drop inner packets that belong to no flow it opened? (threat model Q7) | Not specified here. Nothing on these pages depends on it. |
| Refusing clients by source country before authentication (threat model Q18) | Not specified. If it is added, a refused client must get exactly the unauthenticated path of its listener. |
| Has anyone reviewed this text? | Three rounds of internal adversarial review, whose findings this revision answers. The last revision has not been reviewed again. No review from outside the project. |

## Implementation status of this draft

"Settled enough to implement" means the internal review judged the part stable enough to code against, with fuzz targets and tests, while the page stays a draft. It does not mean reviewed from outside, and it does not mean safe to rely on.

| Part | Status | What is still open |
|---|---|---|
| Tunnel (WireGuard) | Built | Nothing on these pages changes it. |
| `udp`, legacy `ws` | Built | The gaps the threat model lists for them. |
| Control channel: framing, opening exchange, credential, messages, exit selection | Node side built: wire formats in `veilway-proto`, and the listener, pools, limits, snapshot, exit selection, usage pushes, notices, `bye` and MTU handling in the engine, on `veilway` inbounds that carry the `udp` transport. The client side is not built. | The wording of threat model invariant 13a. On Linux the node now prohibits fragmentation of its outer packets on `veilway` inbounds. On other systems it does not yet, and warns at start. On an `l3` exit the error for a packet above a device's MTU is written back through the interface and has no test on a live kernel. The node's stack keeps to the segment size a device announces, and fragments TCP only on a connection that announced more than the device's MTU now carries. The state file keeps version 1 and gains a `devices` key, as the control channel page now says. Hints are always an empty list. |
| Chunk framing and padding: the chunk format, the nonce layout, the padding rules | Settled enough to implement. A first implementation exists, as above. | The ranges are unmeasured. |
| Session activity and timers | Settled enough to implement. A first implementation exists, as above, and must be read again against one change of this revision: the node now sends its first answer only when a session becomes established. | One definition and one table on the transports page. Two items on the list to measure concern the WireGuard library. |
| Replay rule and replay file | Built on the node: the rule and the file format in `veilway-proto`, and in the engine the file with its lock, its one writer and its timer, the start after a clean stop, after a kill and without a usable file, the reset through the control socket, and the log lines, counters and `doctor` check for a floor ahead of the clock. The `udp-obfs` listener and the stream listener use it. | The wire format was reviewed twice against the transports page. The engine's part has not been reviewed. Where it had to read the transports page one way or another is listed with the `udp-obfs` row. The stream listener waits for a limit write where `udp-obfs` keeps the packet, for at most the write deadline. |
| Stream proof | Wire format built | Its wire format is implemented and was reviewed twice against the transports page. The binder was confirmed to close the re-timing hole. The measured timing differences are recorded on the transports page. |
| Stream listener: pools, accept state machine, proxy path, decoy handoff, upgrade answer | Built on the node for a direct peer: the undecided, relayed and session pools, the accept state machine, the decoy handoff with the PROXY protocol header, the upgrade answer with its header learning, and the WebSocket framing in `veilway-proto`. The proxy path and its pool are not built. | The listener was reviewed once, adversarially, and revised against that review. Several rules depend on the list to measure, and none of those measurements has been made. It reads the transports page in these places: the connection to the decoy origin is started before anything is read and waited for only at the "not a user" step. Once it is open it is watched, and an origin that sends anything or closes while the request line is not complete decides the connection as not a user at that moment, while a complete line is always evaluated first. Every byte the origin sent is written out to the peer before the node waits for anything else, the peer is closed only after all of it was handed on, and a connection closed for room is closed at once. An origin's reset reaches the peer as a reset. When the origin closes its side the node closes the peer's connection, also when the peer is still sending. A proof under TLS 1.2 is treated as not a user's. A token is opened under the keys of every transport of the listener, whichever path the request had. A proof of a device leaves the undecided pool when it has passed steps 1 to 4, and at most 64 proofs of a listener wait for a limit write at once, each holding its connection outside the undecided pool. A peer that closes only its side is told to the origin as that, and the origin's answer still reaches it. A ping on a pending session gets no pong. A device with several sessions is answered on the one the node heard it on last, and the node applies no flow hash of its own. The decoy origin is reached over plain HTTP only: an `https://` origin is refused until the page says how it is verified. |
| `udp-obfs` | Node side built: the packet formats in `veilway-proto`, and in the engine one listener for each `udp-obfs` transport of a `veilway` inbound with the node state machine, the session table, the limits per device, per source and per session, the tag table that follows the epoch and the config, the binding of a session to its device's WireGuard, the first answer, the echo, and the end of sessions whose secret is removed. The client side is not built. | The wire format was reviewed twice against the transports page. The listener has not been reviewed. It reads the page conservatively in these places: the lock of the replay file is on a file of its own next to it, because every write replaces the replay file; validation refuses equal transport secrets and does not compute tags, and a tag that is equal to another's at a rebuild is left out and logged; session timers follow the node's wall clock; a session that a newer one of the same source replaced is read for 10 s and not answered on by the node's own traffic; an echo is owed to each lone keepalive, at most 4 at once for a session. The node prohibits outer fragmentation on Linux only. |
| `tls` as a whole transport | Node side built: one listener for each address of a `tls` transport of a `veilway` inbound, with the session bound to its device's WireGuard, its timers, its close, the limits per device counted together with `udp-obfs`, and the end of every session of a device that is cut off, whose transport secret is removed, or that was opened under a node transport key that is removed. The client side is not built. | Reviewed once with the listener. Capped at Detectable in version 1, because the TLS handshake is the node's own. The node offers TLS 1.2 and 1.3 and `http/1.1` only, and issues session tickets as its library does by default: a client that offers only `h2` gets an alert, and what a common web server offers next to that is on the list to measure. Removing a node transport key ends the sessions opened under it within one second, by the path that cuts off a disabled user. Certificate issuance is a marked gap and does not block. |
| `ws`, `fronted` as whole transports | Settled enough to implement | The reader of `fronted` chunks is built and was reviewed twice. The transports themselves are not built. |
| Fronting options, refusal handling, transport fallback | Settled enough to implement | Not built. |
| `ws-plain` | Designed, reviewed twice, not built | The node gains a listener type and a proof name for it. Its header set is unmeasured. |
| Appearance of `ws-plain` frames | Designed, reviewed once, not built | No value is defined in version 1. Form (a) is an interface with requirements and no container. Form (b) is an option of last resort with conditions, outside the default set, and the page recommends against building it. |
| Client TLS and HTTP fingerprint | Not yet | It waits for a measurement that has not been made. It does not block the rest. |
| `faketls`, `quic` | Goals only | No wire format. `faketls` waits for a project decision on relaying to third parties. |
| Subscription format: link grammar, envelope verification, payload schema, request, the client's state machine, legacy reading | Client-side reading built | Implemented as code with no input or output of its own, and reviewed once against the page. No client uses it yet. Display text in several languages and the display filter's joiner rule are implemented in that code. They were reviewed as a design, not yet as code against the page, and no client or panel uses them. One condition of the joiner rule (the virama's own Script) is on the page and not yet in the code. |
| Subscription format: the import screens, fetching and refresh scheduling in a client, and the provider's endpoint | Settled enough to implement | Not built. The page's text for these parts was revised after its second review and has not been reviewed again. |
