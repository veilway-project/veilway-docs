---
title: Config reference
description: Every option of the Veilway server config, version 1.
---

The core reads a JSON file as source of truth. The panel changes it via the control API, never by editing the file.

```json
{
  "version": 1,
  "log": {"level": "info"},
  "dns": {"servers": ["1.1.1.1:53"]},
  "groups": [],
  "inbounds": [],
  "outbounds": [],
  "exits": [],
  "routing": {"default": "main", "rules": []},
  "users": []
}
```

Required: `version`, `dns`, `inbounds`, `outbounds`, `exits`, `routing` and `users`. Optional: `log`, `groups`, `notices`, `public_addresses`, `replay`, `links` and `xray`.

This page covers the node's config. Endpoints, gateway keys, mirrors, relays and backups belong to the panel and are not keys of this document. See the [panel manual](../../manuals/panel/).

## Rules that apply everywhere

- **Strict JSON.** Unknown and duplicate keys are errors at every level, as are a byte order mark, data after the document, invalid UTF-8 and a NUL inside a string. An integer must be an integer token (`1`, never `1.0`).
- **Growth.** Version 1 only grows by new optional keys and new enum values. A build that meets an unknown key or value refuses the file and says the config may be newer.
- **Tags.** Inbounds, outbounds, exits, routing rules, DNS sets, links, tunnels and Xray inbounds each have a `tag` matching `[a-z0-9][a-z0-9_-]{0,63}`, unique within its section. These words cannot be tags: `all`, `any`, `block`, `reject`, `drop`, `local`, `direct`, `user`.
- **References.** Every tag, user name and group name used anywhere must exist.
- **Lists.** A list never holds the same entry twice. A condition in a routing rule must not be an empty list.
- **Canonical spelling.** Numbers inside strings (a port, a prefix length, a `lo-hi` range) have no sign and no leading zeros. A timestamp uses `T` between date and time.
- **Addresses.** IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) and addresses with a zone (`%eth0`) are errors everywhere. So is a network with host bits set (`10.7.0.5/24`), except in an inbound's `address`, where the host part is the gateway. Port 0 is an error everywhere.
- **Secrets.** These are secrets: `private_key`, `preshared_key`, `transport_keys`, `transport_secrets`, `transport_secret`, `username`, `password`, `server_key` and the `secret` of an Xray client. No error, warning, log line or API response shows a value, only its path (`outbounds[1].password`) and what was expected. On Unix, `veilway run` refuses a config file that group or others can read, unless you start it with `--allow-readable-config`. `veilway check` warns.
- **Keys.** A WireGuard key is standard base64 with padding, exactly 44 characters, decoding to 32 bytes. Keys are compared as decoded bytes. An all-zero key is an error.
- **Paths.** A file path is relative to the config file's directory. Absolute paths and any `..` component are errors.
- **Limits.** File: at most 64 MiB and 8,000,000 JSON values. At most 64 inbounds with 8 transports each, 256 outbounds, 256 exits, 256 groups, 32 DNS sets, 4096 routing rules, 1024 entries in any list inside a rule, 65,536 users, 64 devices per user, 4 notices, 8 public addresses, 64 links, 64 tunnels and 16 Xray inbounds.
- **Errors and warnings.** Validation reports the path of each bad field, with at most 100 errors and 100 warnings, then a count of the rest. An error refuses the config. A warning lets it load and is logged. Warnings are advice, not part of the format.

## `version`

Must be the integer `1`.

## `log`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `level` | `error`, `warn`, `info`, `debug`, `trace` | `info` | Lowest level written. `RUST_LOG` overrides it when set. |
| `destinations` | bool | `false` | Whether log lines at any level may hold the destinations and DNS names users reach. |

## `groups`

A list of group names, each matching `[a-z0-9][a-z0-9._-]{0,63}`. Declare a group here before a user or a rule names it.

## `dns`

The node answers DNS for its tunnels at each inbound's gateway address.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `servers` | list of `ip:port`, 1 to 4 | required | Upstream resolvers, tried in order with 5 seconds each. |
| `hijack` | bool | `true` | Answer every UDP and TCP port 53 flow from a tunnel here, whatever address it was sent to. With `false`, only queries sent to a gateway address are answered. Other port 53 traffic is routed like any flow. |
| `sets` | list of at most 32 sets | `[]` | Other lists of servers, each for the inbounds, groups and users it names. See DNS sets below. |

A server address may not be loopback, link-local, unspecified, broadcast, multicast, in `0.0.0.0/8`, or inside any inbound pool. An IPv6 address that embeds such an IPv4 address (IPv4-compatible, NAT64, 6to4, Teredo) is refused too. The destination gate refuses them at run time, so such a server would resolve nothing.

Engine:

- A forwarded query is a flow from that user to the chosen server on port 53. The rules route it like any flow, matching `domain` conditions against the queried name. It must pass the destination gate of its exit. A `block`, `reject` or not-entitled result answers `REFUSED`.
- Per user, the node remembers which names it resolved to which addresses (one name, one address per entry): at most 4096 entries, each kept for the answer's TTL clamped to 60 to 3600 seconds. It records only answers its own resolver obtained, never answers that hold pool, gateway, loopback or link-local addresses. Nothing is cached across users.
- Each upstream query goes out under an id the node picks, and only an answer with that id is accepted. The first server whose rules refuse the query ends it with `REFUSED`. Only a silent server moves on to the next.
- A query name that is not a valid rule domain (for example one with an underscore label) is still forwarded, but no `domain` condition matches it and it is not remembered.
- At most 64 queries of one user wait at once. More get `SERVFAIL`. Over TCP a query may be 1500 bytes and a connection carries at most 128 queries.
- With `hijack` on, rules with `port: [53]` never see tunnel DNS, and port 53 traffic that is not DNS is dropped. DNS over TLS and DNS over HTTPS pass untouched, and `domain` rules cannot see those names.

### DNS sets

A set is a named list of upstream servers for some users, for example a filtering resolver for a `family` group, an ad blocker for a few users, or another resolver for one inbound.

```json
"dns": {
  "servers": ["1.1.1.1:53"],
  "sets": [
    {"tag": "family", "servers": ["1.1.1.3:53", "1.0.0.3:53"], "groups": ["family"]},
    {"tag": "adblock", "servers": ["192.0.2.53:53"], "users": ["alice", "bob"]},
    {"tag": "lab", "servers": ["192.0.2.54:53"], "inbounds": ["office"]}
  ]
}
```

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | Unique among the sets. |
| `servers` | list of `ip:port`, 1 to 4 | required | Tried in order with 5 seconds each. The address rules of `dns.servers` apply. One server may stand in several lists. |
| `inbounds` | list of inbound tags | `[]` | Queries that come through these inbounds use the set. |
| `groups` | list of group names | `[]` | Users in these groups use the set. |
| `users` | list of user names | `[]` | These users use the set. |

A query goes to the first match, most specific first:

1. the set that names the user;
2. otherwise the set that names one of the user's groups;
3. otherwise the set that names the inbound the query came through;
4. otherwise `dns.servers`.

Steps 1 and 2 belong to the user, step 3 to the query. A user with devices on two inbounds, whom no set names by user or group, uses the list of whichever inbound a query comes through.

Validation does not depend on the order of the sets:

- Error: two sets name the same inbound, group or user, or one list names it twice. The error gives the path of the first entry.
- Error: a user whom no set names is in groups that two different sets name. The error is at that user's `groups` and gives both paths. Name the user in the `users` of one set, or keep the groups in one set.
- Error: a name no inbound, group or user has.
- Error: `hijack` is `false` and `sets` is not empty. With `hijack` off, a device can reach any resolver by querying an address other than the gateway, so a set would decide nothing.
- Warning: a set no query goes to. It names nobody, or the groups it names have no user and every user of the inbounds it names goes by a set that names them or one of their groups.

A set covers the DNS the node answers: with `hijack` on, every UDP and TCP port 53 flow of a tunnel. A device that uses DNS over TLS or DNS over HTTPS steps around its set, as around `domain` rules. Where a filtering set has to hold, refuse those too, for example with a rule that rejects TCP and UDP port 853 and rules for the addresses of the public DoH resolvers.

Engine:

- A set's servers follow everything said about `dns.servers`: the flow, rules, destination gate, entitlement, name memory, limits, ids and TCP fallback.
- A set never falls back. When none of its servers answers, the query gets `SERVFAIL`. When the rules refuse a server, it gets `REFUSED`. The node never asks `dns.servers` or another set instead: a filtering resolver that could be skipped whenever it is down would filter nothing.
- `hijack` is one setting for the whole node. A config with sets needs it on.
- The name memory belongs to the user, whichever list answered. See Reloading for what happens to it when a user's servers change.
- A log line about a query that names a user also names the set used. The info lines about a server that stopped answering, or answers again, name the list and the server's place in it (`server 2 of 2 of dns set family`). A server in two lists is counted in each by itself. No line shows a queried name or a server address unless `log.destinations` is on.

## `inbounds`

An inbound is one tunnel: one key, one address pool, reached over one or more transports. A device keeps the same tunnel address on every transport.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | |
| `type` | `wireguard` or `veilway` | required | `wireguard`: stock WireGuard peers. `veilway`: the same tunnel, with the control channel at its gateway address, see "The control channel" below. Changing the type restarts nothing. |
| `enabled` | bool | `true` | `false` switches the inbound off, see "Switching an inbound or a transport off" below. |
| `private_key` | key | required | The tunnel's static key. Secret. Unique across inbounds, compared by the public key derived from it. |
| `address` | list of 1 or 2 networks | required | The gateway address with its prefix, at most one IPv4 and one IPv6, for example `["10.7.0.1/24", "fd7a:115c:a1e0::1/64"]`. The network is the tunnel's address pool. |
| `mtu` | integer 1280 to 1500 | `1420`, or `1390` for a `veilway` inbound with a `udp-obfs` transport | MTU inside the tunnel. Above 1420 is a warning: the outer packet fragments on a normal path, or is lost on a `veilway` inbound, which never fragments. With a `udp-obfs` transport the warning starts above 1390, because a full-size packet then does not fit a 1500 byte path over IPv6. |
| `padding` | object | see below | Upper bounds of the padding the node adds to what it sends over `udp-obfs`, `tls`, `ws` and `fronted`. Both are optional: `wide` from 512 to 1023 (default 1023) and `normal` from 64 to 255 (default 255). On an inbound with none of these transports the key is a warning. See `udp-obfs` below. |
| `transport_keys` | list of 1 or 2 keys | none | Secret. The node's transport keys, private halves. Required for an inbound with a `tls`, `ws` or `fronted` transport (a `ws-plain` transport has its own `transport_keys`, see below). Devices seal their proof to one of them. `veilway genkey --transport` prints one with its public half, which is what a profile carries. Two keys allow rotation: removing one ends the sessions opened under it. No WireGuard key of the config is one, no transport secret is one, and no two inbounds share one. On an inbound without such a transport the key is a warning. See `tls` below. |
| `upgrade_cookie` | 1 to 32 characters from `A-Z a-z 0-9 _ -` | none | The name of the cookie on the upgrade answer of a `tls` or `ws` transport, and of the cookie that carries the token of a `ws-plain` transport, where the answer sets no cookie. Required with one of them. It has no default, so that not every node sends the same name. Choose a name your own site could use. An inbound with `fronted` alone needs none. |
| `upgrade_headers` | list of at most 16 header field names | `["Server", "Date"]` for `tls`, none for `ws` | The header fields the upgrade answer of a `tls` or `ws` transport copies from the decoy origin, in this order. Behind a web server the list is empty unless you set it, because that web server adds its own fields. See `tls` below. |
| `transports` | list of 1 to 8 | required | See below. |

Rules for `address`:

- IPv4 prefix from /16 to /30, inside `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` or `100.64.0.0/10`. IPv6 prefix from /48 to /126, inside `fc00::/7`.
- The gateway is a host address in the pool, never the network address and, for IPv4, never the broadcast address.
- Pools of different inbounds do not overlap.

