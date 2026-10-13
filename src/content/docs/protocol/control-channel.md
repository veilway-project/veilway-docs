---
title: Control channel
description: The authenticated API a client reaches inside the tunnel, at the gateway address.
---

:::caution[Draft]
This page is a draft specification. It has had three rounds of internal adversarial review, and its node side has been implemented and that implementation reviewed against this page. It has not been reviewed by anyone outside the project. The node side exists on `veilway` inbounds with the `udp` transport. No client exists yet. Do not rely on any property described here.
:::

The control channel is what plain WireGuard lacks: a way for a connected client to check its addresses and resolver for IPv4 and IPv6, find a working MTU, see the exits it may use and pick one, see its usage and quota, and receive operator notices. It is a small binary protocol on one port of the gateway address, inside the tunnel. Read [Protocol overview](../overview/) first for the terms and the keys.

Two rules shape everything on this page:

- **The node decides nothing about who is asking from what the request says.** Identity is the tunnel the request arrived through.
- **The client trusts nothing a node says beyond fixed bounds.** A node can be malicious or compromised.

## Where it is

| | |
|---|---|
| Address | The gateway address of the inbound, IPv4 or IPv6 |
| Port | TCP 47873 for the channel. UDP 47873 for MTU probes only. Fixed, not configurable. |
| Inbound types | `veilway` only. On a `wireguard` inbound the port is not served and the gateway answers DNS and nothing else, as today. |
| Carried in | Plain TCP inside the tunnel. No TLS: the tunnel already encrypts and authenticates, and a TLS handshake inside the tunnel would add a recognisable pattern. |
| Routing | Handled by the node before the routing rules and before any exit, the way gateway DNS is. No rule can block, redirect or open it. `dns.hijack` has no effect on it. |
| Counting | Its bytes are inner IP bytes like any others and count towards usage. |

This changes one sentence of the [config reference](../../reference/config/) ("A gateway address answers DNS and nothing else") and invariant 9 of the threat model, for `veilway` inbounds only. This draft changes neither document. Both must change in the same change that builds the channel.

## Numbers that are judgement calls

Every range written "a to b" is inclusive at both ends, and a time drawn from a range is drawn in whole milliseconds.

| Name | Value |
|---|---|
| Port | 47873. Not registered with any authority. |
| Delay before opening the channel | uniform 0 to 2000 ms after the WireGuard handshake |
| Time to finish authentication | 10 s from the TCP accept on the node, and 10 s from the TCP connection being open on the client |
| Connections per device that have not authenticated | 4. A fifth replaces the oldest. |
| Authenticated connections per device | 2. A third replaces the oldest. |
| Client message | `length` at most 4,096 |
| Node message | `length` at most 65,535 |
| Messages from one device, of every type | 10 at once, then 1 a second. Over it: `error` code 1. |
| `set_exit` from one device | 3 at once, then 1 every 5 s. Over it: `exit_result` status 2. |
| Exits in a catalogue | at most 256, at most 64 per message |
| Notices | at most 4, each shown cut to 280 bytes |
| Hints | at most 16 |
| Usage push | not sooner than a time drawn uniformly from 30 to 90 s after the last one |
| Pushed snapshot messages the client applies (`session`, `exits`, `usage`, `notices`, `hints`) | at most 1 of each kind every 5 s. A newer one replaces one that waits. Every other message is handled at once. |
| Subscription refresh caused by the channel | at most 1 in 6 hours, through the tunnel |
| MTU probe run | 1 per device per 60 s, token valid 30 s, at most 16 probes in each direction, 2 s wait per probe, 1 retry |
| MTU probe sizes | The profile's `mtu`, and those of 1280, 1320, 1360, 1390, 1420 and 1440 that are below it |
| Remembered MTU on the client | per network and transport, 7 days |
| MTU re-confirmation | one probe in each direction after a time drawn uniformly from 300 to 900 s, for as long as the session lasts |
| Wait after `bye` | see "Being cut off" |
| Device MTU on the node | kept until the client sets another, or until the device has had no WireGuard session for 180 s. One value per device, also for a device with addresses in two inbounds. |

## Who can use it

**Authentication by tunnel identity.** A connection is accepted only from a source address that the sending device owns, in the tunnel it arrived through. WireGuard has authenticated that device, and the node's ingress checks have tied the address to it. No message has a field that names a user or a device.

Tunnel identity alone would make every program on the client device, every device behind a client that shares its tunnel, and every web page in the user's browser the user. Two things prevent that:

