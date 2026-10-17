---
title: Borrowed-site mode
description: The faketls transport. The node answers with the shape of a real site's TLS handshake, a client proves itself inside its ClientHello, and everyone else is relayed to the real site.
---

:::danger[Design draft, not built, not reviewed]
Nothing on this page is implemented. It is the specification that comes before the build, as [Protocol overview](../overview/) requires, and nobody outside the project has read it. The proof, the node's handshake and the way the node copies a site are new constructions with no analysis behind them. **Nobody outside the project has reviewed it.** It is offered as alpha only: off by default, labeled alpha in the panel and the apps, with a warning that it is new and unreviewed. Until it has passed the tests of `THREAT_MODEL.md` invariant 7a it is rated Detectable like every other native transport. Do not rely on any property described here.
:::

`tls` shows the node's own certificate to anyone who connects, which is why it is rated Detectable. This mode, called `faketls` in the tables of [Transports](../transports/), removes that. The node holds no certificate and needs no name. It borrows a real site that the operator chooses. A client that proves itself inside its first TLS message gets the tunnel. Every other connection is relayed byte for byte to the real site, so a prober completes a real handshake with the real site and sees its genuine certificate.

It is the hardest mode in the project to get right. The proof sits in a message that is in clear on the path. The node has to answer a user with a handshake that is not the site's, and make that answer look like the site's. The site is a third party that never agreed to any of this, and it can change its behavior at any time. This page says what is designed, what is only hoped, and what a careful observer can still see. It is designed from RFC 8446, RFC 7748, RFC 9180, RFC 8879 and the other documents named in "Building blocks". No code or text of any other project was used or read. See "Prior art" in "Building blocks".

Read [Transports](../transports/) first. This page uses its terms, its replay rule, its tag table, its pools and its chunk and padding rules without repeating them.

## What it is, and what it is not

| | `tls` | `faketls` |
|---|---|---|
| Certificate the node needs | Its own, for a name the operator owns, or a self-signed one | None. The node mints a throwaway one per user connection. |
| What a prober with no proof sees | The decoy origin's answer behind the node's own TLS handshake | The real site's own handshake and answers, relayed. A copy of a user's hello gets a flight the node makes, with the sizes and times the site showed for that same hello. |
| Where the proof travels | In the request target, inside TLS | Inside the ClientHello, in clear on the path |
| How the client knows it reached the node | A pinned certificate key, with the TLS signature verified against it | A key only the node and the client can compute, with the TLS signature verified against it |
| Behind a CDN or a TLS-ending proxy | Yes (`ws`) | No. The node must be reached directly. |
| What carries the tunnel | WebSocket frames | Length-prefixed chunk plaintext in TLS 1.3 application data |
| Third party involved | None. The decoy is the operator's own. | The real site, which has not agreed |
| Status | Built | Designed here, not built |

What this mode claims: a prober that has no device secret gets the real site's bytes on every path, except that a copy of a user's hello gets a flight the node makes with the sizes and times the site showed for that same hello, and an observer who sees one connection sees a TLS 1.3 handshake to a real site's name whose flight has the sizes that site's flights have. What it does not claim is in "What remains detectable". The first item there is that the node's address is not the site's address.

Use `tls` or `ws` with a name you own whenever you can. This mode is for a node on a bare address with no name, where the alternative is a certificate that is rare and self-made.

## Numbers that are judgement calls

Every number on this page that was chosen, not derived, is in this table. None has a measurement behind it. The numbers of [Transports](../transports/) apply where this page says "as for `tls`". A range written "a to b" is inclusive at both ends.

| Name | Value | Used by |
|---|---|---|
| Proof window `W`, replay limit, session timers, proofs per device and per source, pending sessions per device, the allowance for recording hellos that a limit refused | As on the transports page. The allowance is counted per device and apart from the one of `udp-obfs`. | every proof and session |
| Tag epoch | 3,600 s | proof |
| Seals remembered by the client | the last 4,096 | client |
| Binder length | 16 bytes, the start of the HMAC output | proof |
| ClientHello read | at most 8,192 bytes of handshake in at most 4 records. Chrome's hello is about 1.8 KB with the hybrid key share. | node |
| Hello hold | 3 s from the first byte of a record that can still be a ClientHello. When it passes unfinished, the connection is a stranger's. | node |
| Connect to the site | 5 s | node |
| Strangers relayed to the site | 8 for one source, 256 in all for a listener. Proposed config values (`limits.relayed`). | node |
| New connections to the site | burst 64, then 16 a second for a listener, the relay connections of strangers and the early connections of accepts together. When it is spent, no early connection is opened and users are still served. Only a stranger that would need a connection is closed. | node |
| Hellos that open and are refused (decoy sessions) | counted in the relayed pool, at most 2 for one source | node |
| Idle time before a relayed connection may be closed for room | 60 s | node |
| Probes of the site | 8 at start and on reload, 2 s apart, then one every 6 h | node |
| Shapes kept | the last 32 successful probes, none older than 7 days. A shape holds the reactions of "The shape of the site" too. | node |
| Live copy | The site connection is kept until the site's flight for the forwarded hello has arrived, at most 5 s, then closed | node |
| No successful probe | after 24 h the node stops accepting proofs, and relays everything, until a probe succeeds | node |
| Timing of the node's flight | Live: the offsets at which the site's own records arrived for that exact hello. With no live answer: the offsets of one kept shape. | node |
| TLS handshake deadline | 10 s from accept | node, client |
| First tunnel packet deadline, idle time, keepalive, echo, rekey point | As for `tls` | every session |
| Parallel connections | 1 by default, at most 4, as for `tls` | client |

## Building blocks

No primitive is implemented in this project. Each comes from a library, as on the transports page.

| Primitive | Specification | Used for |
|---|---|---|
| X25519 | RFC 7748, with the all-zero output check of section 6.1 | The proof's key agreement, and the TLS key exchange |
| HKDF-SHA-256 | RFC 5869 | Every key derivation of the proof |
| HMAC-SHA-256 | RFC 2104 | The binder |
| ChaCha20-Poly1305 | RFC 8439 | Sealing the carrier |
| ECDSA on P-256 | FIPS 186-5, with the key made as appendix A.2.1 does from extra random bits, deterministic signatures as RFC 6979 | The node's throwaway TLS key, and the random leaf key of a refused hello |
| TLS 1.3 | RFC 8446 | The handshake and the record layer |
| ML-KEM-768 hybrid with X25519 | FIPS 203 and the X25519MLKEM768 group of the TLS working group | Only when the site chooses that group |
| Brotli certificate compression | RFC 8879 | Only when the site sent a compressed certificate |

