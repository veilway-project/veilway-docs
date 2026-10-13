---
title: Transports
description: How tunnel datagrams are framed and carried over each transport, and what each transport leaves visible.
---

:::caution[Draft]
This page is a draft specification. It has had three rounds of internal adversarial review, and its wire formats have a first implementation that was reviewed twice against this page. The node side of `udp-obfs` and the replay file are built and reviewed. It has not been reviewed by anyone outside the project. Built: `udp`, legacy `ws`, and the wire formats named under "Implementation status of this draft" on the overview. No listener and no client for the obfuscated transports exists. The obfuscation it describes is experimental and not externally reviewed.
:::

A transport carries WireGuard datagrams between a client and a node. The tunnel inside is WireGuard, unchanged. Read [Protocol overview](../overview/) first for the terms, the keys and the fail-closed rules. Statements about how browsers, web servers and libraries behave are not made on this page. They are listed under "To measure before implementing" on the overview.

## The transports

| Transport | Class | Carried over | Proof | Who ends TLS | Answer to someone who is not a user | Status |
|---|---|---|---|---|---|---|
| `udp` | Plain | UDP | None of its own. WireGuard's handshake. | No TLS | Silence | Built |
| `udp-obfs` | No cover | UDP | Masked epoch tag and sealed opening packet, keyed by the device transport secret | No TLS | Silence | Specified here |
| `tls` | Cover | WebSocket inside TLS 1.3, with the operator's own name and certificate | Stream proof in the request target | The node | The decoy origin's answer, behind the node's own TLS | Specified here |
| `ws` | Cover | WebSocket behind the operator's web server or a CDN | Stream proof in the request target | The web server or the CDN, never the node | The decoy origin's answer | Specified here. The built `ws` is the legacy format. |
| `fronted` | Cover | HTTP request and response polling through a CDN | Stream proof in the request target | The CDN | The decoy origin's answer | Specified here |
| `faketls` | | | | | | Goals and open questions only |
| `quic` | | | | | | Goals and open questions only |

**Classes.** A transport of the cover class imitates a protocol that an observer already knows (TLS to a web server). A transport of the no-cover class hides WireGuard's bytes and imitates nothing. A plain transport hides nothing. Legacy `ws` is plain. The class is fixed by this table and is what transport fallback and consent are based on. It is not a rating and not a promise.

`tls` and `ws` share one wire format after TLS. They differ in who ends TLS. The recommended first choice is a name and certificate the operator owns, served by an ordinary web server with the node behind it (`ws`).

## Numbers that are judgement calls

Every number on this page that was chosen, not derived, is in these tables. None has a measurement behind it. Sizes that follow from a format (a 16 byte tag, a 148 byte handshake message) are not listed.

Wire and client numbers, the same on every installation unless a row says the profile may set it. Every range written "a to b" is inclusive at both ends, and a time drawn from a range is drawn in whole milliseconds.

| Name | Value | Used by |
|---|---|---|
| Proof window `W` | 60 s either side of the node's clock | every proof |
| Replay limit | kept 10 to 20 s above the later of the wall clock and the highest accepted timestamp, and brought down when it is more than `W` plus 20 s above the clock. That is one small write about every 10 s while the node runs. | every proof |
| Epoch | 120 s | `udp-obfs` |
| Hello padding | uniform 0 to 96 bytes | stream proof |
| Pending sessions per device | 2 | every obfuscated transport |
| Sessions at one `udp-obfs` source address and port | 4 | `udp-obfs` node |
| Opening packets kept while a limit is written | at most 64 for a listener, at most 2 s each | `udp-obfs` node |
| Opening packets recorded as used after a limit refused them | 16 at once, then 1 a second, per device | `udp-obfs` node |
| Handshake initiations a session remembers | its last 8 | every obfuscated transport |
| Smallest opening packet a client sends | 122 bytes | `udp-obfs` client |
| Reset answered "still being written" | after 10 s | node |
| Cookie replies on plain `udp` | begin above 100 handshake messages a second per inbound | `udp` |
| Opening packet with no answer | sent again after 1, 2 and 4 s, then the attempt is lost | `udp-obfs` client |
| Replay limit write | 2 s deadline | node |
| Wait for the peer's close frame | 5 s | `tls`, `ws` |
| Body of a `fronted` request | 10 s to arrive | `fronted` node |
| `fronted` request number | at most 10 decimal digits, at most 4,294,967,295 | `fronted` |
| Decoy requests in flight per source on the proxy path | 16 | stream listeners |
| Chunk plaintext | at most 16,000 bytes | every obfuscated transport |
| Datagram inside a chunk | at most 1,600 bytes | every obfuscated transport |
| Datagrams in one chunk | at most 470, which follows from the two sizes above and the smallest item | every obfuscated transport |
| Wide padding | uniform from the session's base to an upper bound. The upper bound is 1023 unless the profile (client) or config (node) sets it, from 512 to 1023. | see "Padding" |
| Normal padding | uniform 0 to an upper bound. 255 unless set, from 64 to 255. | every other chunk |
| Session padding base | uniform 0 to 63 bytes, drawn once per session and direction | wide padding |
| Idle keepalive | after a send silence drawn uniformly from 20 to 40 s. The profile may set the range, from 10 to 60 s. | client side of every obfuscated transport |
| Keepalive echo | after a delay drawn uniformly from 0 to 3000 ms | node, `udp-obfs`, `tls`, `ws` |
| Client liveness limit | 10 s | client, every obfuscated transport |
| Lone keepalive delay | uniform 0 to 3000 ms | a chunk that would hold only one WireGuard keepalive |
| Client rekey point | uniform 60 to 110 s after the last handshake | client, every obfuscated transport |
| Stream send queue | 256 datagrams per connection | stream transports |
| Parallel connections | 1 by default, at most 4 | `tls`, `ws` |
| Request line | at most 4,096 bytes, at most 10 s | stream listeners |
| Request head of a user | at most 16,384 bytes, at most 10 s | stream listeners |
| TLS handshake deadline | 10 s from accept | `tls` |
| Decoy connect timeout | 5 s | stream listeners |
| Wait between requests on a trusted proxy's connection | 300 s | stream listeners |
| Idle time before a relayed connection may be closed for room | 60 s | stream listeners |
| Cookie value on the upgrade answer | 16 to 96 characters | `tls`, `ws` |
| First tunnel packet deadline | 10 s after the proof was accepted | every session |
| Session idle | 300 s on `tls` and `ws`, 180 s on `udp-obfs`, 60 s on `fronted` | every session |
| Sessions per device | 8, of which at most 2 `fronted` | every obfuscated transport |
| Accepted proofs per device | burst 16, then 1 a second | every obfuscated transport |
| WireGuard handshake initiations per session | burst 3, then 1 a second | every obfuscated transport |
| Packets per `udp-obfs` key | the client opens a new session at 2^30 sent or received, the node ends a session at 2^31 sent | `udp-obfs` |
| Old `udp-obfs` session after a new one from the same source | readable for 10 s | `udp-obfs` node |
| `fronted` body | at most 65,536 bytes in each direction | `fronted` |
| `fronted` hold | 250 ms | `fronted` node |
| `fronted` poll wait | 100 ms, multiplied by 1.5 per empty response up to 5 s, each wait multiplied by a number drawn uniformly from 0.75 to 1.25 | `fronted` client |
| Request path | at least 12 characters | stream listeners |
| Candidates per transport | at most 16 | fronting options |
| Candidate attempts | 2 in flight, 250 ms apart, 10 s each, 6 distinct per hour per network, an unreachable one set aside for 1 hour, the last working one remembered for 7 days | fronting options |
| Refusal wait | uniform 60 to 120 s, doubled after every refusal up to 3600 s, back to the start after a session opens. A candidate is tried at most 3 times in a row, the first attempt included, before the client moves on. | client |
| Silence on a datagram transport that worked on this network within the last 7 days | retried for 90 s in all, then the transport counts as unreachable | client |
| Upgrade header learning | once at start and on reload, again every 60 s while it has failed | `tls`, `ws` node |
| Clock offset from `Date` | kept for at most 24 h, and taken again after any refusal on a pinned candidate | client |
| Fallback | 10 s per transport, a wait drawn uniformly from 2 to 10 s between transports, 3 per round, then 30 s doubling to 900 s, each multiplied by a number drawn uniformly from 0.5 to 1.5 | transport fallback |
| Reconnect after a lost session | 1 s doubling to 60 s, each multiplied by a number drawn uniformly from 0.5 to 1.5 | client |
| Certificate pins | at most 4 per candidate | `tls`, `ws` |
| Fingerprint pack expiry | 90 days after its capture date | client TLS |
| Node transport key age | rotate at least every 30 days | operators |

Node capacity numbers. These are not wire parameters. Each is a proposed config value with the default shown, because a fixed number cannot fit both a node of ten users and one at the config's upper limits:

| Name | Default | Scope |
|---|---|---|
| Sessions | 16,384 | per listen address |
| Undecided connections | 512, and 64 per source | per listen address |
| Relayed connections | 1,024 | per listen address |
| Proxy connections | twice the `fronted` sessions, 8,192 | per listen address |
| `fronted` sessions | 4,096 | per listen address |
| Replay cache | 262,144 entries | per node |
| Accepted proofs per source | burst 256, then 32 a second | per node |

A source is an IPv4 address or an IPv6 /64. How each limit behaves when it is reached is stated where the limit is used. Two rules hold for all of them: nothing a stranger does displaces a device's session, and a device at its own session limit replaces its own oldest session, but only once the new session is established (see "Session activity and timers").

## Building blocks

No primitive is implemented in this project. Each comes from a library. The first implementation takes HPKE from the `hpke` crate, pinned to version 0.14.1, and the rest from the libraries the WireGuard code already depends on. That HPKE library has had no paid audit, by its own statement. What was checked is that the suite used here reproduces the test vectors of RFC 9180. The threat model plans a dependency allow-list that a build checks. It does not exist yet, so today nothing but review stops a library from being added. The threat model records this as gap G41.

| Primitive | Specification | Used for |
|---|---|---|
| X25519 | RFC 7748 | Inside HPKE only |
| HKDF-SHA-256 | RFC 5869 | Every key derivation |
| HMAC-SHA-256 | RFC 2104 | Tags, the tag mask, the proof binder |
| ChaCha20-Poly1305 | RFC 8439 | Sealing chunks and `udp-obfs` packets |
| HPKE, base mode, with DHKEM(X25519, HKDF-SHA256), HKDF-SHA256 and ChaCha20Poly1305 | RFC 9180 | The stream proof |
| TLS 1.3 | RFC 8446, from a mainstream library | `tls`, `ws`, `fronted` |

Each construction follows a published design. Where it departs from that design, the row says how.

| Construction | Follows | Departs in |
|---|---|---|
| Stream proof | HPKE base mode used as in Oblivious HTTP (RFC 9458): the client seals a small message to the server's static key, and both sides take further keys from the HPKE exporter | The message is a device tag, a timestamp and a binder, not a request |
| Proof binder | The pre-shared key binder of TLS 1.3 (RFC 8446, section 4.2.11.2): an HMAC under a key derived from the shared secret, over a value that is unique to this exchange | The value is an HPKE exporter output followed by the message fields themselves, where TLS uses a hash of the handshake transcript. As in TLS, the binder covers the message it vouches for. |
| Epoch tag | Time-based one-time passwords (RFC 6238): a truncated HMAC of a time step under a shared key, with the neighbouring steps accepted | 16 bytes, not decimal digits |
| Tag mask | QUIC header protection (RFC 9001, section 5.4): header bytes are XORed with the output of a keyed function over bytes sampled from the same packet. The mask key comes from the inbound's public key, as WireGuard keys its first handshake check. | HMAC-SHA-256 as the keyed function |
| `udp-obfs` envelope | Shadowsocks AEAD: a session key from HKDF of a pre-shared key and a random salt. Shadowsocks 2022: a timestamp and a salt check against replay | The device is found by the epoch tag. Data packets use random nonces under a packet limit. |
| Chunk | TLS 1.3 record padding (RFC 8446, section 5.4): padding inside the encryption. WireGuard's counter nonce layout. | Several datagrams per chunk |
| Decoy handoff | Trojan: anything that is not a valid client is passed to a real web server | The decision is made at the end of the HTTP request line |
| `fronted` | meek: polling through a CDN with data in request and response bodies | Bodies are sealed chunks, and the session is opened with the stream proof |
| Send limit before the tunnel authenticates | QUIC address validation (RFC 9000, section 8.1) | A factor of 1, not 3 |
| Candidate attempts | Happy Eyeballs version 2 (RFC 8305) for the stagger | A cap per hour |

Following a published design is not the same as inheriting its analysis. The combinations here have no proof and no outside review. See "Open questions".

Notation: a label in double quotes is its ASCII bytes followed by one zero byte. `||` joins byte strings. `HKDF(salt, ikm, info, n)` is HKDF-Extract with `salt` and `ikm`, then HKDF-Expand with `info` to `n` bytes.