- **A framing a browser cannot send.** The first byte a client sends is `0x00`. A browser can open this port only with an HTTP request or a WebSocket upgrade, and both begin with a letter.
- **A credential only the client engine holds.** After the preface, the client proves knowledge of the device transport secret, bound to a fresh number from each side, to the device and to the inbound. The node proves the same in return.

Not prevented: a program on the client device that can read the stored profile holds the transport secret and can use the channel. A program on the device, or a device that shares its tunnel, can also open connections to the port and crowd the real client's attempts for a moment. There is no lockout, and the pool for connections that have not authenticated makes room by dropping the oldest, so a single failed attempt or a slow flood does not keep the client out. A program that opens connections fast enough can still push the client's attempt out of the 4 places before it authenticates. That takes software on the user's own device or network. A compromised device is outside what Veilway defends.

## Framing

Every message after the preface is:

| Offset | Size | Field |
|---|---|---|
| 0 | 2 | `length`: the number of bytes that follow, at least 1 |
| 2 | 1 | `type` |
| 3 | `length` - 1 | Body, laid out as the type says |

- Every body has a fixed layout. There is no self-describing encoding, no optional field and no nesting. A body shorter or longer than its layout is malformed.
- A string is a length followed by UTF-8 bytes. A tag has a 1 byte length of at most 64. Display text has a 2 byte length. Bytes that are not valid UTF-8 are a malformed body.
- A tag on the wire follows the tag rule of the [config reference](../../reference/config/) exactly, in both directions: it matches `[a-z0-9][a-z0-9_-]{0,63}` and is not one of the words that rule reserves (`all`, `any`, `block`, `reject`, `drop`, `local`, `direct`, `user`). Anything else is a malformed body. An exit's tag is never empty. The only empty tags are the one in `set_exit` that clears the selection and the one in `exit_result` that says nothing is selected. Because a tag can hold only these characters, it needs no filter before it is shown.
- Display text (an exit's name, a notice) has no limit of its own on the wire: any length that fits the message is a valid body. Its limit is a display limit. The receiver filters the text for display and then cuts it to that limit, in that order, on a character boundary so that no character is split (see "What a malicious node can do"). Text over its display limit is cut. It is never a malformed body and never a reason to close the connection. The size of a message as a whole is still bounded by `length`. The filter removes control characters, bidirectional formatting characters, zero-width and other invisible characters, and also U+2800, U+FFF0 to U+FFF8, U+FFFC, U+13430 to U+1343F, U+1BCA0 to U+1BCA3, private use characters and noncharacters. The same filter serves the subscription format.
- An address is a family byte (`4` or `6`) followed by 4 or 16 bytes.
- Reserved bits and reserved bytes are zero. A message with one set is malformed.

## Opening a connection

1. The client opens a TCP connection to the gateway address and port, after the delay in the table of numbers. Other traffic does not wait for it.
2. The client sends the preface, 8 bytes: `00 56 57 43 54 4C 00 00`. A node that reads anything else closes the connection.
3. The client sends `hello`. The node answers `hello_reply`.
4. The client checks the version (see "Versions"), computes its credential and sends `auth`.
5. The node verifies in constant time. On failure it closes the connection and counts the failure. On success it sends `auth_ok` with its own credential.
6. The client verifies the node's credential in constant time. On failure it closes the connection, applies nothing it received, and tells the user the control channel could not be verified. The tunnel stays up.
7. The node sends the snapshot, unasked: one `session`, the `exits` messages, one `usage`, one `notices` and one `hints`.

Steps 2 to 5 must finish within the time limit, or the node closes the connection. The client has the same limit, counted from the moment its TCP connection is open to the moment it has verified `auth_ok`. When it passes, the client closes the connection and treats the channel as unavailable, so a node cannot hold the opening exchange open forever.

### The credential

It is a mutual challenge and response with HMAC-SHA-256, the textbook three-message form: each side sends a fresh random number, and each proves it holds the shared key by a MAC over everything both sides sent.

With `k_ctl` the control key derived from the device transport secret (see "Keys derived from the device transport secret" on the transports page), and a label being its ASCII bytes followed by one zero byte:

```
transcript = "veilway v1 control auth" || preface || hello || hello_reply
client_mac = HMAC-SHA-256(key = k_ctl, message = 0x01 || transcript)
node_mac   = HMAC-SHA-256(key = k_ctl, message = 0x02 || transcript)
```

- `hello` and `hello_reply` are the whole messages as sent, from the first length byte to the last body byte. The transcript therefore covers `max_version`, the chosen `version` and both random numbers, so nobody in between can change the version that was offered or chosen.
- Both numbers are 32 fresh random bytes, so a credential is good for this connection only.
- `k_ctl` depends on the device's and the inbound's WireGuard public keys. The node computes it for the device the connection came from. One device's secret therefore does not authenticate from another device's tunnel, even another device of the same user.
- A device may have two transport secrets during a rotation. The node checks the client's MAC against both, always both, and answers with the one that matched. So that an operator who removes one of two secrets can tell which one stays, the control API shows a secret in its config read as `<redacted:xxxxxxxx>`, where the digits are a short fingerprint that is different in every run of the node (see the [control API reference](../../reference/api/)).
- The credential is sent once per connection, not per message. A message cannot be put into an established TCP connection by a browser or by another device behind the client.

### Versions

This page defines version 1.

0. Before it sends anything, a client whose signed profile has a `min_control_version` above the highest version the client speaks does not open the channel. It tells the user that the app needs an update. Here the app is too old, not the node.
1. `hello` carries the highest version the client speaks.
2. The node answers with the lower of that and the highest it speaks. If that would be 0 it closes the connection.
3. When the answer is below `min_control_version` of its signed profile, the client closes the connection and tells the user the node is too old. When the answer is above what the client offered, or is 0, the node has broken the protocol: the client closes the connection and reports a protocol error, not an old node. In neither case does it try again with a lower version.
4. Version 1 never grows. A new message type, a new field or a new enum value is a new version.

## Messages

Client to node:

| Type | Name | Body | Allowed |
|---|---|---|---|
| `0x01` | `hello` | `max_version` (1), `client_nonce` (32) | First message only |
| `0x02` | `auth` | `client_mac` (32) | Second message only |
| `0x10` | `refresh` | Empty | After `auth_ok` |
| `0x11` | `set_exit` | Exit tag. An empty tag clears the selection. | After `auth_ok` |
| `0x12` | `probe_start` | Empty | After `auth_ok` |
| `0x13` | `probe_down` | `seq` (1), `size` (2), `port` (2) | Only after a `probe_token` was received on this connection and while that token is live. At any other time the node answers `error` code 2. A `size` outside 1280 to `max_size`, or a `port` of 0, is a malformed body: the node closes the connection with no message. |
| `0x14` | `set_mtu` | `mtu` (2) | After `auth_ok`. A value outside 1280 to the inbound's `mtu` is not malformed: it changes nothing and is answered with `mtu_result` carrying the value in force. |

Node to client:

| Type | Name | Body |
|---|---|---|
| `0x81` | `hello_reply` | `version` (1), `node_nonce` (32) |
| `0x82` | `auth_ok` | `node_mac` (32) |
| `0x90` | `session` | `node_time` (8, Unix seconds), `mtu` (2), family count (1, 1 or 2), then per family: the device's address and the gateway address. Families appear in the order IPv4 then IPv6, each at most once, and both addresses of an entry are of the same family. Anything else is malformed. |
| `0x91` | `exits` | `flags` (1: bit 0 set on the last message of a catalogue, every other bit zero), entry count (1, at most 64), entries |
| `0x92` | `exit_result` | `status` (1), the tag now selected (empty when none) |
| `0x93` | `usage` | `used_bytes` (8), `quota_bytes` (8, 0 for none), `period` (1: 0 none, 1 daily, 2 weekly, 3 monthly), `period_start` (8, Unix seconds), `expires_at` (8, Unix seconds, 0 for none), lifetime `up_bytes` (8), lifetime `down_bytes` (8) |
| `0x94` | `notices` | Count (1, at most 4), then per notice: `severity` (1: 0 information, 1 warning), text (shown cut to 280 bytes) |
| `0x95` | `hints` | Count (1, at most 16), then per hint: transport index (1), candidate index (1), both positions in the lists of the signed profile |
| `0x96` | `probe_token` | `token` (8), `max_size` (2) |
| `0x97` | `probe_ack` | `seq` (1), `size` (2) |
| `0x98` | `mtu_result` | `mtu` (2): the value now in force for this device |
| `0x99` | `bye` | `reason` (1): 1 quota used up, 2 expired, 3 disabled or removed, 4 the node is stopping |
| `0x9F` | `error` | `code` (1), the `type` of the message it answers (1). The type is one of `0x10` to `0x14`. |

An `exits` entry:

| Field | Size | Meaning |
|---|---|---|
| Tag | 1 + up to 64 | The exit's tag |
| Name | 2 + its length | The exit's display name, shown cut to 64 characters |
| Country | 2 | Two uppercase ASCII letters, or two zero bytes for none |
| Flags | 1 | Bit 0: carries every IP protocol. Bit 1: this device's selection. Bit 2: the user's configured exit. Bit 3: working. Other bits zero. |
| Load | 1 | 0 unknown, 1 low, 2 medium, 3 high. It is 0 until something on the node measures load. |

"The user's configured exit" is the exit a device without a selection leaves through: the user's `exit`, or `routing.default` when the user has none. "Working" is always set for a `netstack` exit, set for an `l3` exit while its interface is up, and never set for a `block` exit.

A catalogue is one or more `exits` messages, the last with bit 0 of `flags` set. `refresh` asks for the snapshot again.

A catalogue has exactly one encoding, and the client checks it as a whole:

- Every message that is not the last carries exactly 64 entries. The last carries 1 to 64, or 0 only when it is the only message and the user has no exits.
- No tag appears twice.
- At most one entry has the "this device's selection" bit, and at most one has the "user's configured exit" bit.
- At most 256 entries in all.

A catalogue that breaks any of these is dropped whole, nothing of it is shown, and the client closes the connection.

### Errors

| Condition | What the node does |
|---|---|
| A wrong preface, an unknown type, a malformed body, a `length` of 0 or over the limit, a type that is not allowed in the current state | Closes the connection with no message, and counts it |
| A failed `auth` | Closes the connection with no message, and counts it. There is no lockout. |
| A message of any type over the limit for all messages | Answers `error` with code 1 (rate limited) and ignores the message. An ignored `set_exit` does not count against the `set_exit` limit. |
| A `set_exit` that is within the limit for all messages and over the `set_exit` limit | Answers `exit_result` with status 2 and the tag in force, and changes nothing |
| A `probe_down` with a `size` outside 1280 to `max_size` or a `port` of 0 | Malformed body: closes the connection with no message |
| A `set_mtu` outside 1280 to the inbound's `mtu` | Changes nothing and answers `mtu_result` with the value in force |
| `probe_start` on a transport where it does not apply, or `probe_down` without a live token | Answers `error` with code 2 (not applicable) |
| `probe_start` while a run is open or too soon after one | Answers `error` with code 3 (busy) |
| `set_exit` for a tag that does not exist, or one the user is not entitled to | Answers `exit_result` with status 1. Both cases look the same, so the channel does not reveal which tags exist. |

`error` answers only the requests a client may send after the opening: `refresh` (`0x10`), `set_exit` (`0x11`), `probe_start` (`0x12`), `probe_down` (`0x13`) and `set_mtu` (`0x14`). A bad `hello` or `auth` is never answered with `error`: the connection is closed. A client that receives an `error` naming any other type closes the connection.

`exit_result` statuses: 0 selected, 1 refused, 2 rate limited by the `set_exit` limit. Both limits apply to `set_exit`: the limit for all messages is checked first. A client treats a message it cannot read the same way a node does: it closes the connection and applies nothing from that message.

### Being cut off

When the node is about to cut a device off, it first sends, on every authenticated connection of that device, a last `usage` if the cause is quota, and then `bye` with the reason. It does this on a best effort: the cut-off does not wait for it. The `bye` is one TCP segment written at the node's next sequence number on that connection. It is not sent again if it is lost.

No `bye` is sent to a device that is cut off because its addresses or its preshared key changed. None of the four reasons is true of it, and it can connect again with its new values.

A client that received `bye` knows the tunnel was ended on purpose. It shows the reason, does not treat any transport or candidate as failed, and does not run transport fallback. When it tries again depends on the reason:

| Reason | The client tries again |
|---|---|
| 1, quota used up | When the next period starts, worked out from `period` and `period_start` of the last `usage`, or when the user asks. With no period, only when the user asks or a refreshed subscription shows a new quota. |
| 2, expired | When the user asks, or when a refreshed subscription shows a later expiry. |
| 3, disabled or removed | With the refusal wait of the transports page, which doubles up to an hour. |
| 4, the node is stopping | With the ordinary reconnect wait. |

Every attempt of a cut-off device is a connection with a refused proof, visible on the path and a load on a CDN, so the client makes as few as it can. Without this, a user whose quota ran out would look to the client like a user who is being blocked, and the client would walk through every transport and front.

A node that lies in a `bye` can only make its own client wait.

## Addresses and resolver

A device's tunnel addresses are fixed in the node's config, and WireGuard needs one before the first inner packet, so the client takes its addresses from its signed profile. In version 1 the channel only reports. `session` states what the node holds, for IPv4 and for IPv6: the device's address and the gateway address of that family. The gateway address is also the resolver. There is no separate resolver field, and a node cannot name a resolver anywhere else.

What the client does with `session`:

| Case | Client behaviour |
|---|---|
| Same values as the profile | Nothing |
| Anything else: a different address or gateway, a family the profile lacks, a family the node lacks | Keeps the profile's values, shows that the profile is out of date, and refreshes the subscription within the limit in the table of numbers, through the tunnel |

A client never adds or changes an address, a resolver or a route because a node said so. An address family is added by a new signed subscription, and by nothing else. The authority to configure the client's network belongs to the key that signs subscriptions, not to a node.

`node_time` lets the client warn the user when the device clock is drifting towards the limit that proofs allow. The client never sets a clock from it.

## MTU discovery

The profile carries the inbound's `mtu`. On a `veilway` inbound, outer packets of a datagram transport are never fragmented (see "MTU" on the transports page), so on a path that cannot carry packets of that size every full-size packet is lost. The channel lets the client find the largest size that passes in both directions. The method is that of RFC 8899 (path MTU discovery by probing from the packet layer): send probes of chosen sizes and treat a size as working only when a probe of that size was confirmed.

It applies on `udp` and `udp-obfs`. On a stream transport nothing fragments, the node answers `probe_start` with `error` code 2, and the client keeps the profile's `mtu`.

A probe is one UDP datagram between the device's address and the gateway's probe port, whose inner IP packet is exactly `size` bytes:

| Offset | Size | Field |
|---|---|---|
| 0 | 8 | `token` |
| 8 | 1 | `seq` |
| 9 | rest | Filler, zero bytes, up to the size probed. A receiver refuses a probe with any other byte in the filler. |

`size` is the length of the whole inner IP packet, which has no IP options and no extension headers. The headers are 20 + 8 = 28 bytes on IPv4 and 40 + 8 = 48 bytes on IPv6, so the UDP payload is `size` - 28 or `size` - 48 bytes, and the filler is `size` - 37 or `size` - 57 bytes. A probe whose packet has options or extension headers, or whose length is not the `size` it was sent for, is refused.

A probe is sent like any data packet of the transport, with fragmentation prohibited as always, and on `udp-obfs` with no transport padding.

1. The client sends `probe_start`. The node answers `probe_token` with a fresh random token and `max_size`, the inbound's `mtu`.
2. **Upstream.** The client sends a probe to the gateway. When one arrives with a live token from an address of that device, the node sends `probe_ack` on the channel with the `seq` and the size it received. It sends no UDP reply.
3. **Downstream.** The client sends `probe_down` with a `seq`, a `size` and a UDP port of its own. The node sends one probe of that size to the device's address and that port. The client sees it arrive, or does not.
4. The client first probes the profile's `mtu` in both directions. If both pass, it is done after two packets. Otherwise it walks down the table of sizes. A size fails after a lost probe and one lost retry.
5. The result is the largest size that passed in both directions. If 1280 fails, this datagram transport does not work on this path, and the client moves on under the rules of "Transport fallback".
6. The client sets its tunnel MTU to the result and sends `set_mtu`. The node answers `mtu_result`.
7. The client remembers the result per network and transport, and next time confirms it with one probe in each direction. After every reconnect and every change of network it sends `set_mtu` again.
8. **A path that shrinks later.** Because nothing is fragmented, a path whose MTU drops in the middle of a session would lose every full-size packet from then on. The client therefore confirms the current size again with one probe in each direction on the timer in the table of numbers, and at once when its system reports an ICMP "fragmentation needed" or "packet too big" for the transport's outer packets. Such a report is only a reason to probe. The size in it is never used, because anyone on the path can forge one. A confirmation that fails starts a walk down the table.

Bounds: a `probe_down` with a `size` outside 1280 to `max_size` is malformed and closes the connection. A `set_mtu` outside 1280 to the inbound's `mtu` changes nothing and gets `mtu_result` with the value in force. The client never raises its MTU above the signed profile's, whatever the node says.

A probe run belongs to the gateway it was started at: its token, its probes and its `probe_down` requests all use that gateway's address, also for a device with addresses in two inbounds.

### What the node does with a device's MTU

The value from `set_mtu` is the MTU of the tunnel towards that one device. It lasts as the table of numbers says. From then on the node behaves towards that device as a router or host with a link of that size:

| Packet headed to the device, larger than its MTU | What the node does |
|---|---|
| TCP that the node itself ends (a `netstack` exit) | Does not arise for connections opened after the MTU was lowered: the node honours the segment size the device announces when it opens a connection. A connection that was open before is fragmented by the node as the sending host. |
| UDP that the node itself builds (a `netstack` exit) | Fragments it as the sending host: IPv4 fragments, or IPv6 fragments made at the source. The fragment identification is counted per device and starts at a random value. |
| IPv4 that the node forwards (an `l3` exit), fragmentation allowed | Fragments it. |
| IPv4 that the node forwards with fragmentation prohibited, and any forwarded IPv6 | Drops it and sends the sender the ICMP error "fragmentation needed" or "packet too big" with the device's MTU, within the node's ICMP rate limits. |

The client's own MTU setting covers the other direction: it limits what the device sends and the segment size it asks for in its TCP connections.

## Exit selection

A device may choose which exit the action `"user"` means for it. The meaning of exits, entitlement and that action is that of the [config reference](../../reference/config/). This section adds only the selection.

1. **Scope.** The selection belongs to one device. Another device of the same user is not affected, so one stolen device does not reroute the user's other devices. A device with addresses in two `veilway` inbounds is still one device: it has one selection, one MTU (applied in each inbound as the lower of it and that inbound's `mtu`) and one set of connection pools and rate limits, whichever gateway it talks to.
2. **Where it lives.** It is runtime state, kept in the usage state file, keyed by the device's public key. It is never written into the config document, so a reload does not revert it. The state file keeps its version 1: selections are an added `devices` key that older builds ignore, so going back to an older build loses no usage. A selection is written at the next regular write of the state file, not at once, so a crash within about 10 s of a `set_exit` loses that selection and nothing else. When a node has more selections than fit beside its users in the file, the rest are kept in memory only and the node warns.
   Selection and MTU belong to the device under its user. They do not follow a public key that is moved to another user: the key then starts without either.