| Construction | Follows | Departs in |
|---|---|---|
| Proof key agreement | The sender side of DHKEM(X25519, HKDF-SHA256) in RFC 9180 section 4.1: a static-ephemeral Diffie-Hellman with the receiver's public key | The client's ephemeral key is the X25519 key share that the ClientHello carries anyway, so no extra public value travels. The rest of HPKE is not used. |
| Carrier | The sealed message of the stream proof on the transports page, with the binder idea of it and the hourly tag idea of the `udp-obfs` epoch tag | The tag changes every hour. It is split over two fields of the hello that are random in every hello, and the associated data is the hello itself |
| Binder | The binder of the stream proof, which follows RFC 8446 section 4.2.11.2 | 16 bytes, not 32, because the carrier has 48 bytes of plaintext |
| Node authentication | Trust in a key because the client already holds something that names it, as in the pin of `tls` with `self_signed` | The held thing is a key derived from the Diffie-Hellman result, and the TLS signature (RFC 8446 section 4.4.3) is verified against it by the library as always |
| Record sizes | TLS 1.3 record padding, RFC 8446 section 5.4 | Used to reproduce another server's sizes |
| Relay to the site | The decoy handoff of the stream listeners | The destination is a third party, and what is read before the decision is a ClientHello, not a request line |

Following a published design is not the same as inheriting its analysis. See "Open questions".

**Prior art.** Proving oneself inside a ClientHello and relaying everyone else to a real site is not a new idea. REALITY, in Xray, is prior art for it, and it has been used and attacked in public. Its code and its text were not consulted for this page: everything here comes from the documents named above. So this page does not inherit REALITY's analysis, its measurements or its fixes, and it may repeat weaknesses that are known there or miss defenses that exist there. Anyone who implements this mode for the project must not read the sources of Xray's REALITY, so that the build stays independent of them. A reviewer from outside the project may read anything. Any likeness in the design comes from the shared idea and the same standards.

## The proof

### What the client puts in its hello

The client sends a ClientHello shaped like the Chrome release the build claims (see "Client TLS and HTTP fingerprint" on the transports page), with these differences from the stream transports:

- The server name is the site's name from the candidate, never the node's.
- ALPN offers `h2` and `http/1.1` in Chrome's order, because no HTTP is spoken afterwards and a Chrome hello to a site offers both. The ALPS extension is present when the capture has it.
- No pre-shared key and no early data. This is a first visit every time.
- No Encrypted Client Hello other than the GREASE value of the capture. The candidate may not carry `ech`.
- `X` is the standalone X25519 key share when the hello has one, and otherwise the X25519 part of the X25519MLKEM768 share: its last 32 bytes, after the 1,184 byte ML-KEM-768 encapsulation key. The client holds the private key `x` of `X`. When the hello carries both shares and the two X25519 values are equal, as they are from a client that reuses one key for both, `X` is that value and nothing else changes. When it carries both and they differ, `X` is the standalone share and the hybrid share is only a key share. The template follows the capture of the claimed Chrome here: it reuses `x` for the hybrid share if the capture does, and draws a separate key if the capture does. The rest of the hybrid share is as Chrome sends it.

Two fields of every TLS 1.3 hello from a browser are random bytes: `random` (32 bytes) and `legacy_session_id` (32 bytes, RFC 8446 section 4.1.2). Together, in that order, they are the **carrier**, 64 bytes. Nothing else of the hello is changed for the proof.

### Keys

With `T_priv` and `T_pub` the key pair of this `faketls` transport (a pair of its own, not the keys of the stream proof or of any other transport), `inbound_pub` the inbound's WireGuard public key, `dh = X25519(x, T_pub)` on the client and `X25519(T_priv, X)` on the node:

| Name | Value | Used for |
|---|---|---|
| `prk_f` | HKDF-Extract(salt `"veilway v1 faketls"`, ikm `dh`) | Deriving the keys below, nothing else |
| `k_seal` | HKDF-Expand(`prk_f`, `"veilway v1 faketls seal" \|\| X \|\| T_pub \|\| inbound_pub`, 32) | Sealing the carrier |
| `b` | HKDF-Expand(`prk_f`, `"veilway v1 faketls binder" \|\| X`, 32) | The binder |
| `node_seed` | HKDF-Expand(`prk_f`, `"veilway v1 faketls node key" \|\| X \|\| carrier`, 40) | The node's TLS key, see "What the node answers with" |

The client and the node both hold `dh`, and so does nobody else. A node that gets `dh` of zero (a key share of low order) treats the hello as a stranger's.

**The transport key of `faketls` is its own.** Validation refuses a config in which the key of a `faketls` transport equals the transport key of any other transport on the node, and every label here says `faketls`. The hello is in clear on the path, so the key that opens it is the one most likely to be recorded against. A leak of it must not open the proofs of `tls`, and a leak of the key of `tls` must not open these.

**The tag is a tag of the hour.** The tag in the plaintext is the first 16 bytes of HMAC-SHA-256(key `k_tag`, message `"veilway v1 faketls hour tag" \|\| e`), with `k_tag` the device's key from the transports page and `e` the number of the hour (Unix time divided by 3,600, rounded down) as 8 bytes. The client uses the hour of its clock, with the offset of "Refusals and clocks" when one is held. The tag table holds three per device secret, for the previous, current and next hour, as it holds three epoch tags for `udp-obfs`, each with the kind `faketls` tag, which is valid only in a `faketls` hello. A device tag or an epoch tag in this place is a miss. Whoever holds only `T_priv` cannot name a device from a tag, and two tags of one device from different hours cannot be linked.

### Sealing

The plaintext is 48 bytes:

| Offset | Size | Field |
|---|---|---|
| 0 | 1 | Version, `0x01` |
| 1 | 3 | Zero |
| 4 | 8 | Timestamp: Unix time in seconds |
| 12 | 16 | Tag of the device for the hour of the client's clock, see "Keys" |
| 28 | 16 | Binder: the first 16 bytes of HMAC-SHA-256(key `k_bind`, message `b \|\| h`), where `h` is bytes 0 to 27 of this plaintext and `k_bind` is the device's key from the transports page |
| 44 | 4 | Zero |

It is sealed with ChaCha20-Poly1305 under `k_seal`, with a nonce of 12 zero bytes, which is safe only because `k_seal` is new for every `X` (see "Every seal gets a fresh `x`"), and with associated data `"veilway v1 faketls aad" ||` the ClientHello handshake message (the 4 byte handshake header included) with the 64 carrier bytes set to zero. The 48 bytes of ciphertext and 16 of tag are the carrier. The first 32 go in `random` and the last 32 in `legacy_session_id`.