## Keys derived from the device transport secret

With `S` a device transport secret, `inbound_pub` the inbound's WireGuard public key and `device_pub` the device's:

| Name | Value | Used for |
|---|---|---|
| `prk` | HKDF-Extract(salt `"veilway v1 device secret"`, ikm `S`) | Deriving the four keys below, nothing else |
| `k_tag` | HKDF-Expand(`prk`, `"veilway v1 tag" \|\| inbound_pub`, 32) | Computing tags, nothing else |
| `k_bind` | HKDF-Expand(`prk`, `"veilway v1 proof binder" \|\| inbound_pub \|\| device_pub`, 32) | The binder of the stream proof |
| `k_obfs` | HKDF-Expand(`prk`, `"veilway v1 udp-obfs" \|\| inbound_pub`, 32) | `udp-obfs` session keys |
| `k_ctl` | HKDF-Expand(`prk`, `"veilway v1 control" \|\| inbound_pub \|\| device_pub`, 32) | The control channel credential |
| Device tag | The first 16 bytes of HMAC-SHA-256(key `k_tag`, message `"veilway v1 device tag"`) | Naming the device inside a stream proof. It has no time step and never changes for a given secret. |
| Epoch tag | The first 16 bytes of HMAC-SHA-256(key `k_tag`, message `"veilway v1 epoch tag" \|\| e`) | Naming the device on a `udp-obfs` opening packet. `e` is the epoch number as 8 bytes. |

`S` is never sent and never used as a key directly. Each derived key has one purpose. `k_tag` computes both tags, under two different labels. A device on two inbounds has different tags and keys on each.

One more key does not come from `S`. It is shared by every device of the inbound:

| Name | Value | Used for |
|---|---|---|
| `k_mask` | HKDF(salt `"veilway v1 udp-obfs mask"`, ikm `inbound_pub`, info empty, 32) | Masking the epoch tag on the wire |

**How the node finds the device.** The node keeps one table from tag to device, built from the config: one device tag per device secret, and one epoch tag per device secret for each of the previous, current and next epoch. Each entry knows which kind it is. A device tag is valid only in a stream proof and an epoch tag only on an opening packet. The other kind in either place is a miss. It is rebuilt on reload and when the epoch changes, away from the packet path, and swapped in whole. Finding the device is one table lookup, whatever the number of devices. The node never tries secrets one after another, so the work per proof does not grow with the number of users and does not depend on which user it is. Only devices of a user who is enabled, not expired and not over quota, with an address on this inbound, are in the table. Validation refuses a config in which two transport secrets are equal. Two different secrets whose tags are equal are found when a table is built: the tag stays with the secret that already had it, and the collision is logged and counted. A table that fails to build is logged and counted, and the old one stays in use. A table that is not rebuilt at an epoch change refuses nobody for one more epoch, because the old table already holds the next epoch's tags.

**One node, one set of keys.** An inbound's WireGuard key and its transport keys must not be used on a second node. The replay cache belongs to one node, so a token seen on the way to one node could be used once on another node that shares the keys. Validation cannot see other nodes. The panel generates keys per node, and this page states the rule for people who write configs by hand.

## Framing

### The chunk

On every obfuscated transport, WireGuard datagrams travel inside chunks. A chunk is one ChaCha20-Poly1305 message. Its plaintext is a list of items followed by padding:

| Offset | Size | Field |
|---|---|---|
| 0 | 2 | `length` of the first datagram, 32 to 1,600, or 0 for "no more items" |
| 2 | `length` | One WireGuard datagram, exactly as the WireGuard library produced it |
| ... | ... | More `length` and datagram pairs |
| ... | 0 or more | Padding. The sender writes zero bytes. The receiver ignores the content. |

Reading rules:

1. The receiver reads items until fewer than 2 bytes remain or it reads a `length` of 0. Everything after that point is padding.
2. A `length` from 1 to 31, a `length` above 1,600, or one that runs past the end of the plaintext, makes the chunk invalid. 32 bytes is the smallest WireGuard message, a keepalive. An item takes at least 2 + 32 = 34 bytes, so a chunk of 16,000 bytes holds at most 470 items.
3. A plaintext with no item (empty, or all padding) is valid. It is the padding-only chunk.
4. A chunk that does not decrypt, or that decrypts and is invalid, ends the session on `tls` and `ws` (see "Closing") and is dropped silently on `udp-obfs`. On `fronted` the two cases differ, because anyone can send a request there: a request with a chunk that does not decrypt changes nothing and takes the unauthenticated path, while a chunk that decrypts and is invalid can only have come from the session's client and ends the session.

The length field and the padding are inside the encryption. On the wire a chunk shows its total length and nothing else: no type byte, no fixed bytes, no visible length field.

### Padding

1. The sender draws the padding length uniformly at random from the range that applies, then lowers it to what still fits the chunk limit of the transport. Padding is never negotiated on the wire. The sender pays for it.
2. **Wide padding** goes on the first 16 chunks of each direction of a session, on every chunk that holds a WireGuard handshake message, and on every chunk that holds a control channel packet. The sender knows which datagrams those are, because it built them. On `udp-obfs` the opening packet is always padded wide and is not one of the 16: the 16 are counted over data packets. The 16 is the `N` of threat model invariant 7.
3. Wide padding starts at the session's base, a small number each side draws once per session, so that the smallest padded size is not the same in every session.
4. The upper bounds and the keepalive range may be set per profile for the client and per inbound for the node, inside the bounds in the table of numbers, so that not every installation shows the same ranges.
5. A chunk that would hold exactly one WireGuard keepalive is held back for the lone keepalive delay and joins whatever else is sent in that time.

What padding achieves: WireGuard's sizes do not appear as exact lengths. What it does not achieve: a uniform spread above a base size is itself a shape that no ordinary protocol has, and over many sessions its lower edge still points at the base sizes. The order of the first exchange is unchanged, and a full-size inner packet still gives a chunk of nearly fixed size. Whether any of these ranges is good enough is decided by the length and timing measurement of the threat model, which has not been run.

### Session activity and timers

This section is the one definition of when a session is alive. Every other section refers to it.

**Pending and established.** A session is pending from the moment its proof is accepted. It becomes established when a WireGuard packet of its device has authenticated on it: a handshake initiation from that device that WireGuard accepts, or a data packet or keepalive under a WireGuard session of that device. A handshake initiation that WireGuard drops as a repeat does not establish a session. Pending sessions do not take places in a listener's session pool. They are bounded by the 2 per device. A pending session that is not established within the first tunnel packet deadline is ended. A device may have 2 pending sessions, and further proofs are refused while it has. Only an established session counts against the device's session limit, and only at the moment it becomes established does it replace the device's oldest session when the limit is reached. Someone who can produce a proof but not the device's WireGuard packets can therefore not push out the device's real sessions.

**Activity.** A session is active at a moment when the receiver accepts from it a chunk that cannot be a replay.

- On `tls`, `ws` and `fronted` every chunk has a number, so any chunk that opens at the expected number is activity, padding-only chunks included.
- On `udp-obfs` chunks have no number and a recorded chunk opens again. There, only a chunk that holds a WireGuard packet which authenticates is activity, because WireGuard rejects a replayed packet.

**Idle keepalive.** WireGuard is silent on an idle tunnel, and a transport that hears nothing cannot tell an idle peer from a lost one. The client sets no WireGuard persistent keepalive. On `udp-obfs`, `tls` and `ws`, when it has sent nothing for the idle keepalive time, it asks the WireGuard layer for one keepalive datagram and sends it in a chunk. The node answers a chunk that held only a WireGuard keepalive with one padding-only chunk, the echo, after the echo delay, unless it sent something else in that time. On `fronted` there is no idle keepalive and no echo: the client's polling is the activity, and the response to each request is the sign of life.

**What the node's WireGuard does.** The node's transport sends nothing on a schedule of its own. WireGuard on the node is unchanged, and that includes the keepalive WireGuard itself sends when it has received data and has had nothing to send for some seconds. An upload with nothing coming back therefore still gets that keepalive, and the client's WireGuard does not conclude that the node is gone. That the library behaves this way is on the list to measure.

| | `udp-obfs` | `tls`, `ws` | `fronted` |
|---|---|---|---|
| Established by | A WireGuard packet of the device authenticates | Same | Same |
| First tunnel packet deadline | 10 s | 10 s | 10 s |
| Activity | A chunk with a WireGuard packet that authenticates | Any chunk that opens at the expected number | An accepted request |
| The node ends a session with no activity for | 180 s | 300 s | 60 s |
| Client idle keepalive, after a send silence of | 20 to 40 s, or the profile's range within 10 to 60 s | Same | None |
| Node's echo | A padding-only chunk after 0 to 3000 ms | Same | None. The response to a request. |
| The client treats the session as lost when | An idle keepalive got no chunk back within 10 s, or WireGuard reports the node silent | An idle keepalive got no chunk back within 10 s, or the connection closes | A request got no valid response within 10 s |
| Lone keepalive delay | 0 to 3000 ms | Same | Same |
| Client rekey point | 60 to 110 s after the last handshake | Same | Same |

The longest keepalive range a profile may set, 60 s, is well below the shortest idle time of a transport that uses keepalives, 180 s. The longest poll wait on `fronted`, 6.25 s, is well below its idle time of 60 s and below the client's 10 s limit.

### Datagram and stream transports

- **Datagram** (`udp-obfs`): one chunk per UDP packet. A chunk holds one WireGuard datagram or none. Nothing is retransmitted and nothing is reordered on purpose.
- **Stream** (`tls`, `ws`, `fronted`): the sender puts every datagram that is waiting at the moment it writes into one chunk, up to the limit, and never waits for more. Under load chunks therefore grow towards 16,000 bytes. Without load a chunk holds one datagram.

On stream transports the chunk nonce is a counter: 4 zero bytes followed by the 64 bit chunk number of that direction in little-endian, starting at 0. This is the layout WireGuard uses. Each direction has its own key, so no nonce is used twice under one key. A stream chunk is sealed with empty associated data, on `tls`, `ws` and `fronted` alike. A sender closes the session before it would send chunk number 2^60, and a receiver closes the session instead of accepting a chunk with that number.

### MTU

The MTU (maximum transmission unit) of the tunnel is the largest inner IP packet. An inbound has one `mtu` for all of its transports, because a device keeps its tunnel address on every transport.

Each inner packet gains 32 bytes from WireGuard (16 of header, 16 of authentication tag), then the transport's own envelope, then the outer headers: 20 for IPv4 or 40 for IPv6, plus 8 for UDP. Whether the WireGuard library also rounds a short inner packet up to a multiple of 16 is on the list to measure. It does not change the figures below, which are for a full-size packet.

| Transport | WireGuard | Envelope of a data packet | Outer, IPv4 | Outer, IPv6 | Largest `mtu` on a 1500 byte path, IPv4 | Same, IPv6 |
|---|---|---|---|---|---|---|
| `udp` | 32 | 0 | 28 | 48 | 1500 - 28 - 32 = 1440 | 1500 - 48 - 32 = 1420 |
| `udp-obfs` | 32 | 12 nonce + 2 length + 16 tag = 30 | 28 | 48 | 1500 - 28 - 62 = 1410 | 1500 - 48 - 62 = 1390 |

An opening packet of `udp-obfs` has a larger envelope, 78 bytes. It never carries user data, so it stays far below these sizes.

A stream transport does not fragment, so it has no such limit. What matters there is whether one full-size inner packet fits one TCP segment:

| Direction on `tls` and `ws` | Per chunk that holds one packet |
|---|---|
| Client to node | 32 WireGuard + 2 length + 16 chunk tag + 8 WebSocket header + 22 TLS record = 80 |
| Node to client | 32 + 2 + 16 + 4 WebSocket header + 22 = 76 |

A TCP segment with timestamps carries 1448 bytes over IPv4 and 1428 over IPv6. A full-size inner packet therefore fits one segment only when `mtu` is at most 1448 - 80 = 1368 over IPv4 or 1428 - 80 = 1348 over IPv6, before any padding. Above that, each full-size packet spans two segments. That costs throughput and is one reason record lengths on these transports do not look like a browser's.

Rules:

- **No outer fragmentation.** On a `veilway` inbound, the client and the node send every outer packet of a datagram transport with fragmentation prohibited. A packet that does not fit the path is lost, not fragmented, and path MTU discovery on the control channel finds the size that fits. Data packets and probes are therefore treated alike by the path. As built: on Linux the sockets of `veilway` inbounds set the system's path MTU discovery to its probing mode. That sets "do not fragment" on everything sent and ignores the path MTU the system has cached, so that one forged "fragmentation needed" message cannot make the node refuse its own packets. A packet the host refuses for its size is not sent and is counted. On other systems the option is not set and the node warns at start, so the rule is not yet kept there.
- The smallest `mtu` is 1280, which IPv6 inside the tunnel requires. The outer path must therefore carry 1280 + 32 + 48 = 1360 bytes for `udp` over IPv6, and 1280 + 62 + 48 = 1390 bytes for `udp-obfs` over IPv6. On a path that cannot, those transports do not work and the client moves on under "Transport fallback".
- For a `veilway` inbound, validation warns when `mtu` is above the IPv6 figure of any of its datagram transports. With a `udp-obfs` transport that is 1390. The proposed default `mtu` of such an inbound is 1390, and 1420 otherwise.
- On `udp-obfs` no packet is larger than `mtu` + 62 bytes. Padding is lowered to fit, so a full-size inner packet carries none.
- The client takes its MTU from the signed profile. Path MTU discovery can lower it, never raise it, and never below 1280.