An entry of `inbounds` with the type `socks5`, `http` or `mixed` is a proxy inbound, not a tunnel. See [Proxy inbounds](#proxy-inbounds-socks5-http-mixed) below. Everything above is about tunnel inbounds.

Addresses alone decide who may use an inbound: a device belongs to the inbound whose pool holds its address. It may have one IPv4 and one IPv6 address in each inbound, so one device can use several inbounds, `wireguard` and `veilway` alike. From v0.2.18 the panel also gives a device an address in the range of every plain `wireguard` inbound, at the same offset as in its own pool (see the panel manual), so a device whose keys the panel made can get a WireGuard file. Once the config has any device, `veilway check` warns about a `veilway` inbound with transports that no device has an address in and no link uses: every connection to it would be treated as a stranger's.

### Switching an inbound or a transport off

`"enabled": false` on an inbound, a transport or a proxy inbound switches it off without deleting it, as on a link, a tunnel or an upstream. Leaving the key out means `true`.

- It is validated like any other, and its addresses stay reserved: no other listener may take its address and no other pool may overlap its pool.
- It does not listen. The node binds nothing for it, and `veilway doctor` does not try its address.
- Sessions on it end at the reload that switches it off. The devices of an inbound that is off are let go: sessions end, flows are reset, and they cannot connect through it until it is switched on again. A transport that is off leaves the inbound's other transports as they are.
- `veilway check` skips an inbound that is off when it looks for a `veilway` inbound that no device has an address in.
- The control API's `GET /v1/inbounds` says `enabled` for each inbound and for each of its transports.

Devices learn of a switch only from the next published profile. At the next publish, the panel leaves an inbound that is off out of the profiles, and a transport that is off out of its inbound's profile.

### The control channel

Engine. On a `veilway` inbound the gateway address also answers the control channel of the [protocol](../../protocol/control-channel/): TCP port 47873, and UDP port 47873 for MTU probes. The client engine speaks it inside the tunnel.

- **Who reaches it.** A device, from its own tunnel address, at the gateway of the inbound it is connected through. The gateway of any other inbound refuses the port, and so does every `wireguard` inbound. The node handles it before the routing rules, like gateway DNS: no rule blocks, redirects or opens it, `dns.hijack` does not touch it, and its bytes count as usage.
- **Who is let in.** A connection must prove one of the device's `transport_secrets` within 10 seconds, in an exchange bound to that device's and that inbound's keys. Anything else is closed with no answer. A device may have 4 connections that have not proven it and 2 that have. One more replaces the oldest.
- **What it gives.** The device's addresses, gateway and MTU as the node holds them. The exits of its user's `exits` (tag, `name`, `country`, whether it carries every IP protocol, whether it is up). Its user's usage and quota. The `notices`. A reload sends again what it changed. Usage is sent again when it changed, at most once every 30 to 90 seconds, never because of the channel's own traffic.
- **Choosing an exit.** A device may choose which of its user's `exits` the action `"user"` means for it. The choice belongs to that device only. It moves the flows that the rules send to `"user"` or that match no rule: they are reset and leave through the new exit from their next packet. A flow a rule sends to a named exit is not touched. A device without a choice leaves through `users[].exit`, then `routing.default`, and while that exit is not working, through the first exit of `routing.fallback` that works. A choice goes into the state file at its next regular write, not at once, so a node killed within those 10 seconds forgets it and the device chooses again.
- **MTU.** A device may probe which packet size its path carries and set its own tunnel's MTU, from 1280 (1080 for a device with IPv4 addresses only) to the inbound's `mtu`. The node then sends that device nothing larger. TCP the node ends itself keeps to the segment size the device announces. What else the node sends itself, it fragments, as it does IPv4 that it forwards and that allows it. The sender of anything else gets "fragmentation needed" or "packet too big". The value is forgotten after 180 seconds without a session. A device with addresses in two `veilway` inbounds has one MTU, one chosen exit and one set of limits for both. A probe applies on `udp` and `udp-obfs`, and over `udp-obfs` it leaves with no padding. On Linux the node prohibits fragmentation of everything it sends from the `udp` and `udp-obfs` sockets of a `veilway` inbound, so a packet that does not fit the path is lost and a probe measures what the path carries. On another system it cannot, and warns at start: there a probe can pass a path that fragments it.
- **Being cut off.** Before a device is cut off (quota, expiry, disabled or removed, or the node stops), the node writes it the reason. The cut-off does not wait for that.
- **Limits.** Per device: 10 requests at once and then one a second, 3 exit changes and then one in 5 seconds, one probe run a minute. Over a limit, a request is answered "rate limited" and does nothing.
- **What is logged and counted.** A channel that opens or closes, an exit that is chosen or dropped and an MTU that is set are logged at info with the user and device name: at most 6 such lines at once for one device, then one in 30 seconds. The rest go to debug and the next line says how many. None names a destination. Counters are in `control` of `/v1/stats`. `/v1/sessions` shows each device's chosen exit, open control connections and MTU.

### `transports`

| `type` | Keys | Meaning |
|---|---|---|
| `udp` | `listen` (`ip:port`) | Plain WireGuard datagrams. |
| `ws` | `listen` (`ip:port`), `path`, optional `tls` with `cert` and `key` (both required) | One WireGuard datagram per binary WebSocket frame. Without `tls` it serves plain `ws` for a reverse proxy that ends TLS. Validation warns when such a listener is not on a loopback address. |
| `udp-obfs` | `listen` (`ip:port`), optional `limits` with `sessions` (1 to 1,048,576, default 16,384) | Every WireGuard datagram inside the `udp-obfs` envelope of the [protocol](../../protocol/transports/), keyed by the device's `transport_secrets`. Only on a `veilway` inbound. See `udp-obfs` below. |
| `tls` | `listen` (`ip:port`), `path`, `tls` with `cert` and `key`, `decoy` with `origin` and optional `proxy_protocol`, optional `limits` with `sessions`, `undecided`, `undecided_per_source` and `relayed` | The WebSocket session of the [protocol](../../protocol/transports/) inside TLS that the node ends itself. Anyone who is not a user goes to the decoy origin. Only on a `veilway` inbound. See `tls` below. |
| `ws` with a `decoy` | `listen` (`ip:port`), `path`, `decoy`, `trusted_proxies`, optional `client_address_header`, optional `limits`. No `tls` key. | The same WebSocket session behind your own web server, which ends TLS. Only on a `veilway` inbound. See "`ws` and `fronted` behind your web server" below. |
| `ws-plain` | the keys of `ws` with a `decoy`, and `transport_keys` | The same WebSocket session over plain HTTP, with no TLS between the app and your web server. Only on a `veilway` inbound. The weakest transport. See "`ws-plain`" below. |
| `fronted` | the keys of `ws` with a `decoy` | Polling with HTTP requests, for a CDN that allows neither WebSocket nor long-lived connections. Only on a `veilway` inbound. See the same section. |
| `fronted-shaped` | the keys of `fronted`, and `shape` | `fronted` with a method, a place for the data and a downstream form that you pick. See "`fronted-shaped`" below. |
| `faketls` | `listen` (`ip:port`), `site`, `transport_key` and the limits of its section | Alpha in v0.2.0. Borrows a real site. Only on a `veilway` inbound. A profile carries it as "The `faketls` transport" of the subscription format. A client dials it only after the user turns on `alpha_transports`. See "`faketls`" below. |

`ws` is two transports under one name, and its keys say which. Without `decoy`, `trusted_proxies`, `client_address_header` and `limits` it is the `ws` of a `wireguard` inbound, which carries WireGuard datagrams as they are. With any of them it is the native `ws` of a `veilway` inbound, which needs `decoy` and `trusted_proxies` and takes no `tls`. Validation refuses each on the other kind of inbound.

A `veilway` inbound takes `udp`, `udp-obfs`, `tls`, the native `ws`, `ws-plain`, `fronted` and, as alpha, `faketls`. A `wireguard` inbound takes `udp` and the `ws` without a decoy, because its devices have no transport secret for the others.

`path` starts with `/`, is at most 256 bytes from `A-Z a-z 0-9 . _ ~ / -`, and has no `..` component. It is matched exactly against the request path before any `?`, except for a `fronted-shaped` transport whose data rides in the path, which is matched as a prefix (see "`fronted-shaped`" below). On `tls`, the native `ws`, `ws-plain`, `fronted` and `fronted-shaped`, `path` is at least 12 bytes.

Every transport takes `enabled` (bool, default `true`) next to `listen`. A transport that is not enabled is validated like any other, does not listen, and keeps its address reserved. See "Switching an inbound or a transport off" above.

Engine: a `ws` connection that does not finish the WebSocket upgrade within 10 seconds is dropped. One source (an IPv4 address or an IPv6 /64) may have 64 unfinished upgrades at once, a reverse proxy in front of a plain `ws` listener included.

Listen conflicts, across all inbounds:

- IPv6 sockets are always IPv6-only, so `0.0.0.0:443` and `[::]:443` do not conflict. A wildcard address conflicts with every address of its own family on the same port.
- Two `udp` or `udp-obfs` transports never share an address and port, in any combination.
- Two `ws` transports may share an address and port when their `path` differs and their `tls` is identical.
- Two `tls` transports may share an address and port when their `path` differs and their `tls`, `decoy` and `limits` are identical: two paths of one listener.
- The `ws` and `fronted` transports of `veilway` inbounds may share an address and port when their `path` differs and their `decoy`, `trusted_proxies`, `client_address_header` and `limits` are identical. That is one listener, to which the web server hands a `GET` for one path and a `POST` for another.
- A `fronted-shaped` transport shares a listener on the same terms as `fronted`. Its `path` may not be a prefix of another transport's `path` on the same listener, because a shape that puts the data in the path is matched by prefix. Validation refuses it.
- A `faketls` transport never shares an address and port with another transport, and its key never equals the key of another transport of the node.
- A `ws-plain` transport never shares an address and port with a transport that is not `ws-plain`. Its decoy must answer like your plain site, so that a prober cannot tell its path from your other plain paths. Two `ws-plain` transports may share a listener on the same terms as `ws`.
- A listener serves one kind of peer. A `tls` transport, a `ws` transport of a `wireguard` inbound, and the `ws` and `fronted` transports of `veilway` inbounds never share an address and port with one another.

Any other pair that shares an address and port conflicts.

### `udp-obfs`

Engine. Built on both sides. The [transports page](../../protocol/transports/) is the specification, an unreviewed draft. `udp-obfs` hides WireGuard's fixed bytes and sizes from an observer without a subscription. It imitates nothing, and its rating is Detectable.

```json
{"type": "udp-obfs", "listen": "0.0.0.0:51821", "limits": {"sessions": 16384}}
```

- **Who is let in.** A device opens a session with one opening packet that only a holder of one of its `transport_secrets` can make. The session then carries that device's WireGuard and no other. The node sends nothing on a session until a WireGuard packet of that device has authenticated on it.
- **What a stranger gets.** Nothing: no answer and no log line. It is counted by reason in `udp_obfs` of `/v1/stats`.
- **Replay.** An opening packet is accepted once, also across restarts. That needs the replay file, see `replay` below. A node does not start a config with a `udp-obfs` transport without a replay file it can write and lock. An opening packet from a device whose clock is ahead of the node's limit is kept, at most 64 of them for at most 2 seconds, until the limit is written, and is then answered at its own source. One that a limit refuses is recorded as used all the same, so that nobody who saw it can use it later.
- **Being cut off.** Whenever the node cuts a device off (its user is disabled, expired, over quota or removed, the device is removed, or its addresses, preshared key or key change), every `udp-obfs` session of that device ends with its tunnel. So does a session whose transport secret was removed.
- **Packets that cannot be sent.** A `veilway` inbound never fragments. The system refuses a packet larger than the host's interface carries. It is counted in `send_failed` of `/v1/stats` and logged at info once a minute. Lower the inbound's `mtu` when that counter grows.
- **Limits that are fixed.** A device may have 2 sessions that are not yet established and 8 that are, and 16 accepted opening packets at once and then one a second. One source address and port may have sessions of 4 devices. A session ends 10 seconds after its opening packet if WireGuard has not authenticated on it, and after 180 seconds without an authentic WireGuard packet. The idle time of the client's keepalive is well below that.
- **`limits.sessions`.** How many established sessions the listener holds at once. When it is full, new opening packets are refused. Nothing a stranger does takes a place.
- **`padding`.** The node pads what it sends, inside the encryption. `wide` bounds the padding of the first 16 packets of a session, of every WireGuard handshake message and of every control channel packet. `normal` bounds the rest. A full-size packet carries none: no packet is larger than `mtu` + 62 bytes. Change them so that not every node shows the same ranges.
- **`mtu`.** `udp-obfs` adds 62 bytes around a tunnel packet, 30 more than `udp`, so the default `mtu` of a `veilway` inbound with a `udp-obfs` transport is 1390. Adding the transport to an inbound with no `mtu` written changes its `mtu` from 1420 to 1390, which restarts the tunnel once.
- **The clock.** A device and the node must agree on the time within 60 seconds. A node whose clock is wrong refuses its devices. A clock that ran ahead can leave the node refusing everybody after it is put right, see `replay`. Run the node with a synchronized clock.
- **What is logged.** At info: a listener that starts, sessions that a reload ended, a session that reached the packet limit of its keys. At warn or error: a tag table that was built late, and everything about the replay file. No line names a client address, a tag or a secret.

### `tls`

Engine. Built on both sides. The [transports page](../../protocol/transports/) is the specification, an unreviewed draft.

A device reaches its tunnel through a WebSocket connection inside TLS, on a name and certificate of your own. Everyone else who connects goes to your own web server, the decoy origin, and gets its answer.

**`tls` is rated Detectable, and stays so in version 1.** The TLS handshake a visitor sees is the node's, not your web server's. A prober needs no subscription to see that the handshake and the site behind it do not match. The decoy makes the HTTP answer your site's, not the handshake. For a handshake that matches the site, use the native `ws` behind the web server that serves the site, see "`ws` and `fronted` behind your web server" below.

```json
{
  "tag": "home", "type": "veilway", "private_key": "...", "address": ["10.7.0.1/24"],
  "transport_keys": ["..."],
  "upgrade_cookie": "visit",
  "transports": [{
    "type": "tls", "listen": "0.0.0.0:443", "path": "/assets/app-3f9c2e71.js",
    "tls": {"cert": "site.crt", "key": "site.key"},
    "decoy": {"origin": "http://127.0.0.1:8080"}
  }]
}
```

| Key | Type | Default | Meaning |
|---|---|---|---|
| `listen` | `ip:port` | required | Where the node ends TLS. |
| `path` | 12 to 256 bytes from `A-Z a-z 0-9 . _ ~ / -`, starting with `/`, no `..` component | required | The path a device's request names. Anyone with a subscription knows it. Choose one your site does not have. |
| `tls` | `cert` and `key`, both file paths | required | The certificate chain and its key, as PEM files. Version 1 has no built-in issuance from an authority: get and renew the certificate with your own tooling. On a native `tls` transport, `self_signed: true` may replace `cert` and `key`. The node then makes its own self-signed key and certificate (files `tls-<inbound tag>.key` and `.crt`, next to the config file, mode 600) and renews the certificate with the same key. It reports the pin (the SHA-256 of the SubjectPublicKeyInfo) in `veilway doctor` and in the control API's status. A renewal keeps the key, so the pin survives it. The panel puts this pin into the `tls` candidates of the profiles it makes, see the panel manual. `name` (optional, with `self_signed` only) is the host name in the certificate: a lowercase DNS name of at most 64 characters. Without it the node draws one. A running node never makes a new key. If the key file is gone or changed, it keeps the current certificate and logs a warning, since the pin would change. A node link may trust it through its pin alone, see `links` below. The node also works out the pin of a certificate read from `cert` and `key`, and `veilway doctor` and the control API show it. It remembers the pin of each `tls` transport in `tls-pins.state` next to the config file, and warns once when the key of a transport changes (from v0.3.6), see [Pins and self-signed links](../../protocol/node-links/#pins-and-self-signed-links). See the transports page of the protocol specification. |
| `decoy.origin` | `http://` URL with an address or a name and an optional port, nothing behind it | required | Your own web server. There is no default and no other kind of decoy. |
| `decoy.proxy_protocol` | bool | `false` | Send the PROXY protocol header, version 2, at the start of every connection to the origin. |
| `limits.sessions` | integer 1 to 1,048,576 | `16384` | Established sessions the listener holds at once. |
| `limits.undecided` | integer 1 to 65,536 | `512` | Connections that have not sent their request line yet. |
| `limits.undecided_per_source` | integer 1 to `undecided` | `64` | How many of those one source may have. A source is an IPv4 address or an IPv6 /64. |
| `limits.relayed` | integer 1 to 65,536 | `1024` | Connections relayed to the origin. |
| `http2` | `off` or `on` | `off` | Whether the node offers `h2` as well as `http/1.1`. With `on`, the node decides every stream itself and relays a stranger's streams to the origin as HTTP/1.1, so the node's own HTTP/2 server answers a prober instead of the origin's. Keep it `off` unless you need `h2`. See [HTTP/2](../../protocol/http2/). Every `tls` transport on the same listener must have the same `http2`. |

**What the decoy origin must be.**

- **Your own web server**, on the same host or one you control, serving real content under your own name. Relaying strangers to somebody else's site is not supported in this version. Validation warns when the origin is not a loopback or private address, and when it is a name.
- **Reached over plain HTTP.** An `https://` origin is refused in this build. Put the origin on a loopback address: what strangers send travels to it as is.
- **Serving the site there, not redirecting to `https://`.** A stranger arrived over TLS and goes to a plain listener. A site's usual plain listener redirects everything to its `https://` address, and through the node that redirect would come back on every request, which no web site does. The origin must be a plain listener that serves the site as its HTTPS listener does. `veilway doctor` warns when the origin redirects to `https://`.
- **Serving the right site.** A stranger's request reaches the origin with the `Host` the stranger sent. The node's own requests, and those of `veilway doctor`, carry the host of the `decoy.origin` URL. On a web server with several sites, make the site you mean the default of that listener, or the two may see different sites.
- **Not the node.** Validation refuses an origin whose address and port the node itself listens on. A name is held to the same when it is resolved, at start and at every reload. A listener on a wildcard address refuses an origin on a loopback or wildcard address with its port, and not one on another host.
- **Aware of an extra connection per user.** For every connection it accepts, the node opens a connection to the origin before it knows who is there, and closes it unused when a user was there. It leaves no request in the origin's log. With `proxy_protocol`, it carries the user's address.
- **Serving nothing at the path.** A request for the path without a valid proof must get the site's own not-found answer, so the origin must not hand the path back to the node. If your web server also forwards something to the node, make the origin a second listener of that web server without the forwarding rule. `veilway doctor` asks the origin for the path and says what it finds.
- **Using its own limits.** The node puts no limit on the size or lifetime of a relayed connection. Your site's own timeouts and limits decide, as for its direct visitors. With `proxy_protocol` the site sees each stranger's address and can limit per address. Turn it on only when the origin expects the header on that listener: an origin that does not expect it answers every relayed request with an error. The node's own requests carry the node's address.

**What happens to a connection.**

- **Who is let in.** A device sends a WebSocket upgrade request for `path` with a proof in its query: a token that only a holder of one of the device's `transport_secrets` can make, sealed to one of the inbound's `transport_keys`, valid once and for about a minute. The node decides at the end of the request line. An accepted proof gets the upgrade answer, and the connection then carries that device's WireGuard and no other. The node sends nothing more on it until a WireGuard packet of that device has authenticated.
- **What everybody else gets.** The origin's answer, and nothing of the node's: no status line, no header field and no error page. Every byte the peer sent goes to the origin unchanged, and the node relays both directions blindly until either side closes. Everything the origin sends is passed on at once. When the origin closes, the peer is closed once it has been given all of it, however slowly it reads. An origin that resets the connection resets the peer's. This holds for a browser, garbage, a wrong path, a wrong or used proof, and the proof of a device that was removed or whose user is disabled, expired or over quota. All look like a visitor who asked for a page the site does not have.
- **What this does not hide.** The TLS handshake is the node's, as said above. An answer through the node comes later than one from the origin, by the hop between them. The node offers `http/1.1` alone unless `http2` is `on`, and TLS 1.2 and 1.3 as its library does. A client that offers only `h2` gets a TLS alert. Plain HTTP sent to the port gets the library's alert, where a web server sends an error page. A proof under TLS 1.2 is never accepted. When the origin answers before it has read a whole upload and closes its side, the node then closes the peer's connection, where a lingering web server would take the rest of the upload first.
- **An origin that gives a connection up first.** The node watches the origin while a request line is incomplete. If the origin says something or closes in that time, as a web server does with a connection that sends nothing, the peer gets that at once, and the connection is not a user's. A complete request line is always looked at first. An origin that closes connections before a request can arrive would cost users an attempt now and then. A web server does not, and its timeout for a request head should not be shorter than a second or two.
- **When the origin is down.** Whoever is not a user is closed with no answer, which tells the node from a web site for as long as it lasts. It is counted in `stream.decoy_down` of `/v1/stats`, logged at warn once a minute, and logged at info when the origin is back. Users are not affected.
- **The upgrade answer.** After the status line come the fields of `upgrade_headers` in that order. `Date` carries the node's time. Every other field carries the value your origin sent for it, spelled as the origin spelled it, and a field the origin did not send is left out. Then come the three fields of the upgrade and one cookie named `upgrade_cookie` with a random value of random length. The node asks the origin once for its page at start and at every reload to learn those values. Until that works, the answer carries only `Date` of the list, which is logged at warn, and the node asks again every 60 seconds. `upgrade_headers` may not name `Upgrade`, `Connection`, `Sec-WebSocket-Accept`, `Set-Cookie`, `Content-Length`, `Transfer-Encoding`, `Content-Type`, `Content-Encoding`, `Trailer` or `Keep-Alive`, and no name twice.

**Limits.**

- **The pools.** A connection that has not sent its request line is undecided. When the listener has `limits.undecided` of them, or one source has its share, the oldest is decided as "not a user" at once to make room. One still inside its TLS handshake is closed. When `limits.relayed` connections are relayed, the one idle longest makes room, or the oldest when none has been idle for 60 seconds. It is closed at once, with nothing more sent. When `limits.sessions` sessions are established, new proofs take the decoy path. Nothing a stranger does takes the place of a session.
- **Limits that are fixed.** A TLS handshake has 10 seconds. A request line has 4,096 bytes and 10 seconds. A user's request head has 16,384 bytes and 10 seconds. A device may have 2 sessions that are not yet established and 8 that are, and 16 accepted proofs at once and then one a second. These count across `udp-obfs` and `tls` together. A session ends 10 seconds after its proof if WireGuard has not authenticated on it, and after 300 seconds without a chunk. Each connection has a send queue of 256 packets. What does not fit is dropped and counted, as on a real network.
- **Replay.** A proof is accepted once, also across restarts, which needs the replay file, see `replay`. A proof from a device whose clock is ahead of the node's limit waits for the limit to be written, 2 seconds at most, and 64 of them at once for a listener. Each holds its connection outside the undecided pool while it waits.
- **Being cut off.** Whenever the node cuts a device off, every `tls` session of that device ends within a second. So does a session whose transport secret was removed, and one opened under a node transport key the config no longer has. A session ends the same way for every cause: a WebSocket Close frame, then TLS and TCP in the normal order.
- **`padding`** bounds the padding of what the node sends, as for `udp-obfs`. A stream has no packet size to keep to, so the inbound's `mtu` default stays 1420 with `tls` alone.
- **The address.** A `tls` transport on an address that also has a `udp`, `udp-obfs` or `ws` listener marks that address for whoever watches it. Put it on an address of its own if you can.
- **What is logged.** At info: a listener that starts, sessions that a reload ended, an origin that is reached again. At warn: an origin that cannot be reached, a key file that group or others can read, header fields that could not be learned. Nothing is logged for a single connection, and no line names a connection's client address, a path, a token or a key. Counters are in `stream` of `/v1/stats`.

### `ws` and `fronted` behind your web server

Engine. Built on both sides. Tested only in containers on one machine, against small test servers and with nginx in front of the node and nginx or HAProxy behind it. Neither transport has run behind a CDN, on a real network, or in front of a real site. The [transports page](../../protocol/transports/) is the specification, an unreviewed draft.

Your own web server ends TLS with your site's name and certificate. It hands two paths to the node over plain HTTP on the loopback and serves everything else as before. The node never ends TLS on these transports. A device reaches its tunnel through one of the two paths.

- **`ws`** is the WebSocket session of `tls`, with the web server's TLS in place of the node's. Use it wherever a WebSocket connection gets through, with or without a CDN in front of the web server.
- **`fronted`** carries the tunnel in the bodies of `POST` requests and their answers, for a CDN that allows neither WebSocket nor long-lived connections. It is slow, makes many requests, and is the transport of last resort. Check the CDN's terms before you use it this way.

**Both are rated Detectable.** The handshake is your web server's, which `tls` cannot offer. The [transports page](../../protocol/transports/) states what is left: a request for one fixed path with a long random query, a long-lived connection or a steady rhythm of small requests to one host, and the sizes and times of what flows. Nothing here has been measured, so claim no more than Detectable for either.

```json
{
  "tag": "home", "type": "veilway", "private_key": "...", "address": ["10.7.0.1/24"],
  "transport_keys": ["..."],
  "upgrade_cookie": "visit",
  "transports": [
    {"type": "ws", "listen": "127.0.0.1:8443", "path": "/assets/live-7c1d0a52.js",
     "decoy": {"origin": "http://127.0.0.1:8080"},
     "trusted_proxies": ["127.0.0.1"], "client_address_header": "X-Forwarded-For"},
    {"type": "fronted", "listen": "127.0.0.1:8443", "path": "/assets/sync-90be44f1.js",
     "decoy": {"origin": "http://127.0.0.1:8080"},
     "trusted_proxies": ["127.0.0.1"], "client_address_header": "X-Forwarded-For"}
  ]
}
```

| Key | Type | Default | Meaning |
|---|---|---|---|
| `listen` | `ip:port` | required | Where the node takes plain HTTP from your web server. Use a loopback address. Anything else is a warning, because tokens, session ids and your site's pages then cross unprotected. A unix socket is not built. |
| `path` | 12 to 256 bytes from `A-Z a-z 0-9 . _ ~ / -`, starting with `/`, no `..` component | required | The path as the web server hands it to the node. If the web server rewrites the path, use the rewritten one. Choose one your site does not have. |
| `decoy.origin`, `decoy.proxy_protocol` | as for `tls` | required, `false` | Your own web site, on a plain listener of its own. See "What the decoy origin must be" under `tls`, and below. |
| `trusted_proxies` | list of 1 to 64 addresses or networks | required | Where your web server connects from: `["127.0.0.1"]` on one host. Only a connection from one of these can bring a user, and only from these is `client_address_header` believed. Everybody else is a stranger and gets the origin's answer. A network of every address (`0.0.0.0/0`, `::/0`) is refused, and so is a list whose networks cover every address between them. An entry that is neither a loopback nor a private address is a warning: every host inside it can bring a user and is believed about where a request came from, and requests cross from it to the node as plain HTTP. |
| `client_address_header` | header field name | none | The field in which your web server names the address a request came from, such as `X-Forwarded-For`. The node takes the rightmost address in it that is not one of `trusted_proxies`. Without the key, or when a request has no such field, the request counts as the web server's own, and the limits per source become one limit for everybody. Validation warns when the key is missing. |
| `limits.sessions` | integer 1 to 1,048,576 | `16384` | Established sessions the listener holds at once, `ws` and `fronted` together. |
| `limits.fronted_sessions` | integer 1 to 65,536 | `1024` | How many of them may be `fronted` sessions. Each keeps its last answer, up to 65,536 bytes, and a digest of its last request. A full pool of 1,024 holds up to 64 MiB of answers. Above 4,096, which is 256 MiB, validation warns and says how much the pool holds. |
| `limits.proxy_connections` | integer 2 to 65,536 | twice `fronted_sessions` | Connections of your web server the listener holds at once. When all are taken, the node stops accepting and leaves new ones in the system's queue. A `ws` session takes its connection out of this count. |
| `limits.decoy_requests_per_source` | integer 1 to 65,536 | `16` | Requests of one source that may wait for the origin at once. One more closes the connection of the oldest. All strangers together have half of `proxy_connections`. |
| `limits.undecided`, `undecided_per_source`, `relayed` | as for `tls` | as for `tls` | The pools for peers that reach the listener from outside `trusted_proxies`. |

Transports that share a listener have the same `decoy`, `trusted_proxies`, `client_address_header` and `limits`. A `limits.proxy_connections` that is not set is twice `fronted_sessions`, and three times the shaped `sse` sessions on a listener of a `fronted-shaped` transport (see below).

**The web server in front.** An nginx example, with the site and the node on one host. The first server is the site as the world sees it. The second is the same site on a plain loopback listener, without the two rules that hand a path to the node. That one is the decoy origin.

```nginx
upstream veilway {
    server 127.0.0.1:8443;
    keepalive 64;
}

server {
    listen 443 ssl;
    server_name site.example.com;
    ssl_certificate     /etc/ssl/site.crt;
    ssl_certificate_key /etc/ssl/site.key;
    root /var/www/site;

    # The path of the ws transport: a WebSocket upgrade, handed on with its query.
    location = /assets/live-7c1d0a52.js {
        proxy_pass http://veilway;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 360s;
        access_log off;
    }

    # The path of the fronted transport: requests on connections that are kept.
    location = /assets/sync-90be44f1.js {
        proxy_pass http://veilway;
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header Connection "";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
        client_max_body_size 128k;
        access_log off;
    }
}

server {
    # The decoy origin: the same site, plain, on the loopback, with no rule for the two paths.
    listen 127.0.0.1:8080 default_server;
    root /var/www/site;
}
```

What the example does:

- **`proxy_add_x_forwarded_for`** puts the address the web server took the request from at the right end of `X-Forwarded-For`, behind whatever the visitor sent. The node reads from the right and skips the addresses in `trusted_proxies`, so a visitor cannot name an address for itself. Behind a CDN, add the CDN's ranges to nginx's own `set_real_ip_from` and `real_ip_header`, so that the address nginx adds is the visitor's and not the CDN's. `veilway doctor` says whether a running node has found the field in the requests it read.
- **`access_log off`** on the two paths keeps the query, a token or a session id, out of the web server's log. A token that was logged and never reached the node can be used once by whoever reads the log, within about a minute.
- **`keepalive`** and `proxy_http_version 1.1` let the web server keep its connections to the node. `fronted` needs that: it makes one request after another for as long as the tunnel is up. The node keeps a quiet connection of the web server for 300 seconds.
- **`proxy_http_version 1.1` is required.** A request that reaches the node as HTTP/1.0 is never a user's, and nginx speaks HTTP/1.0 to the node unless told otherwise, which shuts every user out with no other sign. The node counts such requests (`proxy_http10` in `/v1/stats`), and `veilway doctor` says so when a running node has seen any.
- **`proxy_read_timeout`** on the `ws` path is above the 300 seconds a session may be quiet for.
- **Only the two paths go to the node** here. A request for either without a valid proof gets the origin's own not-found answer. You may hand more to the node, or everything: the origin answers whatever is not a user's, through the node. The origin must never hand a path back to the node, which is why it is a listener without the two rules.

**What the decoy origin must be** is what `tls` says, with these differences:

- The visitor arrived over your web server's TLS, so the origin is the plain listener behind it. It must serve the site as the first server does, without a redirect to `https://`.
- The node opens a connection to the origin only for a request that is not a user's, and keeps it for the next such request of the same web server connection. A user's request never reaches the origin and leaves no connection in its log.
- With `proxy_protocol`, the origin is told the address taken from `client_address_header`, with port 0, since the field names no port. A request that names no source, and one whose head the node cannot read to its end, is told with the address of the web server in front. So the origin must grant nothing to an address, its own host's and its proxy's included.
- The node keeps one origin connection for each web server connection. The origin's keep-alive time does not decide how long the web server's connection lives: see "What the origin does between two requests" below.

**What happens to a request.**

- **Who is let in.** The node reads the whole request head, at most 16,384 bytes within 10 seconds, takes the source from `client_address_header`, and then decides. A head above 16,384 bytes is nobody's and is handed on as the bytes it is. The node still reads it to its end, up to 65,536 bytes, for one thing only: the source its last proxy named, so that a stranger with a long head does not look like the web server itself to the origin. A `GET` for the `ws` path with a valid proof in its query becomes a WebSocket session, as on `tls`, and its connection leaves the proxy pool. A `POST` for the `fronted` path with a valid proof opens a `fronted` session. Later requests name that session and a number that goes up by one.
- **What everybody else gets.** The origin's answer, and nothing of the node's. The node writes no byte of its own for such a request and changes none. The head goes to the origin as read, the body as far as its length or chunks say, and the answer comes back as the origin sent it, to its last byte and no further. When the answer is complete, the next request of the web server is read. An answer that says `Connection: close` ends the web server's connection with it, as does an origin that closes or resets its connection while a request is in its hands.
- **Bytes behind a complete answer** are never handed to the web server: they answer nothing it asked, and its next request on that connection may be a user's. When the origin writes more than one answer to a request, the web server gets the first and both connections are closed.
- **What the origin does between two requests** is not passed on. When an origin says something on a quiet connection, as some servers do with a `408`, or closes a connection it kept, it did so to the node's connection only. The node drops that connection, keeps the web server's, and opens a new one to the origin for the next stranger. If a kept connection turns out closed just as a request is sent on it, the node sends the request once more on a new connection.
- **A request the node cannot tell the end of.** The node reads lengths more strictly than a web server: one `Content-Length` in digits, no more than 2^63 - 1, or `Transfer-Encoding: chunked` alone, CR LF line ends, no folded line, no chunk extension. It reads nothing else. It hands the request on as the bytes it is, with everything the web server sends behind it, until the origin's first answer is complete, then closes both connections, so it never guesses where the next request starts. nginx refuses most such requests itself, before the node sees them.
- **A request from outside `trusted_proxies`** is a stranger's whatever it carries, a valid proof and a forwarded-address field included. It is relayed to the origin as on `tls`.
- **When the origin is down** the web server's connection is closed with no answer, and the web server gives the visitor its own error, as if the site were down. Users are not affected. The error is not always the one a down site gives. nginx answers 502 either way. HAProxy answers 503 for an origin that refuses connections and 502 for a connection closed with no answer. While the origin is down, that is one more way to tell the node from the site.
- **A visitor with more than its share of requests waiting** (`limits.decoy_requests_per_source`, and half the proxy pool for all strangers together) has the connection of its oldest waiting request closed at once, also in the middle of an answer. The web server makes its own error of that, a 502 on nginx, which a site without the node would not have given.
- **The upgrade answer of `ws`** is the one of `tls`, with an empty `upgrade_headers` unless you set it, since the web server adds `Server` and `Date` itself.

**`fronted` in particular.**

- A request is decided from its head: exactly one `Content-Length` from 18 to 65,536 and no `Transfer-Encoding`. The node then reads the whole body within 10 seconds before it uses anything, and every chunk in it must open. The origin answers a request that fails any of this, and the session it named stays exactly as it was, so a stranger who learns a session id cannot disturb the session.
- One request of a session is in flight at a time. If the next one comes early, the origin answers it. A repeat of the last request with the same bytes gets the same answer again, because a CDN may send a request twice. For that, the node keeps the last answer and a SHA-256 of the last request body, not the body.
- The node answers at once when it has something for the device, and after 250 ms when it has not. The answer is `200` with `Content-Type: application/octet-stream` and a `Content-Length`, and nothing else from the node.
- A session with no accepted request for 60 seconds is forgotten. `fronted` has no keepalive: the requests are the sign of life.
- A device may have 2 `fronted` sessions among its 8. A third takes the place of its oldest `fronted` session once it is established.
- An opening request whose body brings no WireGuard packet of its device is held, since the node sends nothing before that. The origin answers it when the session ends, 10 seconds later.

**HTTP/2 behind your web server.** Your web server may speak HTTP/2 to the client but must speak HTTP/1.1 to the node, which offers no HTTP/2 on these listeners. HTTP/2 or `h2c` towards the node is not supported. The web server turns a client's HTTP/2 into HTTP/1.1 as for any site behind it. See [HTTP/2](../../protocol/http2/), where a client side for `ws` and `fronted` over HTTP/2 is designed and not built.

**Limits that are fixed** are those of `tls` where they are the same thing: 2 sessions that are not yet established and 8 that are for a device, 16 accepted proofs at once and then one a second, counted across every native transport together. A `ws` session ends after 300 seconds without a chunk and a `fronted` session after 60 seconds without an accepted request. Replay and being cut off are as on `tls`: a proof is accepted once, also across restarts, and whatever cuts a device off ends its sessions within a second.

**What is logged.** At info: a listener that starts, sessions that a reload ended, an origin that is reached again. At warn: an origin that cannot be reached. Nothing is logged for a single request, and no line names a request's client address, a path, a token, a session id or a key. Counters are in `stream` of `/v1/stats`.

### `ws-plain`

Engine. Built on both sides since v0.2.14-alpha. Tested in containers with a small web server, nginx and HAProxy, not on a real network. The [transports page](../../protocol/transports/) is the specification.

`ws-plain` is the session of the native `ws` over plain HTTP. Your web server takes the connection on port 80 (or another plain port) and hands one path to the node on the loopback. Use it only where TLS to your server is blocked or slowed and plain HTTP passes. The network sees your server's name, the path and the token, and can tell that people use this app. A later leak of the transport's key ties all of a device's plain connections together. The app asks the user for consent of its own before it dials one, and the panel shows a warning when you add it.

Its keys are those of `ws` with a `decoy`: `listen`, `path`, `decoy`, `trusted_proxies`, optional `client_address_header` and optional `limits`. It has no `tls`, `http2`, `shape`, `site` or `transport_key` key. It adds one:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `transport_keys` | list of 1 or 2 keys | required | Secret. The private halves of this transport's own keys, not the inbound's. Two allow rotation, the new key first and the old one second. A profile carries the public half of the first. `veilway genkey --transport` prints one. |

The inbound's `upgrade_cookie` is required, and the token travels in a cookie of that name. Pick a name your own site never sets.

Validation refuses:

- a key that is a WireGuard key of the config, a key of any other transport or inbound, or the same key twice, so that a leak of this one opens nothing else;
- a `path` that is the `path` of a `tls`, `ws` or `fronted` transport of any inbound;
- a `ws-plain` transport on a listener that a transport which is not `ws-plain` also uses.

The node reads the whole head of every request before it decides. The token must be in exactly one `Cookie` field, in exactly one cookie of the inbound's cookie name. Other cookies in the field are allowed. A request with anything after `?` in its target is not from a user. Whoever is not a user gets the decoy's answer. Your web server must answer the path as it answers any other plain path, a redirect to HTTPS included. The upgrade answer sets no cookie.

The panel makes and rotates the keys (see [Rotation](../../manuals/panel/#subscription-settings)). The node only sees the list change.

### `fronted-shaped`

:::caution[Not built, designed in version 0.2.0]
Nothing here is in the node, the client or the panel, and a `fronted-shaped` transport in a config is refused today. The specification is [Shapes of fronted](../../protocol/fronted-shapes/). Nobody outside the project has reviewed it and it has not been run behind a CDN. It changes nothing about `fronted`, which is written above and called the classic form.
:::

A `fronted` transport has one shape: a `POST` with the data in the body, answered in the body. A `fronted-shaped` transport lets you pick the method, where in the request the data goes, and whether the node answers each request or writes to one Server-Sent Events stream. Its keys are those of `fronted`, and one more.

| Key | Type | Meaning |
|---|---|---|
| `shape` | object, required | `up` with `method`, `in`, and optionally `name`, `limit`, `inflight` and `gather`, and `down` with `mode` and optionally `gather`, `life` and `fallback`. The members, the valid combinations and the ranges are on the page. The panel writes the same object to the profile, and the two must match. The node cannot see the profile, and a difference shows as refusals at the client. |

```json
{"type": "fronted-shaped", "listen": "127.0.0.1:8443", "path": "/assets/feed-5a1e9c30.js",
 "shape": {"up": {"method": "POST", "in": "body"}, "down": {"mode": "sse"}},
 "decoy": {"origin": "http://127.0.0.1:8080"},
 "trusted_proxies": ["127.0.0.1"], "client_address_header": "X-Forwarded-For"}
```

- **Validation** refuses a shape that breaks the rules of the page: a method and `in` that do not go together (a `GET` with a body), a refused method or header name, a limit or range out of bounds, an `up.inflight` above 1 with `poll`, and an unknown member or value. It warns above 256 shaped sessions on a listener, and counts them among the 1,024 `fronted` sessions.
- **The path** of a shape that puts the data in the path (`up.in` `path`) is matched as a prefix. Your web server hands the node every path under it, and the origin must serve nothing there. Validation refuses a `path` that is a prefix of another transport's path on the same listener.
- **Limits.** The node reads a request line of up to 8,192 bytes when `up.limit` is above 4,000. A shaped session holds at most 603,136 bytes. `limits.proxy_connections` is three times the shaped `sse` sessions when not set, because a shaped client keeps up to 5 connections to the host.
- **Your web server.** For `sse` it must not buffer the answer. In nginx, use `proxy_buffering off` for the path, a `proxy_read_timeout` above the longest stream (`down.life`, at most 3,600 s) and `proxy_http_version 1.1`. For `GET` the CDN must not cache the path. The prefix location is for `up.in` `path` only.

```nginx
# A fronted-shaped transport with an event stream down. Use a location with a
# trailing slash instead of "=" when the data rides in the path.
location = /assets/feed-5a1e9c30.js {
    proxy_pass http://veilway;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header Connection "";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_read_timeout 3700s;
    client_max_body_size 128k;
    access_log off;
}
```

- **A node link refuses it**, as it refuses `fronted`.
- **`veilway doctor`** prints the shape of each such transport.
- **Your web server and the CDN log data in a URL.** For `query` and `path` that is every upstream byte, sealed. If that worries you, use `body`.

### `faketls`

:::caution[Alpha]
The node builds this transport and the config accepts it. It is new, and nobody outside the project has reviewed it. It is off unless you add it, and it is labeled alpha. The panel sets it up and writes a profile of its own for it. The apps dial it only after the user turns on Alpha transports. It is rated Detectable. For the steps, see the [Borrowed-site mode guide](../../guides/borrowed-site/). The design is on the [Borrowed-site mode](../../protocol/borrowed-site/) page, and the keys are the ones in the schema.
:::

The node holds no certificate. It borrows a real site that you choose. A client proves itself inside its ClientHello and gets the tunnel. Every other connection is relayed byte for byte to the site, so a prober sees the site's own certificate. Clients must reach the node directly: no CDN, no TLS-ending proxy and no `trusted_proxies`. The site is a third party that has not agreed to any of this. Read "The third party" on the page before you set it.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `listen` | `ip:port` | required | Where the node takes connections. It shares its address and port with no other transport. |
| `site.host` | host name | required | The site's name. It is the only server name a user's hello may carry, and the name used in relayed and probe connections. |
| `site.names` | list of at most 4 host names | none | Extra server names a user's hello may carry. |
| `site.port` | port | `443` | The site's port. |
| `site.address` | IP address | none | An address to connect to instead of resolving the name. |
| `site.acknowledged` | bool | required | Must be `true`. Validation refuses the transport without it. Setting it means you accept that the site's owner has not agreed to this. |
| `transport_key` | secret | required | A key of this transport alone. Validation refuses a key equal to the transport key of any other transport on the node. |
| `limits.relayed` | integer | `256` | Strangers relayed to the site at once. |
| `limits.site_rate` | integer | `16` | New connections to the site a second. When it is spent, users are still served and only a stranger that needs a connection is closed. |

Validation also refuses a listener with `trusted_proxies`, and a `site.address` that is the node's own listen address. Pick a site that a user in your country can reach, that is large enough that the node's connections do not matter to its owner, and, if you can, that is hosted in the same network as the node. None is suggested or shipped. The candidate a profile carries has the node's address, the site's name as its server name and the transport's public key. It has no pin, `self_signed`, `ech`, `host`, `path` or fronting value.

## Proxy inbounds (`socks5`, `http`, `mixed`)

From v0.2.17. A proxy inbound is an entry of `inbounds` whose `type` is `socks5`, `http` or `mixed`: a TCP listener that lets other software use the node as a plain proxy. It has no key, no address pool and no transports. Every connection logs in as one of the config's users, and its traffic meets the same destination gate, rules, exits, entitlement, quota and counters as that user's tunnel traffic.

:::danger[Nothing is encrypted]
SOCKS5 and HTTP carry the password and the traffic in the clear. Anyone on the path reads both, and anyone who finds the port can tell it is a proxy and block it. The panel rates a proxy inbound Unsafe. Listen on loopback and reach the port through a tunnel or a TLS front you run, as in [Give an account a proxy login](../../guides/proxy-inbound/). Use a public address only when you must.
:::

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | Unique among all the inbounds of the config, tunnels included. Rules name the inbound by it. |
| `type` | `socks5`, `http` or `mixed` | required | `socks5`: SOCKS5 with a user name and password. `http`: an HTTP proxy. `mixed`: both on one port. A first byte of `0x05` is SOCKS5 and anything else is read as HTTP. |
| `listen` | `ip:port` | required | The TCP address clients connect to. See "Listen addresses" below. It never shares an address and port with another TCP listener of the node: another proxy inbound, a `tls`, `ws` or `fronted` listener, a tunnel, or an Xray inbound. A UDP port of the same number is no conflict. |
| `users` | list of user names | `[]` | The users that may log in. Each name must be a user of the config. |
| `groups` | list of group names | `[]` | The groups whose members may log in. A user in `users` or in one of these groups may. With both lists empty, every user that has a `proxy_password` may. |
| `udp` | bool | `true` | Whether UDP ASSOCIATE is answered. An error on an `http` inbound, which has none. |
| `udp_any_port` | bool | `false` | Lets a client behind a NAT have a UDP association on an inbound that is not on loopback. See "UDP" below. An error on an `http` inbound. A warning where it has no effect: on loopback, or with `udp` off. |
| `public` | bool | `false` | Says you know that a listen address strangers reach carries traffic and passwords in the clear. See "Listen addresses" below. |
| `enabled` | bool | `true` | `false` keeps the inbound in the config, validated, with its address reserved, and does not listen. Its connections end at the reload. |
| `limits.connections` | integer 1 to 65536 | `1024` | Connections the inbound holds at once, logged in or not. |
| `limits.per_source` | integer 1 to 65536 | `64` | How many of those one source may hold. A source is an IPv4 address or an IPv6 /64. A loopback peer is exempt, see below. |
| `limits.handshakes` | integer 1 to 65536 | `256` | Connections that have not finished logging in. At most 8 of them for one source, and half of them for loopback peers together. |

```json
{"tag": "socks", "type": "socks5", "listen": "127.0.0.1:1080", "users": ["ana"]}
```

### Listen addresses

- **Loopback** (`127.0.0.0/8`, `::1`) is taken as is and warns about nothing. Only this host reaches it. `public: true` on loopback is a warning, since it is never needed.
- **A private address** (RFC 1918, `100.64.0.0/10`, `fc00::/7`) is taken without `public`, with a warning. On a cloud host a private address is often NATed one to one to a public one, and a local network has other machines. Nothing is encrypted there, so anyone who reaches the port or is on the path can read the traffic and the password.
- **Any other address**, the wildcard (`0.0.0.0`, `::`) and link-local ones included, is an error unless `public` is `true`. With `public: true` it is taken with a warning that the traffic and the password cross the network unencrypted, and that the listener is easy to find and block.

`veilway check` reports these. `veilway doctor` also checks that each listen address can be bound.

### Who may log in

A client logs in with the user's `name` and `proxy_password`. There is no anonymous use and no shared password.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `users[].proxy_password` | 16 to 128 printable ASCII characters, no `:` | none | Secret. The password this user logs in to a `socks5`, `http` or `mixed` inbound with. Without one the user cannot log in to any of them. No two accounts share a login. A `proxy_password` in a config with no proxy inbound is a warning. |

- The inbound must admit the user (`users`, `groups`, or neither list for everyone with a password). A user who is disabled, expired or over quota is refused at the request, as everywhere else.
- A wrong password, a wrong name and a user the inbound does not admit are answered alike and take the same time.
- **Proxy-only users.** A user with a `proxy_password` may have `"devices": []`. Such a user is counted, held to a quota and cut off like any other. A user without a `proxy_password` still needs 1 to 64 devices.
- The control API shows `proxy_password` as `"<redacted>"`. A document sent back with that marker keeps the running password of the user with the same `name`. A marker in a config file read from disk is an error.
- A user's connections end within a second of the user being cut off, of the password changing, or of the inbound no longer admitting the user.
- The node cannot recover a login the user did not write down. The panel keeps its own sealed copy, see the [panel manual](../../manuals/panel/#proxy-inbounds-socks5-and-http).

### SOCKS5

- Only the user name and password method (RFC 1929) is offered. A client that offers no such method is answered `0xff` and closed.
- `CONNECT` and `UDP ASSOCIATE` are taken. `BIND` and every other command are refused.
- The node resolves a destination name itself, never through the host's resolver, using the DNS servers of the user's set and the exit the rules give the query. A name is lower case, at most 253 bytes, of letters, digits, hyphens, underscores and dots.
- Each destination is a flow of the user. The destination gate refuses loopback, link-local, multicast, the cloud metadata addresses, every address pool of the node and every address of this host, the inbound's own listen address included. Private networks are the rules' business, as for the tunnel.

### HTTP

- `CONNECT host:port` opens a tunnel to the target. The login is `Proxy-Authorization: Basic`. A request without a login is answered `407` and the connection is closed.
- A plain `http://` request with an absolute URI is forwarded, one request to a connection. The node sends it to the origin with the request line in origin form, `Host` taken from the URI, the `Proxy-Authorization` field and the other hop fields removed, and `Connection: close` added, so the origin never sees the login. The node reads nothing the client writes after the request's own end (its `Content-Length`, or its chunks), so a second request behind the first never reaches the origin.
- Refused: `https://` and origin-form requests, userinfo and fragments in a URI, a request with both `Content-Length` and `Transfer-Encoding`, a `Transfer-Encoding` that does not end in `chunked`, and any version but `HTTP/1.0` and `HTTP/1.1`. The head is at most 8,192 bytes and 64 fields.

### UDP

UDP ASSOCIATE gives a SOCKS5 client a UDP relay on the node. A datagram carries no proof of who sent it, so the node ties the relay to the control connection.

- The relay is bound to the address the control connection reached, with a port of its own. It carries only datagrams from the IP address of the control connection. Fragments are dropped.
- **On loopback (Linux)** a datagram is carried only from a socket whose owner, read from the kernel, is the user id that owns the control connection. On macOS and Windows the system cannot tell who owns a socket, so a loopback inbound follows the rule for other addresses.
- **On any other address** the client must say in its request the port it sends from. Only datagrams from exactly that address and port are carried, and a request with port `0` is refused (`0x02`). A client behind a NAT, which rewrites the port, gets no UDP. Validation warns about this on every such inbound with `udp` on.
- **`udp_any_port`** is the way out for clients behind a NAT: the association binds to the first datagram from the client's address. The cost is a window before that datagram, in which a sender that shares the client's address (neighbors behind the same carrier NAT, say) can take the association and reach the destinations of the user's flows. Validation warns about it. Leave it off unless your clients are behind a NAT.
- An association ends with its control connection, after 120 seconds without a datagram, and when the user is cut off. A user holds at most 32 associations and 256 UDP flows, and an inbound 4,096 and 16,384.
- Datagrams dropped because they did not come from the address and port the client named count as `refused_udp_source`.

### Limits and failed logins

Beyond `limits`, the inbound protects the passwords:

- A client that sends no byte in 3 seconds is closed, and so is a connection that has not finished its login in 10 seconds. A `mixed` inbound's first-byte look and its whole login share those 10 seconds.
- A source that fails 10 logins to one user name in 60 seconds is refused that name, unheard, until the window ends. The count is kept per source and name, so one source does not lock out the others. One source may hold counts for 16 names. One that tries more is refused every name until the window ends.
- A refusal for a name that logins failed for waits 100 ms for each failure beyond the first two, up to 2 seconds, whoever asks. A correct login never waits.
- A loopback peer is a front you run, with every user behind one address. It is exempt from the share of a source and from the block, but the wait for a name still holds.
- A request without a login is not a failure: a browser makes one first.
- A user's TCP connections and UDP flows are counted once across every proxy inbound and the hop of the Xray add-on together, so spreading them over inbounds buys nothing.
- A connection that carries nothing for the exit's `tcp_idle_secs` is ended.

Counters are in `proxies` of [`GET /v1/stats`](../api/#get-v1stats), and the bytes are in `inbounds` as well. A refused login is logged at info, once in 10 seconds at most, with a count and no address, name or password.

### Reloading

A reload that changes a proxy inbound in any way closes its listener and every connection on it. Connections of other inbounds stay. A reload that changes a user's `proxy_password`, or removes, disables or no longer admits a user, ends that user's connections within a second. A reload that removes an inbound also closes its port.

## `outbounds`

An outbound is a way for the userspace stack to open TCP and UDP flows.

| `type` | Keys | Meaning |
|---|---|---|
| `direct` | optional `bind` (a local IP, not a wildcard), optional `interface` (a network interface of the host by name, 1 to 15 characters of letters, digits, `_`, `-` and `.`, starting with a letter or digit; since v0.2.8) | Connects from the node itself. With `bind`, flows of the other address family are rejected. With `interface`, every socket of the outbound is tied to that interface (`SO_BINDTODEVICE` on Linux, `IP_BOUND_IF` on macOS), so its traffic leaves there whatever the routing table says. |
| `socks5` | `server` (`host:port`, IPv6 literals in brackets), optional `username` and `password` (both or neither, each 1 to 255 bytes), optional `via` (the tag of another `socks5` outbound) | Connects through a SOCKS5 proxy, or through a chain of them when `via` is set. UDP uses UDP ASSOCIATE when the proxy offers it. |
| `xray` | `server` (`host:port`) and `protocol`, or a `link`; the fields of the protocol | Connects through a VLESS, VMess, Trojan or Shadowsocks server of another party, run by the Xray add-on. Linux nodes only. See "`xray` outbounds" below. |
| `wireguard` | `server` (`host:port`), `public_key`, `private_key`, `addresses`, and optional `preshared_key`, `mtu`, `keepalive_secs`, `max_flows`, `bind`, `interface` | Connects through a WireGuard server of another party, with a tunnel the node runs itself. See "`wireguard` outbounds" below. |

Every outbound also has a `tag`.

An `interface` that is the interface of an `l3` exit is an error: the outbound's traffic would go back into the tunnel. A `socks5` outbound takes no `interface`. Engine: on a system other than Linux and macOS, `run` refuses a config whose exits use an outbound with `interface`. If the host lacks the interface when the config comes into force, the node logs a warning and the outbound's flows fail until it is there. `veilway doctor` names a missing interface.

Engine: the system resolver resolves a `server` host name each time the node dials the proxy, never through a tunnel exit. The node uses the UDP relay address a proxy returns only if it is the address the control connection is connected to. A relay address on another host means the proxy counts as having no UDP.

**`via`** (`socks5` only) sends the connection to this outbound's `server` through another `socks5` outbound, which may have a `via` of its own. A chain may have up to 8 proxies, counting this outbound. The node dials the first proxy itself. Each hop then does its own SOCKS5 handshake and authentication over the connection the hop before it made, and the flow's destination is the last CONNECT. A host name in `server` goes to the hop before it unresolved, except for the first proxy, which the node resolves.

- `via` names a `socks5` outbound. A `direct` outbound cannot be named, and a `direct` outbound cannot have `via`.
- Following `via` from an outbound must not come back to it. A loop is a config error.
- A chain has at most 8 `socks5` outbounds. A longer one is a config error at the `via` of the outbound that makes it too long.
- A chain carries TCP only. A UDP ASSOCIATE relay cannot be reached through a TCP chain, so a UDP flow through a chain is refused as a proxy without UDP is. The exit's `unsupported.udp` policy decides, and the default `reject` refuses it. `direct` is a config error on such an exit, since it would send that UDP from this node's own address, around the chain. DNS over UDP falls back to TCP through the chain, as for any proxy without UDP.
- The chain is shown as one outbound. Its latency is the time the whole chain took to answer the greeting of the last hop.
- A chain that cannot be dialled makes its flows fail. Nothing goes around it.
- **Plain text.** SOCKS5 is not encrypted. Each proxy of a chain sees the user name and password of the proxies after it, the CONNECT targets and the bytes of the flows. Chain only through proxies whose operators may see that, or run TLS inside every flow yourself.

### `xray` outbounds

From v0.2.18. An `xray` outbound sends flows through a server of another party that speaks VLESS, VMess, Trojan or Shadowsocks, with the Xray add-on doing the talking. Use it behind a `netstack` exit. The [guide](../../guides/xray-outbound/) shows the steps in the panel. The server, its name and its credential are your secrets. Whoever runs the server sees what the exit carries, as any provider of an exit does.

Give either a `link`, or `protocol` and `server` with the fields of the protocol. A node takes at most 16 outbounds of this type.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `link` | string of at most 4,096 bytes | none | Input only. One share link of the kinds `vless://`, `vmess://`, `trojan://` and `ss://`, on one line. The node reads it with the same reader and table as the desktop app, so it accepts what the app accepts and refuses with the same codes. What it holds becomes the typed fields below and the link itself is dropped: a document read back from the node never has a `link`. Any other key next to a `link` is refused. A link the table refuses is an error that names the code and never the link. |
| `protocol` | `vless`, `vmess`, `trojan` or `shadowsocks` | required without `link` | |
| `server` | `host:port` | required without `link` | The server. IPv6 literals go in brackets. Xray never looks a name up, see "The server's address" below. |
| `allow_private` | bool | `false` | Lets `server` be a private, shared (CGNAT) or unique local address. Loopback, link-local, the node's own addresses and its inbounds' pools are refused whatever this says. |
| `id` | UUID | none | Secret. Required for `vless` and `vmess`, and refused for the other two. |
| `password` | 1 to 255 bytes, no control characters | none | Secret. Required for `trojan` and `shadowsocks`, and refused for the other two. For a `shadowsocks` 2022 cipher it is the key as standard base64: 16 bytes for `2022-blake3-aes-128-gcm`, 32 for the other two. For the older ciphers it must have at least 16 characters, since the key comes from the password alone and a short one is guessed offline. |
| `cipher` | string | `auto` for `vmess` | `vmess`: `auto`, `aes-128-gcm` or `chacha20-poly1305`. `shadowsocks`: required, one of `aes-128-gcm`, `aes-256-gcm`, `chacha20-ietf-poly1305`, `2022-blake3-aes-128-gcm`, `2022-blake3-aes-256-gcm` and `2022-blake3-chacha20-poly1305`. Refused for `vless` and `trojan`. |
| `flow` | `xtls-rprx-vision` | none | `vless` only, and only over `tcp` with `tls` or `reality`. |
| `transport` | object with `type` | `{"type": "tcp"}` | The stream: `tcp`; `ws` and `httpupgrade` with optional `path` and `host`; `grpc` with optional `service` and `authority`; `xhttp` with optional `path`, `host` and `mode` (`auto`, `packet-up`, `stream-up` or `stream-one`). A `path` starts with `/`, has at most 256 bytes and no `?`, since a query can carry early data, which the node does not use. `host` and `authority` are lowercase host names or addresses. `service` is 1 to 128 characters from letters, digits and `-._/`. A path that is left out is `/`. |
| `security` | object with `type` | `{"type": "none"}` | `none`; `tls` with optional `server_name`, `alpn` (`h2` and `http/1.1`, each at most once) and `fingerprint` (default `chrome`); `reality` with `server_name` and `public_key` (43 characters of base64url), and optional `short_id` (up to 16 lowercase hex digits, an even number of them) and `fingerprint`. The `server_name` of `tls` defaults to the server's name and is required when `server` is an address. Certificates are always checked against the system roots. No key turns that off or pins a certificate. |

```json
{"tag": "rented", "type": "xray", "protocol": "vless", "server": "198.51.100.7:443", "id": "3f2b8c1e-5d4a-4e7b-9a6c-1d2e3f4a5b6c", "security": {"type": "tls", "server_name": "example.org"}}
```

**What validation refuses.**

- `vless` and `trojan` without `tls` or `reality`: they are never spoken in the clear.
- A `flow` that is not Vision over `tcp` with `tls` or `reality`, and a `flow` on any protocol but `vless`.
- `reality` over `ws` or `httpupgrade`.
- A `?` in a `path`, and any path, host, service or authority that does not read as above.
- A `shadowsocks` password that is too short for its cipher, or a 2022 key of the wrong length.
- An exit on an `xray` outbound whose `unsupported.udp` is `direct` or `{"via": ...}`. An Xray outbound carries UDP itself, and while it is down the flow ends rather than leave the exit around it. Use `reject` or `drop`.
- A `via` on an `xray` outbound, and an `xray` outbound as the `via` of another outbound, of a link or of an upstream. It is reached through a Unix socket and cannot carry a chain.
- A literal server at an address the node may not dial, see "The server's address".

The warnings are a server written as a name (see below), and `routing.fallback` next to an exit on an `xray` outbound, because users routed there fall back to the other exit while the outbound is down. `proxy_only` of such an exit defaults to `true`.

**How it runs.** The add-on's one Xray process gets a `trojan` inbound for each `xray` outbound, listening on a Unix socket and routed to that outbound alone. The node dials that socket and speaks Trojan to it: CONNECT for TCP and one framed stream for each UDP flow. So the exit, the gate, the rules, the quotas and the counters are those every flow meets, and Xray only talks to the provider. Every request carries a password made new at each start. Before it sends a byte, the node checks that the socket belongs to Xray's user.

- **Linux nodes only.** The add-on host runs on Linux. On macOS and Windows nodes the outbound is down and says so.
- **The add-on must be installed.** `scripts/veilway.sh addon xray install` also puts the node's user in the group `veilway-xray`, which owns the folder the sockets are made in (`/run/veilway-xray-out`, mode 750, and `run --xray-dir` changes it). The script restarts a node that was running, so that it joins the group. Without the add-on, every exit through an `xray` outbound is down and says why, and nothing goes around it.
- **A restart drops Xray users for a moment.** One Xray runs for the inbounds and the outbounds. Adding, changing or removing either restarts it after two seconds without another change. Connections of Xray inbounds and flows through Xray outbounds end and come back with the next connect. No quota, count or user is lost.
- **Down, with a reason.** An outbound that Xray does not carry is down, and so is every exit through it. That covers a missing add-on, a host that does not answer, Xray starting again, a name that gives no usable address and a socket that is not Xray's. A flow of a down outbound ends at once and never goes to `direct`, to another exit or to the provider's default. `GET /v1/stats` gives the reason as `down_reason` of the outbound. It names no address and no credential.
- **Xray's own egress is not restricted.** The Xray unit has the network of the host, because providers can be anywhere. The document the node writes, with one address the node checked, holds Xray to the provider, but a bug in Xray is not held to it. The `interface` and `bind` of the config do not apply to this traffic. On a host with other tunnels it follows the host's routing table.

**The server's address.** A literal address must pass the rules of every dial of the node. It must not be loopback, link-local, unspecified, multicast, a cloud metadata address or an address of an inbound's pool. It must not be private, shared or unique local unless `allow_private` is `true`. The node itself looks up a server that is a name, through `dns.servers`, never by Xray or the host's resolver. The first address that passes the rules is written into Xray's document. A name that gives none leaves the outbound down. The names are looked up again every 15 minutes, and every 30 seconds while a name has no address. The address in use stays while the lookup still gives it, and a failed lookup changes nothing, so a resolver that flaps does not restart Xray. That lookup is plain UDP DNS, so whoever can see the node's DNS traffic learns the provider's name. Write the address when the name must stay hidden. Validation warns for each name.

**Secrets.** `id` and `password` are secrets. The control API shows the marker in their place and takes it back for the running outbound with the same tag, server, protocol and kind of security. Change any of those and you must write the secret out again.

`veilway doctor` checks the add-on and the socket folder when the config has an `xray` outbound, see "Commands".

### `wireguard` outbounds

From v0.3.6. A `wireguard` outbound sends flows through a WireGuard server of another party: Mullvad, a server of your own, any `wg-quick` peer. The node is the WireGuard client and runs the tunnel itself, in userspace, so it needs no `wg` tool and no interface. Use it behind a `netstack` exit. The [guide](../../guides/wireguard-outbound/) shows the steps in the panel. Whoever runs the server sees what the exit carries, as any provider of an exit does.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | |
| `server` | `host:port` | required | The server's UDP endpoint. IPv6 literals go in brackets. A name is looked up by the system's resolver at start, every 5 minutes and whenever the node starts a handshake again. The last address is kept while the name still resolves. |
| `public_key` | key | required | The server's public key. |
| `private_key` | key | required | Secret. The node's own key for this server. |
| `preshared_key` | key | none | Secret. |
| `addresses` | list of 1 or 2 addresses | required | The node's addresses inside the tunnel, at most one of each family. A `/32` or `/128` at the end is dropped. A destination of a family with no address here is refused as unsupported. |
| `mtu` | integer, 1280 to 1500 | 1420 | The tunnel's MTU. |
| `keepalive_secs` | integer, 0 to 3600 | 25 | Seconds between keepalives. 0 sends none. |
| `max_flows` | integer, 16 to 4096 | 1024 | The flows open through the tunnel at once, TCP and UDP together. A flow past it is refused and counted. |
| `bind`, `interface` | as for `direct` | none | The local address and the network interface of the UDP socket that talks to the server. |

```json
{"tag": "wg-out", "type": "wireguard", "server": "198.51.100.7:51820", "public_key": "<server public key>", "private_key": "<node private key>", "addresses": ["10.2.0.2", "fd00::2"]}
```

Each flow of the exit is opened from the tunnel by a TCP/IP stack of its own. Every flow leaves from the node's one tunnel address, so the server cannot tell users apart.

**What is refused.**

- A `server` that is loopback, link-local, unspecified, multicast, a cloud metadata address or an address of an inbound's pool. Private addresses are allowed, since the server may be on your own network. A name that resolves to a refused address leaves the outbound down.
- An address inside the tunnel that is loopback, multicast, unspecified, or inside an inbound's pool.
- A `private_key` that is the server's, or any inbound, device or link key of the config, or the key of another `wireguard` outbound. A key has one use.
- A `via` on the outbound, and the outbound as the `via` of another outbound, of a link or of an upstream. It carries flows of its own and cannot carry a chain.
- An exit on it whose `unsupported.udp` is `direct` or `{"via": ...}`. Use `reject` or `drop`.

**Warnings.**

- Every `wireguard` outbound warns: users routed through it reach whatever the server's own network reaches, its other peers included. The node's gate only refuses the node's own addresses and networks. If users must not reach those ranges, add a routing rule that rejects them, such as `{"tag": "no-wg-lan", "ip": ["10.2.0.0/16"], "action": "reject"}`.
- A `server` written as a name: whoever sees the node's lookups learns the name. Write the address when it must stay hidden.
- `routing.fallback` next to an exit on it: users fall back to that exit while the outbound is down.

**Health.** The outbound is down when the server has not answered a handshake for 20 seconds, when a datagram could not be sent, or when one of its two tasks ended. A task that ends is started again after 2 seconds, then 4, doubling to 60. A down outbound tries a new handshake on the same schedule, and every change is logged at info with the reason. An outbound with no handshake for 180 seconds and nothing unanswered is idle and counts as up. While it is down the exit does not work: flows end with a reason and nothing goes to `direct`, to another exit or to the provider's default. `GET /v1/exits` shows the state, see [the API reference](../api/#get-v1exits).

**Limits.**

- One user holds at most a quarter of `max_flows` flows of an outbound, never fewer than 16. A quarter of `max_flows`, at most 16 places, are kept for the node's own DNS lookups through the outbound, so a user cannot starve them.
- Each flow costs about 272 KiB once it carries data, so the default 1,024 flows come to about 272 MiB and 4,096 to about 1.1 GiB.
- One outbound runs on one core. Measured on three cores of one machine, one connection moved about 54 MB/s in each direction in a release build. More flows share the same core.
- Packets over the MTU, and datagrams too large for it, are dropped and counted.

**DNS.** The node's resolver asks through the outbound for users routed to it, over UDP and with a fallback to TCP. No name leaves around the tunnel.

**Changes.** Adding or removing the outbound, or changing anything the tunnel is made of (the server, the keys, `addresses`, `mtu`, `keepalive_secs`, `max_flows`, `bind`, `interface`, or the pool of an inbound) restarts its tunnel, and flows open at that moment end. Other outbounds, exits and users are not touched.

**Secrets.** `private_key` and `preshared_key` are secrets. The control API shows the marker in their place and takes it back only for the running outbound with the same tag, server and public key. Change any of those and write the key again.

**Not hidden.** The outer UDP is plain WireGuard, easy to recognize and block. Where WireGuard is blocked, use an [`xray` outbound](#xray-outbounds). Whoever sees the node's lookups learns a server name, and the server sees every flow.

## `exits`

An exit is a named way out that users are routed to.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | |
| `name` | string, 1 to 64 characters, no control, bidirectional formatting, zero-width, line separator or other invisible characters | the tag | Display name. |
| `country` | two uppercase letters | none | ISO 3166-1 alpha-2 code shown in clients. Not checked against the ISO list. |
| `backend` | object | required | See below. |
| `load` | object | none | Tells apps how busy this exit is. Off when absent. See "`load`" below. An error on a `block` exit. |

### `backend`

| `type` | Carries | Keys |
|---|---|---|
| `netstack` | TCP and UDP | `outbound` (tag, required), `proxy_only`, `tcp_idle_secs` (10 to 86400, default 7200), `udp_idle_secs` (5 to 3600, default 60), `unsupported` |
| `l3` | every IP protocol | `interface` (matching `[a-z][a-z0-9_-]{0,14}`, default `veilway0`, unique across exits), `masquerade` (bool, default `true`). Linux only, needs `CAP_NET_ADMIN`: on another system `run` refuses to start. `check` does not look at the system it runs on. |
| `block` | nothing | none. Every packet is dropped silently. |
| `chain` | every IP protocol | `links` (1 to 4 link tags, required). The traffic leaves from another node through these links, see `links` below. No key of `netstack` or `l3` is allowed. |
| `upstream` | every IP protocol | `upstream` (the tag of an entry of `upstreams`, required). The traffic leaves through the provider's network, see `upstreams` below. No key of `netstack`, `l3` or `links` is allowed. |

Engine, `l3`:

- Only one `l3` exit can run on a node for now. A second is refused at start. The host needs `ip` (iproute2) and `nft` (nftables).
- With `masquerade` true, the node turns on forwarding for the whole host if it is off and sets it back when it stops (it stays on if the node is killed). With `masquerade` false, the node still loads a small nftables table named `veilway_<interface>` that keeps tunnel traffic away from the host itself.
- Return traffic is delivered only when it belongs to a live flow that left through that exit. Flows idle out after 7200 seconds for TCP and 60 for UDP.
- An `l3` exit can go down while the node runs: its interface was removed under the node, or a reload closed the interface and could set up neither the new one nor the old one again. The node then tries to bring the interface up with the config in force, 2 seconds after it went down, then after twice the wait each time, once a minute at most, until it is up.
- While the exit is down, traffic routed to it is answered as unreachable (a reset for TCP, host unreachable for everything else, counted under `unreachable` in the drop counters). It never leaves through another exit. The node logs a warning with the failed step when the exit goes down and for every failed try, and an info line when it is up again. `GET /v1/exits` shows the state in `interface_up`, `interface_down_secs` and `interface_flips`.
- A reload that leaves the `l3` exit as it is goes through while the exit is down, and makes the node try at once. A reload that changes or removes the exit ends the tries for the old one. Stopping the node ends them too and leaves no interface, route, nftables table or sysctl behind.

### The destination gate

Every exit refuses these destinations, whatever the config says:

- every address inside an inbound pool (traffic between users never leaves through an exit, see below);
- loopback and link-local (`169.254.0.0/16`, `fe80::/10`);
- the cloud metadata addresses `fd00:ec2::254` and `100.100.100.200` (from v0.2.15; only these two addresses, your rules handle the networks around them);
- multicast, broadcast, unspecified and `0.0.0.0/8`;
- IPv6 addresses that embed an IPv4 address (IPv4-compatible, NAT64, 6to4, Teredo) whose embedded address is refused;
- every IPv4-mapped IPv6 destination (`::ffff:a.b.c.d`), outright.

The node's own public addresses are not on that list either. Users reach them unless a rule refuses them, see [Reaching the server itself](#reaching-the-server-itself). Private networks are not on that list. Routing rules decide about them, so an operator can refuse them, allow them, or allow them for some users only. See `geoip:private` under routing.

### Traffic between users

A packet whose destination lies inside an inbound pool is never sent to an exit, but routing rules still decide about it. The name `tunnel:users` in a rule's `ip` list stands for every address in every pool except the gateways:

- If the matching rule says `block` or `reject`, the packet is refused. A config that isolates users, the normal case, has a rule that rejects `tunnel:users`.
- Otherwise the node delivers the packet to the device that holds the address, on the same inbound or another one. An address no connected device holds is answered as unreachable.

`tunnel:<inbound tag>`, for example `tunnel:gaming`, stands for the addresses of one inbound only. With the `inbound` condition, which says where a packet came from, a rule can be about one tunnel in either direction. An inbound cannot have the tag `users`.

A shared network for games on one tunnel, with every other tunnel isolated, is one rule placed before the isolating rule. Its action `"user"` means "handle normally", which for a destination inside a pool is delivery to that device:

```json
{"tag": "gaming-lan", "inbound": ["gaming"], "ip": ["tunnel:gaming"], "action": "user"},
{"tag": "isolate-users", "ip": ["tunnel:users"], "action": "reject"}
```

Users on `gaming` reach each other but not users of other tunnels, and users of other tunnels reach nobody.

Three things hold whatever the rules say. A device can only send from its own addresses. A gateway address answers DNS and ping from the devices of its own inbound and nothing else, plus, on a `veilway` inbound, the control channel of that inbound. Broadcast and multicast are not carried, so games that find each other by local broadcast will not see other players. Connecting by address works.

### `proxy_only` and `unsupported`

`proxy_only` (bool) says that traffic through this exit leaves only through its SOCKS5 proxy. It defaults to `true` when the outbound is `socks5` or `xray`. It must be absent or `false` when the outbound is `direct`.

`unsupported` says what a `netstack` exit does with traffic its outbound cannot carry:

| Key | Applies to | Default | Allowed values |
|---|---|---|---|
| `icmp_echo` | ping | `"local"` | `"local"`, `"reject"`, `"drop"`, `"direct"`, `{"via": "<exit tag>"}` |
| `udp` | UDP when the proxy has no UDP ASSOCIATE (DNS keeps its TCP fallback) | `"reject"` | `"reject"`, `"drop"`, `"direct"`, `{"via": "<exit tag>"}` |
| `other` | every other IP protocol | `"reject"` | `"reject"`, `"drop"`, `{"via": "<exit tag>"}` |

- `reject` answers with the matching ICMP error. `drop` discards. `local` makes the node answer the ping itself, after the destination gate.
- `direct` sends from the node's own address around the proxy, and `via` hands the traffic to another exit. Either is an error unless the exit sets `"proxy_only": false`, and validation still warns for each use.
- A `via` target must exist and must not be the exit itself. It must be an `l3` exit for `icmp_echo` and `other`, and must carry UDP for `udp`. The node never consults the target's own `unsupported` policy, so chains and loops cannot form.
- On a `direct` outbound, setting `udp` is a warning: it never applies.
- On an `xray` outbound, `udp` must be `reject` or `drop`. The outbound carries UDP itself, and `direct` and `via` would let the flow leave around it while it is down.

Engine:

- `direct` for `icmp_echo` uses unprivileged ping sockets and is checked at start.
- The `udp` policy is decided once per flow at its first packet, and the flow never moves between the proxy and the other path. A UDP flow the proxy has carried is refused if the proxy loses UDP. Every switch of an upstream between "has UDP" and "has no UDP" is logged at info and counted.
- A destination sent by `direct` or `via` must pass the gate of both exits, and a flow sent by `via` needs the user to be entitled to both. A `via` target that cannot carry the packet rejects it.
- `reject` answers are rate limited per device (burst 20, then 10 a second).
- ICMP codes used: administratively prohibited for rules, the gate, entitlement and a rejected ping. Host unreachable for a tunnel address nobody holds. Port unreachable for `unsupported.udp`. Protocol unreachable on IPv4 and prohibited on IPv6 for `unsupported.other`.
- `icmp_echo: direct` allows 16 ping identifiers per device, 32 per user and 1024 in total.

### `load`

From v0.2.18. An exit with a `load` object tells every device of its users how busy it is, as one of three levels: low, medium or high. Apps show them as **Not busy**, **Busy** and **Very busy**. When `load` is absent, apps show nothing for the exit.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `by` | `flows` or `mbps` | required | `flows`: the flows open on the exit, all users together. `mbps`: the exit's traffic, up and down added together, in megabits per second, averaged over the last 30 seconds. |
| `busy` | integer 1 to 1,000,000 | required | The level is medium from this value. Below it, low. |
| `very_busy` | integer 2 to 1,000,000 | required | The level is high from this value. Must be greater than `busy`. |

```json
"load": {"by": "flows", "busy": 50, "very_busy": 200}
```

- **The node looks every 10 seconds.** A level changes only after the new one held for two looks in a row, so a value that crosses a threshold and comes back does not flap. The first look that has a value sets the level at once. For `mbps` there is no level before the second look.
- **A device is told a change at most once in 60 seconds**, however often the node looks. It is also told when a reload or a change of whether the exit works would have sent the list anyway. A level that was told and still holds stays as told.
- **The levels are coarse on purpose.** A device learns at most that the exit got busier, a minute late, never a number, so it cannot watch what other users do. Without `load` the node sends nothing about other users' traffic.
- **A `block` exit has no load**, and `load` on one is an error.
- The control API's `GET /v1/exits` shows the setting as `load` and the level apps are told as `load_level`.

## `routing`

The first packet of a flow is matched against `rules` in order. The first match decides, and the whole flow keeps that decision.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `default` | exit tag | required | Used when nothing else chose an exit. |
| `fallback` | list of exit tags, at most 16 | none | The exits a device without a choice of exit leaves through while its own exit is not working, in this order, each only when the device's user may use it. It goes back to its own exit once that works again. No `block` exit, and no tag twice. Without it a device stays on its exit whatever happens to it. An entry node needs that: nothing goes round a node link that is down. From v0.2.11. |
| `rules` | list | `[]` | See below. |

### A rule

All conditions present in a rule must hold. Inside one list, any entry may match. A rule needs at least one condition.

| Key | Type | Matches |
|---|---|---|
| `tag` | tag | required. The rule's identity for the control API. |
| `enabled` | bool, default `true` | Not a condition. A disabled rule is validated like any other and skipped when flows are matched. |
| `inbound` | list of inbound tags | the inbound the packet arrived on. A proxy inbound's tag is a tag like any other: a flow that comes in through one is decided with that inbound. |
| `transport` | list of transport names | the kind of session the flow started on, see "Transport" below. From v0.2.17. |
| `user` | list of user names | the sending user |
| `group` | list of group names | any group of the sending user |
| `link` | list of link tags | what arrives from one of these links, on a node that is the exit half of each. Not together with `user` or `group`, which a link does not have. |
| `ip` | list of networks, or the names `geoip:private`, `host:self`, `tunnel:users` and `tunnel:<inbound tag>` | destination address. `host:self` is the machine's own addresses, see [Reaching the server itself](#reaching-the-server-itself). |
| `domain` | list of names | a name this user resolved to the destination address through the node. `example.com` matches that name only. `*.example.com` matches every name below it and not `example.com` itself. |
| `protocol` | list of `tcp`, `udp`, `icmp`, `icmpv6`, `gre`, `esp`, `sctp`, or an integer 0 to 255 | IP protocol. A name and its number are the same entry. |
| `port` | list of integers 1 to 65535 or strings `"lo-hi"` with `lo <= hi` | destination port. Needs `protocol` present and limited to `tcp`, `udp` and `sctp`. |
| `icmp_type`, `icmp_code` | lists of integers 0 to 255 | Need `protocol` to be exactly `["icmp"]` or exactly `["icmpv6"]`. `icmp_code` needs `icmp_type`. |
| `action` | `{"exit": "<tag>"}`, `"user"`, `"block"` or `"reject"` | required |

### Transport

`transport` holds a flow to the kind of session it started on. The names are `udp` (plain WireGuard), `udp-obfs`, `tls`, `ws` (both the native one and the `ws` of a `wireguard` inbound), `ws-plain`, `fronted`, `fronted-shaped`, `faketls`, `socks5` and `http`. Like every condition it must hold together with the others, and the first matching rule still decides. A rule that names a transport and a group matches only that group's flows on that transport.

```json
{"tag": "no-proxy-to-private", "inbound": ["socks"], "ip": ["geoip:private"], "action": "reject"},
{"tag": "calls-direct", "transport": ["socks5"], "protocol": ["udp"], "action": {"exit": "direct"}}
```

- For a tunnel flow it is the transport of the device's session when the flow was created. A device that moves to another transport keeps its old flows where they began, and its new flows follow the rule. A reload that decides a flow again also keeps its transport. A device that races two sessions cannot swap it.
- For a proxy flow it is `socks5` or `http`. A `mixed` inbound reports the one its connection spoke, and UDP ASSOCIATE is `socks5`.
- A link this node dials runs on the transport of the candidate it dialled.
- A DNS query of the node's resolver follows the `inbound` and `transport` rules of the flow it came in on. A name a proxy user asks for is resolved under the same inbound and transport.
- A flow of the Xray add-on has no transport and matches no rule that names one. It has no inbound either, so a rule with `inbound` never matches it. Validation warns about an enabled rule with `inbound` while Xray inbounds exist.
- Validation warns about an entry that names a transport no inbound of the node has, since it never matches.

A domain is lowercase ASCII (punycode for other scripts), at most 253 bytes with labels of 1 to 63, no trailing dot, and not an IP address in any spelling (a last label that is all digits, or `0x` followed by hex digits, is refused). `*` may only be the whole first label and needs at least two labels after it.

`geoip:private` stands for every private and special-purpose range: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `192.0.0.0/24`, `192.0.2.0/24`, `192.88.99.0/24`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `240.0.0.0/4`, `fc00::/7` and `2001:db8::/32`. It never matches an address inside an inbound pool: those are `tunnel:users`. A network in a rule, and `geoip:private`, also match an IPv6 destination that embeds a matching IPv4 address (IPv4-compatible, NAT64, 6to4, Teredo). No other `geoip:` name is accepted yet, and a `tunnel:` name must be `users` or the tag of an inbound. A config that keeps users away from each other and out of the networks behind its exits starts its rules with:

```json
{"tag": "isolate-users", "ip": ["tunnel:users"], "action": "reject"},
{"tag": "no-private", "ip": ["geoip:private"], "action": "reject"}
```

To let one group reach one private network, put a rule for it before that one. To switch a rule off without deleting it, set `"enabled": false`.

Actions: `{"exit": ...}` sends the flow to that exit. `"user"` sends it to the user's own `exit`, or to `default` when the user has none. `block` drops silently. `reject` answers with an ICMP error, or a TCP reset for TCP. A flow that matches no rule is treated as `"user"`.

### Entitlement

A flow may only leave through an exit in its user's `exits`, whatever chose it: a rule, the user's `exit`, `default`, or a `via`. Otherwise the flow is rejected, never passed to another rule.

Validation:

- Error: a rule with a `user` condition sends a named user to an exit outside that user's `exits`.
- Error: a user with a non-empty restricted `exits` has no `exit` and `default` is not in the list.
- Warning, with a count of affected users: a rule without a `user` condition can send users to an exit they are not entitled to, directly or through `via`.
- Error: a rule limited to protocols other than TCP and UDP sends them to a `netstack` exit whose policy for that class is `reject` or `drop`. UDP is never checked, because whether a proxy carries UDP is only known at run time.
- Warning: a `domain` rule with an `exit` action comes before a `block` or `reject` rule. A user who controls any name matching the pattern can point it at any address, so a `domain` rule is a routing convenience and never a security control.
- Warning: no enabled rule isolates users for everyone, that is, no enabled rule with `block` or `reject` has `tunnel:users` in `ip` and no other condition. The warning says that users can reach each other's devices. When an `inbound` condition limits the rule, it names the inbounds where that is so.
- Warning: no enabled rule refuses private destinations for everyone, that is, no enabled rule with `block` or `reject` has `geoip:private` in `ip` and no other condition. The warning says that private networks behind the exits are reachable.
- Warning: an enabled `block` or `reject` rule whose only conditions are `ip`, `protocol` and `port` matches a server of `dns.servers` or of a DNS set on port 53 before any rule that would send it to an exit, so the node cannot reach its own resolver. The warning gives the path of the server, for example `dns.sets[0].servers[1]`.
- Error: a rule with a `link` condition names a link that is not the exit half on this node, a link no config has, or also has a `user` or `group` condition. Sending a link to an exit that is not in that link's `exits` is an error too.
- Warning: a rule with a `domain` condition and no `user` or `group` that could apply to a link. The exit never learns the names behind a link's traffic, so the rule never matches it, and a block by name does not cover a link.
- Warning, best effort: a single earlier rule completely covers a rule. `check` does this within a fixed budget. A reload does not.

Engine: `protocol` is the upper-layer protocol after walking IPv6 extension headers. Fragments are reassembled before routing, within a per-user bound, or dropped. A packet whose headers cannot be parsed is dropped and counted.

For flows between users, only an echo reply counts as the answer to a delivered echo request. The rules decide every other ICMP message for its own direction.

The flow table holds at most 65536 flows in total, 1024 per user and 512 per device. Refused flows are remembered apart from these limits (4096, the oldest gives way).

### Reaching the server itself

Since v0.3.6, users can reach services on the node's own public addresses unless a rule refuses them. Loopback and link-local stay refused by the gate. The panel listens on `127.0.0.1`, so users cannot reach it.

The name `host:self` in a rule's `ip` list stands for every address the machine holds on its interfaces. The node reads them again every 60 seconds and at each reload, so it follows DHCP and addresses added later. An IPv4 address of the machine written inside an IPv6 one matches too. Addresses of the inbound pools are not part of it. The rule holds for every door: tunnels, proxy inbounds, the Xray add-on and node links.

Nothing adds a rule for you. If other services listen on this machine (a database, an admin port, another panel), refuse them:

```json
{"tag": "no-self", "ip": ["host:self"], "action": "reject"}
```

A rule above it can let one user reach one port. Rules are checked from the top, so the first match decides:

```json
{"tag": "alice-ssh", "user": ["alice"], "ip": ["host:self"], "protocol": ["tcp"], "port": [22], "action": "user"},
{"tag": "no-self", "ip": ["host:self"], "action": "reject"}
```

- A service that listens on every address of the machine is reachable through any of them until a rule refuses them.
- An address that no interface holds, such as a public address behind a 1:1 NAT, is not in `host:self`. An anycast address and a broadcast address are not either. They stay reachable.
- With an `l3` exit, the node's own firewall table still keeps tunnel traffic from the host itself, whatever the rules say.
- `veilway doctor` lists the addresses `host:self` covers and says whether an enabled rule names it.

## `users`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | matching `[a-z0-9][a-z0-9._-]{0,63}` | required | Unique. This is the user's identity: usage counters and rules refer to it. Renaming a user is removing one and adding another. |
| `enabled` | bool | `true` | |
| `groups` | list of declared group names | `[]` | |
| `devices` | list of 1 to 64 | required | See below. Empty only for a user with a `proxy_password`, who then uses proxy inbounds alone. |
| `proxy_password` | 16 to 128 printable ASCII characters, no `:` | none | Secret. The password for the `socks5`, `http` and `mixed` inbounds, with `name` as the user name. See [Proxy inbounds](#who-may-log-in). From v0.2.17. |
| `exits` | `"all"` or a list of exit tags | required | Exits the user may leave through. An empty list means none: the user can connect but every flow is rejected, and validation warns. |
| `exit` | exit tag | none | The user's own exit. Must be in `exits`. |
| `quota_bytes` | integer 1 to 9007199254740991 | none | Bytes of inner IP traffic, both directions, per period, including traffic that was rejected or answered locally. See Usage and quota. |
| `quota_period` | `daily`, `weekly`, `monthly` | none | When the count resets, at 00:00 UTC (weekly on Monday, monthly on the 1st). Needs `quota_bytes`. Without it the quota never resets. |
| `expires_at` | RFC 3339 timestamp with an explicit offset | none | From this moment the user is treated as disabled. |
| `speed_up`, `speed_down` | integer 16384 to 12500000000, bytes per second | none | The most the user sends and receives through this node. Without a key there is no limit. See [Speed limits](#speed-limits). From v0.3.6. |

### `devices`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | matching `[a-z0-9][a-z0-9._-]{0,63}` | required | Unique within the user. |
| `public_key` | key | required | Unique across all devices of all users, and never equal to the public key of an inbound. |
| `preshared_key` | key | none | Secret. |
| `transport_secrets` | list of 1 or 2 secrets | none | Secret. Required for a device with an address in a `veilway` inbound, where the device proves one of them to the control channel. A secret is 32 random bytes written like a key, and `veilway gensecret` prints one. No two devices share one, and none is a WireGuard key of the config. Two allow rotation: add the new one, give it to the device, remove the old one later. On a device with no address in a `veilway` inbound the key is a warning. |
| `addresses` | list of 1 to 16 host addresses, written without a prefix | required | The device's tunnel addresses. |

Each address must lie in the pool of exactly one inbound and may not be that pool's gateway, network or IPv4 broadcast address. A device has at most one IPv4 and one IPv6 address per inbound. No address is used by two devices.

Engine: when a user is disabled, expires, runs out of quota or is removed, or when a device's key or addresses change or the device is removed, the core drops the session keys, resets every flow and clears the DNS memory that belong to it within one second, and logs it at info. A timer and the byte count drive expiry and quota, not only a check at handshake. A backward step of the node's clock does not re-enable a user. Usage is kept outside this document, see below.

### Usage and quota

Engine. Usage never lives in the config document. It is kept in one state file (see `--state` under Commands) and survives reloads and restarts. Without a state file path, the node keeps usage in memory only and loses it on restart.

- **Over quota.** A user at or over quota is cut off by the same path as a disabled user, within one second, and the info log line names quota as the reason. The user cannot shake hands again until the period rolls over, a reload raises or removes the quota, or the operator resets the user's usage.
- **Clock steps back.** A backward step of the clock by less than one period never resets a count and never re-enables a user, at that moment or when the clock moves forward again. The period start stays where it was.
- **A period start far in the future.** A period start more than one whole period after the node's clock (more than 1 day for `daily`, 7 days for `weekly`, 31 days for `monthly`) is not trusted. It can come from an edited state file, a state file written while the clock was wrong, or a clock that was ahead by more than a period and was then set right. Left alone, such a count would not reset until the clock reached that time, which can be years. So the node sets the period start to the start of the period its clock is in, keeps `used_bytes`, and logs one warning that names the user. It checks this when it loads the state file and four times a second while it runs. The price: a clock that jumps back by more than a period and then forward again gives that period's quota a second time. Keep the node's clock synchronized.
- **Without `quota_period`.** Any period start after the node's clock is set to `0` with `used_bytes` kept and one warning. Nothing resets by itself for such a user, so this costs nothing.
- **Reset by the operator.** `veilway usage reset --user <name>`, or `POST /v1/users/{name}/usage/reset` on the control API, sets `used_bytes` to 0 and the period start to the start of the current period. A user who was over quota can connect again at once, without a reload. Lifetime totals are kept unless you give `--totals` (`"totals": true`). See Commands and the control API reference.
- **Counters.** Every user, inbound and exit has totals of up and down bytes and packets, which the control API serves. Whoever polls computes rates. Counters follow names and tags across reloads. Exit counters count inner IP packets and bytes where a packet is handed to or taken from the exit. A flow that leaves by way of another exit (`via`) is counted on the exit that carries it, not on the exit the rule chose.
- **State file.** Versioned JSON keyed by user name. Per user it holds the bytes used in the current quota period, the start of that period, and lifetime totals (up and down, bytes and packets). Next to the users it holds `devices`: for each device that chose an exit on the control channel, its public key and that exit's tag. The version stays 1, because an older build passes that key over and still reads every user's count. The file keeps the choices of at most 65,536 devices, and no more than fit in the 16 MiB a state file may have next to its users (with 65,536 users that is about 1,500). After a restart, a device whose choice is not kept has chosen no exit, and the node warns when that happens.
- **Writes.** The file is written with mode 600 through a temporary file in the same directory, then fsync, then rename, at most once every 10 seconds and only when something changed. It is also written on shutdown, right after a user is cut off for quota, and right after a usage reset. Writing never blocks traffic. A failed write is retried, and logged once and then every 10 minutes while writes keep failing. If the node is killed, at most about 10 seconds of counted usage can be lost.
- **Start.** A missing file means zero usage. A file that cannot be parsed, has an unknown version, or is larger than 16 MiB is kept under the same name with `.bad` appended and logged at error, and the node starts from zero, since an unreadable state file must not keep a node down. A state file that group or others can write is treated the same way. Values are clamped, never trusted: a count above 9007199254740991 saturates at it. One entry that is not valid is skipped, and only that user starts from zero, or only that device has chosen no exit. The node reads no more than 65,536 users and 65,536 devices from a file. An exit in the file is held against the config like one a device asks for: when it is not in the user's `exits` it is dropped at start and logged at info. If the path is not a regular file (a directory, a symbolic link, a device), the node leaves it untouched, logs an error and keeps usage in memory until it stops.
- **Removed users.** The entry of a user the config no longer names is dropped at the commit that removes it, and so is the entry of a device. A renamed user starts from zero.

### Speed limits

`speed_up` is the most a user sends through this node and `speed_down` the most the user receives, in bytes per second (16384 to 12500000000). A user with neither key has no limit. From v0.3.6.

- **Per user.** All of the user's devices and proxy logins share one limit, so more devices get no more speed.
- **Per node.** The same user on two nodes has the limit on each.
- **TCP is slowed down.** TCP that the node holds as a stream (a `netstack` exit, the proxy inbounds, the Xray add-on) waits for its turn. Nothing is lost.
- **Other traffic over the rate is dropped.** That is UDP, pings, and anything through an `l3`, `chain` or `upstream` exit. A drop is counted as `rate_limited` in `drops` and in the user's `limited` counters.
- **DNS and the control channel are never dropped.** They count against the limit, so a user at the limit can still look up names and keep the control channel up.
- **A short burst passes.** It is one second at the rate, at least 64 KiB, and cannot be set.
- **A dropped upload still counts toward the quota.** A dropped download does not.
- **Node links have no limit of their own.** Limit the user on the entry node.
- **Apps do not show it.** `GET /v1/users` and the panel do.

## `notices`

A list of at most 4 notices that the control channel of every `veilway` inbound gives to every device. The node writes none of its own.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `severity` | `information` or `warning` | `information` | |
| `text` | 1 to 280 bytes | required | Plain text. Control characters, line breaks, bidirectional formatting and zero-width or other invisible characters are refused, so a client shows it as written. A client shows no link in it. |

```json
"notices": [{"severity": "warning", "text": "Maintenance on Friday from 02:00 UTC"}]
```

Notices on a node with no `veilway` inbound are a warning.

These notices reach only connected devices. A panel can also put notices into every signed subscription document. Apps keep those from their last refresh and show them even when they cannot connect. That is a panel setting, not part of this config, see the [panel manual](../../manuals/panel/#notices).

## `public_addresses`

A list of at most 8 host names or IP addresses, with no port and none twice. A profile of this node gets these addresses, each with the port of the listener of one of its transports. The control API shows them in `GET /v1/status` and `GET /v1/inbounds`. A host name is lowercase ASCII, written as for a rule's `domain` without `*`. An IPv4-mapped IPv6 address and an address with a zone are errors, as everywhere.

```json
"public_addresses": ["node.example.com", "203.0.113.7"]
```

## `replay`

Engine. The replay memory makes sure a proof is accepted once (for `udp-obfs` an opening packet, for `tls` the token of an upgrade request). One memory serves every obfuscated transport of the node. A node without such a transport keeps none, and the key is then a warning.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `cache` | integer 1024 to 1,048,576 | `262144` | How many accepted proofs the node remembers at once. When it is full, every proof is refused until entries leave, which they do 60 seconds after their time. The node reads it at start. A reload that changes it logs a warning and changes nothing until the next start. |
| `per_source` | object with `burst` and `rate`, each 1 to 65,536 | `{"burst": 256, "rate": 32}` | Accepted proofs one source may bring: `burst` at once, then `rate` a second. A source is an IPv4 address or an IPv6 /64. Raise it when many users share one address. A reload changes it at once. |

```json
"replay": {"cache": 262144, "per_source": {"burst": 256, "rate": 32}}
```

### The replay file

The memory is kept in a file of its own: `veilway-replay` next to the state file, or the path given with `run --replay`. Next to it the node keeps a lock file (`veilway-replay.lock`) and, during a write, a temporary file (`veilway-replay.tmp`).

- **Start.** A node does not start a config with an obfuscated transport, and does not reload into one, without a replay path whose directory it can write. A second node on the same file does not start. Two nodes never share a replay file, and an inbound's keys belong to one node.
- **Size.** While the node runs, the file is 68 bytes and is written about every 10 seconds, with mode 600. A clean stop writes the cache as well, 41 bytes for each entry, at most about 10 MiB at the default `cache`.
- **After a clean stop** nobody is refused because of the restart.
- **After a kill or a crash** the node refuses proofs for up to 20 seconds, or up to 80 if a device with a fast clock had connected just before. Logged at info.
- **With no file**, which is how a node starts for the first time, every proof is refused for 60 seconds. Logged at warn.
- **A file that cannot be used** (cut short, damaged, larger than `cache` allows, writable by group or others) is moved aside with `.bad` behind its name and logged at error. The node then starts as with no file. A config that lowers `cache` below the entries of the last clean file makes that file unusable in this way.
- **A file that cannot be written while the node runs**: within about 20 seconds the node accepts no new proof. Open sessions go on. Logged at error once a minute, and counted in `replay.write_failures` of `/v1/stats`.

Three things undo replay protection:

- **Restoring the replay file from a backup or a machine snapshot.** An older file reopens replay for everything accepted since it was taken. If in doubt, delete it: that costs 60 seconds of refusals.
- A reset (below) after the node's clock ran ahead.
- A lost file on a node whose clock is behind where it has been. Do not start the node before its clock is synchronized.

### When the floor is ahead of the clock

A node whose clock ran ahead and was then put right can be left refusing every device: its floor, the time up to which proofs are refused, lies in the future. The outage lasts as long as the clock was wrong by, and waiting is the only thing that ends it by itself.

It is not the same as what a start costs. After a start or a reset, the floor is up to 80 seconds ahead of the clock, as the list above says. That passes by itself, is logged once at start with the time left, and is shown as `replay.refusing_secs` of `/v1/stats`. Do not reset for it: a reset costs another 60 seconds.

The fault is a floor more than 80 seconds ahead of the clock, or one that rose while the node ran:

- The node logs it at error once a minute with the distance, and counts the refused proofs in `replay.refused_floor_ahead`. `replay.floor_ahead` of `/v1/stats` is true.
- `veilway doctor` shows the floor, the limit and the clock. It fails when the floor is more than 80 seconds ahead, and warns when the limit is. A floor up to 80 seconds ahead is reported as what a start costs, with the time left.
- `veilway replay reset` ends it, see Commands.

## `links`

A list of at most 64 node links. A link joins this node to one other node. Users connect to one of the two (the entry) and their traffic leaves from the other (the exit). See the [node links page](../../protocol/node-links/) for roles, directions, pairing and what each node enforces.

Do not write a link by hand. `veilway link offer` and `veilway link answer` pair two nodes and print the entry for each node's config, which you put into `links`, see Commands. A link is either one this node is dialled for (it has `inbound` and `public_key`) or one it dials (it has `peer` and `private_key`), never both.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | |
| `id` | 22 characters of base64url | required | The id the pairing made. Unique. |
| `direction` | `forward` or `reverse` | required | Who dials. In a forward link the entry dials the exit, in a reverse link the exit dials the entry. |
| `enabled` | bool | `true` | A link that is not enabled is validated like any other and neither dialled nor answered. |
| `addresses` | object | required | `dialler`: 1 or 2 addresses, at most one IPv4 and one IPv6. `listener`: one address for each family of `dialler`, in the same order, in a reverse link and in no other. They lie in the pool of the inbound the link connects to. |
| `mtu` | integer 1280 to 1500 | `1390` when the link lists `udp-obfs`, else `1420` | MTU inside the link's tunnel. Above the default is a warning, since nothing is fragmented for a link. |
| `transport_secret` | secret | required | The secret the two nodes agreed on when they were paired. It never travels. No device and no other link has the same, and it is not a WireGuard key or a transport key of the config. |
| `inbound` | inbound tag | none | On the node that is dialled: the `veilway` inbound the link connects to. It has no `fronted` or `fronted-shaped` transport and carries no users' devices. Needs `public_key`. |
| `public_key` | key | none | On the node that is dialled: the WireGuard public key the other node made for this link. Needs `inbound`. |
| `private_key` | key | none | Secret. On the node that dials: the WireGuard key it made for this link. Needs `peer`. |
| `peer` | object | none | On the node that dials: `inbound_public_key` (the key of the other node's inbound), `transport_public_key` (needed when a `tls` or `ws` transport is listed) and `transports` (1 to 8). Needs `private_key`. See below. |
| `exit` | exit tag | none | On the exit half: the exit the link leaves through when no rule names one. Without it that is `routing.default`. Must be in `exits`. |
| `exits` | list of exit tags | required on the exit half | On the exit half: the exits the link may leave through. A `chain` exit is among them only with `allow_chain`. An `upstream` exit never is. |
| `allow_chain` | bool | `false` | On the exit half: whether the link may continue through a `chain` exit of this node, into another link. The node the traffic leaves from then sees this node's link address, and the entry is not told. A chain has at most 3 links, see [Chaining](../../protocol/node-links/#chaining). An error on the entry half. From v0.3.6. |
| `allow_private` | bool | `false` | On the exit half: whether rules decide about private networks for this link. Without it they are refused whatever the rules say. |
| `max_flows` | integer 1 to 65,536 | `16384` | On the exit half: the flows the link may have at once. It is a warning when the `max_flows` of the links this node is the exit of come to more than half of the 65,536 flows the node holds. |
| `quota_bytes`, `quota_period`, `expires_at` | as for a user | none | On the exit half. They mean what they mean for a user. |

Which half a node is follows from `direction` and from whether the link has `inbound` or `peer`. The entry half has the users and is used through a `chain` exit. The exit half takes traffic from the other node. `exit`, `exits`, `allow_private`, `allow_chain`, `max_flows`, `quota_bytes`, `quota_period` and `expires_at` are errors on the entry half, and `exits` is required on the exit half. An entry half that no `chain` exit names is a warning.

`peer.transports` lists the other node's transports in its order of preference, in the shape a profile of a subscription has:

| Key | Type | Meaning |
|---|---|---|
| `type` | `udp`, `udp-obfs`, `tls` or `ws` | `fronted` and `fronted-shaped` are read and refused: a link carries the traffic of many users, and polling that through a CDN is not a transport of a link. |
| `endpoints` | list of 1 to 16 `ip:port` | For `udp` and `udp-obfs`, which take neither `path` nor `candidates`. |
| `path` | as for `tls` | For `tls` and `ws`, together with `candidates`. |
| `candidates` | list of 1 to 16 objects | For `tls` and `ws`. Each has `address` (`ip:port`), `sni` (a lowercase host name, or `""` for none), `host` (the `Host` of the request), `verify_name` (the name the certificate is held against: required when `sni` is empty and not allowed otherwise) and `pins` (1 to 4 SHA-256 hashes of the certificate's SubjectPublicKeyInfo, in base64). `self_signed` (only on `tls`: `true` trusts the certificate through its pins alone, see below). A `tls` candidate needs `pins`. Unless `self_signed` is set, the chain is validated and a pin is a second condition. |

A `tls` candidate with `"self_signed": true` is for a node with no domain. Its certificate is trusted through its pins alone: no chain, name or date is checked, and the handshake must be signed by the pinned key. It needs 1 to 4 `pins` and no `verify_name`, and `sni` may be `""`. It is an error on `ws`. A new key on that node breaks the link until the operators pair again. See [Pins and self-signed links](../../protocol/node-links/#pins-and-self-signed-links).

An address the node dials may not be loopback, link-local, unspecified, multicast, broadcast, in `0.0.0.0/8`, inside an inbound pool of this node, or an IPv6 address that carries an IPv4 address. A private address is a warning.

Other checks: a link's key is not an inbound's or a device's, and no two links share a key. The addresses of a link must be host addresses (not the gateway, network or broadcast address) of its inbound's pool on the node it connects to. On the node that dials, they must lie outside every pool of this node, inside `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10` or `fc00::/7`, where the pool they come from lies. The `chain` exit that names a link must name an entry half, and no two exits name the same link.

Engine. A link that is down carries nothing, and nothing routed to it goes round it: the flows are answered as unreachable. The dialler tries one candidate at a time and never latches a failure. `GET /v1/links` of the control API shows each link's state, and `veilway doctor` checks the links.

## `tunnels`

A list of at most 64 tunnels. A tunnel forwards one TCP or UDP port of this node to one address on the far side of a node link, through a `chain` exit, with no client. See "Tunnels" on the [node links page](../../protocol/node-links/) for what each node does.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | |
| `enabled` | bool | `true` | A tunnel that is not enabled is validated and does not listen. |
| `protocol` | `tcp` or `udp` | required | |
| `listen` | `ip:port` | required | The address this node listens on. No other tunnel, inbound transport or listener of this node uses the same address, port and protocol. |
| `exit` | exit tag | required | A `chain` exit. |
| `target` | `ip:port` | required | The address the far node is asked to reach. Not a link address, not a listen address of this node, not inside an inbound pool of this node, and nothing the destination gate refuses. A private address works only when the far node set `allow_private` for the link. |
| `sources` | list of 1 to 64 networks | anyone | The networks that may connect. Required for a UDP tunnel that listens on an address that is not loopback. Without it, such a TCP tunnel is a warning. |
| `max_connections` | integer 1 to 4096 | `256` | TCP connections or UDP sessions at once. One source (an IPv4 address or an IPv6 /64) holds at most 16. All tunnels together come to at most 16,384. |

Engine. A tunnel's connections leave from the entry's link address with ports from the entry's translation, as users' flows do. The far node's rules for the link decide them. While the `chain` exit is down, connections are refused. `/v1/stats` counts each tunnel under `tunnels`.

## `upstreams`

A list of at most 8 other providers' Veilway subscriptions. The node holds one device on each and uses it as the way out of an exit: the exit's backend is `{"type": "upstream", "upstream": "<tag>"}`, and at most one exit names each upstream. The [upstream protocol page](../../protocol/upstreams/) says what the provider sees and can do. The [operator guide](../../guides/upstream-provider/) walks through enrollment.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | Any tag but `preview`, which the control API uses for previews. |
| `enabled` | bool | `true` | A disabled upstream is checked, and neither fetched nor connected. |
| `link` | string | required | The provider's native `veilway://sub/` link. It holds the account's token, so it is a secret. |
| `signing_key` | string | required | The provider's signing key the operator confirmed: 8 groups of 4 hex digits with spaces, or 43 characters of base64url. The link must carry this key. |
| `private_key` | string | required | The node's device key for this provider, a 32-byte key in standard base64, as WireGuard keys are written. A secret. Not all zero, and no two upstreams share one. |
| `device_secret` | string | required | The device secret for this provider: 16 bytes as 22 characters of base64url. A secret. |
| `profile` | string | automatic | The provider's profile to use. Without it the node tries every profile in the document's order, starting with the last one that carried. |
| `failover` | bool | `false` | With a `profile`: whether the node goes on to the other profiles when that one cannot be used. Without `failover` a named profile is the only one used. Without a `profile` every profile is tried whatever this says. From v0.3.6. |
| `transport` | string | automatic | The type of transport to connect over: `udp`, `udp-obfs`, `tls`, `ws`, `ws-plain`, `fronted` or `fronted-shaped`. Without it the node picks from every transport of the profile, as the apps do. A type outside `allow` is refused. From v0.3.6. |
| `exit` | string | the provider's default | The provider's exit to leave through. A change of `exit` alone is taken on the running tunnel: nothing leaves through the old exit meanwhile. Any other change makes the tunnel again. |
| `via` | outbound tag | none | A `direct` or `socks5` outbound for the fetch and for TCP transports. A proxy on a loopback, unspecified or link-local address is refused. |
| `allow` | list of up to 4 classes | empty | Transport classes besides `cover` that the node may use: `no_cover`, `exposed` and `plain`. |
| `allow_private` | bool | `false` | Whether the provider may have the node dial private addresses. |

Validation refuses a link that is not native, one whose key is not `signing_key`, a `preview` tag, two upstreams with one account or one device key, two exits for one upstream, and an unknown `via`. `veilway check` warns about an upstream that no exit names, one with no `exit` set, and one that an exit uses while `routing.fallback` exists, since users then fall back to it while the provider is down. The node keeps `upstreams.state` next to the usage state file. Removing an upstream through the control API is kept until the provider confirms, see the protocol page.

## `xray`

The Xray add-on: inbounds that the official `xray` binary serves, with users that are users of this node. It is off when the key is absent, and nothing runs until the add-on is installed, see the [Xray manual](../../manuals/xray/). The traffic of Xray's users goes only to the node, so the gate, rules, exits, quotas and counters apply to them as to a tunnel's users. (The unit does not keep Xray itself from the network, since `xray` outbounds need it to reach their providers.) An Xray user's traffic leaves through `netstack` exits only: `l3` and `chain` exits are not built for it.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `inbounds` | list of at most 16 | required | See below. |

```json
"xray": {"inbounds": [{
  "tag": "vless-443", "protocol": "vless", "listen": "0.0.0.0:8443",
  "tls": {"cert": "site.crt", "key": "site.key"},
  "decoy": "http://127.0.0.1:8080",
  "clients": [{"user": "alice", "secret": "5783a3e7-e373-51cd-8642-c83782b807c5"}]
}]}
```

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | Unique among the Xray inbounds. |
| `protocol` | `vless`, `trojan` or `shadowsocks` | required | VMess and Reality are not built. |
| `listen` | `ip:port` | required | The public listener of Xray. Unique among the Xray inbounds. A `shadowsocks` inbound uses its port for UDP as well, so no `udp` or `udp-obfs` transport of the node may share it. |
| `tls` | `cert` and `key`, both file paths | required for `vless` and `trojan`, not allowed for `shadowsocks` | The certificate chain and its key, as PEM files of at most 1 MiB. The node reads them and hands them to Xray. `self_signed` is not available here. |
| `decoy` | `http://` URL, as `decoy.origin` of `tls` | required for `vless` and `trojan`, not allowed for `shadowsocks` | Your own web server. After the TLS handshake, a connection that does not carry a user's credential goes to it. |
| `server_key` | 32 bytes as standard base64 (44 characters) | required for `shadowsocks`, not allowed for the others | Secret. The server's key of the cipher `2022-blake3-aes-256-gcm`. |
| `clients` | list of at most 65,536 | required | The users that may use this inbound. Each has `user` (the name of a user, once per inbound) and `secret`. |

The `secret` of a client is secret and unique within its inbound. For `vless` it is a UUID. For `trojan` it is a password of 22 to 128 characters from `A-Z a-z 0-9 _ - . + / =`. For `shadowsocks` it is a key of 32 bytes as standard base64 (44 characters).

Engine. The node leaves a user who is disabled, expired or over quota out of what Xray is given, and holds quota and expiry itself. A change of the section, or of the users it names, starts Xray again with a new document after 2 seconds without another change, and connections on it drop for that moment. Without the add-on's executable, or with no Xray host to ask, the node keeps running and Xray is not started.

## Reloading

Engine. The core reloads on `SIGHUP` and on an apply through the control API. It does not watch the file.

1. The core parses and validates the new document. An error leaves the running config in force and is logged once with the field path.
2. Prepare: every new listener is bound, every certificate loaded, every device and firewall change staged, while the old config keeps running. Any failure aborts the reload and the old config stays whole.
3. Commit: the new config replaces the old one in one step. The core logs which inbounds, outbounds, exits, rules and users were added, changed or removed, by tag or name.

After a commit:

- A flow belongs to a user and device, not to an address. A device is identified by its public key across reloads.
- Every live flow is checked again. It is reset when its exit is gone, its exit's backend or outbound changed, its destination no longer passes the gate, its user is no longer entitled to the exit, or the rules now decide differently for it.
- Changing an inbound's `private_key`, `address` or `mtu` restarts that tunnel and drops its sessions. Changing one transport restarts that transport only. Changing a tag is removing one object and adding another.
- Certificates are read again on every reload.
- A proxy inbound that changes closes its listener and its connections. See [Proxy inbounds](#reloading).
- A device's chosen exit is kept across a reload while it is still in the user's `exits`. One that is not is dropped and logged at info, and the device leaves through the user's exit. It does not come back when the exit is given back.
- A control connection proved one transport secret. When a reload removes that secret from the device, the connection is closed within a second and the secret opens no new one. A `udp-obfs` session opened with the removed secret ends at the reload, and an opening packet under that secret is a stranger's from then on. A session opened with the device's other secret stays up, and so does a tunnel that came over `udp`, where no secret opened it. Adding a second secret disturbs nothing.
- A `udp-obfs` transport that stays as it was keeps its sessions across a reload, also when `limits.sessions` or the inbound's `padding` change. New padding bounds apply to sessions opened afterwards. A transport whose `listen` changes, or whose tunnel restarts, loses its sessions, and its devices open new ones.
- A `tls` transport whose `listen` and `path` stay as they were keeps its sessions across a reload, also when its `limits`, its `decoy`, its certificate files, or the inbound's `upgrade_cookie`, `upgrade_headers` or `padding` change. The certificate and key files are read again at every reload, also at a `SIGHUP` on an unchanged config file, and connections made afterwards get the new certificate. A file that cannot be used refuses the reload and the certificate that runs stays. A new `path` ends the sessions that came in by the old one, which is the origin's from then on. Removing the transport closes its listener with every connection on it, except connections being relayed to the origin, which stay with it.
- A session opened with a `tls` proof ends at the reload that removes the transport secret it was opened with, like a `udp-obfs` session. Adding a key to `transport_keys` ends no session. Removing one ends, within a second, every session opened under it, and a token sealed to it opens nothing from then on. The keys of a session's chunks come from the key its proof was sealed to, so removing a key is the answer to one that leaked. Keep the old key in the list until every profile carries the new one, then remove and destroy it. Devices still connected under it connect again under the new one.
- A `ws` or `fronted` transport behind your web server whose `listen` and `path` stay as they were keeps its sessions across a reload. A session ends with its transport secret or its transport key, like a `tls` one. A new `path` ends the sessions that came in by the old one, which is the origin's from then on. A proxy taken out of `trusted_proxies` is a stranger from its next connection on. Removing the transport ends its sessions. Removing the last one on a listener closes the listener with every connection on it.
- The name of a `decoy.origin` is resolved at start and at every reload, and the header fields of the upgrade answer are asked for again.
- `replay.per_source` changes at once. `replay.cache` changes at the next start.
- An inbound whose `type` changes from `veilway` to `wireguard` loses its control channel: its connections are closed and the port is refused. The other way round, the port starts to answer. Sessions stay.
- Changed `notices` are sent to every open control connection.
- A link that keeps its `id` and its key keeps its state across a reload. A changed `xray` section, or a changed `xray` outbound, starts Xray again, see `xray` and "`xray` outbounds".
- DNS sets change without touching a tunnel or a session. You can add a set, remove it, give it other servers, or give it to other inbounds, groups and users. The next query of every user goes to the list the new config gives them.
- A user whose queries go to other servers than before loses the names the node remembered for them, so that no `domain` rule keeps matching on the word of a resolver that is no longer theirs. This is logged at info. What counts is the servers of the list the user's queries go to, looked at for each inbound their devices are on. Moving a user, a group or an inbound into, out of or between sets clears the memory, and so does changing the `servers` of the set they are on. The same holds for `dns.servers`: changing it clears the memory of every user who resolves through it, which earlier builds did not do. The same servers in another order, and another set with the same servers, are no change. `domain` rules match for that user again as their names are resolved again. Open flows are checked like after any reload.
- A query that is waiting for a server when the reload happens is answered by that server. Its answer is not remembered when the servers its user resolves through changed in the meantime.

## Commands

```
veilway run --config config.json
veilway run --config config.json --state veilway-state.json
veilway run --config config.json --replay /var/lib/veilway/veilway-replay
veilway run --config config.json --api /run/veilway/veilway.sock
veilway run --config config.json --no-api
veilway run --config config.json --addons /usr/local/lib/veilway/addons --xray-socket /run/veilway-xray/host.sock
veilway check --config config.json
veilway doctor --config config.json
veilway doctor --config config.json --json --timeout 3
veilway usage reset --user alice
veilway usage reset --user alice --totals --api /run/veilway/veilway.sock
veilway replay reset
veilway replay reset --yes
veilway schema
veilway genkey
veilway genkey --transport
veilway gensecret
veilway link offer --config config.json --tag to-exit --inbound links --name entry-1 --address 10.9.0.2 --transports transports.json
veilway link answer --config config.json --tag to-exit
veilway link remove --config config.json --tag panel --empty --apply
veilway mirror --config mirror.json
veilway mirror --config mirror.json --check
```

- `run` refuses a config file that group or others can read, unless you start it with `--allow-readable-config`.
- `run --state <file>` sets the path of the usage state file. Default: `veilway-state.json` next to the config file.
- `run --replay <file>` sets the path of the replay file. Default: `veilway-replay` next to the state file. Only a config with an obfuscated transport uses it, see `replay`.
- `run --api <path>` sets the unix socket of the control API. Default: `veilway.sock` next to the config file. `run --no-api` starts the node without the API. You cannot combine the two. Whoever can open the socket administers the node, see the control API reference. Both flags exist on Unix only.
- `run --addons <folder>` is the folder the Xray add-on is installed in (`/usr/local/lib/veilway/addons` by default). It must not be writable by the user the node runs as.
- `run --xray-socket <path>` is the socket of the Xray host that starts Xray (`/run/veilway-xray/host.sock` by default).
- `run --xray-dir <folder>` is the folder shared with Xray's user where the sockets of `xray` outbounds are made (`/run/veilway-xray-out` by default).
- Only a config with an `xray` section or an `xray` outbound uses these three, see `xray` and "`xray` outbounds". `veilway xray-host` is that host, which the install script runs as its own service on Linux.
- `check` prints every error and warning and exits with a non-zero status when there is an error. It gives the same answer on any operating system.
- `schema` prints the JSON Schema of this format.
- `genkey` prints a new WireGuard private key and its public key.
- `genkey --transport` prints a new node transport key for `transport_keys` of one inbound of one node, and its public half, which is what the profiles of that inbound carry. It is an X25519 key of its own and never a WireGuard key.
- `gensecret` prints a new transport secret for one device of a `veilway` inbound.

`doctor` tries what a config needs of this host and of the network, once, before you start the node or after it misbehaves. It needs no running node. It never changes the node, the host or any file, and it never prints a secret. A line names tags, user-chosen names, field paths and listen addresses, and no other value of the config.

- `--config <file>` is the config to check (`config.json` by default).
- `--state <file>`, `--replay <file>`, `--api <path>` and `--no-api` mean what they mean for `run`, with the same defaults. So do `--addons <folder>` and `--xray-dir <folder>`, which matter when the config has an Xray inbound or an `xray` outbound.
- `--json` prints one JSON document with the same lines in place of text.
- `--timeout <seconds>` is how long each step on the network may take, 5 by default and 10 at most.

Checks run a few at a time, so the command ends in well under a minute on a network that answers nothing.

`link remove` takes the link `--tag` out of this node's config, which ends it at once. On a node a panel manages, this is how the node leaves the panel. `--empty` also removes every user and the clients of the Xray inbounds. Without it the users stay and keep working, out of the panel's reach. It asks for `yes` first, or not with `--yes`. `--apply` (or `--apply=SOCKET`) changes the node that runs through its control socket. Without it the config file is changed, and the node reads it at its next reload or restart. A link that an exit still names is refused, and nothing is changed. Exit status: 0 removed, 2 not confirmed, 1 anything else

`link offer` and `link answer` pair this node with another one, one command on each node. Once both operators have compared the fingerprint, they print the entry for each node's `links`. Neither writes the config: you put the entry in yourself. Exit status: 0 paired, 2 not confirmed, 1 anything else.

| Flag | Meaning |
|---|---|
| `--config <file>` | The config of this node. Default: `config.json`. |
| `--tag <tag>` | The tag the link gets in this node's config. Required. |
| `--inbound <tag>` | `offer` only. The `veilway` inbound the link connects to, which carries no users' devices. Required. |
| `--reverse` | `offer` only. A reverse link: the other node dials and is the exit, and this node has the users. Without it the link is a forward one and this node is the exit. |
| `--name <label>` | `offer` only. This operator's label for the link, which the other operator is shown. Required. |
| `--address <ip>` | `offer` only. The address of the node that dials, from the inbound's pool: one, or an IPv4 and then an IPv6 one. Required. |
| `--listener-address <ip>` | `offer` only. In a reverse link, this node's own link address from the same pool, one for each `--address`. |
| `--transports <file>` | `offer` only. A JSON file with a list of the transports the other node may dial, in this node's order of preference and in the shape of `peer.transports`. Required. |
| `--mtu <n>` | `offer` only. The link's `mtu`, 1280 to 1500. |
| `--lifetime <seconds>` | `offer` only. How long the offer is good for, 1 to 3600. Default: 600. |

`usage reset` starts one user's quota count over on a running node. It talks to the node through the control socket, so it exists on Unix only and needs a node started without `--no-api`. It does not read or change the config file or the state file itself.

| Flag | Meaning |
|---|---|
| `--user <name>` | The user to reset. Required. |
| `--totals` | Also zero the user's lifetime totals (up and down, bytes and packets). Without it they are kept. |
| `--api <path>` | The control socket of the node. Default: `veilway.sock` next to the config file. |
| `--config <file>` | Only used to find the default socket path. Default: `config.json`. |

On success it prints one line with the new `used_bytes` and `period_start`. It says so if the user still cannot connect because they are disabled or expired. Errors go to standard error.

| Exit status | Meaning |
|---|---|
| 0 | The usage was reset. |
| 1 | Anything else: the node answered with another error, or did not answer within 30 seconds. |
| 2 | Wrong command line, for example no `--user`. |
| 3 | The running config has no user of that name. Nothing was changed. |
| 4 | No node answers on the socket: nothing is at the path, or a node that was killed left its socket behind. |
| 5 | This user may not open the socket. Run the command as the user the node runs as, or as root. |

Running it twice is safe: the second run sets the count to 0 again and changes nothing more.

`replay reset` empties the replay memory of a running node and sets its floor and its limit to the node's clock plus 60 seconds. Use it for a node whose floor is ahead of its clock, see `replay`. It talks to the node through the control socket, like `usage reset`. It never touches the replay file itself, because the node's next write would undo a file edited under a running node. With the node stopped, deleting the replay file has the same effect. Usage and quotas are not touched.

It costs two things, and the command prints them every time before it does anything:

- Every client is refused for 60 seconds.
- A proof that was accepted with a timestamp above the new floor is forgotten. Whoever recorded it can use it once more when the clock reaches that timestamp. That can only be a proof from the time the node's clock ran ahead.

| Flag | Meaning |
|---|---|
| `--yes` | Do it. Without this flag the command prints what a reset costs and changes nothing. |
| `--api <path>` | The control socket of the node. Default: `veilway.sock` next to the config file. |
| `--config <file>` | Only used to find the default socket path. Default: `config.json`. |

On success it prints one line with the new floor and limit and the node's clock.

| Exit status | Meaning |
|---|---|
| 0 | The replay memory was reset and its file is written. |
| 1 | Anything else. Either the node could not write the replay file: it then accepts no proof until it has written the floor and the limit it had back, and the reset has to be run again. Or the node did not answer within 30 seconds. |
| 6 | The node has not finished writing the reset after 10 seconds. The reset is in force when the write ends. Do not run the command again: that would cost another 60 seconds. `replay.resets` of `/v1/stats` grows by one when it has landed. |
| 2 | `--yes` was not given, or the command line is wrong. Nothing was changed. |
| 3 | The node keeps no replay memory, because it has run no obfuscated transport. |
| 4 | No node answers on the socket. |
| 5 | This user may not open the socket. |

Each `doctor` check prints one line: its status, the kind of check, what it looked at, and one sentence on what was found. On `warn` and `fail`, the sentence also says what to do about it. The checks run in this order:

1. The config file: its mode, and the validation report with every error and warning. A config that does not validate ends the run here, and everything after it is reported as `skipped`.
2. The control socket: whether a node answers on it. If one does, a listen address that is taken and an l3 interface that exists are expected, not failures.
3. Every listen address of every inbound: whether it can be bound right now, over UDP or over TCP as the transport needs. Transports that share an address are tried once.
4. Every certificate and key of a `ws` or `tls` transport: both load, the key matches the certificate, the certificate is not expired and not yet valid, and the names it covers. Under 14 days left is a warning.
5. The decoy origin of every `tls` transport, with two requests made the way the node makes its own. The first asks for the origin's page. An origin that is not reached, or does not answer as a web server, is a failure, because whoever is not a user would then be closed with no answer. An answer that redirects to an `https://` address is a warning: behind the node's TLS that redirect never ends. A field of `upgrade_headers` that the origin does not send is a warning. The line says which `Host` the request carried. The second asks for the path of the transport with a query that is no proof. The origin has to answer it itself, as it answers a path it does not have. An answer below 400 is a warning, since the origin must serve nothing there. A 5xx answer, or none in time, is a failure: an origin that hands the path on to the node would send every stranger's request round in a loop. The path is sent to the origin and printed nowhere. That request, with the path and a query of 144 letters, is in the origin's access log afterwards. `doctor` does not measure how long the origin keeps a connection that sends nothing.
6. The proxy path of every `ws` and `fronted` listener: whether anybody but this host can reach it, whether the web server in front speaks HTTP/1.1 to the node, and, from a running node, whether the requests it has read named their source in `client_address_header`. For a `fronted-shaped` transport the line also prints the shape the transport uses, so that you can compare it with the profile.
7. Every link that is enabled, without dialing anything: a clock that is set, whether an exit with a `chain` backend names each entry half, whether its `mtu` is below that of an inbound with users, and, from a running node, each link's state.
8. Every DNS server of the config, those of `dns.servers` and then those of every DNS set: one query over UDP and the same query over TCP from the node itself, with the answer time. The line of a server of a set names the set, as in `set family, servers[0], udp`. A server that stands in two lists is asked once for each. Silence over UDP is a failure when some exit leaves directly, and a warning otherwise. Silence over TCP is a warning, because answers too long for one datagram and every lookup through a SOCKS5 proxy need TCP.
9. Every outbound. An `xray` one is not tried, since its socket exists only while the node runs: its line says so, and the `xray` line described below says whether the add-on is installed. A `direct` one gets a TCP connect and a UDP exchange to the first DNS server it can reach from the node itself. A `socks5` one gets four separate lines: the TCP connect to the proxy, the handshake with the authentication of the config, a CONNECT through the proxy to the first DNS server with a real DNS query, and a UDP ASSOCIATE with a real DNS query through the relay, so a proxy without UDP shows as one clear warning on the last line. The relay must be on the host the control connection reached, as the node requires. These DNS servers are those of `dns.servers`. The servers of DNS sets are not tried through the outbounds. When the config has sets, a `skipped` line (`sets, through the outbounds`) after the DNS lines says so: where a set's queries leave through a proxy, doctor does not tell whether that proxy reaches the set's servers.
10. Every l3 exit (Linux only): `CAP_NET_ADMIN`, `/dev/net/tun`, `ip` and `nft` on the `PATH`, the forwarding sysctls as they are now and what the node would change with `masquerade`, and whether the interface name is free. When a running node has the exit and its interface is not there, a warning says the exit is down and being retried.
11. ICMP ping sockets, when a policy uses `icmp_echo: direct`.
12. The state file: a regular file or absent, a directory the user can write, the mode, and whether it parses.
13. The replay file, for a config with an obfuscated transport: a regular file or absent, a directory the user can write, whether it is a replay file, and its floor, its limit and the clock. A floor more than 80 seconds ahead of the clock is a failure, because the node then refuses every device for longer than any start costs. A floor up to 80 seconds ahead is what a start or a reset leaves, and the line says how long it lasts. A limit more than 80 seconds ahead of the clock is a warning: a clock ran ahead, and a node started on that file refuses every device until the clock passes the limit. A file that is not a replay file is a failure. Doctor reads the file and never moves or writes it.
14. The control socket path: what is there, and whether its directory can be written.

When the config has an Xray inbound or an `xray` outbound, `doctor` also checks the add-on right after the config file, in a line of the kind `xray`. It checks whether the executable is installed, is the pinned release and belongs to root. For an `xray` outbound it also checks the folder for the sockets (`--xray-dir`). It is a warning while the folder is not there yet, since the Xray unit makes it when it runs. It fails when the folder is not a folder, when its mode lets anyone but the owner and the group in or the group write to it (the mode is 750), when it belongs to root, or when the user `doctor` runs as is not in its group. Run `doctor` as the node's user, since root enters any folder. `scripts/veilway.sh addon xray install` sets the group and the folder up.

The four statuses: `ok` means the check passed. `warn` means the node starts and works, but something is likely not what you want. `fail` means the node would not start or would not work for the thing checked. `skipped` means the check was not tried because a step before it failed, or because of `--no-api`. A final line counts the statuses.

The exit status is 0 when nothing failed, 1 when a check failed (a config that reads but does not validate counts), and 2 when the config could not be read at all. Warnings do not change it.

## `veilway mirror`

`veilway mirror --config mirror.json` runs a relay mirror of a subscription endpoint, see [Relay mirrors](../../manuals/panel/#relay-mirrors). `--check` only validates the file and prints every error and warning. It exits with a non-zero status on an error. The file holds the secret it shares with the panel, so the command refuses a file that group or others can read. The file is JSON, unknown members are errors, and the command reads it once at start. The command exists on Unix only.

| Member | Default | What it does |
|---|---|---|
| `name` | none | The name the panel lists the mirror under in `trusted_mirrors`: 1 to 32 characters from `a-z`, `0-9`, `-` and `_`. |
| `listen` | none | The address the mirror listens on, plain HTTP. Use a loopback address and put your web server in front: another address is a warning. |
| `path` | none | The public path it serves, such as `/sub`: the path of the link's endpoint on the mirror's own domain. 2 to 128 characters from letters, digits and `- _ . ~ /`, with a leading slash and no trailing slash. Only a `POST` to exactly this path is forwarded. |
| `upstream` | none | The panel's subscription endpoint, an `https` URL with a path. The path names the endpoint: the panel tells its endpoints apart by path and never by the `Host` header, so it is the panel's `sub_path`, a slash and the endpoint's name. The chain of its certificate is always validated against the Mozilla roots. A query, a fragment, a user name and a host under `.invalid` (the template's placeholder) are refused. |
| `upstream_pins` | `[]` | Up to 4 SHA-256 hashes, in base64, of the SubjectPublicKeyInfo of the upstream's certificate. When given, the certificate must match one of them as well as validate. Empty is a warning. |
| `trusted_proxies` | `[]` | Up to 16 addresses and networks of your web server, none of them every address. Only they may connect, and only they are believed about the visitor's address. Empty is for a test with no web server: the mirror then answers requests it will not take with a 404 of its own. |
| `client_address_header` | `X-Forwarded-For` | The header the visitor's address is read from, as for the `ws` transport's `client_address_header`: 1 to 64 characters from `A-Z a-z 0-9 -`. |
| `secret` | none | 32 to 64 random bytes in unpadded base64url, the same as in the panel's `trusted_mirrors`. |

The mirror forwards a `POST` with `Content-Type: application/octet-stream` and a body of exactly 1,073 bytes, in HTTP/1.0 or HTTP/1.1. That body is a request sealed to the panel's gateway, which the mirror cannot open. The mirror hands back status 599 for the web server to answer in these cases: anything else, and every request while the upstream fails or answers with anything but a `200` with `Content-Type: application/octet-stream` and a body of 9,413, 36,979, 140,867, 538,201 or 1,089,437 bytes (a sealed answer), the panel's own 599 included. A sealed answer is passed on unchanged with that status and content type, and with `Cache-Control: no-store`. The panel is sent `X-Veilway-Mirror: v1;name;address;timestamp;nonce;mac`. There, `mac` is HMAC-SHA-256 under the secret over `veilway mirror v1`, then the name, address, timestamp (seconds), nonce (16 random bytes) and the SHA-256 of the body, each after a line feed. The nonce, the hash and the mac are in unpadded base64url. The panel accepts it within 60 seconds of its clock and once per nonce.