The associated data binds the proof to this hello: its server name, its extensions and its key shares. A carrier cut out of one hello and put into another does not open. The timestamp binds it to the time. The binder proves the device secret as on the stream proof, and a 16 byte binder is enough because a forger gets one online guess per hello, spends the node's rate limits on it, and learns nothing from a miss.

To an observer without `T_priv` the carrier is 64 bytes of AEAD output, which is uniformly random, in two fields that are uniformly random in every browser. `X` is an ordinary key share. Nothing on the wire repeats from one hello to the next.

**Every seal gets a fresh `x` (MUST).** The nonce is fixed. One `X` that sealed two plaintexts would reuse a ChaCha20-Poly1305 key and nonce, which gives away the XOR of the two plaintexts and the Poly1305 key, and lets a forger make carriers that open. The client draws `x` from the system random source for every hello, including a hello sent again after a failed attempt and each of parallel connections, and never derives it from a counter, a clock, saved state or another key share. The client also checks: it keeps the `X` of its last 4,096 seals in memory, and the seal function refuses an `X` on that list, ends the attempt with an internal error, and counts it. The check cannot see across restarts, which is why the draw is the rule and the check only a backstop. Reusing `x` inside one hello for the hybrid share, if the capture does, is a second use of the private key in a key exchange, not a second seal.

The client builds the hello last for these two fields: everything else is final, `X` is chosen, the associated data is computed, the carrier is sealed and written, and only then does the hello go into the transcript hash and onto the wire. A TLS library that writes `random` and `legacy_session_id` itself and hashes them at once cannot do this. See "Open questions".

### Verifying

The node evaluates every connection that sends a complete ClientHello. The checks, in this order:

1. The hello parses within the limits: a handshake message of type ClientHello, TLS 1.3 offered in `supported_versions`, a `legacy_session_id` of 32 bytes, and an X25519 value that can be `X` as "What the client puts in its hello" says.
2. The server name is the site's name or one of its configured extra names. Without a server name the hello is a stranger's.
3. The carrier opens under `k_seal`.
4. The version is 1, the zero bytes are zero.
5. The tag is in the tag table, as a `faketls` tag.
6. The binder equals the node's value, in constant time, with a dummy key for a tag that is not in the table, as on the transports page.
7. The replay rule does not refuse it. This step only reads. The key in the replay cache is `X` with kind 1, the kind of a stream proof's `enc`. Both are 32 uniformly random bytes drawn fresh for each proof, so the two cannot meet by accident, and the replay file needs no new kind.
8. The timestamp is not above the limit, as rule 8 of "The replay rule" says. If it is, the answer is "write a limit", and the hello is asked again when that write has ended, within the TLS handshake deadline. Nothing is recorded while it waits.
9. The rate limits of that device and that source have room, and the device has fewer than 2 pending sessions.

Steps 1 to 6 are done for every complete hello with dummy inputs where a field is missing, and their results are combined at the end, as for `tls`. Step 7 comes before any limit is charged, for the same reason.

**A hello whose carrier opens is never relayed.** A hello that fails step 1 or 2, or whose carrier does not open at step 3, is a stranger's and is relayed. A hello that opens at step 3 is answered with a flight the node makes, whatever happens at steps 4 to 9, and the node never says which step failed. The reason is the paired comparison. A censor that records a user's hello and later sends the same bytes to the node would otherwise get the real site's flight, while the user got the node's flight for those same bytes. Sent to the site directly, the same bytes give a third answer, and the three can be compared. With this rule the copy and the original both get a node-made flight, and with the live copy of "The flight" both have the sizes and times that the site showed for those bytes. A hello that fails at step 4 to 9 gets a flight with a random leaf (see "The throwaway leaf"), so a copy cannot read it and the sender with a profile sees only a leaf that does not match.

**Recording.** When steps 1 to 7 hold and step 8 does not hold the hello for a limit write, the node records `X` in the replay cache at once, before step 9 charges any limit, and whatever step 9 says. A hello that a limit refused and that was not recorded could be presented later from another address, which is rule 10 of `udp-obfs` for the same reason. The recording has its own allowance per device, in the table of numbers. Beyond the allowance the hello is not recorded and is answered with a flight of the node and no session.

When all nine hold, a pending session belongs to the device, and the node answers as "What the node answers with" says. A recorded hello that is sent again, from anywhere, within its window or after it, fails step 7 or the window and is answered with a flight of the node with a random leaf, from which nothing can be read.

## Strangers: the relay to the site

The configured site is a host name, a port (443 by default) and optionally one address to use instead of resolving the name. The name is resolved once per reload and when a probe needs a new address. There is no default site, none ships with the software, and the config refuses a site without `site.acknowledged: true` (see "The third party").

**For every accepted TCP connection:**

1. **Early connection.** If the budget for new connections to the site has room, open one connection to the site now, with the connect timeout, and watch it. The reason is the one of the decoy handoff: the site's own early close of a connection that sent nothing must reach the peer when a direct visitor would see it. If the budget has no room, skip the early connection and go on to step 2: the node still reads the hello, so a user is still served and only a stranger that needs a connection is closed (see "Pools"). If the site cannot be reached, the node only remembers that, and acts on it at step 5.
2. **Read the hello.** The bytes are a candidate while they can still become one TLS record of type 22 with a version field of `0x0301` or `0x0303` and a length within the limit, holding a ClientHello that fits the limits of the table. This test uses no secret. The node reads at most 4 records and at most 8,192 bytes of handshake, within the hold.
3. **Forward at once** when a byte arrives that makes the bytes no candidate, or when a limit or the hold is reached: go to step 5 with what was read.
4. **A complete hello.** Verify as above. If the carrier does not open, or the hello fails step 1 or 2, go to step 5. If it opens, the connection is not a stranger's: write the hello, unchanged, to the early connection if there is one, read the site's flight without answering it, then close the site connection and answer as "What the node answers with" says. The site is sent the bytes of the hello and nothing else, and those are bytes a censor on the path has already seen. With no early connection the node answers from the kept shapes.
5. **A stranger.** Take the early connection, or open one now if the budget has room, and write every byte read so far to the site, unchanged. Then relay both directions byte for byte. The node reads nothing more as a protocol on this connection. Every byte the site sent is written to the peer before the node waits for anything else, and the site's close, alert or reset reaches the peer as it came.
   - **Half-close.** When one side ends its writes (a FIN), the node passes it as a shutdown of the write half (`SHUT_WR`) on the other connection, keeps relaying the other direction, and closes both when both have ended or the idle time has passed. It never turns a half-close into a full close.
   - **Reset.** When one side resets, the node resets the other connection (it sets `SO_LINGER` to 0 and closes) and ends the relay. It never turns a reset into a FIN.
   - If the site closes the waiting connection first, the peer is closed the same way, as a FIN or as a reset.
   - If the site cannot be reached, the peer's connection is closed, counted as `site_down`, and logged at warn at most once a minute. If there is no early connection and the budget has no room, the peer's connection is closed, counted as `site_budget`, and logged at warn at most once a minute.