### Stream transports and TCP inside TCP

Inside a stream transport, the tunnel's own TCP connections run on top of the transport's TCP connection. When the outer connection loses one segment, everything behind it waits, and the inner connections also see the delay and slow down. This cannot be designed away. These rules reduce it:

1. **Datagram transports perform better, and are easier to recognise.** Which comes first is a choice the profile and the user make, under "Transport fallback". This page does not prefer one.
2. **No second retransmission layer.** A transport never retransmits a chunk or a datagram, and never acknowledges one. Loss recovery belongs to the outer TCP connection alone, and to the applications inside the tunnel.
3. **Drop, do not queue.** Each connection has a send queue of 256 datagrams. When it is full, new datagrams are dropped and counted. The applications inside then see loss and slow down, which is what they would do on a real network. An unbounded queue would turn loss into seconds of delay.
4. **Parallel connections.** A client uses 1 connection per tunnel by default. A profile may allow up to 4. When more than one is open:
   - Each connection is its own session with its own proof and keys, for the same device.
   - A sender picks the connection for a datagram by a hash of the inner packet's addresses, protocol and ports, so one inner flow stays on one connection and in order. A stall on one connection then holds back only the flows on it. WireGuard handshake messages go on the connection that has been open longest.
   - The node sends to a device on any session on which a packet from that device has authenticated.
   - The client opens the second and later connections one at a time, each after a delay drawn uniformly from 1 to 5 s.

Several long-lived connections from one client to one host are themselves a pattern. That is why the default is 1. When one connection stalls for long while others run, its packets can arrive outside WireGuard's replay window and are then dropped, which the applications see as loss.

## The stream proof

Used by `tls`, `ws` and `fronted`. It is one HPKE message in base mode (RFC 9180) from the client to the node transport public key. HPKE is used as specified, through a library, with the suite in "Building blocks". Nothing in HPKE is changed.

HPKE base mode hides the message from everyone but the node. It does not show who sent it. The sender is shown by the binder inside the message.

### Inputs

| HPKE input | Value |
|---|---|
| Recipient public key | The node transport public key from the profile |
| `info` | `"veilway v1 proof" \|\| name \|\| inbound_pub`, where `name` is the label `"tls"`, `"ws"` or `"fronted"` |
| `aad` | Empty. The request path is not bound, because a front may rewrite it. |
| Plaintext | The hello below |

The hello, 60 bytes and padding:

| Offset | Size | Field |
|---|---|---|
| 0 | 1 | Version, `0x01` |
| 1 | 3 | Zero |
| 4 | 8 | Timestamp: Unix time in seconds |
| 12 | 16 | Device tag |
| 28 | 32 | Binder: HMAC-SHA-256(key `k_bind`, message `b \|\| h`), where `b` is 32 bytes from the HPKE exporter of this context with exporter context `"veilway v1 binder"`, and `h` is bytes 0 to 27 of this hello: the version, the zero bytes, the timestamp and the device tag |
| 60 | 0 to 96 | Padding, zero bytes, of a length drawn uniformly at random |

The binder proves that the sender holds the device secret, for this one HPKE context and for exactly this version, timestamp and tag. This matters because in HPKE base mode the holder of the recipient's private key can rebuild the context from `enc`. Without the hello fields under the binder, such a holder could keep a logged `enc` and binder and seal a new hello with a fresh timestamp. With them, a new timestamp needs `k_bind`. Knowing a device's tag, or a node's transport private key, is not enough to make a proof.

HPKE produces `enc`, the client's fresh public value (32 bytes), and the sealed hello (the hello and a 16 byte tag). The client creates a new HPKE context for every proof and never reuses one.

### The token

The proof travels as a token: `enc` followed by the sealed hello, 108 to 204 bytes, encoded as base64url without padding, 144 to 272 characters. It is the query part of the request target: `<path>?<token>`. Its length differs from one connection to the next. A legal token is base64url without padding in its one canonical form, which means the unused bits of the last character are zero, and decodes to 108 to 204 bytes. Anything else is not a token.

### Session keys

Both sides take the session's keys from the HPKE exporter of the same context:

| Name | Exporter context | Size | Use |
|---|---|---|---|
| `k_c2s` | `"veilway v1 c2s" \|\| device_pub` | 32 | Chunks from client to node |
| `k_s2c` | `"veilway v1 s2c" \|\| device_pub` | 32 | Chunks from node to client |
| `sid` | `"veilway v1 sid" \|\| device_pub` | 16 | Session id on `fronted` |

`device_pub` is the WireGuard public key of the device the tag named. Putting it in the exporter context means both sides must agree on which WireGuard identity the session belongs to, or the first chunk does not decrypt. The node proves it holds the transport private key by sending a chunk the client can open. The client does not treat a session as open before that.

### Verifying

A proof is valid when all of these hold. The node checks them in this order:

1. The token opens under one of the node's transport keys. The node always tries every key it has.
2. The version is 1, the three zero bytes are zero, and every padding byte is zero.
3. The device tag is in the tag table, as a device tag.
4. The binder equals the value the node computes with `k_bind` over the exporter value and bytes 0 to 27 of the hello, compared in constant time. The tag table gives the device and the one secret the tag came from, and `k_bind` is the one derived from that secret, also while a device has two secrets. On a tag that is not in the table the node computes with a dummy key. Dummy keys come from a secret the node draws from the random source at start and that nobody else holds. How many dummy keys there are is the implementation's choice.
5. The replay rule does not refuse it. It refuses, in this order, a timestamp more than `W` from the clock, a timestamp at or below the floor, a key of its kind that is in the cache, and any proof while the cache is full.
6. The timestamp is not above the limit. If it is, nothing is charged and nothing is recorded: the answer is "write a limit 20 s above this timestamp", and the proof is asked again when that write has ended, as rule 8 of "The replay rule" says.
7. The rate limits for that device and for that source have room, and the device has fewer than 2 pending sessions. They are charged only now.

When all hold, the node records `enc` in the replay cache and a pending session belongs to that device.

Two rules about the order:

- **Steps 1 to 4 are done for every request the node evaluates,** with dummy inputs where a field is missing or malformed, and their results are combined at the end without leaving early.
- **The replay rule comes before any rate limit is charged.** A proof that the replay rule refuses, or that is still waiting for a limit, spends no rate limit. Otherwise one old token from a log, sent once a second, would keep a device's allowance empty and its real proofs refused. Steps 5 to 7 are done only for a token that passed steps 1 to 4. They are not repeated with dummy values for the others.

A request that fails any step takes the unauthenticated path, and the node never says which step failed. What its timing shows is stated under "Timing": the steps are not identical in cost, and this page does not claim they are.

## The replay rule

One replay memory serves every obfuscated transport of a node. It belongs to the process, so a config reload does not empty it. It has three parts: a cache of accepted proofs, a floor, and a limit.

1. **Window.** A proof is accepted only if its timestamp is within `W` of the node's wall clock.
2. **Cache.** Each accepted proof is kept with its kind, its key and its timestamp. The kind is 1 for a stream proof, whose key is `enc`, and 2 for a `udp-obfs` opening packet, whose key is `salt`. The kind is part of the cache key, so the two kinds never meet. A proof whose key of its kind is in the cache is refused.
3. **Floor.** A proof whose timestamp is at or below the floor is refused. An entry leaves the cache no earlier than when its timestamp is more than `W` behind the wall clock. It may stay somewhat longer, because an implementation may remove a bounded number of entries at a time. When it leaves, the floor rises to its timestamp if it was lower. So an entry is forgotten only once the floor refuses it for good, whatever the wall clock does afterwards. An entry that could have left and has not yet refuses only its own key, and every timestamp at or below it is outside the window anyway, so staying longer changes no verdict.
4. **The floor follows accepted proofs, not the clock.** While the node runs, the floor only ever rises to a timestamp the node itself accepted. A wall clock that jumps forward and is corrected back therefore moves the floor only as far as proofs were accepted during the jump. That can be all the way: see "When the floor is ahead of the clock".
5. **Limit.** A proof whose timestamp is above the limit is not accepted. The node judges proofs by the lowest limit that may be on its disk:
   - When a replay file with a limit is handed out to be written, the limit in use becomes the lower of the limit in use and the file's.
   - When that file is reported written, its limit is the limit in use.
   - When it is reported failed, the limit in use stays as it is.
6. **The limit follows the clock.** Let the base be the wall clock, or the highest timestamp accepted since the last start, forget or reset if that is later. A timer keeps the limit at least 10 s and at most 20 s above the base: whenever the limit is less than 10 s above the base, it writes a limit 20 s above the base. This happens away from the packet path, about every 10 s while the node runs.
7. **Nothing has been accepted yet.** After any start, a forget of the cache or a reset, no timestamp has been accepted, and the base is the wall clock alone. The floor is never used as if it were an accepted timestamp. Without this rule a node that crashes and restarts in a loop would raise its floor by 20 s per restart with no proof and no clock fault.
8. **A proof above the limit.** An honest proof carries about the current time and is below the limit, so it never waits for a write. A proof that is valid in every other way and lies above the limit, which is one from a client whose clock runs ahead, asks for a limit 20 s above its timestamp. On a stream transport the proof waits for that write to end, for at most the deadline in the table of numbers, and is then asked again from step 5 of "Verifying". If the deadline passes first it is refused. On `udp-obfs` the opening packet is kept while the limit is written: at most 64 packets for a listener and at most 2 s each. When the limit is written, a kept packet goes to the replay rule again, and it is answered at its own source or not at all. A packet that arrives while 64 are kept, or whose write takes longer, is dropped.
9. **The node brings its own limit down.** When the highest limit that may be on disk is more than `W` plus 20 s above the wall clock, the timer writes a limit 20 s above the latest of three values: the floor, the highest timestamp in the cache, and the wall clock, if that is lower than the limit. This never goes below anything the node accepted: what has left the cache is at or below the floor, what is in the cache is counted, and what was accepted before the last start is at or below the floor that start took. A reset is the only thing that puts the limit below an accepted timestamp.
10. **Bound.** When the cache is full, every proof is refused until entries leave. Only valid proofs enter the cache, and the rate limit per device bounds how fast one device can fill it.
11. **A refused proof takes the unauthenticated path** of its transport: the decoy on streams, silence on `udp-obfs`.

### Writing the replay file

1. **One write at a time.** The node has at most one replay file out to be written. It writes files in the order they were made, and each is reported as written or failed before the next is made. A proof that needs a higher limit while a file is out waits for that write to end and is then asked again.
2. **What "failed" means.** A write has failed when the attempt is over and nothing of it can reach the disk later. A write that has only run past its deadline has not failed until then. A failed write may still be on the disk, in whole. That is why the node reasons about every limit that may be on disk, and not about the one it last asked for.
3. **Before the first proof.** After any start, the timer has run once and its file is written before a listener takes its first proof.

### The replay file

The floor, the limit and, on a clean stop, the cache are kept in a file of their own, next to the usage state file and separate from it.

| Offset | Size | Field |
|---|---|---|
| 0 | 8 | The ASCII bytes `VWREPLAY` |
| 8 | 4 | Format version, 1 |
| 12 | 1 | Clean mark: 1 after a clean stop, 0 otherwise |
| 13 | 3 | Zero |
| 16 | 8 | Floor, Unix seconds |
| 24 | 8 | Limit, Unix seconds |
| 32 | 4 | Entry count. 0 unless the clean mark is 1. |
| 36 | 41 per entry | Entries: kind (1 byte, 1 or 2), key (32 bytes), timestamp (8 bytes) |
| end - 32 | 32 | SHA-256 of every byte before it. It detects a damaged or cut file. It is not a security measure. |

Rules for the file:

- **Size.** The entry count is at most the configured cache size. At the default cache size a clean file is 10,747,972 bytes, and while the node runs the file is 68 bytes. A config that lowers the cache size below the count in the last clean file makes that file unusable at the next start, with the 60 s of refusals of that row. The config reference is to say so.
- **Writing.** Every write goes to a temporary file in the same directory, is synced, and is renamed over the old file, with mode 600, as the usage state file is written. While the node runs, only the header changes (the floor and the limit), and that write happens away from the packet path with the deadline in the table of numbers.
- **One process.** The node holds an exclusive lock for as long as it runs. The lock is on a file named after the replay file with `.lock` added, next to it, because the replay file itself is replaced at every write. It is a regular file, opened without following links. A start that cannot take the lock refuses to run.
- **A file that cannot be used is never empty state.** A file is unusable when it is cut short, fails its hash, has other first bytes or an unknown version, has an entry count above the bound or not matching its length, has a non-zero count without the clean mark, has an entry of a kind other than 1 or 2, or has an entry whose timestamp is above the file's own limit. No node writes the last two. An unusable file is renamed with `.bad` added, logged at error, and handled exactly as "no replay file" in the table below. An implementation must not start with an empty cache and no floor because it could not read the file.