3. **Validity.** `set_exit` is accepted only when the tag is in the user's `exits` at that moment. On every reload each stored selection is checked again, and one that is no longer in the user's `exits` is removed and logged at info. A device with no selection uses the user's `exit`, then `routing.default`, as today.
4. **What it changes.** Only flows that the rules send to `"user"`, or that match no rule. A rule that names an exit is not affected, and entitlement still applies to every flow.
5. **Live flows.** On a successful `set_exit` the node ends the flows of that device whose decision came from `"user"`, the way it ends flows on a cut-off (a reset for TCP, an ICMP error for UDP). Their next packets are decided again and leave through the new exit. A TCP connection cannot move to another exit address, so it is broken on purpose and not left to hang. The tunnel itself does not reconnect.
6. **Cost.** The node rechecks only that device's flows, at most 512, and does it without holding the flow table's lock for the whole check. It must not run the full recheck that a reload runs (threat model G31).
7. **Catalogue.** It holds only the exits in the user's `exits`. It says nothing of backends, outbounds or upstream addresses. "Working" and "load" are coarse on purpose.

## Usage, notices and hints

- **Usage.** The numbers are the node's own counters and the meaning of each is in "Usage and quota" of the [config reference](../../reference/config/).
- **Push.** The client does not poll. The node sends a new `usage` when the numbers changed since the last one, and not sooner than the time in the table of numbers. Nothing is pushed while nothing changes. The one thing the channel does on a schedule is the MTU re-confirmation on a datagram transport, see "What shows through the transport". A new `session`, `exits` or `notices` is sent when a reload changed it for this device.
- **Applying.** The client applies pushed snapshot messages no faster than the limit in the table of numbers, so that a node cannot make the interface flicker or keep the client busy. The limit covers `session`, `exits`, `usage`, `notices` and `hints` only. Answers to the client's own requests (`exit_result`, `probe_token`, `probe_ack`, `mtu_result`, `error`) and `bye` are handled as they arrive.
- **Notices.** They come from the operator's config (the proposed `notices` key). The node writes none of its own. A notice is plain text.
- **Hints.** A hint tells a client which of the candidates in its signed profile this node also answers on. It is two indices into the profile's own lists and can name nothing that is not already there. In version 1 the node may always send an empty list.