The node writes no byte of its own to a stranger, in any state. It does not decrypt the relayed TLS, it holds no key to it, and the site's certificate, its session tickets, its ALPN and its alerts reach the prober as the site made them.

**Pools.** The pools of the stream listeners apply: undecided, relayed and session. Strangers may displace strangers, and nothing a stranger does displaces a session. A decoy session (a hello that opened and was refused) is held in the relayed pool. Because the relayed side is a third party, the relayed pool is smaller than on `tls` and the node also limits how fast it opens connections to the site (see the table of numbers). When the budget is spent, a connection that would need a site connection is closed at the decision point, which is a signature ("Closing under load" in "What remains detectable"), and the only alternative is to load the site without bound. A connection that turns out to be a user's needs no site connection and is never closed for this reason: it is answered from the kept shapes. The budget must never be a reason to refuse a user. The limit is a config value.

**Errors.**

| Condition | What the node does | What the peer sees |
|---|---|---|
| Any hello that fails step 1, 2 or 3, a wrong name, a hello cut short, bytes that are no TLS | Relays to the site | The site's answer, bytes and close behavior |
| A hello that opens and fails any later check | Answers with a flight of the node with a random leaf, as "What the node answers with" says | A flight with the site's sizes and times for that hello, that it cannot read |
| The site cannot be reached, and the peer is not a user | Closes the peer's connection at the decision point, counts `site_down` | A closed connection with no answer. A node whose site is down can be identified for as long as that lasts. |
| The budget for new connections to the site is spent, and the peer is a stranger | Closes the peer's connection at the decision point, counts `site_budget` | A close, where the site would have answered |
| The relayed pool is full | As above | A close |
| The hello is not finished within the hold | Treated as a stranger's from that moment | The site's timers, started up to 3 s late |

## What the node answers with

After an accepted proof the node does not relay. It ends TLS itself and has to answer with a flight that looks like the site's.

### The shape of the site

At start and on reload the node probes the site: it sends the Chrome template hello (without a proof, so the site is not told anything), through the same relay-free connection a client would make, completes the handshake as an ordinary client, and records the **shape** of what comes back. It does this 8 times, 2 s apart, then again every 6 h, and keeps the last 32 shapes, none older than 7 days. After the handshake a probe does one of these in turn: waits, sends a close_notify, or sends a record that fails to decrypt. A shape is:

- the cipher suite, the chosen group, the order and value of the ServerHello's extensions, whether the site sent the compatibility change-cipher-spec record, and the ALPN it chose;
- the sequence of records of the server's flight, with the length of each record as it appeared on the wire and which handshake messages each held, how the flight arrived in groups, and the offset of each record from the probe's hello, less the time the TCP connection took to open;
- the bytes of EncryptedExtensions, verbatim, and the chain that followed the leaf, verbatim, and whether the certificate came compressed (RFC 8879);
- what the site sent after the client's Finished: the number and length of NewSessionTicket records and the time of each from the Finished, and the length, order and time of the first application data records, such as an HTTP/2 SETTINGS frame, that it sent before any request;
- the reactions: what the site sent and how soon, and how it ended the connection (an alert, a close_notify, a FIN, a reset), after a close_notify from the client, after a record that fails to decrypt, and after the client sent nothing at all, with the time it waited before ending an idle connection.

The node accepts a site only if its shape meets all of these: TLS 1.3 is chosen for the template hello with no HelloRetryRequest, the group is X25519 or the hybrid with X25519, the cipher suite is one the node supports (the three TLS 1.3 suites of RFC 8446 section 9.1), the handshake has no client certificate request, and the node can produce every record of the flight at or above its natural size. A site that fails is refused by validation, or by `veilway doctor` for a config in use, and a site that starts to fail while the node runs is handled as the table of numbers says.

### The flight

The node's handshake is written for this one flight. It accepts only a hello whose carrier has opened, never sends a HelloRetryRequest, resumes nothing, asks for no client certificate, and supports no TLS version other than 1.3. It is not a general TLS server, because a general server library fixes the sizes of records, the number of tickets, the order of extensions and the padding in ways this mode cannot accept. The key schedule, the record protection and the alerts follow RFC 8446 exactly.

1. **The site's answer to this hello.** When the early connection is open, the node has written the hello to it unchanged and now reads what the site sends back, and does not answer it. It holds no `x`, so it cannot decrypt the site's encrypted records and does not try. It reads the ServerHello's fields in clear and, for the rest of the flight, the length of each record, how the records were grouped in TCP segments, and the offset of each from the moment the hello was written. The node copies those for its own flight: the same fields and order in the ServerHello with its own `random` and key share, and the same record lengths, groups and offsets. A hello answered by the node and the same bytes answered by the site then show the same sizes and times, because the node's are the site's own for that hello. This is the defense against the paired comparison, and the only defense against a site whose flight depends on the hello. The node closes the site connection when the flight has arrived, or after 5 s, as a client that went away. If there is no early connection, or the site's answer is not usable (it did not arrive in time, it is a HelloRetryRequest or an alert, or it chose a group no kept shape has), the node uses one kept shape and its recorded offsets, and counts `live_miss`.
2. **Wait.** Before each record the node waits until the offset of the live answer, or of the kept shape, less the time it has already spent. The first byte of a user's handshake then comes as long after the hello as the site's own, which a subscriber and a prober can measure.
3. **ServerHello.** The fields and order of the live answer or the kept shape, with a fresh `random`, the client's `legacy_session_id` echoed, and a fresh key share of the chosen group. For the hybrid group the node encapsulates to the client's share as the group's specification says.
4. **Encrypted records.** The messages are the EncryptedExtensions of a kept shape, a Certificate (or CompressedCertificate) holding the throwaway leaf and then the chain after the leaf of that shape, a CertificateVerify, and Finished. The node takes the kept shape whose total length is nearest to the live one without being above it, and pads each record with TLS record padding to the live length. If a live record is shorter than the content the node needs for it, padding cannot help, so the node uses a whole kept shape and counts `live_miss`.
5. **After the client's Finished.** The node sends the NewSessionTicket records of a kept shape, with random contents, and the first application data records of that shape as padding-only frames of the length the site used, each at the time the shape shows. A client never resumes, so the tickets are never read.
6. **Everything later.** The site's timing of tickets, application data and close cannot be taken live, because the node cannot finish a handshake with the site. They come from a kept shape: the node answers a close_notify after the shape's time with the shape's kind of close, answers a record that fails to decrypt with the alert, close or reset and the time of the shape, and closes a connection that sends nothing after the shape's idle time. The same close timing is used for a user's session, and for a refused hello.