What each event does to the cache, the floor and the limit. In every row, "nothing accepted yet" holds after the start, so the base of rule 6 is the wall clock:

| Event | Cache | Floor | Limit | What clients meet |
|---|---|---|---|---|
| Clean stop | Written to the file with the clean mark | Written | Written as it is | |
| Start after a clean stop | Read from the file | Read | The first file written has no mark and carries the later of the old limit and the clock plus 20 s. It is written before the first proof is accepted, so that a crash right after start cannot make a stale cache look clean. If that write fails, the cache is forgotten and the floor becomes the clean file's limit, which is safe whichever of the two files is on disk. | No refusal because of the restart, unless that first write fails. |
| Start after anything else (a crash, a kill) | Empty | The written limit. Every proof accepted before had a timestamp at or below it. | Unchanged, until rule 6 asks for more. Because the base is the clock alone, a start writes no higher limit than the clock calls for, and repeated crashes do not raise the floor. Rule 9 never brings the limit below this floor. | Clients with a correct clock are refused until the clock passes the floor: up to 20 s, or up to `W` plus 20 s, 80 s, if a client with a fast clock had connected just before. Logged at info. |
| Start with no replay file, or with one that cannot be used | Empty | The wall clock plus `W` | The wall clock plus `W`, written before the first proof is accepted. If that write fails, nothing is accepted until a limit write succeeds. | Every proof is refused for `W`, 60 s. Logged at warn, or at error for a bad file. |
| Reset (see below) | Emptied | The wall clock plus `W` | The wall clock plus `W`, also when that is lower than before. If the write fails, the reset may or may not be on disk. The node then writes the old floor and limit again and accepts no proof until one of the two writes is known to be on disk. If that write fails too, it writes the same file again. | Every proof is refused for `W`, 60 s, and for as long as no write is known to be on disk. A reset whose write has not ended after 10 s is answered "still being written". It is in force when the write ends, and must not be asked for again. |
| The wall clock jumps forward | Entries leave as rule 3 says | Rises only by entries that leave | Follows the clock up, by rule 6. After the clock is corrected, rule 9 brings it down at the timer's next run. | Nothing while the node keeps running, because a limit that is too high refuses nobody. An unclean start before rule 9 has acted makes that limit the floor, see below. |
| The file cannot be written while the node runs | | | Cannot rise | The node accepts no proof once the clock has passed the limit in use, within about 20 s. Logged at error, at most once a minute, and counted. |
| The lock is held, or cannot be taken | | | | `veilway run` refuses to start a config that has an obfuscated transport. |
| The first write after a start fails | | | No limit is known to be on disk | The node runs and accepts no proof until a write succeeds. Logged at error and counted. |

**Three things undo replay protection, and all three are stated here so that nobody finds them by accident:**

- A replay file restored from a backup or a machine snapshot. It is older than the truth and reopens replay for everything accepted since it was taken. Delete it. Do not restore it.
- A reset after a clock fault, for proofs accepted during the fault with timestamps above the new floor.
- A lost or unusable file while the node's clock is behind where it has been. The no-file row sets the floor from the clock. If the clock is stale, for example on a machine that boots before its time is synchronised, on the same boot that lost the file, the floor is below proofs the node accepted before, and those can be used again inside their window. Nothing in the file can protect against this, since the file is what was lost. A node should not start its obfuscated transports before its clock is synchronised.

### When the floor is ahead of the clock

The floor can end up ahead of real time, and honest proofs are then refused until the clock passes it. There are three ways there, and all start with a node clock that is wrong in the forward direction:

- **Honest clients that follow the node's clock.** A client on a pinned candidate that is refused reads `Date` from the decoy origin, which usually shares the node's clock, and corrects its proof timestamps. During a clock fault such clients follow the wrong clock and are accepted. When their entries leave the cache, the floor is at the faulty time. This is the ordinary case wherever a pinned transport exists.
- **A device that sends timestamps far ahead** on purpose while the clock is wrong.
- **An unclean start after the fault.** The limit follows the clock, so a forward fault raises the written limit even if no proof was accepted during it. While the node keeps running that harms nobody, and once the clock is corrected rule 9 brings the limit down at the timer's next run. If the node crashes before that, the old limit becomes the floor, and the limit never comes down below a floor.

In each case the node refuses every honest proof for as long as the fault was large, unless the operator resets. Only a reset ends it. This is an outage. It is not silent and it does not need a quota reset to end:

- **The cost of a start is not a fault.** After a start or a reset the floor is up to `W` plus 20 s, 80 s, ahead of the clock. The node reports that at info, with the time left. A floor that is further ahead than that, or one that rose while the node ran, is the fault: the node logs at error, at most once a minute, with the distance, and counts every proof refused for that reason. It logs at info when the state ends, and at info each time rule 9 brings the limit down.
- `veilway doctor` reports the floor, the limit and the clock, fails the check when the floor is ahead by more than a start costs, and warns when the limit is more than `W` plus 20 s ahead.
- A proposed command, `veilway replay reset`, asks the running node, through the control socket, to empty its cache and set the floor and the limit to the wall clock plus `W`. The node writes the file and accepts no proof until that write, or the write that puts the old values back, is known to be on disk. The command refuses to run when no node answers on the socket, because editing the file under a running node would be undone by its next write. With the node stopped, deleting the file has the same effect: the no-file row gives the same floor and the same limit. The reset touches nothing else, usage and quotas included. It costs one refusal period of `W`, and it has a second cost that the operator accepts by running it: a proof that was accepted during the fault with a timestamp above the new floor is forgotten, and whoever recorded it can use it once more when the real clock reaches that timestamp. The command says so before it acts.

**WireGuard's own replay memory.** The WireGuard library forgets the last handshake timestamp of a peer on restart, on a tunnel restart and when sessions are dropped (threat model G18). On an obfuscated transport this is covered: a WireGuard handshake is read only inside a session whose proof passed the rule above, and only from the device that proof named. On plain `udp` and legacy `ws` it is not covered. Closing G18 in the core, and the restart replay test of the threat model, are conditions for this page leaving Draft. This holds for `udp-obfs` only together with one more rule: every `udp-obfs` session of a device ends whenever the node cuts the device off or drops its WireGuard sessions, for any reason, and so does a session opened with a transport secret that has been removed. Otherwise an old session could carry a replayed handshake to a WireGuard layer that had just forgotten it.

### Refusals and clocks

A client whose proof is refused gets the decoy's answer on a stream transport and silence on `udp-obfs`, exactly as a stranger would. The causes are a wrong clock on either side, a restart of the node, a spent rate limit, a full cache, and a user who is disabled, expired or over quota.

On a stream transport the client can tell a refusal from a block: an HTTP answer that arrived over validated TLS means the node or its front was reached and said no. The client then:

0. Counts as a refusal any attempt that got through a validated TLS handshake and then received an HTTP answer other than the expected one, or a close with no answer. A node whose decoy is down closes without an answer, and that must not look like an unreachable candidate.
1. Does not mark the candidate or the transport as failed, and does not spend the candidate budget.
2. Shows "the server or its front answered and did not accept the connection: check the device clock and your quota, or try again later". The answer may come from a CDN that could not reach the node, so the message does not blame the node alone.
3. Tries the same candidate again after the refusal wait. A candidate is tried at most 3 times in a row, the first attempt included, and then the client continues in the profile's order without setting it aside.
4. Doubles the refusal wait after every refusal, up to the limit in the table of numbers, for as long as refusals continue on this profile. A device that is over quota or disabled therefore ends up trying about once an hour, not once a minute. The wait returns to its start when a session opens or the user asks to connect again.

On `udp-obfs` a refusal is silence and cannot be told from a block by the answer. The client uses what it remembers. On a datagram transport that worked on this network within the last 7 days, it keeps trying for 90 s in all, with the reconnect waits, before it treats the transport as unreachable and moves on. That covers a node that refuses for some tens of seconds after a crash. The doubling refusal wait is not used for silence, so a network that starts to drop the transport costs the user about a minute and a half, not many minutes.

The clock:

- On `tls` or `ws`, and only after the certificate matched a pin from the profile, the client may read the `Date` header of the decoy's answer and use the difference as an offset for proof timestamps and for the epoch number of `udp-obfs`, which is computed from the same clock. It then uses that offset for every transport of the profile, for at most 24 h, and takes it again after any later refusal on a pinned candidate, so that a stale offset does not outlive the fault that caused it. It never changes the system clock, never takes a time from a connection without a matching pin, and shows the user that the device clock is wrong.
- A profile whose only cover transports run through a CDN has no pin. A client with a wrong clock cannot connect to it and is told so. See "Open questions".
- Once connected, the control channel reports the node's time, so the client can warn about a clock that is drifting towards the limit.

## WireGuard on an obfuscated transport

WireGuard's wire format is untouched. These rules say how the node and the client drive it.

1. **Binding.** A session belongs to the one device its proof named. When a WireGuard handshake initiation arrives on a session, the node reads the static key in it and drops the message, with no reply, unless that key is `device_pub` of that device. A data packet is accepted only if it authenticates under a WireGuard session of that device. A proof can therefore not be used to carry another device's tunnel, and a tunnel cannot be moved onto a session opened with another device's proof. Test: device A's proof followed by device B's initiation yields no handshake response, and the session ends at the first tunnel packet deadline.
2. **First tunnel packet.** A session is pending until a WireGuard packet of its device has authenticated on it, and is ended if that does not happen within the deadline (see "Session activity and timers"). The first thing a client sends on a new session is therefore always a WireGuard packet: a handshake initiation, or a keepalive of a tunnel that is already up.
3. **First answer.** The node sends nothing on a pending session. At the moment a session becomes established it sends one chunk on it: the WireGuard handshake response when an initiation established it, and otherwise a padding-only chunk. A chunk from the node therefore always means that WireGuard has authenticated on that session, and the client may treat it as proof that this path carries the tunnel.
4. **Activity** is defined once, under "Session activity and timers".
5. **No cookie replies.** A node never sends a WireGuard cookie reply (message type 3) on an obfuscated transport. Handshake messages that arrive on a session are not passed through the inbound's handshake load limiter. Load is limited by the limits per session, per device and per source in the table of numbers. Excess messages are dropped silently and counted. A handshake initiation that a session has already seen among its last 8 is dropped before it is charged to that allowance, by the same principle that puts the replay rule before any rate limit: a copy must not spend the budget of the real thing.
6. **Peer address.** The WireGuard layer is given the session as the peer's address, and a peer's endpoint moves between sessions only after a packet authenticated under that peer's keys.
7. **Rekey.** The client starts a new WireGuard handshake when it sends a packet on a tunnel whose last handshake is older than the client rekey point. With the client doing so, the node never initiates. The purpose is that the exchange does not recur at one fixed period. An idle keepalive is a packet too, so the exchange recurs on an idle tunnel as well as on a busy one.

## `udp`

Plain WireGuard over UDP. Built, and unchanged by this specification.

**Layout.** WireGuard's own four messages, as its paper defines them:

| First byte | Message | Size |
|---|---|---|
| 1 | Handshake initiation | 148 |
| 2 | Handshake response | 92 |
| 3 | Cookie reply | 64 |
| 4 | Data | 32 plus the inner packet, as the library pads it |

Bytes 1 to 3 of every message are zero.

**State machine.** WireGuard's.

**Limits.** WireGuard's handshake load limit, one counter per inbound. Cookie replies begin above 100 handshake messages a second on an inbound.

**Errors and decoy behaviour.** There is no decoy. The node sends nothing to a datagram that fails WireGuard's first check, or to a handshake from a key that is not a device. Two known exceptions: above the inbound's handshake load limit the node sends a cookie reply to anyone who can compute the first check, which needs only the inbound's public key, and after a restart a replayed handshake initiation is answered (threat model G18).

**What it does not hide.** Anything. The type byte, the zero bytes and the sizes identify WireGuard to any observer. Its class is plain and it is rated Detectable.

## `udp-obfs`

`udp-obfs` wraps every WireGuard datagram in a ChaCha20-Poly1305 envelope keyed by the device transport secret, so that an observer without a subscription sees no fixed or repeated byte and no length that is one of WireGuard's.

The plan describes this transport as "randomised headers, junk packets and padding". This draft has padding and padding-only packets and no junk before the first packet. See "Open questions".

### Keys

| Name | Value |
|---|---|
| Epoch number `e` | Unix time in seconds divided by 120, rounded down, as 8 bytes |
| `salt` | 32 fresh random bytes per opening packet |
| Mask | The first 16 bytes of HMAC-SHA-256(key `k_mask`, message `salt`) |
| `k_open` | HKDF(`salt`, `k_obfs`, `"veilway v1 udp-obfs open"`, 32) |
| `k_c2s`, `k_s2c` | The same with `"veilway v1 udp-obfs c2s"` and `"veilway v1 udp-obfs s2c"` |