## What a malicious node can do

A compromised node is a malicious provider. This table is the whole list of values a client takes from the channel. Nothing else is applied.

| Field | Bound the client enforces | What the client does with it |
|---|---|---|
| `mtu` in `session` and `mtu_result` | 1280 to the `mtu` of the signed profile | Lowers the tunnel MTU to it. A value outside the bound is ignored. |
| Addresses and gateways | None needed | Compares them with the profile and reports a difference. Applies nothing. |
| `node_time` | None needed | Shows a warning. Sets no clock. |
| Exit catalogue | At most 256 entries, and the checks under "Messages". A name is first filtered (control, bidirectional formatting, zero-width and other invisible characters are removed) and then cut to 64 characters. A name that is too long for the screen is cut, never a reason to close the connection. Tags need no filter. | Shows it. A later catalogue replaces the earlier one. A catalogue that fails a check is dropped whole and closes the connection. |
| Selected exit | Must be a tag in the catalogue | Shows it. |
| Usage | Integers, clamped to 9007199254740991 | Shows it. |
| Notices | At most 4. Each is filtered as names are and then cut to 280 bytes, at a character boundary. A longer notice is cut, never a reason to close the connection. | Shows them as plain text in the area for provider content, apart from the app's own interface. Nothing in a notice is a link and nothing in it can be opened. |
| Hints | At most 16, each index inside the profile's lists | May try a hinted candidate before others of the same transport. An index outside the lists is ignored. |
| Probe results | Sizes from the table only | Lowers the MTU. A node that lies makes the tunnel slower or sends the client to another transport of the profile. It cannot raise the MTU. |
| `bye` | Four known reasons | Shows the reason and waits before trying again. |
| A difference that asks for a subscription refresh | At most 1 refresh in 6 hours, through the tunnel | Refreshes. A node cannot use this as a beacon or to load the subscription server. |