**The throwaway leaf.** For each hello that passed steps 1 to 9 the node signs with a P-256 key whose private scalar is made from `node_seed` as FIPS 186-5 appendix A.2.1 makes it from extra random bits: `d = (c mod (n - 1)) + 1`, with `c` the 40 bytes of `node_seed` as a big-endian integer and `n` the group order. For a hello that opened and was refused the key is drawn from the random source and derived from nothing, so that it matches nothing the client computes. In both cases the leaf is a valid DER certificate that holds the matching public key, a subject and a subject alternative name equal to the site's name, and random serial number and filler extensions. It is signed by nothing: its signature field is random bytes. The CertificateVerify is an ECDSA signature by that key over the transcript, as RFC 8446 section 4.4.3 requires. The leaf's age and issuer are not meant to look like anything, because they are inside the encryption, and only the sizes of records are visible.

**A refused hello that opened.** The node makes the whole flight as above, with a random leaf, so the sender can read it only if it holds `x`. Such a session never carries a tunnel. After the handshake the node ignores frames that decrypt, answers a close_notify and a record that fails to decrypt as step 6 says, and closes the session after the idle time of the shape. A replayer holds no `x`, so the only thing it can send is garbage, and that gets the site's reaction to garbage.

### How the client knows the node

The client does not validate the site's chain, its name or its dates, and the chain is never a reason to trust anything. It cannot: the node does not hold the site's key. It does this instead, before any application data is sent or read:

1. It derives `node_seed` the node's way, from its own `dh`, and from it the P-256 public key.
2. It compares that key to the leaf's public key, in constant time. A leaf with another key is a mismatch, handled below.
3. The TLS library verifies the CertificateVerify signature against the leaf's key, and Finished, as it always does. This is the same rule as for a pinned self-signed certificate in `tls`: only the checks of the chain, the name and the dates are skipped, and the signature is always verified.

Only a party that holds `dh` has the key that signs, and `dh` needs `T_priv` or `x`. A party that holds a CA's keys, or the site's, cannot pass step 2, so interception is noticed, as it is on `tls`.

What this does not give: the client cannot tell the node's refusal from other causes. If the leaf's key is not the derived one, what came back is the real site (the hello did not open, so the node relayed), or a flight of the node with a random leaf (the hello opened and the node refused it, because the clock is wrong, the quota is spent, the cache is full, or the device is off), or an interceptor, or a path that sends the address to the real site. The site's own chain would validate against the system roots and prove nothing about the node. So, unlike `tls`, **nothing here is an authenticated refusal.** On a mismatch the client sends no alert. It finishes the handshake the way a client that accepted would, sends no application data, sends a close_notify, closes as "Closing" says, and only then reports the mismatch, so that the site or the node sees a visitor that left. It handles this case as "the server does not match this profile" of `tls`: the candidate is unreachable for this attempt, no refusal wait is spent, and the message says "the server answered like the real site instead of the node: check the device clock and your quota, or the network may be interfering". It sends no HTTP request to learn the time. Whether it should is an open question.

## The session

After the handshake the connection carries tunnel data as TLS 1.3 application data. The TLS record layer is the only encryption: the chunk layer's own sealing is not used, because TLS has already been authenticated against `dh`, and a second layer would only add 16 bytes to each record.

**Frames.** A frame is a 2 byte length `n`, from 1 to 16,000, then `n` bytes of chunk plaintext as defined on the transports page (items, then padding), and the padding rules of that page apply as they do for `tls`. The sender puts one frame in one TLS record, so record lengths follow chunk lengths. A receiver that gets a frame with a bad length, or a chunk plaintext that is invalid, ends the session. A frame whose plaintext holds no item is the padding-only chunk, and is activity.

**Establishing.** The client's first frame holds a WireGuard packet of the device. The session is pending until a WireGuard packet of that device authenticates, and the timers, limits and activity rules of "Session activity and timers" apply, as for `tls`. The node accepts on a session only the WireGuard packets of the device the proof named. The client treats the session as open when a frame from the node has arrived.

**Closing.** Either side sends a TLS `close_notify`, waits up to 5 s for the other, and closes TCP. The same close is used for every cause. The node answers a close_notify after the time that a kept shape shows for the site.

**MTU.** Each full-size inner packet gains 32 bytes of WireGuard, 2 of item length, 2 of frame length, and 22 of TLS record (5 header, 1 content type, 16 tag), 58 in all in each direction. One packet fits one TCP segment (1448 bytes with timestamps over IPv4, 1428 over IPv6) when `mtu` is at most 1448 - 58 = 1390 over IPv4 or 1428 - 58 = 1370 over IPv6, before padding.

**Parallel connections** work as for `tls`: each is its own hello, proof and session.

## Probes and replays

Everything here follows from the rule that the node relays unless the proof holds. The table is what a party that sends it sees.

| Input | What the node does | What the sender sees |
|---|---|---|
| A TCP connection with nothing sent | Waits, with the site's connection open when the budget allowed one. Closes when the site closes. | The site's own timer and close |
| Plain HTTP, or any bytes that are not TLS | Forwards at the first byte that cannot be a hello | The site's TLS alert or close |
| A hello for another server name, or none | Relays it | What the site does with that name |
| A hello with no proof (any browser, scanner or library) | Relays it | The real site's handshake, with its certificate |
| A hello with a proof for the wrong node key, or cut and pasted from another hello, or one byte of a user's hello changed | Fails step 3, relays | The real site's handshake |
| A recorded user's hello, sent again at any time | Opens at step 3 and fails step 7 or the window. Forwards it over the early connection when one is open, and answers with a flight of its own with a random leaf, sized and timed from the site's live answer | A flight it cannot read, with the sizes and times the site gives for those bytes. The same bytes sent to the site give the same sizes. |
| A recorded hello sent first, before the user's own reaches the node | Accepts it once. The first valid copy wins. | A flight it cannot read, and the user's own attempt is relayed. The user retries with a new hello. |
| A valid proof with a clock off by more than `W` | Fails step 7, answers with a flight of its own with a random leaf | A flight like the site's, whose leaf does not match |
| A valid proof of a device that is disabled, expired, over quota or unknown | Fails step 5, answers with a flight of its own with a random leaf | A flight like the site's, whose leaf does not match, the same as for the cases above |
| A partial hello and then silence | Holds up to 3 s, then forwards and lets the site's timers run | The site's behavior, started up to 3 s late |
| Many connections from one source | Relays up to 8, then closes the oldest | A close |

A holder of a valid profile can do everything a user does and can therefore tell the node's flight from the site's. See "Threat model".

## What remains detectable