### Opening packet, client to node

| Offset | Size | Field |
|---|---|---|
| 0 | 16 | The epoch tag for the client's current epoch, XORed with the mask |
| 16 | 32 | `salt` |
| 48 | 12 + n + 16 | ChaCha20-Poly1305 under `k_open` with an all-zero nonce. Associated data: bytes 0 to 47 as sent. Plaintext: version `0x01` (1 byte), zero (3 bytes), timestamp (8 bytes, Unix seconds), then a chunk plaintext of n bytes. |

`k_open` seals exactly one message, because `salt` is fresh, so the fixed nonce is used once per key. Because the mask depends on the salt, the first 16 bytes differ on every opening packet. The timestamp inside the packet and the epoch of its tag are checked separately, the first against the replay rule and the second by the table, and are not compared with each other. That is meant: each is already held to the node's clock. The chunk plaintext holds exactly one WireGuard datagram: a handshake initiation, or a keepalive of a tunnel that is already up. It never holds user data.

### Data packet, both directions

| Offset | Size | Field |
|---|---|---|
| 0 | 12 | Nonce, fresh random bytes for every packet |
| 12 | n + 16 | ChaCha20-Poly1305 under `k_c2s` or `k_s2c` with that nonce, no associated data. Plaintext: a chunk plaintext holding one WireGuard datagram, or none. |

Random 96 bit nonces are safe only for a bounded number of packets under one key. Up to the node's bound of 2^31 packets the chance of a repeated nonce under one key is below 2^-34. The client opens a new session well before that.

A data packet that is replayed decrypts again. That is harmless: what is inside is a WireGuard datagram, and WireGuard rejects a replayed one. A replayed packet does not count as activity of the session.

### Node state machine, for every datagram

Sessions are kept per source address and port and per device. One source may have sessions of up to 4 devices, since a translator can hand a port to another device later.

1. Shorter than 28 bytes: drop.
2. If the source address and port have sessions, try the datagram as a data packet of each: the established ones first, then a session one of them replaced if that is still readable, then the pending ones. On success process the chunk and stop. A data packet that authenticates can establish a pending session.
3. Shorter than 76 bytes: drop.
4. Compute the mask from bytes 16 to 47, remove it from bytes 0 to 15, and look the result up in the tag table. A miss: drop.
5. Derive `k_open` from that device's `k_obfs` and the salt, and open the packet. A failure: drop.
6. Check the version and the zero bytes, the timestamp and the salt against "The replay rule", and the rate limits. Any failure: drop. A source that already has sessions of 4 other devices: drop.
7. Record the salt. Create a pending session for this source and this device, in place of a pending session of the same source and device if there is one, and process the chunk.
8. If the WireGuard datagram in it establishes the session, send the first answer, and keep an older established session of the same source and device readable for 10 s before removing it. No other device's session is touched. The first answer is never larger than the opening packet it answers. If what the node has to send does not fit, it answers with padding only.
9. If it does not, send nothing. An older session stays as it was, and the pending one ends at its deadline.
10. **A packet that a limit refuses is still used up.** An opening packet that passed the replay rule and was then refused by a limit (the session pool, the pending sessions, a rate limit, the sessions at a source) is recorded in the replay cache as used, so that someone who copied it from the path cannot present it later from another address. This recording has its own allowance per device, in the table of numbers. Beyond it the packet is not recorded.

A session ends when it has had no activity for its idle time, when the first tunnel packet deadline passes, or when the node has sent 2^31 packets on it. The last case is counted and logged at info. The client then meets silence and opens a new session. It also ends, whatever its state, when the node cuts its device off or drops that device's WireGuard sessions for any reason, and when the transport secret it was opened with is removed.

### Client state machine

The client sends an opening packet in these cases and no others:

- when it starts;
- when its network interface or address changes;
- when it has sent or received 2^30 packets on the current session;
- when the WireGuard layer starts a new handshake because the node stopped answering, which is WireGuard's own timer;
- when an idle keepalive got no chunk back within 10 s;
- when an opening packet got no answer, as below.

Rules for an opening packet:

1. **No answer.** If no chunk of the new session opens, the client sends a new opening packet, with a fresh salt and a fresh WireGuard datagram of the same kind, after 1 s, then after 2 s more, then after 4 s more. If the last one is not answered either, the attempt is lost and is handled as silence under "Refusals and clocks". A client makes every opening packet at least 122 bytes long, the size of a first answer that carries a handshake response without padding, so that the first answer always fits the send limit.
2. **The old session stays in use.** While it waits for the first answer of a new session, the client keeps sending and receiving on the session it had. It switches to the new keys when the first answer of the new session opens, and keeps the old session readable for 10 s after that.
3. **The clock.** The timestamp and the epoch number both use the client's clock with the offset from "Refusals and clocks", when one is held.

Every other WireGuard datagram travels in a data packet, rekey handshakes included. An upload with nothing coming back does not cause an opening packet, because the node's WireGuard still sends its own keepalive, and neither does an idle tunnel whose keepalives are answered.

A change of the client's address that the client cannot see (a rebinding in a network address translator) leaves the node with a session for the old address. The client notices by a keepalive that is not answered or by WireGuard's timer, and sends an opening packet with a keepalive. No new WireGuard handshake is needed.

### Limits

- **Send limit.** The node sends nothing on a pending session. The first answer, which it sends when the session is established, is no larger than the opening packet it answers. The node sends on a session only to the source of that session.
- **Work per packet.** A datagram from a stranger costs the node one HMAC and one table lookup, and a miss is dropped right after the lookup. Nothing is derived or decrypted with a dummy key for a miss: the node answers nothing on either path, so there is no timing for a stranger to compare. A datagram whose unmasked tag is in the table costs one key derivation and one decryption more. The two data keys of the session, `k_c2s` and `k_s2c`, are derived only after the replay rule has accepted the opening packet. None of this involves a public key operation.
- **Table size.** The tag table holds three epoch tags per device secret. A node at the upper limits of the config holds millions of entries and must budget memory for that.

### Errors and decoy behaviour

There is no decoy and there are no error messages. Every drop is silent and counted by reason. Two reasons that look alike are counted apart: a tag that is not in the table, and a tag that is in the table on a packet that does not open. A prober that does not hold a device secret gets no reply, whatever it sends and however often.

One case gives a reply to someone without a secret: an interferer on the path that holds back a real opening packet and sends it first from its own address gets the node's first answer, a packet of random bytes no larger than the one it sent. This works only when the packet it took carries a handshake initiation that the node's WireGuard has not seen. The node then also sends what it has for that device to the interferer's address, until a packet of the device authenticates on a live session: at once for a device that is sending, and up to its next keepalive for an idle one. All of it is ciphertext under keys the interferer does not have. Plain WireGuard has the same property: whoever delivers a peer's authenticated packet first is where the answers go until the peer speaks again.

**Opening packets that stay usable by a copy.** The node records an opening packet as used whenever it can. Three cases remain in which a packet that the node did not accept is not recorded either, so that whoever copied it from the path can present it once, from any address, inside its window. The copy gets a pending session and the first answer if the packet carried a fresh handshake initiation, and nothing it can read. The cases are: a packet that arrived while 64 others were being kept, or whose limit write took more than 2 s; a packet refused by a limit after the device's allowance for recording such packets was spent; and a packet that arrived while the node took no proof at all, for example before its first write had succeeded. The threat model records this as G47.

### What `udp-obfs` does not hide

- It imitates nothing. Every byte is uniformly random, and traffic that is random from its first byte is a class of its own. A network that passes only protocols it recognises, or that drops or slows unknown UDP, stops it.
- A port that answers no probe and carries sustained random-looking UDP.
- Full-size inner packets give datagrams of exactly `mtu` + 62 bytes, so a bulk transfer shows a plateau.
- From anyone who holds a subscription of the same inbound: `k_mask`. Such a holder can remove the mask and sees that two opening packets in the same epoch come from the same device, on any network. It cannot tell which device, and cannot open the packets.
- Whoever holds a device's transport secret (the node, a leaked subscription, a seized client) computes that device's tags for any epoch, past or future, recognises that device's recorded opening packets, and removes the envelope from that device's recorded packets. What is under the envelope is still WireGuard and stays encrypted.
- There is no cover protocol to compare against, so the length and timing test of the threat model (invariant 7) cannot be passed. `udp-obfs` is rated Detectable and stays so.

## Stream listeners: what `tls`, `ws` and `fronted` share

### What the decoy origin must be

The decoy origin is a web server that answers everyone who is not a user. There is no default: a stream listener without `decoy.origin` is a validation error, and no decoy address or name ships with the software.

- **It is the operator's own.** A web server on the same host, or one the operator controls, serving real content under the operator's own name. Version 1 has no option for a decoy on someone else's site. Relaying strangers to a site whose owner has not agreed is a question this specification leaves to `faketls`, as a project decision.
- Validation warns when `decoy.origin` is not a loopback or private address, with the reminder that it must be the operator's own server.
- Validation refuses an origin whose address and port equal a listen address of the node, since requests would loop. The origin must also not send the transport path back to the node by a rule of its own. With a web server in front of the node, the origin is a second listener of that web server that serves the same site without the rule that forwards the path. `veilway doctor` checks this by a request.
- The origin must not serve anything at a transport path, so that a request for the path without a valid proof gets the origin's own not-found answer.
- `decoy.origin` is an `http://` or `https://` URL with an address or a name, resolved once per reload.
- `decoy.proxy_protocol` (optional) makes the node send the PROXY protocol header, version 2, at the start of every connection it opens to the origin, so that the operator's site sees the stranger's address and can apply its own limits. It is all connections or none, because an origin that expects the header refuses a connection without it. On the direct path the header carries the peer's address. On the proxy path it carries the source taken from the forwarded-address header. On the node's own requests (learning the upgrade headers, the `doctor` check) it carries the node's address.
- The node's own requests to the origin carry the host of the `decoy.origin` URL as `Host`.

### Who ends TLS

| Deployment | TLS server the path sees | What the node receives |
|---|---|---|
| `tls` | The node's TLS library | TLS from the client |
| `ws` or `fronted` behind a web server on the same host | That web server | Plain HTTP/1.1 from the web server, on a loopback or unix socket listener |
| `ws` or `fronted` behind a CDN | The CDN towards the client. The operator's web server towards the CDN. | Plain HTTP/1.1 from the operator's web server, on a loopback or unix socket listener |

A native `ws` or `fronted` listener never ends TLS itself. A listener where the node ends TLS is `tls`. Behind a CDN, the operator's own web server ends the CDN's TLS and the node sits behind it, so tokens, session ids and the decoy's pages never cross the path from CDN to node unprotected. Validation warns when a `ws` or `fronted` listener is not on a loopback address or a unix socket, as it does for the built `ws`.

### Pools and what happens when one is full

A listener serves one kind of peer. A `tls` listener has only direct peers. A `ws` or `fronted` listener is meant for the operator's web server alone: its users arrive through `trusted_proxies`, and a peer outside them is a direct peer that is never a user and always goes to the decoy.

A connection is in one of four states, each with its own pool, so that pressure from strangers lands on strangers first.

| State | Meaning | When the pool is full |
|---|---|---|
| Undecided | Accepted from a direct peer, no decision yet | The oldest undecided connection is decided as "not a user" at once. The same happens to a source's oldest undecided connection when that source reaches its share. A connection that is still inside its TLS handshake has nothing to relay and is closed. |
| Relayed | A direct peer that is not a user, connected to the decoy origin | The relayed connection that has been idle longest is closed, both sides. If none has been idle for the time in the table of numbers, the oldest is closed. |
| Proxy | A connection from a trusted proxy. It carries the requests of many visitors, users among them, one after another. | The node stops accepting on that listener and leaves new connections in the system's queue. A proxy connection is closed after 300 s without a request, or under the rule for strangers' requests below. It is never closed to make room for a direct peer. |
| Session | A user | New proofs are refused and take the unauthenticated path. A device at its own limit replaces its own oldest session, once the new one is established. Pending sessions are not in this pool. |

Rules:

- Strangers may displace strangers. Nothing a stranger does displaces a session.
- **Strangers on the proxy path.** A proxy connection also carries strangers' requests, and each one that waits for the decoy holds a connection. On this path the source is known from the header, so it is capped: one source may have 16 requests in flight to the decoy. Over that, the proxy connection that carries that source's oldest waiting request is closed. A user's request is never the one that is cut.
- The default size of the proxy pool is twice the cap on `fronted` sessions, because a front may open one connection per request in flight.
- The undecided pool is shared by nature: until a connection has sent its request line, the node cannot tell a user from a stranger. Under heavy churn a user's connection can be decided as "not a user" before its request arrives. The client then sees a refusal and waits. This is a limit of the design, not a guarantee that was kept.
- There is no limit per source on relayed connections of direct peers and no limit on their size or lifetime. The origin is the operator's own, and its limits decide, as they do for its direct visitors. Closing an idle connection for room is what web servers do.
- The node never closes a connection at accept because of a count. If it cannot take more connections, it stops accepting and leaves new ones in the system's queue, as a busy server does.