A client never takes from the channel: an address, a route, a resolver, an address or name to dial, a transport, a certificate pin, a rating, a kill switch or resolver setting, a URL, or anything that is executed or shown as markup (threat model invariant 23).

What remains: a node can lie about usage, show false notices, hide exits, report "working" wrongly, push the MTU down to 1280 and make its own client wait. It can make a client prefer one of the profile's own candidates over another. All of this is annoyance or misinformation from a party the user already sends all traffic through. None of it moves traffic outside the tunnel.

## What a malicious client can do

A device that holds a valid key is authenticated and still hostile.

| Attempt | Limit |
|---|---|
| Act as another user or device | Identity is the tunnel peer. No field names anyone. The credential is bound to the device's own key. |
| Select an exit it is not entitled to | Refused, with the same answer as for a tag that does not exist. |
| Learn what exits or users exist | The catalogue holds only that user's exits. |
| Flood the channel | Rate limits per device, two small pools of connections per device, a fixed time to authenticate. Over the limit the node answers a 5 byte error or closes. |
| Guess the credential | The key is 32 random bytes. No lockout is needed, and none exists that other software on the device could turn against the user. |
| Make the node work hard with `set_exit` | Its own rate limit, and the recheck touches only that device's flows. |
| Use probes to send traffic at someone | A downstream probe goes only to the requesting device's own tunnel address, at most 16 per run and one run a minute. An upstream probe gets a 6 byte answer on the channel. |
| Hold memory | A token, a selection, an MTU value and six connections per device. Message sizes are capped before anything is allocated. |
| Reach the channel from a web page or another program on the device | The preface and the credential, see "Who can use it". |