Stated so that nobody finds these by accident. The first four are not fixable by any change to this page.

- **The address.** The node's address is not one of the site's. One lookup of the server name shows that, for a censor that checks. The only help is a site hosted in the same network as the node, so that the address is plausible for the name.
- **The path to the node.** The round-trip time to the node, the time to live of its packets, and the way its TCP stack behaves are those of the node, not of the site. A prober that measures them against the site's from the same place sees the difference.
- **The site's changes.** The site can change its certificates, its ciphers, its tickets or its HTTP stack at any time, and a shape that is days old is then wrong. The probes bound how long, not whether.
- **Connections to the site from the node.** The site, and a censor that sees the node's traffic to it, see short connections from the node's address for every stranger and every user, a user's connection ending in the middle of the handshake, and a handshake every 6 h.
- **Sampled sizes.** When there is no live answer (the budget is spent, the site cannot be reached, or the answer is not usable), the record sizes and times of the node's flight come from at most 32 samples, and a site whose servers differ more than that, or whose sizes depend on something the node cannot see, gives a flight that is sometimes a size the site never sends. A censor can drain the budget on purpose to make this the case, and a paired comparison then works again, statistically. The records after the flight (tickets, application data, the close) always come from samples. Padding can only add.
- **Closing under load.** When the budget for connections to the site is spent, a stranger that needs a site connection is closed where the site would have answered. A censor that fills the budget with idle connections can make this show. Users are not refused.
- **No probe for 24 h.** While no probe has succeeded for 24 h, everything is relayed, including copies of user hellos, and the paired comparison works. The state is logged and ends at the next probe.
- **The first client flight.** After the handshake the client's first record holds a WireGuard handshake initiation in a frame, where a browser sends an HTTP/2 preface and a request. The node reproduces the site's first records only in size, with padding.
- **No resumption, ever.** A browser that visits a site again resumes with a ticket. This client never does, and the node never accepts a ticket.
- **The shape of the flow afterwards.** One long connection that carries a lot in both directions, the small exchange that recurs every one to two minutes, record lengths that follow chunk lengths, and the handshakes of applications inside the tunnel as a sequence of sizes (the same limits as "What `tls` and `ws` do not hide"). None of this is defended against.
- **A partial hello that never ends.** The hold of 3 s and the late start of the site's timers.
- **The hybrid group.** If the site picks it, the node must too, and a node that cannot encapsulate is refused by the shape check. The ServerHello size is then the site's.
- **The profile.** A holder of a subscription knows the node's address, the server name and the key, can send a proof, and compare the flights. No design can stop a user from recognizing the service it uses.

## Choosing a site

The operator chooses. None is suggested or shipped, and no list of sites is kept by the project, because a list of sites that are known to work is a list of the sites to watch.

A site fits when all of these hold. `veilway doctor` checks the first four from the node.

1. TLS 1.3 is chosen for the Chrome template hello, with no HelloRetryRequest, and the group is X25519 or the hybrid.
2. It accepts connections from the node's address without a challenge, a block or a rate limit, over 10 probes.
3. It does not require Encrypted Client Hello, and answers the ECH GREASE of the template as a site that does not use it.
4. It answers a plain TLS handshake on its address with no routing by the TLS client's address.
5. It is hosted in the same network as the node, or as near as can be had. This is what makes the address plausible.
6. It is a site that a user in the censored country can reach, is not blocked there, and is large enough that visits from an unusual address are not remarkable. It is also large enough that the node's connections do not matter to its owner.
7. It is not the operator's own site. For a site the operator owns, with a real certificate, `tls` or `ws` is the better choice: they show the real site's behavior, with no relay to a third party.

A flight whose length varies from one connection to the next is not a reason to refuse a site. The node copies the length the site showed for that same hello, and the kept shapes are only the fallback.

## The third party

Every stranger's connection, every probe and every early connection is a connection to a site whose owner has not agreed. The site sees them from the node's address. Its name is used to make the node's traffic look like visits to it, and if that is noticed the site may be blocked, or its owner questioned. This may break the site's terms of use or the law where the operator is.

- The site is always chosen by the operator. The config key `site.acknowledged` must be `true`, and the panel's form says what it means before it sets it.
- Connections to the site are capped per source, in total, and per second, so the node cannot be used to load it.
- A site that learns a lot from the node: when users connect (the early connection and the forwarded hello), how many strangers come, and the strangers' hellos. It does not learn who a user is, because the node's address is its source and nothing a user sent reaches it.
- The site is sent only bytes that a censor on the path has already seen: the bytes of strangers as they came, and the ClientHello of a hello that opened, which is in clear on the path. Nothing of a user's later records, of the tunnel or of the proof's keys reaches the site. The node closes the connection when the site's flight has arrived, so the site sees a handshake that was never finished.

## Threat model of this mode

This section is the one `THREAT_MODEL.md` and its page are to refer to for `faketls`. It uses the adversaries of section 5.1 there.

**Assets.** The tunnel content (protected by WireGuard alone). The device's identity, which is its tag and its timestamps. The node's transport private key. The existence of the node as a Veilway node. The site, as a third party that can be harmed.

| Adversary | Can do | Design response | What is left |
|---|---|---|---|
| Passive observer, one connection | Reads the hello, the ServerHello, the sizes and timing of every record, and the flow afterwards | The hello has only random-looking carrier bytes and an ordinary key share. The flight has the site's sizes. | The items under "What remains detectable" |
| Passive observer, many connections | Looks for something that repeats | Nothing repeats: `X`, the carrier and the node's key are new each time | Count, timing and volume of connections to one address, and the shape of the flow |
| Active prober, no subscription | Sends any bytes, any hello, any replay | Relays all of it to the site, as "Probes and replays" says | The address, the path, the 3 s hold, and the site's changes |
| Replayer who can race | Delivers a recorded hello before its sender | One acceptance, then the replay cache. The racer reads nothing. | A burned hello, and so one retry for the user |
| Paired comparer | Records a user's hello and sends the same bytes to the node and to the site, at once or in turn, and compares the flights with each other and with the user's own | A hello that opens is never relayed. The node answers with the sizes, grouping and times the site showed for those same bytes, and a leaf of random bytes for a copy. The contents are encrypted, so only sizes and times can be compared. | With no live answer (budget spent, site down) the sizes come from samples and a statistical comparison is possible again. The records after the flight are timed from samples. |
| Holder of a subscription | Everything a user does, and a comparison of the node's flight with the site's | Not defended. | Confirms the node is a Veilway node, as on every transport |
| Holder of a CA, or a CDN in the path | Presents any certificate | The client does not use the chain, and checks the derived key. The node cannot sit behind a CDN or any TLS-ending proxy. | Noticing, and the connection fails |
| A node transport private key leaks | Opens every hello it has recorded (timestamp, source address, hourly tag). Computes `T_pub`, so it can do what a holder of a subscription does and scan addresses for the node. Computes the derived leaf key, so it can answer a client's hello and be accepted: live impersonation of the node | The hello is in clear on the path, so unlike `tls` a censor's own passive log is enough to open it. The tag is of the hour and names no device without the device's key, so recorded hellos link only within an hour. The key is the transport's own, so it opens nothing of `tls`. Rotation limits the future, and a transport key kept for 30 days gives 30 days. | Every connection time and source address back to the key's start, with devices linked only within an hour. Impersonation until the profiles carry a new key. The tunnel stays protected by WireGuard. "Open questions" asks if this can be made better. |
| The site itself, if hostile | Sees every stranger and every probe, and when users connect | The node's address is the source, nothing of a user reaches it | Timing and count of user sessions |
| The site changes | Moves a shape | Probes, and a stop after 24 h without one | Hours of a wrong shape |
| A party that uses the node to load a site | Opens many connections | The caps on strangers and on new connections | Strangers see a close when the cap is reached |