### Accept state machine

**Direct peer.** For every accepted TCP connection:

1. **TLS**, if this listener ends it, within the handshake deadline. A handshake that does not finish in time, or whose connection is displaced from the undecided pool before it finishes, is closed. How ordinary servers close in that case is on the list to measure.
2. **Decoy connection.** Open one connection to the decoy origin now, with the connect timeout, before anything is read. This lets the origin's own timers run from the moment a direct visitor's would. If it cannot be opened, or the origin closes it while the node waits, the node only remembers that. It acts on it at step 7 and nowhere else, so a broken origin never affects a user.
3. **Read the request line**, byte by byte as it arrives. The line is a candidate while it can still become `GET /` or `POST /`, then characters that are legal in a request target, then ` HTTP/1.1` and a line end, within the size and time limits. This test uses no secret: not the path and not the token.
4. **Forward at once** when a byte arrives that makes the line no candidate, or when a limit is reached: go to step 7 with what was read. The node does not compare against the configured path while reading. Stopping at the first difference from the path would show a prober, by timing, how much of the path it had guessed.
5. **Evaluate, at the end of the request line.** The source is the TCP peer. The node verifies as in "Verifying", for every candidate line, with dummy inputs when the line cannot be a user's. Only a `GET` for the path of a `tls` transport on this listener can be a user's. A `POST`, and any line on a `ws` or `fronted` listener, cannot: `ws` and `fronted` are served to trusted proxies only. Steps 1 to 4 of "Verifying" run for every candidate line.
6. **A user.** Read the rest of the request head within its limits, close the decoy connection unused, and continue with "WebSocket session". If the head is over a limit or is not a WebSocket upgrade as that section requires, close the connection: `close_notify` where the node ends TLS, then FIN, with no HTTP answer. No WebSocket exists yet, so no WebSocket close is sent.
7. **Not a user.** If the decoy connection is open, write every byte read so far to it, unchanged, then relay both directions until either side closes. The node reads nothing more as a protocol on this connection, so there is no second reading of the bytes for the origin to disagree with. If the origin closed the waiting connection, close the peer's connection the same way. If the origin could not be reached, close the peer's connection, count it as `decoy_down`, and log at warn at most once a minute.

**Trusted proxy peer.** The connection is a proxy connection and is handled request by request:

1. **Read the whole request head**, within the limits for a head. The proxy has buffered it already, so waiting for it adds no delay that a prober could measure. A head that is over the size limit or not complete in time is "not a user": forward what was read to the decoy origin, relay both directions until the answer ends or either side closes, and then close the proxy connection, because the node no longer knows where the next request starts.
2. **Source.** The source for every limit and log line is the rightmost address in the header named by `client_address_header` that is not itself inside `trusted_proxies`. If the header is absent or unreadable, it is the peer.
3. **Evaluate** the request line as a direct peer's is evaluated, with that source. Here a `GET` for a `ws` path or a `POST` for a `fronted` path can be a user's. Steps 1 to 4 of "Verifying" run for every request.
4. **A user.** For a WebSocket open, the connection leaves the proxy pool: continue with "WebSocket session". A head that is not a WebSocket upgrade closes the connection with no HTTP answer. A `fronted` request is handled as "`fronted`" says, and the node returns to step 1.
5. **Not a user.** Forward this request to a connection to the decoy origin and relay its response, then return to step 1. Forwarding uses an existing HTTP/1.1 implementation. Header fields are passed in order, except hop-by-hop fields. A request with both `Content-Length` and `Transfer-Encoding`, with more than one `Content-Length`, with a `Transfer-Encoding` other than exactly `chunked`, or that the implementation refuses, closes both connections with no response. If the origin cannot be reached, the proxy connection is closed with no response, counted as `decoy_down`. The front then gives the visitor its own error, as it would if the site were down.

The decision point for a direct peer is the end of the request line, or the first byte that cannot belong to one. For a proxy peer it is the end of the request head.

### Errors and decoy behaviour

| Condition | What the node does | What the peer sees |
|---|---|---|
| Any proof that fails any check, a wrong path, a malformed request, a request that is not HTTP | Relays to the decoy origin | The origin's answer, bytes and close behaviour |
| A pool is full | As the table of pools says | Nothing, or for a stranger whose relayed connection was the idlest or the oldest, a close |
| The decoy origin cannot be reached, and the peer is not a user | Closes the peer's connection at the decision point, counts it as `decoy_down`, logs at warn at most once a minute | A closed connection with no answer. A node whose decoy is down can be identified for as long as that lasts. Users are not affected. |
| The TLS handshake of a `tls` listener is not finished in time, or its connection is displaced before it finishes | Closes the connection | A close during the handshake |
| A session's chunk does not decrypt, or a limit inside a session is broken | Ends the session as "Closing" says | An ordinary close, the same for every cause |

The node never sends an error page, a status line or a header of its own to someone who is not a user.

**The node as a relay.** Everything a stranger sends to a stream listener reaches the operator's own decoy origin and nowhere else. The node is not an open relay: the destination is fixed and cannot be chosen by the peer. It does not amplify: it sends a stranger only what the origin answered.

**Timing.** The node does not do identical work for every input, and nothing on this page should be read as saying so. What is equalised: every request from a direct peer that passes the syntactic test goes through steps 1 to 4 of "Verifying", with dummy inputs where needed, and every other input is forwarded as it arrives. What is left is in the table below. The figures are one measurement, in October 2026, on one machine, of the first implementation. They record what was seen. They are not a requirement on an implementation.

| Input | Time against a token that is accepted (about 46 microseconds) | What it could tell |
|---|---|---|
| Opens, the tag is in the table, the binder fails | about 0.04 to 0.08 microseconds less | Nothing useful. |
| Opens, the tag is not in the table | about 0.1 microseconds less (0.08 to 0.25 across runs) | Whether a device is enabled right now, to someone who can make a token with that device's tag, which takes a transport private key and a logged token. The implementation picks a dummy key by the tag from a pool, so that both cases touch memory in about the same way. |
| Does not open | about 0.5 to 0.6 microseconds less, because the library checks the tag before it decrypts | Nothing a stranger does not know: it chose the bytes. |
| Not base64url, or not of a token's size | about 0.6 microseconds less | Nothing: it depends only on bytes the peer chose. |
| What follows the verdict: steps 5 to 7 and a session for a token that passed, the decoy for one that did not | not measured, and larger than the others | Whether a token passed steps 1 to 4, to someone able to make such a token. |

The whole spread of the first four rows is under 1 microsecond. The judgement for version 1: that is not measurable across a wide-area path, where it sits behind the hop from the node to the decoy origin, and is at the edge of what can be measured on a local network. It is stated, not removed, and a timing check in the test suite is to catch a change that adds or drops a whole operation. Against the origin itself, an answer through the node is later by the hop from node to origin, and a request line that arrives slowly is held until its end. Those two are far larger, a prober can measure them, and they are to be published per transport with the probe test of the threat model.

### WebSocket session

Used by `tls` and `ws`. The open request is a WebSocket upgrade (RFC 6455) over HTTP/1.1 whose request target is `<path>?<token>`. The node requires `Upgrade: websocket`, `Sec-WebSocket-Version: 13` and a `Sec-WebSocket-Key`, and ignores every other header field, including `Origin`.

The node's answer must not be the same bytes on every node in the world. It is these lines, in this order:

1. The status line `HTTP/1.1 101 Switching Protocols`.
2. The fields named in `upgrade_headers`, an ordered list of header field names in the inbound's config. The default list is `Server`, `Date` on a `tls` listener and empty on a `ws` listener, where the front web server adds its own. For `Date` the node writes the current time in the standard HTTP format. For every other name it writes the value the decoy origin sent for that field, spelled as the origin spelled the name. A field the origin did not send is left out. A field the origin sent more than once is written once, with its first value. Validation refuses a list that names `Upgrade`, `Connection`, `Sec-WebSocket-Accept`, `Set-Cookie`, `Content-Length`, `Transfer-Encoding`, `Content-Type`, `Content-Encoding`, `Trailer` or `Keep-Alive`, or names a field twice.
3. `Upgrade: websocket`, `Connection: Upgrade`, and `Sec-WebSocket-Accept` with the value RFC 6455 requires.
4. One `Set-Cookie` field. The cookie's name is set per inbound in the config, with no default, and its value is random base64url text of a random length. It carries no meaning. It exists so that the answer's length varies.

The node learns the origin's values by one `GET /` to the origin at start and on every reload. If that request fails, the node sends only `Date` from the list, logs at warn, and tries again every 60 s until it succeeds, logging at info when it does. Nothing else about the origin's responses is copied.

It never accepts an extension and never selects a subprotocol. Behind a front web server, that server adds its own fields as it does for any upgrade.

After the upgrade:

1. One binary WebSocket message is one sealed chunk: the ChaCha20-Poly1305 ciphertext and tag of a chunk plaintext, under `k_c2s` or `k_s2c` with the counter nonce and empty associated data.

   | Offset | Size | Field |
   |---|---|---|
   | 0 | 2 to 8 | WebSocket frame header (RFC 6455): binary, final, with a 4 byte mask from client to node |
   | ... | n | Ciphertext of the chunk plaintext |
   | ... | 16 | Tag |

2. A message longer than 16,016 bytes, a text message or a fragmented message ends the session.
3. Neither side sends WebSocket pings. A received ping is answered with a pong, as RFC 6455 requires.
4. The node sends nothing on a pending session. When the client's first chunk establishes the session, the node sends its first answer.
5. The client checks `Sec-WebSocket-Accept` as RFC 6455 requires and ends the attempt if it is wrong. It ignores the cookie and every other header field of the answer, stores none of them, and never sends the cookie back.

### Closing

Either side ends a session with a WebSocket Close frame with status 1000 and no reason, waits up to 5 s for the peer's Close frame, then closes TLS and TCP in the normal order whether or not it came. The same close is used for every cause, so the cause cannot be read from the close.

## `tls`

The node ends TLS itself, with a certificate for a name the operator owns.

**Layout.** TLS records carrying the WebSocket session above.

**State machine.** The accept state machine, with TLS ended by the node. The client:

1. Connects to a candidate (see "Fronting options") and completes TLS. It ends the attempt unless TLS 1.3 was negotiated, the chain validates for the name, and the leaf's public key matches a pin in the profile (SHA-256 of the SubjectPublicKeyInfo).
2. Sends the upgrade request with a fresh token.
3. On a `101`, sends its first chunk, which holds a WireGuard packet of this device: a handshake initiation, or a keepalive of a tunnel that is already up. On any other HTTP answer it handles a refusal as "Refusals and clocks" says.
4. Treats the session as open when a chunk from the node has opened.

**Limits.** Those of the stream listener, and the TLS handshake deadline.

**The certificate.** In version 1 a `tls` listener takes a certificate and key as files, as the built `ws` does. The operator obtains them with their own tooling. Built-in issuance is a marked gap: it is not specified, because a challenge answered on the listener's own port is something a prober can ask for, and it must be specified before it is built. See "Open questions".

**What the node's TLS answers, and why `tls` is capped.** When the node ends TLS, a prober's handshake meets the node's TLS library, not the decoy origin's. The decoy mechanism makes the HTTP answer the origin's. It does not make the TLS handshake the origin's, and the HTTP header fields then name a server that the handshake does not match. A prober needs no subscription to see that. Threat model invariant 1 (no byte the decoy would not send) does not hold for the TLS handshake of this transport. For that reason `tls` is rated Detectable in version 1, whatever its tests show, and an operator who wants a handshake that matches the site uses `ws` behind the web server that serves the site.

**What `tls` does not hide.** See "What `tls` and `ws` do not hide". In addition: the node's TLS library, and the name, which is published in certificate transparency logs when the certificate is issued.

## `ws`

The same WebSocket session, behind something else that ends TLS: the operator's web server on the same host, or a CDN.

**Layout and state machine.** As `tls`, except that the node reads plain HTTP from a trusted proxy and handles its connections request by request, as the second half of the accept state machine says.

**Client checks.** Normal certificate validation for the candidate's name. A pin is used when the profile has one, which is possible when the client reaches the operator's own web server directly and not when a CDN is in between, because a CDN's certificate changes without notice. The client requires TLS 1.3 on a pinned candidate and accepts what the CDN negotiates otherwise.

**The path.** The node compares the path it receives with its configured path. If the front rewrites the path, the node's `path` is the rewritten one and the profile's is the one the client sends. The proof does not depend on either.

**Limits.** Those of the stream listener. Behind a proxy every connection has one TCP source, so limits per source work only when `trusted_proxies` and `client_address_header` are set. Without them every visitor shares one share.