## What shows through the transport

The opening exchange is the same for every client: a TCP handshake inside the tunnel, 44 bytes up, 36 down, 35 up, 35 down, then a burst down. Right after the WireGuard handshake that is a sequence of sizes no browser produces.

- On an obfuscated transport every chunk that holds a control channel packet gets wide padding, by rule and not by position in the session, and the start is delayed by up to 2 s. That blurs the sizes and does not remove the exchange.
- An MTU probe run is a handful of large packets of sizes from a fixed table, soon after connecting. A remembered result reduces this to two packets.
- On plain `udp` nothing hides any of it. Plain `udp` is rated Detectable for larger reasons.
- There is one periodic exchange, and only one: on `udp` and `udp-obfs` the client re-confirms the MTU with one probe in each direction after every 300 to 900 s, for as long as the session lasts, also on an idle tunnel. That is a pair of the largest packets the tunnel carries, at a varying interval, and it can be seen. On stream transports there is no periodic message at all. Usage pushes happen only while user traffic flows.

## Security considerations

- **Two factors, for two different threats.** The tunnel identity stops other users. The credential stops other software on the user's own device. Neither replaces the other.
- **The credential is unreviewed.** It is a standard challenge and response over the whole opening exchange, with labels that keep its key apart from every other use of the transport secret. Nobody outside the project has checked it.
- **Mutual, so that a misrouted connection cannot feed the client.** If the gateway address ever led somewhere other than the node, that party could not produce `node_mac`, and the client applies nothing before it has checked it.
- **The channel configures nothing on the client's network.** It can lower the MTU inside a bound. Every other value is shown or compared, and the list is closed.
- **Fixed layouts, not a general encoding.** Both parsers handle hostile input: the node's from a hostile client, the client's from a hostile node. Each gets a fuzz target in the same change as the parser (`fuzz_control_server`, `fuzz_control_client`), with the assertion that no message changes the rating, the kill switch, the resolver setting, the addresses or the routes.
- **Stated gaps of the first node implementation.** On Linux the node now prohibits fragmentation of its own outer UDP packets on `veilway` inbounds, so a probe is confirmed only over a path that carries it whole. On other systems it does not yet and warns at start, and there a probe can be confirmed over a path that fragments it. The `l3` path that answers a packet above a device's MTU with an ICMP error has not been verified against a live kernel.
- **Keys in memory.** In the first implementation, key material (`k_ctl` and the keys it comes from) is held in the cryptographic library's own types and is not wiped from memory when a session ends. This is a stated limit of that implementation. A compromised device or node is outside what Veilway defends, and this limit makes such a compromise worth slightly more.
- **A lost channel is not a lost tunnel, and never a leak.** If the channel fails, the tunnel keeps working with the profile's values, and the client says the channel is unavailable.