**Out of scope.** Traffic analysis of the tunnel, a compromised node (it holds the key and the config), and a censor that blocks every address it has not seen the site on.

**Not reviewed from outside.** The proof (the key agreement, the associated data, the truncated binder), the node's handshake (the key schedule, the record padding, the throwaway key derived from a shared secret, the hybrid encapsulation), the relay's timing and its half-close and reset handling, the live copy and the budget rule, and the claim that the live copy and the sampled shapes are close enough to the site's flights. There is no outside review. The mode is offered as alpha, off by default, behind a panel switch and an app label that say it is new and unreviewed, and only once the tests of "Tests before it is offered" pass. An outside review stays wanted, and its findings would be built before the alpha label comes off.

## Security considerations

- **The proof is in clear on the path.** Everything the node sees of a user's hello, a censor sees. The design makes it look random and bound to the hello. It cannot make it unavailable to a holder of `T_priv`.
- **A holder of `T_priv` opens recorded hellos and can impersonate the node.** The tag changes every hour and names no device without the device's key, so recorded hellos link only within an hour, and the key is the transport's own. It still gives the source and time of every hello, and it gives `T_pub`. The key rotates at least every 30 days, and a rotated key must be destroyed.
- **A fresh `x` for every seal.** The nonce of the carrier is fixed, so a reused `x` breaks the carrier. The client draws `x` anew for every hello and checks it against its recent seals.
- **Unauthenticated input is bounded.** Before a proof is accepted, a peer can make the node read up to 8,192 bytes of handshake within 3 s, hold one connection in the undecided or relayed pool, and cost one X25519 and one AEAD open. A hello that opens costs the node a flight, which the rate limits, the cap on decoy sessions per source and a token bucket for flights that open no session (per source and per listener) bound. A hello that opens and is refused, and finds the bucket empty, is the one exception to "never relayed": it is relayed to the site byte for byte, with the answer the site has already given it, and not closed, because a close would be a signature and the relayed answer is the site's own. Nothing is allocated from a length the peer chose.
- **No amplification.** A stranger is sent only what the site sent that stranger. A user is sent a flight no larger than the site's. The node answers a user only after a proof, and a proof needs a device secret.
- **No identifying answer to a stranger.** No byte the node composes reaches someone who is not a user, except the flight made for a hello that opened (which only a holder of the profile or a copy of a user's hello can cause), and a close when the site is down or the budget or a cap is reached.
- **Half-closes and resets pass through.** A relay that turns a FIN into a close, or a reset into a FIN, shows a difference from the site to any prober. Each passes as it came.
- **Replay.** The window, the cache, the floor and the limit are those of the transports page. This mode adds nothing to the replay file.
- **The throwaway key is derived from a shared secret.** A refused hello gets a random key instead. Each signs only transcripts that include a fresh key share of the node's own, so a signature is not reusable. A leak of `dh` is a leak of the key for that one connection, and `dh` is already enough to read that connection's proof.
- **The binder is 16 bytes.** A guess succeeds with probability 2^-128 and the node limits proofs per device and per source.
- **The early connection is a leak to the site.** It shows when users connect, and the forwarded hello shows their hellos, which a censor on the path sees anyway. Opening it only after the decision would hide the first and would show strangers a delay and change the site's timers. The default is the early connection, skipped when the budget is spent. See "Open questions".
- **Every shared default is a signature.** The hold, the delay and the shapes are the same for every node.
- **No failure is latched silently.** Each state in which the node refuses honest clients (the site down, the shape stale, a cap reached, the replay state) has a log line, a counter and an end.
- **Third parties.** The site is a third party that carries load and risk for this protocol. See "The third party".

## Tests before it is offered

All of these on the release, with dates, and none is claimed before it passes.

1. The differential probe test of the transports page against the real site through the node: the same inputs to the node and to the site from one place, comparing bytes, close behavior and time, including a silent connection, a partial hello, a hello with a changed name, a large input read slowly, and every kind of garbage that test sends to `tls`.
2. The paired comparison: record user hellos, then send each to the node and straight to the site, at the same time and in turn, and compare the record lengths, the grouping and the timing of both answers and of the answer the user's own connection got. A classifier is the measure, not equal means. Repeat with the budget spent and the site down, so that the fallback to kept shapes is measured and its difference stated.
3. A relay test of half-close and reset: a FIN from the peer while the site is still answering, a FIN from the site first, a reset from either side, and the same input straight to the site, comparing what each end sees.
4. A budget test: with the budget spent, users are still served from kept shapes, no user is closed, and only strangers that need a site connection are closed. A censor that fills the budget must not be able to lock out a user.
5. A TLS-layer comparison: for hellos with and without proof, the flight of the node and of the site, record by record, over many connections, and the same for the first records after the handshake and for the tickets, application data and close that follow, with their times.
6. The client fingerprint test with the changes of this page (ALPN, ALPS, no PSK, the choice of `X`), against a capture of the claimed Chrome.
7. A replay and clock test: every row of "Probes and replays", the cases of the replay file, the recording allowance, and a hello refused by a limit that is sent again from another address.
8. A seal test: two seals with one `x` are refused by the client, `x` differs across restarts and across parallel connections, and a carrier built with a reused `x` is shown to be broken by the test, not assumed.
9. A tag test: tags change at the hour, hellos near the hour boundary open, two hours of one device do not link without the device's key, and a tag of `udp-obfs` or of the stream proof is a miss.
10. A check of the flight against RFC 8446 and BoringSSL as the client, and against the traces of RFC 8448 for the key schedule.
11. A measurement of the timing: the time from the hello to the first byte of the node's flight and of the site's, across a real path.
12. A site-change test: a site whose shape moves, and the node's behavior over 24 h.

## Still to measure

Each item needs a dated capture. The page is corrected where a measurement disagrees.

| What to measure | What depends on it |
|---|---|
| Whether the Chrome release the build claims sends `random` and a `legacy_session_id` of 32 uniformly random bytes in every hello to a site, with no change in some situations | The carrier |
| Whether that Chrome's standalone X25519 share and the one inside the hybrid share are the same value, and the order of the parts in the X25519MLKEM768 share | Which share is `X`, whether the template reuses `x`, and the offset of the X25519 part |
| The ALPN, ALPS and ECH GREASE of a first visit, and the lengths ECH GREASE takes | The hello this mode sends |
| For a set of sites: group, suite, record lengths, ticket counts, first application data records, certificate compression, and how much each varies from one connection to the next and over weeks | The shape check and the sample size of 32 |
| How sites answer the ECH GREASE of the template, and what a site that supports ECH puts in EncryptedExtensions for it | The verbatim copy of EncryptedExtensions |
| How sites time out a connection that sent nothing, or a hello cut short | The hold and the early connection |
| How TCP segments of a site's flight are grouped | The grouping rule of the shape |
| How far a prober can measure the node's extra hop against a site from a real network, with the live copy | Whether the timing of the flight needs a correction |
| Whether the same hello gets the same record lengths, grouping and times from a site on every connection, and how they vary between hellos | The live copy and its fallback |
| How sites react after the handshake: the time to tickets, to the first application data, to a close_notify and to a record that fails to decrypt, and the idle timeouts | The reactions in the shape |
| How many new connections a second a site's owner tolerates from one address | The budget of 16 a second |

## Config and profile fields (proposed)

An inbound of type `veilway` takes a transport of type `faketls`.

| Field | Meaning |
|---|---|
| `site.host` | The site's name, used as the only accepted server name and as the name in the relayed and probe connections |
| `site.names` | Optional extra server names that a user's hello may carry, at most 4 |
| `site.port` | The site's port, 443 by default |
| `site.address` | Optional address to connect to instead of resolving the name |
| `site.acknowledged` | Must be `true`. Validation refuses the transport without it. |
| `transport_key` | A key of its own, sealed in the same way as for the other stream transports. Validation refuses a key equal to the transport key of any other transport on the node. |
| `limits.relayed` | Strangers relayed to the site, 256 by default |
| `limits.site_rate` | New connections to the site per second, 16 by default. When it is spent, users are still served. |

Validation refuses a `faketls` listener that has `trusted_proxies`, shares its address and port with another transport, or is given a `site` that resolves to the node's own address (a loop). A `faketls` listener on an address with a weaker listener is capped at that listener's rating, as on the transports page.

The profile's candidate for this transport has the node's address and port, the server name (which must be the site's), and the node transport public key. It takes the public key of the `faketls` transport key and no other. It takes no certificate pin, no `self_signed`, no `ech`, no `host` and no `path`, and none of the fronting values, because there is no CDN and no front. A candidate that sets one is refused.

## Open questions

Each is listed with the default this page takes. The first six are the ones a reviewer should check first.

| Question | Default |
|---|---|
| Is the proof sound: a static-ephemeral Diffie-Hellman whose ephemeral is the TLS key share, a ChaCha20-Poly1305 carrier with the hello as associated data, an hourly device tag inside, and a 16 byte binder? | As written. Unreviewed. |
| Can the node's flight be made close enough to the site's, from the site's live answer to each hello where there is one and at most 32 samples of shape where there is not, with record padding, that a classifier trained on the site's real flights cannot tell them apart? | As written. The unknown that decides whether the mode is worth offering. |
| Is a throwaway P-256 key derived from the shared secret, with a leaf signed by nothing, acceptable to a TLS library as the client, and sound? | As written. It makes the library verify the signature as always. |
| How does the client set `x`, `random` and `legacy_session_id` after the rest of the hello is final? BoringSSL has no supported way. | A small patch in the vendored BoringSSL at the point where the hello is written. If it cannot be kept small, the client writes the hello itself from the capture and runs a small TLS 1.3 client for this mode. A spike decides. |
| Should the node's handshake be a purpose-built writer, or a general TLS library with the sizes forced? | The writer. It is the largest part of the build and the least-reviewed code in the project, so the review has to cover it. |
| A leaked `T_priv` opens every recorded hello and allows impersonation of the node, with the tag linking a device only within an hour. Should the node use a short-lived key for the proof, published in the subscription, so that a leak does not reach the past or the future? | No in this draft: it needs refresh traffic every few hours and a state for clients that have not refreshed. The hourly tag and the 30 day rotation stay. |
| Should a client that reaches the real site (the leaf key is wrong) send one request to learn the site's `Date` for its clock? | No. It is a request no browser sends. The client says what it saw and the user checks the clock. |
| Should a refusal be authenticated by the node, for example by relaying and not being able to? | Not possible by construction. The client treats it as a mismatch. |
| Open the connection to the site at accept, or only after the decision? | At accept, because the site's early close of a silent connection must reach the peer on the site's schedule. It shows the site when users connect. Skipped when the budget is spent, and a user is then served from kept shapes. |
| The hold of 3 s: does it hurt users on lossy paths, and does it show? | 3 s. A user whose hello is later is relayed and retries. |
| How does the node time its flight? | From the site's live answer to the same hello, and from kept shapes only when there is none. |
| Should the node forward a hello that opened to the site (the live copy), or answer from samples only? | Forward. It makes the flight equal the site's for that hello. It costs one more connection per handshake and sends the site every user's hello, which a censor on the path sees anyway. The budget rule keeps users served. |
| Should a hello that opens and is refused get a flight of the node, or the relay? | A flight of the node. A relayed copy beside the user's own flight is the paired comparison. |
| May `x` be shared by the standalone and the hybrid share? | Yes if the capture of the claimed Chrome does it, and no otherwise. `X` is the standalone share when there is one. |
| Support the hybrid group on the node, or refuse sites that choose it? | Support it. A Chrome hello gets the hybrid from most large sites, and a client template without it would be a rare one. |
| Carry the frames inside HTTP/2 after the handshake, so that the first records look like a request? | No in this draft. It would use RFC 8441 and belongs with the HTTP/2 work. |
| Should the project ship, or let the panel suggest, a list of sites? | No, never. |
| Should the page keep the name `faketls`, or use another? | `faketls`, as in the transports table. |
| Can a `tls` and a `faketls` transport share a port? | No. Each takes its own listener. |
| The same hello is sent to the site by the probe, without a proof. Is a probe that always uses the template a signature the site's owner can see? | Yes, once every 6 h, with the node's address as the source. Stated. |