**What a CDN or a front web server sees.** The client's address, the path, the token (opaque, of varying length, different every time), the WebSocket upgrade, and the length and timing of every message. It does not see WireGuard's type bytes or sizes, and it cannot tell which device it is, because the hello is sealed to a key it does not have. A request for a fixed path with a long random query, answered by an upgrade, is still a recognisable shape to whoever ends TLS. Operators should keep the query part of the request out of the front server's access log. A token the node has accepted cannot be used again on that node. A token that was logged on the way and never reached the node can be presented once by whoever holds it, inside its window of about a minute, and opens a pending session that this party cannot establish. Either way a logged token is a record that someone holding the node's transport key could later tie to a device.

### What `tls` and `ws` do not hide

- That the client holds a long-lived connection to this host and moves a lot of data over it, in both directions.
- The order of the first exchange (a request, an answer, one chunk up, one down, then data), and that a small two-message exchange recurs every one to two minutes, on a busy tunnel and on an idle one. Padding changes their sizes, not their existence.
- An idle tunnel emits a small record and gets a small one back at an interval inside the idle keepalive range.
- Without load each chunk holds one inner packet, so record lengths under a steady transfer sit in a narrow band just above the inner MTU. A browser download fills large records.
- TLS handshakes of applications inside the tunnel, as a sequence of sizes and directions (Xue et al., USENIX Security 2024). Nothing here defends against it.
- The extra time of the hop from node to decoy origin on every unauthenticated answer.
- A WebSocket connection with no page load from the same host before it, and a connection with no DNS lookup before it when the profile carries addresses.
- Several parallel connections, when a profile allows them.

## `fronted`

`fronted` is for a CDN that allows neither WebSocket nor long-lived streams. The client polls with HTTP requests: upstream data rides in request bodies and downstream data in response bodies. It is slow, and it is the transport of last resort.

It works only where the CDN is reachable and permits the configuration in the profile, on the day it was tested. A decision by the CDN ends it without any change in Veilway.

### Layout

| Request | Target | Body |
|---|---|---|
| Opening | `POST <path>?<token>` | Chunks under `k_c2s`, starting at chunk number 0 |
| Later | `POST <path>?<sid>.<n>` | Chunks under `k_c2s`, continuing the count |

`<sid>` is the 16 byte `sid` in base64url without padding, 22 characters, in its one canonical form: the unused bits of the last character are zero. `<n>` is the request number in decimal without leading zeros, from 1 to 4,294,967,295. It is 1 for the first request after the opening one.

A body, in both directions, is a sequence of:

| Offset | Size | Field |
|---|---|---|
| 0 | 2 | `length` of the sealed chunk that follows, 16 to 16,016 |
| 2 | `length` | One sealed chunk: ciphertext and tag |

Both bodies are sent with `Content-Type: application/octet-stream` and a `Content-Length`. A request or response with nothing to carry holds one padding-only chunk, so no body is ever empty and every request is authenticated by chunks that only the session's client can seal.

### State machine

The node decides every request in this order, and a request that fails any step takes the unauthenticated path: it is forwarded to the decoy origin as it arrives, and a live session it named is left exactly as it was.

1. **The head.** The request must have exactly one `Content-Length`, from 18 to 65,536, and no `Transfer-Encoding`. This is decided from the head, before any of the body is read.
2. **The target.** It is an opening request (`<path>?<token>`) or a later request (`<path>?<sid>.<n>`, with `<n>` from 1 to 4,294,967,295, at most 10 digits, no leading zero).
3. **An opening request.** The node verifies the proof as "Verifying" says. An accepted proof is spent and creates a pending session, whatever happens next. A CDN's repeat of an opening request is therefore refused as a replay, and the client handles that as a refusal.
4. **A later request.** The `sid` must be known, no other request of that session may be in flight, and `n` must be one more than the last accepted, or equal to it for a repeat. A request `n` + 1 that arrives while request `n` is still held is not queued: it takes the unauthenticated path.
5. **The body.** The node reads the whole body, which must arrive within 10 s, before it acts on any of it.
6. **The chunks.** Every chunk of the body must open under `k_c2s` at the expected chunk numbers. Chunk numbers advance only when the request is accepted. If any chunk does not open, nothing of the body is processed. For a later request the session stays as it was, so a stranger who learns a `sid` cannot disturb it. For an opening request the pending session is dropped at once.
7. **A chunk that is invalid, in a body whose every chunk opened** (a bad item length), came from the session's client. The session is ended and the request takes the unauthenticated path. A body in which any chunk fails to open is handled by step 6, whatever its other chunks hold.
8. **A repeat** of the last accepted request with the same body gets the stored response again, because a CDN may retry.
9. **The answer.** The node answers an accepted request as soon as it has downstream data for the session, and otherwise after the hold time, with status 200. Its first answer on a new session comes when the session is established, as on every transport.

The client:

1. Keeps one request in flight per session at a time.
2. Sends at once when it has data and no request is in flight. When idle it polls with the waits in the table of numbers.
3. Drops the session and opens a new one after the reconnect wait when a request gets no response within 10 s, or anything but a 200 with a body it can open. If that happens to the opening request, it is a refusal, handled as "Refusals and clocks" says.
4. Opens a new session before `n` would pass its limit.

A session with no accepted request for its idle time is forgotten. There is no idle keepalive and no echo on `fronted`: an accepted request is the activity and its response is the sign of life (see "Session activity and timers").

### Limits

- Bodies of at most 65,536 bytes in each direction.
- A body is authenticated chunk by chunk, not as a whole. A front can therefore deliver a body cut at a chunk boundary, or two bodies joined in order, and the node accepts the chunks it gets. A front can also just drop a request, so this is a matter of availability and nothing else.
- The node stores one response per session, for the repeat in step 8. With the cap on `fronted` sessions this bounds the memory: at the default, 4,096 sessions of 65,536 bytes.
- At most 2 `fronted` sessions per device.

### Errors and decoy behaviour

Those of the stream listener. The node handles every connection request by request, and every request that is not a valid opening or a valid later request of a live session is answered by the decoy origin.

### What `fronted` does not hide

- The polling: many small requests to one CDN host for as long as the tunnel is up, with near-equal request and response sizes when idle. Published research has recognised polling transports by exactly this rhythm.
- From the CDN: the client's address, the path, the session id on every request, and all sizes and timing. Anyone the CDN answers to has the same.
- Everything in the list for `tls` and `ws` that concerns the tunnel's own timing.

### What `fronted` asks of the CDN

A tunnel over `fronted` is steady traffic through a service that bills for it and may forbid it.

- The operator must check the CDN's terms before using it this way. Many terms forbid proxies or tunnels, and the CDN can close the account.
- The operator pays for the traffic. A polling tunnel makes far more requests than a web site visitor does.
- The polling waits above are the client's floor. A client never polls faster than the first wait, and a profile cannot lower it.
- A refused client waits and does not sweep the front list, so a node restart or an exhausted quota does not turn into load on the CDN.
- The CDN sees every client's address. An operator who uses a CDN shares that knowledge with it.

## Fronting options

Every TLS-based transport of a profile has a list of candidates. A candidate says where to connect and which names to show:

| Field | Meaning |
|---|---|
| `address` | The IP address and port to dial. Examples use `192.0.2.10:443` and `[2001:db8::10]:443`. |
| `sni` | The TLS server name, for example `cdn.example.com`. Empty means no server name is sent. |
| `host` | The HTTP `Host`, for example `node.example.com` |
| `verify_name` | The name the certificate must be valid for when `sni` is empty |
| `ech` | A configuration for Encrypted Client Hello, when the front supports it. Encrypted Client Hello is the TLS extension that encrypts the server name. |

The plain case is `sni` equal to `host`, both a name the operator owns. That is the recommended first choice.

The other cases, and what they cost:

- **Different `sni` and `host`** (classic domain fronting). It works only on a CDN that permits the mismatch. Several large ones have switched it off, and that changes over time. It shows the path a name that belongs to someone else. Most CDN terms forbid it, and if it is noticed, the name's owner may be the one who is blocked. No client or panel creates such a candidate by itself. An operator who enters one is responsible for having the right to.
- **Encrypted Client Hello.** It hides the name without borrowing anyone's. Some networks block it as a class, so a candidate that uses it can itself be the reason a connection is blocked.
- **No server name.** Rare enough to be blocked as a class.

This page names no CDN and ships no candidate list. A statement about what a particular CDN permits must carry a date and a capture, and belongs in release notes.

A subscription, or a seized client, reveals every address and name in it. A provider limits the damage by giving different users different parts of its front list.

### Choosing a candidate

There is no probe request. Trying a candidate is opening a real session on it. The rules below exist so that trying is slow and bounded: a burst of connections to many addresses is itself a signal, and it also loads the fronts.

1. The client keeps, per network, the candidate that last worked, and tries it first and alone. A network is identified by what the system exposes: interface type, default gateway address, and the wireless network name or mobile operator code where available.
2. If there is none, or it is unreachable, the client walks the list in an order that is random per installation and fixed between attempts.
3. At most 2 candidates are in flight, the second starting 250 ms after the first. The client sends the same WireGuard datagram on both: the same handshake initiation, or the same keepalive. WireGuard on the node accepts it once, so only one of the two sessions is established and only that one gets a chunk from the node. That candidate wins and the other is closed.
4. At most 6 distinct candidates are tried per hour per network. When that is spent the client waits, and says so.
5. A candidate counts as unreachable when the connection or the TLS handshake fails or times out. It is then not tried again on that network for 1 hour. The mark expires, and the mark and its expiry are logged at info, so that no failure is remembered forever.
6. A candidate that answered with a refusal is reachable. It is not marked, does not count against the 6, and is handled as "Refusals and clocks" says.
7. While the current candidate works, no other is tried.
8. The kill switch stays in force throughout.

Even so, a client that tries several addresses of one CDN within a short time, with no DNS lookups, can be noticed, and what it tries shows the path part of the candidate list.

## Transport fallback

The rating of a profile is too coarse to guard a change of transport, because in version 1 every native transport is rated Detectable. Fallback is therefore guarded by the class in the table at the top of this page: cover, no cover, plain.

**Order.** A profile lists its transports in the provider's order. Two things can change which is tried first:

- `stream_first`, a profile option that the user may also set for a profile. With it the client tries every cover transport before any other. It is the right choice on a network that is known to act on random-looking UDP.
- The transport that last worked on this network, if one is remembered.

**Consent to move down a class.** The client uses a transport of a lower class than the best class in the profile only when the user has agreed to that class for this profile. This covers the first attempt as well as fallback: a profile that lists `udp-obfs` before `tls` asks once before its first connection. The question says in plain words what the lower class means. The answer is stored per profile and class and can be withdrawn. Plain transports are never reached without that consent.

**What the address reveals.** A client that sends random-looking UDP to an address and then opens TCP port 443 to the same address has marked that address for whoever watches. For that reason, and by the weakest-listener rule, a cover transport that shares an address with a `udp-obfs`, `udp` or legacy `ws` listener can never be rated above Detectable. An operator who offers both classes puts them on different addresses.

The client:

1. Gives each transport 10 s to carry a chunk from the node, or a WireGuard handshake response on `udp`.
2. On an unreachable transport waits, then tries the next one it is allowed to use.
3. Handles a refusal as "Refusals and clocks" says. A refusal never sets a transport aside.
4. Tries at most 3 transports in a round, then waits with the backoff in the table of numbers.
5. Sets an unreachable transport aside for that network for 1 hour, then tries it again. The mark and its expiry are logged at info. The last transport of a profile that the client is allowed to use is never set aside: the client keeps trying it with the backoff of rule 4.
6. Treats silence on a datagram transport that worked on this network recently as "Refusals and clocks" says: 90 s of further tries, then unreachable.
7. Always shows which transport is in use, its class and its rating.
8. Keeps the kill switch in force throughout: between attempts nothing leaves the device except the transport's own connection.

The sequence can be observed. The random waits blur it and do not remove it.

## Client TLS and HTTP fingerprint

The first message of a TLS connection, the ClientHello, differs between programs in ways an observer can catalogue. A ClientHello from a general-purpose TLS library does not look like a browser's. The plan is to build the client side of every TLS-based transport on a browser's own TLS library, configured from a fingerprint pack, and to measure the result.

| Rule | Value |
|---|---|
| Which browser a build claims | One mainstream browser, in its release for the platform the build runs on. A build never claims another platform's browser. |
| What the pack holds | Everything in the ClientHello that the browser chooses for the kind of connection in question, the HTTP/2 settings, and the header fields and their order of the WebSocket upgrade and of a `fronted` request |
| HTTP version | The WebSocket upgrade is HTTP/1.1. What the claimed browser offers in its ClientHello for a WebSocket connection is taken from a capture, not assumed. |
| Where a pack comes from | Client releases and the client's signed update channel only. Never a subscription, a profile or the control channel. |
| Expiry | An expired pack is still used, and every profile that depends on it is capped at Detectable until a newer pack arrives. |
| Session resumption | Tickets are kept in memory only and never written to disk. |