Tests this page needs before it leaves Draft:

- A browser page loaded inside the tunnel tries simple, preflighted, WebSocket and DNS rebinding requests against the gateway address and port, and can neither change the exit nor read any byte.
- Device A's secret presented from device B's tunnel fails `auth`, also when both belong to one user.
- A changed `max_version` or `version` in the opening exchange makes both MACs fail.
- A program that opens and fails connections in a loop does not keep the real client from authenticating.
- A device cannot select an exit outside its user's `exits`, and loses a selection when a reload removes the entitlement.
- A client that switches exit in a loop, or runs probes in a loop, does not change another user's packet loss beyond the bound of the fairness test.
- A node that answers a version below `min_control_version`, or a wrong `node_mac`, is refused by the client and nothing it sent is applied.
- A hostile `session` (other addresses, another family, a gateway on the local network, an MTU above the profile's) changes nothing on the client, and causes at most one subscription refresh in 6 hours.
- A packet larger than a device's MTU, headed to it through each exit backend, is fragmented or answered with the ICMP error, never sent whole and never dropped in silence.

## Open questions

Each is listed with the default this draft takes.

| Question | Default |
|---|---|
| Should a later version let a node add an address family the profile lacks? (threat model Q6) | Not in version 1. It would hand a node an authority that belongs to the subscription's signing key. |
| Fragmenting towards a device with a small MTU needs work in both exit backends, and the engine drops fragments from clients today | As in the table. It must be built with the channel, or the feature leaves the black hole it exists to remove. |
| Is re-confirming the MTU on a timer worth two large packets every few minutes on a datagram transport? | Yes. Without it a shrinking path breaks the tunnel until the next reconnect. |
| Is probing right after connecting worth its pattern? | Yes when no result is remembered for the network, because a wrong MTU breaks the tunnel in ways users cannot diagnose. |
| The credential is per connection, not a MAC on every message | Per connection, for the reason given under "The credential". |
| Should the catalogue carry load and whether an exit works, as the plan lists? | Yes, coarsely: one bit and four levels. What "working" means for each backend is not defined yet. |
| May a hint name an address that is not in the signed profile? (threat model Q6) | No. |
| Is `bye` worth what it tells a device about its account? | Yes. The device learns only what its own user could ask the provider. |
| Where notices come from | A proposed top-level `notices` key in the config. Not in the config reference yet. |
| The usage state file gains a selection per device | An added `devices` key under the file's version 1, which older builds ignore. Not in the config reference yet. |
| The port number | 47873, the same for every installation. Inside the tunnel it is not visible to the path. |