What this does not achieve: the fingerprint is correct for one browser release and becomes a rare one when that release ages. If the Phase 2 measurement fails, this section is replaced by a statement that the client's TLS is recognisable.

## `faketls`: goals and open questions only

`faketls` is in the plan as "version 1 after a spike". This page does not specify a wire format for it, because the design questions below are open and because it puts load on a third party in a way that needs a project decision first.

**The idea.** The listener holds no certificate and needs no name. A connection that does not carry a valid proof is relayed to a real third-party site, so a prober completes a real TLS handshake with that site through the node. A client proves itself inside its first TLS message.

**Goals, if it is built.**

- A prober that does not hold a device secret gets the borrowed site's bytes on every path, including after a replay.
- The proof names one device, is bound to that device's WireGuard key, has the replay rule of this page, and cannot be recognised by a holder of another device's subscription.
- Pressure from strangers lands on strangers first, and what is relayed to the site is capped per source and in total.
- The client knows it reached the node and not an interceptor, without trusting a certificate.

**Properties it cannot have.**

- The node's address is not one of the borrowed site's addresses. One lookup shows that.
- A stranger's TCP handshake ends at the node and its TLS handshake at the borrowed site, so the two round-trip times differ by the relay hop.
- It depends on the borrowed site keeping its TLS behaviour, which the site can change at any time.

**What it does to the third party.** Every stranger's connection, and every probe, is relayed to a site whose owner has not agreed to it. The site sees that traffic coming from the node's address. Its name is used to make the node's traffic look like visits to it, and if that is noticed the site may be blocked or its owner questioned. This may break the site's terms of use or the law. If `faketls` is built: the borrowed site is always chosen by the operator, none is suggested or shipped, the config key requires an explicit acknowledgement, and relayed connections are capped so that the node cannot be used to load the site.

**Open questions that block a specification.**

| Question | Why it blocks |
|---|---|
| Where the proof travels in the first TLS message, and how it is bound to that message | The first message is in clear on the path. The existing design this would follow is widely used and has had no formal review. |
| What the node sends to a user, and how its sizes match the borrowed site's (threat model Q19) | An authenticated answer that differs in length from the site's is a signal. |
| Whether a holder of the node transport private key can name the user of every recorded first message (threat model Q4) | The first message is in clear, so unlike `tls` there is no outer encryption to protect it. |
| Whether the project should ship a transport that relays to non-consenting third parties at all | It is a question of harm, not of engineering. |

## `quic`: goals and open questions only

`quic` is in the plan as "later". Nothing is specified.

**Goals.** Carry WireGuard datagrams in QUIC datagram frames (RFC 9221) inside a connection that is HTTP/3 to an observer, so that there is a datagram transport with a cover protocol and no TCP inside TCP. The standard for IP over HTTP/3 is MASQUE CONNECT-IP (RFC 9484). Following it as written, with WireGuard inside or in place of the proof, is the first option to examine.

**Open questions.**

- Whether the proof and the decoy behaviour of the stream listener carry over to HTTP/3, where the request arrives on a stream after the QUIC handshake.
- Whether a QUIC library's handshake can match a browser's, which is the same fingerprint question as for TLS.
- The MTU: QUIC adds its own overhead to every datagram.
- Networks that block or slow UDP stop it, as they stop `udp-obfs`.

## What a leaked key or a compromised node reveals

| What leaks | What its holder can do | What it cannot do |
|---|---|---|
| One subscription (one device's profile) | Connect as that device and so confirm that every node in it is a Veilway node. Read every address, name, path and public key in it, and block them. Recognise and unwrap that device's recorded `udp-obfs` traffic down to WireGuard. Remove the tag mask from any `udp-obfs` opening packet of the inbound and link two of one device within an epoch. | Tell which device another opening packet belongs to. Read or unwrap another device's traffic on any obfuscated transport. Read that device's past tunnel content, which WireGuard's forward secrecy protects. |
| A node transport private key, current or retired, without the config | Open any token it can get hold of: from a CDN, a front server's log, or an interceptor. Like anyone who holds a token that never reached the node, present it once inside its window, which gives a pending session it cannot establish. Each opened token gives the device's tag, which never changes for a secret, so all tokens of one device can be linked, across time and networks. | Make a proof that a node accepts, or give a logged token a new timestamp: the binder covers the timestamp and the tag and needs the device secret. Use again a token the node accepted: its timestamp is outside the window by the time it has left the replay cache. Read tunnel content. Name the device without the config. |
| An inbound's WireGuard private key | Impersonate the node to clients. Open the first message of every recorded WireGuard handshake to that inbound and read the static key in it, which names the device. On plain `udp` and legacy `ws` those handshakes are readable on the path. On obfuscated transports they are inside the envelope. | Read past sessions. |
| The whole node (a compromised node) | Everything above for every device of the node, with names. All traffic through it while compromised: destinations, DNS names, client addresses, timing, and the plaintext of anything not encrypted end to end. Lie on the control channel within the bounds on that page. | Read sessions recorded before the compromise. Use a device's identity on another node, as long as device private keys are not stored on that host, which depends on how the provider generates and keeps keys (threat model Q9). |

A leak is ended by rotation (see the overview). Rotation does not undo what was recognisable in traffic recorded before it. Because a retired transport key still opens old tokens, rotating it on a schedule and destroying the old one is the only thing that limits how far back logged tokens can be tied to devices.

## Security considerations

- **Unauthenticated input is bounded.** Before a proof is accepted, a direct peer can make a stream listener read one request line within fixed size and time limits and hold one connection in the undecided or the relayed pool, a stranger behind a trusted proxy can have one request head read and at most 16 requests in flight to the decoy, and can make a datagram listener do one HMAC and one table lookup, or one key derivation and one decryption more. Nothing is allocated from a length the peer chose.
- **Strangers are kept from shutting users out as far as the design can.** Pools are separate, a full pool of strangers makes room among strangers, no count closes a connection at accept, and neither sessions nor proxy connections are ever displaced for strangers. The undecided pool is shared until the request line arrives, and heavy churn there can turn a user's attempt into a refusal.
- **No amplification.** A datagram listener sends nothing to a stranger, and sends an authenticated newcomer no more than it received until the tunnel has authenticated. A stream listener sends a stranger only what the decoy origin answered that stranger. The one exception on a datagram listener is the raced opening packet described under `udp-obfs`: whoever delivers a device's real opening packet first receives that device's traffic, as ciphertext, until the device speaks again.
- **No identifying answer, with listed exceptions.** No byte the node itself composes reaches someone who is not a user. The exceptions: the node's own TLS handshake on `tls`, which is why `tls` is capped, a closed connection when the decoy is down, the raced opening packet on `udp-obfs`, and the two exceptions of plain `udp`.
- **Replay.** A proof is accepted once, including across restarts and clock steps, by the window, the cache, the floor and the limit. Three things undo that, and each is documented with its cost: restoring an old replay file, `veilway replay reset` after a clock fault, and a lost or unusable file on a node whose clock is behind where it has been. A node that cannot write its limit accepts nothing and says so loudly. The rules of the limit were changed after the first implementation was reviewed, each time because the earlier wording could shut honest clients out with no attack or left a failed write undefined: the limit follows the clock, so that an honest proof on a quiet node never waits for a write. Nothing is derived from the floor after a start, so that a node that crashes in a loop does not raise its own floor. The node judges by the lowest limit that may be on disk, so that a write whose fate is unknown cannot let a proof through. And the node brings its own limit down after a clock fault, so that a later crash does not turn a past fault into an outage. On `udp-obfs` an opening packet travels in the clear, so a packet the node dropped stayed valid for whoever saw it, a few milliseconds later, from any address. That is why the node now keeps a packet that is waiting for a limit and records one that a limit refused, and why the three cases where it cannot are listed under `udp-obfs`.
- **No failure is latched silently.** Every state in which the node refuses honest clients (floor ahead of the clock, replay file not writable, cache full, decoy down) has a log line, a counter and an end. The floor running ahead after a clock fault is a real outage that lasts as long as the fault was large, unless the operator resets.
- **Possession of the secret is proven per proof,** by the binder on streams, which covers the timestamp and the tag, and by the sealed opening packet on `udp-obfs`. A proof alone still does not displace a device's sessions: only a session on which that device's WireGuard has authenticated does.
- **No offline test of a secret.** On `tls`, `ws` and `fronted` the proof is sealed to the node's key, so recorded traffic gives nothing to test a leaked device secret against. On `udp-obfs` this does not hold: a holder of the real secret recognises that device's packets. Secrets are 32 random bytes, so guessing is not possible. Leaking is.
- **Binding.** A proof names one device, the session keys and the binder key depend on that device's WireGuard public key, and the node accepts on a session only that device's WireGuard packets.
- **Finding the device does not depend on the number of devices.** One table lookup, no scan, no early exit. A tag that is found and one that is not differ by a fraction of a microsecond, as "Timing" records.
- **Timing residuals are real.** The hop to the decoy origin, a slowly sent request line, the node's own TLS stack on `tls`, and the difference between an authenticated and an unauthenticated answer for a subscriber who holds a valid profile.
- **Every shared default is a signature.** Padding ranges, timers and close behaviour are the same on every installation unless a profile sets them. They are fixed here so that they can be measured, not because they are known to be safe.
- **Third parties.** A decoy origin is the operator's own. A CDN carries load and risk for this protocol, and the client's waits and budgets exist for its sake as well as for the user's.

## Open questions

Each is listed with the default this draft takes. The first six are the ones an outside reviewer should attack first.

| Question | Default |
|---|---|
| Is the stream proof sound: HPKE base mode, a static device tag, and a binder that is an HMAC under a key from `S` over an exporter value and the hello's fields? | As written. Unreviewed. The static tag still lets a holder of a transport private key link one device's tokens. |
| Is the masked epoch tag acceptable? Outsiders see no repetition. A subscriber of the same inbound can link one device's opening packets within an epoch, and a holder of a device's secret recognises that device's recorded traffic. | Yes for version 1, with both limits stated. A key exchange hidden with Elligator2, as obfs4 does, would remove both and needs an implementation of proven quality. |
| Is the replay rule sound across restarts, clock steps in both directions, a lost or restored replay file, and a valid device that sends far-future timestamps? | As written. |
| The limit follows the clock, so a forward clock fault followed by a crash makes the faulty time the floor even when no proof was accepted. Should the node lower its limit by itself once the clock is corrected? | Yes, in a bounded way: rule 9. It never goes below the floor or below anything in the cache. A crash before the timer has acted still gives the outage, and only a reset ends that. |
| After a clock fault the floor can be far ahead, and the reset forgets proofs above the new floor. Should the node keep forgotten timestamps above a trusted floor as a bounded set of burned intervals, so that a fault burns only the seconds that were actually used? | Not in this draft. It would end the outage without the reset's replay cost, at the price of one more structure in the replay file. |
| Does anything on the "not a user" paths differ in timing by cause (table hit or miss, which check failed, how much of the path matched)? | Yes, by under a microsecond in all, as the table under "Timing" records for one machine. Whether that can be used from where a prober sits has not been measured across a network. |
| Do the upgrade answer and the padded token remove the fixed-size first exchange, or only move it? | Unmeasured. The first two records of each direction are to be added to the length and timing test. A cookie with a name per inbound is a judgement call, and whoever ends TLS still sees a recognisable request. |
| Random nonces on `udp-obfs` data packets, with the packet limit | As written. A counter nonce would need to be hidden on the wire, which is one more construction. |
| Should a client take a clock offset from the `Date` header of a connection that validated but has no pin, so that a profile with only CDN transports works with a wrong clock? | No. A party that can present a valid certificate for the front could then steer the timestamps of that client's proofs. The cost is that such a client cannot connect until its clock is right. This default may change. |
| Built-in certificate issuance for `tls` | Not specified, files only. If it is added, a challenge that needs no listener (a DNS record) avoids a new probe surface. The plan says issuance is built in. |
| Should the token on `tls` also be bound to the TLS connection (RFC 9266)? | No. It cannot be done behind a CDN, and one format for `tls` and `ws` was preferred. |
| Always prohibiting outer fragmentation on datagram transports | Yes. Without a working control channel a path with a small MTU then loses full-size packets until the client lowers its MTU by itself. |
| Junk packets on `udp-obfs`, which the plan lists | None before the first packet. They may come back. |
| Padding ranges, the session base, the 16 chunk count, and the keepalive and rekey ranges (threat model Q5) | As in the table of numbers, with no measurement. The length and timing test decides. |
| Parallel connections (threat model Q13) | Default 1, at most 4. Whether more than 1 is worth its pattern is unmeasured. |
| Limits per source behind carrier-grade address translation, where many users share one address | Config values with the defaults above. They may be too low for large mobile networks. |
| Whether `tls` and `ws` should stay two names for one format | Two names, as in the plan. |
| `mtu` default and warning for `veilway` inbounds | As in "MTU". The config reference does not say this yet. |
| `faketls` and `quic` | Not specified. See their sections. |
