---
title: Config reference
description: Every option of the Veilway server configuration, version 1.
---

The core reads one JSON document. It is the source of truth: the panel changes it through the control API, never by editing the file.

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

`version`, `dns`, `inbounds`, `outbounds`, `exits`, `routing` and `users` are required. `log`, `groups`, `notices`, `public_addresses`, `replay`, `links` and `xray` are optional.

This page is about the node's config. Endpoints, gateway keys, mirrors, relays and backups belong to the panel and are not keys of this document, see the [panel manual](../../manuals/panel/).

## Rules that apply everywhere

- **Strict JSON.** Unknown keys and duplicate keys are errors at every level. A byte order mark, data after the document, invalid UTF-8 and a NUL inside a string are errors. Where an integer is expected, only an integer token is accepted (`1`, never `1.0`).
- **Growth.** Version 1 only grows by new optional keys and new enum values. A build that meets a key or value it does not know refuses the file and says the config may be newer than the build.
- **Tags.** Inbounds, outbounds, exits, routing rules, DNS sets, links, tunnels and Xray inbounds each have a `tag` matching `[a-z0-9][a-z0-9_-]{0,63}`, unique within its section. These words cannot be tags: `all`, `any`, `block`, `reject`, `drop`, `local`, `direct`, `user`.
- **References.** Every tag, user name and group name used anywhere must exist. A dangling reference is an error.
- **Lists.** A list never contains the same entry twice. Inside a routing rule, a condition that is present must not be an empty list.
- **Canonical spelling.** Numbers inside strings (a port, a prefix length, a `lo-hi` range) have no sign and no leading zeros. A timestamp uses `T` between date and time.
- **Addresses.** IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) and addresses with a zone (`%eth0`) are errors everywhere. A network written with host bits set (`10.7.0.5/24`) is an error, except in an inbound's `address`, where the host part is the gateway. Port 0 is an error everywhere.
- **Secrets.** `private_key`, `preshared_key`, `transport_keys`, `transport_secrets`, `transport_secret`, `username`, `password`, `server_key` and the `secret` of an Xray client are secrets. No error, warning, log line or API response contains a field's value, only its path (`outbounds[1].password`) and what was expected. On Unix, `veilway run` refuses a config file that group or others can read unless started with `--allow-readable-config`; `veilway check` warns.
- **Keys.** A WireGuard key is standard base64 with padding, exactly 44 characters, decoding to 32 bytes. Keys are compared as decoded bytes. An all-zero key is an error.
- **Paths.** A file path in the config is relative to the directory of the config file. Absolute paths and any `..` component are errors.
- **Limits.** File at most 64 MiB and at most 8,000,000 JSON values. At most 64 inbounds with 8 transports each, 256 outbounds, 256 exits, 256 groups, 32 DNS sets, 4096 routing rules, 1024 entries in any list inside a rule, 65,536 users, 16 devices per user, 4 notices, 8 public addresses, 64 links, 64 tunnels and 16 Xray inbounds.
- **Errors and warnings.** Validation reports problems with the path of the field, at most 100 errors and 100 warnings followed by a count of the rest. An error refuses the config. A warning lets it load and is logged. Warnings are advice and are not part of the format.

## `version`

Must be the integer `1`.

## `log`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `level` | `error`, `warn`, `info`, `debug`, `trace` | `info` | Lowest level written. `RUST_LOG` overrides it when set. |
| `destinations` | bool | `false` | Whether log lines at any level may contain the destinations and DNS names users reach. Off by default at every level. |

## `groups`

A list of group names, each matching `[a-z0-9][a-z0-9._-]{0,63}`. A group must be declared here before a user or a rule may name it.

## `dns`

The node answers DNS for its tunnels at each inbound's gateway address.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `servers` | list of `ip:port`, 1 to 4 | required | Upstream resolvers, tried in order with 5 seconds each. |
| `hijack` | bool | `true` | Answer every UDP and TCP port 53 flow from a tunnel here, whatever address it was sent to. With `false`, only queries sent to a gateway address are answered and other port 53 traffic is routed like any flow. |
| `sets` | list of at most 32 sets | `[]` | Other lists of servers, each for the inbounds, groups and users it names. See DNS sets below. |

A server address may not be loopback, link-local, unspecified, broadcast, multicast, in `0.0.0.0/8`, or inside any inbound pool. An IPv6 address that embeds such an IPv4 address (IPv4-compatible, NAT64, 6to4, Teredo) is refused as well. The destination gate refuses all of these at run time, so such a server would resolve nothing.

Engine:

- A forwarded query is a flow from that user to the chosen server on port 53. It is routed by the rules like any flow, with `domain` conditions matched against the queried name, it must pass the destination gate of the exit it leaves through, and a `block`, `reject` or not-entitled result answers `REFUSED`.
- The node remembers, per user, which names it resolved to which addresses: at most 4096 entries per user, each kept for the answer's TTL clamped to between 60 and 3600 seconds. Only answers the node's own resolver obtained are recorded, and answers that contain pool, gateway, loopback or link-local addresses are not. Nothing is cached across users.
- The node sends each upstream query under an id it picks itself and accepts the answer only under that id. The first server whose rules refuse the query ends it with `REFUSED`; only a silent server moves on to the next.
- A query name that is not a valid rule domain (for example one with an underscore label) is still forwarded, but no `domain` condition matches it and it is not remembered. A memory entry is one name with one address.
- At most 64 queries of one user wait at once; more are answered `SERVFAIL`. Over TCP a query may be 1500 bytes and a connection carries at most 128 queries.
- With `hijack` on, rules with `port: [53]` never see tunnel DNS, and port 53 traffic that is not DNS is dropped. DNS over TLS and DNS over HTTPS pass untouched, and `domain` rules cannot see names resolved that way.

### DNS sets

A set is a named list of upstream servers for some of the node's users: a filtering resolver for a `family` group, an ad-blocking resolver for a few users, another resolver for one inbound. `servers` stays the list for everybody no set speaks for, and a config without `sets` behaves as it always did.

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
| `servers` | list of `ip:port`, 1 to 4 | required | Tried in order with 5 seconds each. The address rules of `dns.servers` apply. The same server may stand in several lists. |
| `inbounds` | list of inbound tags | `[]` | Queries that come through these inbounds use the set. |
| `groups` | list of group names | `[]` | Users in these groups use the set. |
| `users` | list of user names | `[]` | These users use the set. |

Which list a query goes to, most specific first:

1. the set that names the user;
2. otherwise the set that names one of the user's groups;
3. otherwise the set that names the inbound the query came through;
4. otherwise `dns.servers`.

Steps 1 and 2 belong to the user. Step 3 belongs to the query: a user with devices on two inbounds, whom no set names by user or group, uses the list of whichever inbound a query comes through.

Validation makes the answer the same whatever the order of the sets:

- Error: an inbound, a group or a user is named by two sets, or twice in one list. The error gives the path of the first entry.
- Error: a user whom no set names is in groups that two different sets name. The error is at that user's `groups` and gives the paths of the two entries. Name the user in the `users` of one set, or keep the groups in one set.
- Error: a name no inbound, group or user has.
- Error: `hijack` is `false` and `sets` is not empty. With `hijack` off a device reaches any resolver it likes by sending its queries to another address than the gateway, so a set would decide nothing.
- Warning: a set no query goes to. It names nobody, or the groups it names have no user and every user of the inbounds it names goes by a set that names them or one of their groups.

A set covers the DNS the node answers, which with `hijack` on is every UDP and TCP port 53 flow of a tunnel. DNS over TLS and DNS over HTTPS are not that: a device that uses them steps around its set, as it steps around `domain` rules. Where a filtering set has to hold, refuse those too, for example with a rule that rejects TCP and UDP port 853 and rules for the addresses of the public DoH resolvers.

Engine:

- Everything this section says about `dns.servers` holds for the servers of a set, with nothing taken away. A forwarded query is a flow from that user to the chosen server on port 53, routed by the rules, checked by the destination gate and by entitlement. The name memory, the limits, the ids and the TCP fallback are the same.
- A set never falls back. When none of its servers answers, the query is answered `SERVFAIL`, and when the rules refuse a server it is answered `REFUSED`, as with `dns.servers`. The node never asks `dns.servers` or another set in its place: a filtering resolver that could be stepped around whenever it is down would filter nothing.
- `hijack` is one setting for the whole node, not one per set, and it has to be on for a config with sets.
- The name memory belongs to the user, whichever list answered. See Reloading for what happens to it when the servers a user resolves through change.
- A log line that names a user and is about a query also names the set the query used. The info lines about a server that stopped answering, or answers again, name the list and the server's place in it (`server 2 of 2 of dns set family`), and both lines of one server read the same. A server that stands in two lists is counted in each by itself. No line shows a queried name or a server address unless `log.destinations` is on.

## `inbounds`

An inbound is one tunnel: one key, one address pool, reached over one or more transports. A device keeps the same tunnel address whichever transport it uses.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | |
| `type` | `wireguard` or `veilway` | required | `wireguard`: stock WireGuard peers. `veilway`: the same tunnel, with the control channel at its gateway address, see "The control channel" below. Changing the type restarts nothing. |
| `private_key` | key | required | The tunnel's static key. Secret. Unique across inbounds, compared by the public key derived from it. |
| `address` | list of 1 or 2 networks | required | The gateway address with its prefix, at most one IPv4 and one IPv6, for example `["10.7.0.1/24", "fd7a:115c:a1e0::1/64"]`. The network is the address pool for this tunnel. |
| `mtu` | integer 1280 to 1500 | `1420`, or `1390` for a `veilway` inbound with a `udp-obfs` transport | MTU inside the tunnel. Above 1420 is a warning, since the outer packet then fragments on a normal path, or is lost on a `veilway` inbound, which never fragments. With a `udp-obfs` transport the warning starts above 1390: a full-size packet then does not fit a 1500 byte path over IPv6. |
| `padding` | object | see below | The upper bounds of the padding the node puts on what it sends over `udp-obfs`, `tls`, `ws` and `fronted`: `wide` from 512 to 1023 (default 1023) and `normal` from 64 to 255 (default 255), both optional. On an inbound with none of these transports the key is a warning. See `udp-obfs` below. |
| `transport_keys` | list of 1 or 2 keys | none | Secret. The node transport keys, private halves. Required for an inbound with a `tls`, `ws` or `fronted` transport, whose devices seal their proof to one of them. `veilway genkey --transport` prints one with its public half, which is what a profile carries. Two are for rotation: removing one ends the sessions that were opened under it. No WireGuard key of the config is one, no transport secret is one, and no two inbounds share one. On an inbound without such a transport the key is a warning. See `tls` below. |
| `upgrade_cookie` | 1 to 32 characters from `A-Z a-z 0-9 _ -` | none | The name of the cookie on the upgrade answer of a `tls` or `ws` transport. Required with one, and it has no default, so that not every node sends the same name. Choose a name your own site could use. An inbound with `fronted` alone needs none. |
| `upgrade_headers` | list of at most 16 header field names | `["Server", "Date"]` for `tls`, none for `ws` | The header fields the upgrade answer of a `tls` or `ws` transport takes from the decoy origin, in this order. Behind a web server the list is empty unless you set it, because that web server adds its own fields. See `tls` below. |
| `transports` | list of 1 to 8 | required | See below. |

Rules for `address`:

- IPv4 prefix from /16 to /30, inside `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` or `100.64.0.0/10`. IPv6 prefix from /48 to /126, inside `fc00::/7`.
- The gateway is a host address in the pool, never the network address and, for IPv4, never the broadcast address.
- Pools of different inbounds do not overlap.

Who may use an inbound is decided by addresses alone: a device belongs to the inbound whose pool contains its address.

### The control channel

Engine. On a `veilway` inbound the gateway address also answers the control channel of the [protocol](../../protocol/control-channel/): TCP port 47873, and UDP port 47873 for MTU probes. Both sides are built: the client engine speaks it inside the tunnel.

- **Who reaches it.** A device, from its own tunnel address, at the gateway of the inbound it is connected through. The gateway of any other inbound refuses the port, and so does every `wireguard` inbound. It is handled before the routing rules, like gateway DNS: no rule blocks, redirects or opens it, and `dns.hijack` does not touch it. Its bytes count as usage like any others.
- **Who is let in.** A connection must prove one of the device's `transport_secrets` within 10 seconds, in an exchange that is bound to that device's and that inbound's keys. Anything else is closed with no answer. A device may have 4 connections that have not proven it and 2 that have; one more replaces the oldest.
- **What it gives.** The device's addresses, gateway and MTU as the node holds them, the exits of its user's `exits` (tag, `name`, `country`, whether it carries every IP protocol, whether it is up), its user's usage and quota, and the `notices`. A reload sends again what it changed. Usage is sent again when it changed, at most once every 30 to 90 seconds, and never because of the channel's own traffic.
- **Choosing an exit.** A device may choose which exit the action `"user"` means for it, among its user's `exits`. The choice belongs to that device only. It moves the flows that the rules send to `"user"` or that match no rule: those are reset and leave through the new exit from their next packet. A flow a rule sends to a named exit is not touched. A device without a choice leaves through `users[].exit`, then `routing.default`, as before. A choice goes into the state file at its next regular write, not at once: a node that is killed within those 10 seconds forgets it, and the device chooses again.
- **MTU.** A device may probe which packet size its path carries and set the MTU of its own tunnel, from 1280 to the inbound's `mtu`. The node then sends that device nothing larger: TCP it ends itself keeps to the segment size the device announces, what else the node sends itself it fragments, IPv4 that it forwards and that allows it is fragmented, and the sender of anything else gets "fragmentation needed" or "packet too big". The value is forgotten when the device has had no session for 180 seconds. A device with addresses in two `veilway` inbounds has one MTU, one chosen exit and one set of limits for both. A probe applies on `udp` and `udp-obfs`. On Linux the node prohibits fragmentation of everything it sends from the `udp` and `udp-obfs` sockets of a `veilway` inbound, so a packet that does not fit the path is lost and a probe measures what the path carries. On another system it cannot, and says so in a warning at start: there a probe can pass a path that fragments it. Over `udp-obfs` a probe leaves with no padding around it.
- **Being cut off.** Before a device is cut off (quota, expiry, disabled or removed, or the node stops) the node writes it the reason. The cut-off does not wait for that.
- **Limits.** 10 requests at once and then one a second for a device, 3 exit changes and then one in 5 seconds, one probe run a minute. Over a limit a request is answered "rate limited" and does nothing.
- **What is logged and counted.** A channel that opens or closes, an exit that is chosen or dropped and an MTU that is set are logged at info with the user and device name, at most 6 such lines at once for one device and then one in 30 seconds; the rest go to debug and the next line says how many. Nothing of it names a destination. Counters are in `control` of `/v1/stats`, and `/v1/sessions` shows each device's chosen exit, open control connections and MTU.

### `transports`

| `type` | Keys | Meaning |
|---|---|---|
| `udp` | `listen` (`ip:port`) | Plain WireGuard datagrams. |
| `ws` | `listen` (`ip:port`), `path`, optional `tls` with `cert` and `key` (both required) | One WireGuard datagram per binary WebSocket frame. Without `tls` it serves plain `ws` for a reverse proxy that terminates TLS; validation warns when such a listener is not on a loopback address. |
| `udp-obfs` | `listen` (`ip:port`), optional `limits` with `sessions` (1 to 1,048,576, default 16,384) | Every WireGuard datagram inside the `udp-obfs` envelope of the [protocol](../../protocol/transports/), keyed by the device's `transport_secrets`. Only on a `veilway` inbound. See `udp-obfs` below. |
| `tls` | `listen` (`ip:port`), `path`, `tls` with `cert` and `key`, `decoy` with `origin` and optional `proxy_protocol`, optional `limits` with `sessions`, `undecided`, `undecided_per_source` and `relayed` | The WebSocket session of the [protocol](../../protocol/transports/) inside TLS that the node ends itself. Whoever is not a user is handed to the decoy origin. Only on a `veilway` inbound. See `tls` below. |
| `ws` with a `decoy` | `listen` (`ip:port`), `path`, `decoy`, `trusted_proxies`, optional `client_address_header`, optional `limits`. No `tls` key. | The same WebSocket session behind your own web server, which ends TLS. Only on a `veilway` inbound. See "`ws` and `fronted` behind your web server" below. |
| `fronted` | the keys of `ws` with a `decoy` | Polling with HTTP requests, for a CDN that allows neither WebSocket nor long-lived connections. Only on a `veilway` inbound. See the same section. |

`ws` is two transports under one name, and its keys say which one it is. Without `decoy`, `trusted_proxies`, `client_address_header` and `limits` it is the `ws` of a `wireguard` inbound, which carries WireGuard datagrams as they are. With any of them it is the native `ws` of a `veilway` inbound, which needs `decoy` and `trusted_proxies` and takes no `tls`. Validation refuses each on the other kind of inbound and never takes one for the other.

A `veilway` inbound takes `udp`, `udp-obfs`, `tls`, the native `ws` and `fronted`. A `wireguard` inbound takes `udp` and the `ws` without a decoy: its devices have no transport secret for the others to be keyed with.

`path` starts with `/`, is at most 256 bytes from `A-Z a-z 0-9 . _ ~ / -`, has no `..` component, and is matched exactly against the request path before any `?`. On `tls`, the native `ws` and `fronted` it is at least 12 bytes.

Engine: a `ws` connection that does not finish the WebSocket upgrade within 10 seconds is dropped, and one source (an IPv4 address or an IPv6 /64) may have 64 unfinished upgrades at once. This also applies to a reverse proxy in front of a plain `ws` listener, whose connections all come from one source.

Listen conflicts, across all inbounds:

- IPv6 sockets are always IPv6-only, so `0.0.0.0:443` and `[::]:443` do not conflict. A wildcard address conflicts with every address of its own family on the same port.
- Two `udp` or `udp-obfs` transports never share an address and port, in any combination.
- Two `ws` transports may share an address and port when their `path` differs and their `tls` is identical. Otherwise they conflict.
- Two `tls` transports may share an address and port when their `path` differs and their `tls`, `decoy` and `limits` are identical: they are two paths of one listener. Otherwise they conflict.
- The `ws` and `fronted` transports of `veilway` inbounds may share an address and port when their `path` differs and their `decoy`, `trusted_proxies`, `client_address_header` and `limits` are identical: one listener, to which the web server hands a `GET` for one path and a `POST` for another.
- A listener serves one kind of peer. A `tls` transport, a `ws` transport of a `wireguard` inbound, and the `ws` and `fronted` transports of `veilway` inbounds never share an address and port with one another.

### `udp-obfs`

Engine. Both sides are built, the node's listener and the client's. The [transports page](../../protocol/transports/) is the specification, and it is a draft that nobody outside the project has reviewed. `udp-obfs` hides WireGuard's fixed bytes and sizes from an observer without a subscription. It imitates nothing, and its rating is Detectable.

```json
{"type": "udp-obfs", "listen": "0.0.0.0:51821", "limits": {"sessions": 16384}}
```

- **Who is let in.** A device opens a session with one opening packet that only a holder of one of its `transport_secrets` can make. The session then carries that device's WireGuard and no other device's. The node sends nothing on a session until a WireGuard packet of that device has authenticated on it.
- **What a stranger gets.** Nothing. Whatever is not a valid packet of a device gets no answer and no log line, and is counted by reason in `udp_obfs` of `/v1/stats`.
- **Replay.** An opening packet is accepted once, also across restarts. That needs the replay file, see `replay` below. A node does not start a config with a `udp-obfs` transport without a replay file it can write and lock. An opening packet from a device whose clock is ahead of the node's limit is kept, at most 64 of them for at most 2 seconds, until the limit is written, and then answered at its own source. One that a limit refuses is recorded as used all the same, so that nobody who saw it can use it later.
- **Being cut off.** Whenever the node cuts a device off (its user is disabled, expired, over quota or removed, the device is removed, or its addresses, its preshared key or its key change), every `udp-obfs` session of that device ends with its tunnel, and so does a session whose transport secret was removed.
- **Packets that cannot be sent.** A `veilway` inbound never fragments. A packet larger than the host's interface carries is refused by the system, counted in `send_failed` of `/v1/stats` and logged at info once a minute. Lower the inbound's `mtu` when that counter grows.
- **Limits that are fixed.** A device may have 2 sessions that are not yet established and 8 that are, and 16 accepted opening packets at once and then one a second. One source address and port may have sessions of 4 devices. A session ends 10 seconds after its opening packet if WireGuard has not authenticated on it, and after 180 seconds without an authentic WireGuard packet. The idle time of the client's keepalive is well below that.
- **`limits.sessions`.** How many established sessions the listener holds at once. When it is full, new opening packets are refused, and nothing a stranger does takes a place.
- **`padding`.** The node pads what it sends, inside the encryption. `wide` bounds the padding of the first 16 packets of a session, of every WireGuard handshake message and of every control channel packet. `normal` bounds the rest. A full-size packet carries none: no packet is larger than `mtu` + 62 bytes. Change them so that not every node shows the same ranges.
- **`mtu`.** `udp-obfs` adds 62 bytes around a tunnel packet, 30 more than `udp`. The default `mtu` of a `veilway` inbound with a `udp-obfs` transport is therefore 1390. Adding the transport to an inbound that has no `mtu` written changes its `mtu` from 1420 to 1390, which restarts the tunnel once.
- **The clock.** A device and the node must agree on the time within 60 seconds. A node whose clock is wrong refuses its devices, and a clock that ran ahead can leave the node refusing everybody after it is put right, see `replay`. Run the node with a synchronized clock.
- **What is logged.** At info: a listener that starts, sessions that a reload ended, a session that reached the packet limit of its keys. At warn or error: a tag table that was built late, and everything about the replay file. No line names a client address, a tag or a secret.

### `tls`

Engine. Both sides are built, the node's listener and the client's. The [transports page](../../protocol/transports/) is the specification, and it is a draft that nobody outside the project has reviewed.

A device reaches its tunnel through a WebSocket connection inside TLS, on a name and a certificate of your own. Everybody else who connects is handed to your own web server, the decoy origin, and gets what that server answers.

**`tls` is rated Detectable, and stays so in version 1.** The TLS handshake a visitor meets is the node's own and not your web server's, and a prober needs no subscription to see that the handshake and the site behind it do not match. The decoy makes the HTTP answer your site's. It does not make the handshake your site's. If you want a handshake that matches the site, use the native `ws` behind the web server that serves the site, see "`ws` and `fronted` behind your web server" below.

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
| `path` | 12 to 256 bytes from `A-Z a-z 0-9 . _ ~ / -`, starting with `/`, no `..` component | required | The path a device's request names. It is known to whoever holds a subscription. Choose one your site does not have. |
| `tls` | `cert` and `key`, both file paths | required | The certificate chain and its key, as PEM files. Version 1 has no built-in issuance from an authority: get the certificate with your own tooling, and renew it the same way. On a native `tls` transport `self_signed: true` may stand instead of `cert` and `key`: the node then makes its own self-signed key and certificate, keeps them next to the config file with mode 600, renews the certificate with the same key, and reports the pin (the SHA-256 of the SubjectPublicKeyInfo) in `veilway doctor` and in the control API's status. `name` (optional, with `self_signed` only) is the host name the certificate carries, a lowercase DNS name of at most 64 characters; without it the node draws one. The files are `tls-<inbound tag>.key` and `.crt`. A node that runs never makes a new key: if the key file is gone or changed, it keeps the current certificate and logs a warning, since the pin would change. Node links and pairing refuse `self_signed` candidates. See the transports page of the protocol specification. |
| `decoy.origin` | `http://` URL with an address or a name and an optional port, nothing behind it | required | Your own web server. There is no default and no other kind of decoy. |
| `decoy.proxy_protocol` | bool | `false` | Send the PROXY protocol header, version 2, at the start of every connection to the origin. |
| `limits.sessions` | integer 1 to 1,048,576 | `16384` | Established sessions the listener holds at once. |
| `limits.undecided` | integer 1 to 65,536 | `512` | Connections that have not sent their request line yet. |
| `limits.undecided_per_source` | integer 1 to `undecided` | `64` | How many of those one source may have. A source is an IPv4 address or an IPv6 /64. |
| `limits.relayed` | integer 1 to 65,536 | `1024` | Connections that are relayed to the origin. |

**What the decoy origin must be.**

- **It is your own web server**, on the same host or one you control, serving real content under your own name. Relaying strangers to somebody else's site is not an option of this version. Validation warns when the origin is not a loopback or private address, and when it is a name.
- **It is reached over plain HTTP.** An `https://` origin is refused in this build. Put the origin on a loopback address: what strangers send travels to it as it is.
- **It must serve the site there, and not redirect to `https://`.** A stranger arrived over TLS and is handed to a plain listener. The usual plain listener of a site answers everything with a redirect to its `https://` address, and through the node that redirect comes back on every request, which no web site does. The origin has to be a plain listener that serves the site as its HTTPS listener does. `veilway doctor` warns when the origin redirects to `https://`.
- **Which site it serves.** A stranger's request reaches the origin with the `Host` the stranger sent. The node's own requests, and those of `veilway doctor`, carry the host of the `decoy.origin` URL as `Host`. On a web server with several sites, make the site you mean the default of that listener, or the two may see different sites.
- **It must not be the node.** Validation refuses an origin whose address and port the node itself listens on, and a name is held to the same when it is resolved, at start and at every reload. A listener on a wildcard address refuses an origin on a loopback or wildcard address with its port, and not one on another host.
- **It sees a connection for every user too.** The node opens a connection to the origin for every connection it accepts, before it knows who is there, and closes it unused when a user was there. The origin's log has no request for it. With `proxy_protocol` that connection carries the user's address.
- **It must not hand the path back to the node**, and it must serve nothing at the path: a request for the path without a valid proof has to get the site's own not-found answer. If your web server also forwards something to the node, the origin is a second listener of that web server without the forwarding rule. `veilway doctor` asks the origin for the path and says what it finds.
- **It keeps its own limits.** The node puts no limit on the size or the lifetime of a relayed connection: your site's own timeouts and limits decide, as they do for its direct visitors. With `proxy_protocol` the site sees each stranger's address and can apply limits per address. Turn it on only when the origin expects the header on that listener: an origin that does not expect it answers every relayed request with an error. The node's own requests carry the node's address.

**What happens to a connection.**

- **Who is let in.** A device sends a WebSocket upgrade request for `path` with a proof in its query: a token that only a holder of one of the device's `transport_secrets` can make, sealed to one of the inbound's `transport_keys`, valid once and for about a minute. The node decides at the end of the request line. An accepted proof gets the upgrade answer, and then the connection carries that device's WireGuard and no other device's. The node sends nothing more on it until a WireGuard packet of that device has authenticated.
- **What everybody else gets.** The origin's answer, and nothing of the node's: no status line, no header field and no error page. Every byte the peer sent goes to the origin unchanged, and from then on the node relays both directions blindly until either side closes. Everything the origin sends is passed on at once, and when the origin closes, the peer is closed once it has been given all of it, however slowly it reads. An origin that resets the connection resets the peer's. This holds for a browser, for garbage, for a wrong path, for a wrong or used proof, and for the proof of a device that was removed or whose user is disabled, expired or over quota: they all look like a visitor who asked for a page the site does not have.
- **What this does not hide.** The TLS handshake is the node's, as said above. An answer through the node is later than one from the origin by the hop between them. The node offers `http/1.1` only, and TLS 1.2 and 1.3 as its library does: a client that offers only `h2` gets a TLS alert, and plain HTTP sent to the port gets the library's alert where a web server sends an error page. A proof under TLS 1.2 is never accepted. When the origin answers before it has read a whole upload and closes its side, the node closes the peer's connection then, where a web server that lingers would take the rest of the upload first.
- **An origin that gives a connection up first.** The node watches the origin while a request line is not complete. When the origin says something or closes in that time, as a web server does with a connection that sends nothing, the peer is given that at that moment, and the connection is not a user's. A request line that is complete is always looked at first. An origin that closes connections before a request can arrive would therefore cost users an attempt now and then: a web server does not, and its timeout for a request head should not be shorter than a second or two.
- **When the origin is down.** Whoever is not a user is closed with no answer, which tells the node from a web site for as long as it lasts. It is counted in `stream.decoy_down` of `/v1/stats` and logged at warn once a minute, and at info when the origin is back. Users are not affected.
- **The upgrade answer.** After the status line it carries the fields of `upgrade_headers` in that order: `Date` with the node's time, and every other field with the value your origin sent for it, spelled as the origin spelled it. A field the origin did not send is left out. Then come the three fields of the upgrade and one cookie named `upgrade_cookie` with a random value of a random length. The node asks the origin once for its page at start and at every reload to learn those values. While that has not worked the answer carries only `Date` of the list, which is logged at warn, and the node asks again every 60 seconds. `upgrade_headers` may not name `Upgrade`, `Connection`, `Sec-WebSocket-Accept`, `Set-Cookie`, `Content-Length`, `Transfer-Encoding`, `Content-Type`, `Content-Encoding`, `Trailer` or `Keep-Alive`, and no name twice.

**Limits.**

- **The pools.** A connection that has not sent its request line is undecided. When the listener has `limits.undecided` of them, or one source has its share, the oldest is decided as "not a user" at once to make room. One that is still inside its TLS handshake is closed. When `limits.relayed` connections are relayed, the one that has been idle longest makes room, or the oldest when none has been idle for 60 seconds. It is closed at once, with nothing more sent. When `limits.sessions` sessions are established, new proofs take the decoy path. Nothing a stranger does takes the place of a session.
- **Limits that are fixed.** A TLS handshake has 10 seconds, a request line 4,096 bytes and 10 seconds, and a user's request head 16,384 bytes and 10 seconds. A device may have 2 sessions that are not yet established and 8 that are, and 16 accepted proofs at once and then one a second. These count across `udp-obfs` and `tls` together. A session ends 10 seconds after its proof if WireGuard has not authenticated on it, and after 300 seconds without a chunk. Each connection has a send queue of 256 packets, and what does not fit is dropped and counted, as on a real network.
- **Replay.** A proof is accepted once, also across restarts, which needs the replay file, see `replay`. A proof from a device whose clock is ahead of the node's limit waits for the limit to be written, 2 seconds at the most, and 64 of them at once for a listener. Each holds its connection outside the undecided pool while it waits.
- **Being cut off.** Whenever the node cuts a device off, every `tls` session of that device ends within a second, and so does a session whose transport secret was removed, and one that was opened under a node transport key the config no longer has. A session ends the same way for every cause: a WebSocket Close frame, then TLS and TCP in the normal order.
- **`padding`** bounds the padding of what the node sends, as for `udp-obfs`. A stream has no packet size to keep to, so the inbound's `mtu` default stays 1420 with `tls` alone.
- **The address.** A `tls` transport on an address that also has a `udp`, `udp-obfs` or `ws` listener marks that address for whoever watches it. Put it on an address of its own if you can.
- **What is logged.** At info: a listener that starts, sessions that a reload ended, an origin that is reached again. At warn: an origin that cannot be reached, a key file that group or others can read, header fields that could not be learned. Nothing is logged for a single connection, and no line names a client address, a path, a token or a key. Counters are in `stream` of `/v1/stats`.

### `ws` and `fronted` behind your web server

Engine. Both sides are built, the node's listener and the client's. What is described here was tested against a small web server and a small reverse proxy written for the tests, and with nginx in front of the node and nginx or HAProxy behind it, in containers on one machine. Neither transport has run behind a CDN, on a real network, or in front of a real site. The [transports page](../../protocol/transports/) is the specification, and it is a draft that nobody outside the project has reviewed.

Your own web server ends TLS, with the name and the certificate of your site, and hands two paths to the node over plain HTTP on the loopback. Everything else it serves as before. The node never ends TLS on these transports. A device reaches its tunnel through one of the two paths, and every other request the web server hands to the node is answered by your site, through the node, exactly as your site answers it.

- **`ws`** is the WebSocket session of `tls` with the web server's TLS in place of the node's. Use it wherever a WebSocket connection gets through, with or without a CDN in front of the web server.
- **`fronted`** carries the tunnel in the bodies of `POST` requests and their answers. It is for a CDN that allows neither WebSocket nor long-lived connections. It is slow, it makes many requests, and it is the transport of last resort. Check the terms of the CDN before you use it this way.

**Both are rated Detectable.** The handshake is your web server's, which `tls` cannot offer. What is left is stated on the [transports page](../../protocol/transports/): a request for one fixed path with a long random query, a long-lived connection or a steady rhythm of small requests to one host, and the sizes and times of what flows. Nothing here has been measured, and no text may claim more than Detectable for either.

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
| `listen` | `ip:port` | required | Where the node takes plain HTTP from your web server. A loopback address: anything else is a warning, because tokens, session ids and your site's pages then cross the way between the two unprotected. A unix socket is not built. |
| `path` | 12 to 256 bytes from `A-Z a-z 0-9 . _ ~ / -`, starting with `/`, no `..` component | required | The path as the web server hands it to the node. If the web server rewrites the path, this is the rewritten one. Choose one your site does not have. |
| `decoy.origin`, `decoy.proxy_protocol` | as for `tls` | required, `false` | Your own web site, on a plain listener of its own. See "What the decoy origin must be" under `tls`, and below. |
| `trusted_proxies` | list of 1 to 64 addresses or networks | required | Where your web server connects from: `["127.0.0.1"]` on one host. Only a connection from one of these can bring a user, and only from these is `client_address_header` believed. Everybody else who reaches the listener is a stranger and gets the origin's answer. A network of every address (`0.0.0.0/0`, `::/0`) is refused, and so is a list whose networks cover every address between them. An entry that is neither a loopback nor a private address is a warning: every host inside it can bring a user and is believed about where a request came from, and requests cross the way from it to the node as plain HTTP. |
| `client_address_header` | header field name | none | The field in which your web server names the address a request came from, such as `X-Forwarded-For`. The node takes the rightmost address in it that is not one of `trusted_proxies`. Without the key, or when a request has no such field, the request counts as the web server's own, and the limits per source are one limit for everybody. Validation warns when the key is missing. |
| `limits.sessions` | integer 1 to 1,048,576 | `16384` | Established sessions the listener holds at once, `ws` and `fronted` together. |
| `limits.fronted_sessions` | integer 1 to 65,536 | `1024` | How many of them may be `fronted` sessions. Each keeps its last answer, up to 65,536 bytes, and a digest of its last request. A full pool of 1,024 holds up to 64 MiB of answers. Above 4,096, which is 256 MiB, validation warns and says how much the pool you ask for holds. |
| `limits.proxy_connections` | integer 2 to 65,536 | twice `fronted_sessions` | Connections of your web server the listener holds at once. When all are taken, the node stops accepting and leaves new ones in the system's queue. A `ws` session takes its connection out of this count. |
| `limits.decoy_requests_per_source` | integer 1 to 65,536 | `16` | Requests of one source that may wait for the origin at once. One more closes the connection of the oldest. All strangers together have half of `proxy_connections`. |
| `limits.undecided`, `undecided_per_source`, `relayed` | as for `tls` | as for `tls` | The pools for peers that reach the listener from outside `trusted_proxies`. |

Transports that share a listener have the same `decoy`, `trusted_proxies`, `client_address_header` and `limits`.

**The web server in front.** An example for nginx, with the site and the node on one host. The first server is the site as the world sees it. The second is the same site on a plain loopback listener, without the two rules that hand a path to the node: that one is the decoy origin.

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
        proxy_set_header Host $host;
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
        proxy_set_header Host $host;
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

What the example does, and why:

- **`proxy_add_x_forwarded_for`** puts the address the web server took the request from at the right end of `X-Forwarded-For`, behind whatever the visitor sent in that field. The node reads from the right and passes over the addresses in `trusted_proxies`, so a visitor cannot name an address for itself. Behind a CDN, add the CDN's ranges to nginx's own `set_real_ip_from` and `real_ip_header`, so that the address nginx adds is the visitor's and not the CDN's. `veilway doctor` says whether a node that runs has found the field in the requests it read.
- **`access_log off`** on the two paths keeps the query, which is a token or a session id, out of the web server's log. A token that was logged and never reached the node can be used once by whoever reads the log, within about a minute.
- **`keepalive`** and `proxy_http_version 1.1` let the web server keep its connections to the node, which `fronted` needs: it makes one request after another for as long as the tunnel is up. The node keeps a quiet connection of the web server for 300 seconds.
- **`proxy_http_version 1.1` is not optional.** A request that reaches the node as HTTP/1.0 is never a user's, so a web server that speaks HTTP/1.0 to the node, which nginx does unless it is told otherwise, shuts every user out and shows nothing else for it. The node counts such requests (`proxy_http10` in `/v1/stats`), and `veilway doctor` says so when a node that runs has seen any.
- **`proxy_read_timeout`** on the `ws` path is above the 300 seconds a session may be quiet for.
- **Only the two paths go to the node** in this example, and a request for either of them without a valid proof comes back with the origin's own not-found answer. You may hand more to the node, or everything: whatever is not a user's is answered by the origin through the node. What must not happen is the origin handing a path back to the node, which is why the origin is a listener without the two rules.

**What the decoy origin must be** is what `tls` says, with three differences:

- A visitor arrived over your web server's TLS, so the origin is the plain listener behind it and must serve the site as the first server does, without a redirect to `https://`.
- The node opens a connection to the origin only for a request that is not a user's, and keeps it for the next such request of the same connection of the web server. A user's request never reaches the origin, and leaves no connection in its log.
- With `proxy_protocol` the origin is told the address taken from `client_address_header`, with port 0, since the field names no port. A request that names no source, and one whose head the node cannot read to its end, is told with the address of the web server in front. The origin must therefore grant nothing to an address, its own host's and its proxy's included.
- The node keeps one connection to the origin for each connection of the web server, and the origin's keep-alive time does not decide how long the web server's connection lives: see "What the origin does between two requests" below.

**What happens to a request.**

- **Who is let in.** The node reads the whole request head, at most 16,384 bytes within 10 seconds, takes the source from `client_address_header`, and then decides. A head above 16,384 bytes is nobody's and is handed on as the bytes it is. The node still reads it to its end, up to 65,536 bytes, for one thing only: the source its last proxy named, so that a stranger with a long head is not the web server itself to the origin. A `GET` for the `ws` path with a valid proof in its query becomes a WebSocket session, as on `tls`, and its connection leaves the proxy pool. A `POST` for the `fronted` path with a valid proof opens a `fronted` session, and later requests name that session and a number that goes up by one.
- **What everybody else gets.** The origin's answer, and nothing of the node's. The node writes no byte of its own for such a request and changes none: the head goes to the origin as it was read, the body as far as its length or its chunks say, and the answer comes back as the origin sent it, up to the last byte of that answer and no further. When the answer is complete, the next request of the web server is read. An answer that says `Connection: close` ends the web server's connection with it, and so does an origin that closes or resets its connection while a request is in its hands.
- **Bytes behind a complete answer** are never handed to the web server. They answer nothing it asked, and its next request on that connection may be a user's. When the origin writes more than one answer to a request, the web server gets the first and both connections are closed.
- **What the origin does between two requests** is not passed on. An origin that says something on a quiet connection, as some servers do with a `408`, or that closes a connection it kept, has done so to the node's connection and to nobody else's: the node drops that connection, keeps the web server's, and opens a new one to the origin for the next stranger. If a kept connection turns out closed just as a request is sent on it, the node sends the request once more on a new connection.
- **A request the node cannot tell the end of.** The node reads lengths more strictly than a web server does: one `Content-Length` in digits, no more than 2^63 - 1, or `Transfer-Encoding: chunked` alone, line ends that are CR LF, no folded line, no chunk extension. Anything else it does not try to read. It hands the request on as the bytes it is, with everything the web server sends behind it, until the origin's first answer is complete, and then closes both connections. The node therefore never guesses where the next request starts. nginx refuses most such requests itself, before the node sees them.
- **A request from outside `trusted_proxies`** is a stranger's whatever it carries, a valid proof and a forwarded-address field included. It is relayed to the origin as on `tls`.
- **When the origin is down** the web server's connection is closed with no answer, and the web server gives the visitor its own error, as it would if the site were down. Users are not affected. The error is not always the one the web server gives for a site that is down: nginx answers 502 either way, and HAProxy answers 503 for an origin that refuses connections and 502 for a connection that was closed with no answer. For as long as the origin is down, that is one more thing by which the node can be told from the site.
- **A visitor with more than its share of requests waiting** (`limits.decoy_requests_per_source`, and half the proxy pool for all strangers together) has the connection of its oldest waiting request closed at once, also in the middle of an answer. The web server makes its own error of that, a 502 on nginx, which a site without the node would not have given.
- **The upgrade answer of `ws`** is the one of `tls`, with an empty `upgrade_headers` unless you set it, since the web server adds `Server` and `Date` itself.

**`fronted` in particular.**

- A request is decided from its head: exactly one `Content-Length` from 18 to 65,536 and no `Transfer-Encoding`. The body is then read whole, within 10 seconds, before anything of it is used, and every chunk in it must open. A request that fails any of this is the origin's to answer, and the session it named is left exactly as it was. A stranger who learns a session id cannot disturb the session.
- One request of a session is in flight at a time. The next one, sent early, is the origin's to answer. A repeat of the last request with the same bytes gets the same answer again, because a CDN may send a request twice. The node keeps the last answer and a SHA-256 of the last request body for that, and not the body.
- The node answers at once when it has something for the device, and after 250 ms when it has not. The answer is `200` with `Content-Type: application/octet-stream` and a `Content-Length`, and nothing else from the node.
- A session with no accepted request for 60 seconds is forgotten. There is no keepalive on `fronted`: the requests are the sign of life.
- A device may have 2 `fronted` sessions among its 8. A third takes the place of its oldest `fronted` session once it is established.
- An opening request whose body brings no WireGuard packet of its device is held, since the node sends nothing before that, and is answered by the origin when the session ends, 10 seconds later.

**Limits that are fixed** are those of `tls` where they are the same thing: 2 sessions that are not yet established and 8 that are for a device, 16 accepted proofs at once and then one a second, counted across every native transport together. A `ws` session ends after 300 seconds without a chunk and a `fronted` session after 60 seconds without an accepted request. Replay and being cut off are as on `tls`: a proof is accepted once, also across restarts, and whatever cuts a device off ends its sessions within a second.

**What is logged.** At info: a listener that starts, sessions that a reload ended, an origin that is reached again. At warn: an origin that cannot be reached. Nothing is logged for a single request, and no line names a client address, a path, a token, a session id or a key. Counters are in `stream` of `/v1/stats`.

## `outbounds`

An outbound is a way for the userspace stack to open TCP and UDP flows.

| `type` | Keys | Meaning |
|---|---|---|
| `direct` | optional `bind` (a local IP, not a wildcard) | Connects from the node itself. With `bind`, flows of the other address family are rejected. |
| `socks5` | `server` (`host:port`, IPv6 literals in brackets), optional `username` and `password` (both or neither, each 1 to 255 bytes) | Connects through a SOCKS5 proxy. UDP uses UDP ASSOCIATE when the proxy offers it. |

Every outbound also has a `tag`.

Engine: a `server` host name is resolved by the system resolver each time the node dials the proxy, never through a tunnel exit. The UDP relay address a proxy returns is used only if it is the address the control connection is connected to. A relay address on another host means the proxy counts as having no UDP.

## `exits`

An exit is a named way out that users are routed to.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `tag` | tag | required | |
| `name` | string, 1 to 64 characters, no control, bidirectional formatting, zero-width, line separator or other invisible characters | the tag | Display name. |
| `country` | two uppercase letters | none | ISO 3166-1 alpha-2 code shown in clients. Not checked against the ISO list. |
| `backend` | object | required | See below. |

### `backend`

| `type` | Carries | Keys |
|---|---|---|
| `netstack` | TCP and UDP | `outbound` (tag, required), `proxy_only`, `tcp_idle_secs` (10 to 86400, default 7200), `udp_idle_secs` (5 to 3600, default 60), `unsupported` |
| `l3` | every IP protocol | `interface` (matching `[a-z][a-z0-9_-]{0,14}`, default `veilway0`, unique across exits), `masquerade` (bool, default `true`). Linux only, needs `CAP_NET_ADMIN`: on another system `run` refuses to start. `check` does not look at the system it runs on. |
| `block` | nothing | none. Every packet is dropped silently. |
| `chain` | every IP protocol | `links` (1 to 4 link tags, required). The traffic leaves from another node through these links, see `links` below. No key of `netstack` or `l3` is allowed. |

Engine, `l3`:

- Only one `l3` exit can run on a node for now; a second is refused at start. The host needs `ip` (iproute2) and `nft` (nftables).
- With `masquerade` true the node turns on forwarding for the whole host if it is off and sets it back when it stops (it stays on if the node is killed). With `masquerade` false the node still loads a small nftables table named `veilway_<interface>` that keeps tunnel traffic away from the host itself.
- Return traffic is delivered only when it belongs to a live flow that left through that exit. Flows through an `l3` exit idle out after 7200 seconds for TCP and 60 for UDP.
- An `l3` exit can go down while the node runs: its interface was removed under the node, or a reload closed the interface and could set up neither the new one nor the old one again. The node then tries to bring the interface up again with the config that is in force, 2 seconds after it went down and then after twice the wait each time, once a minute at most, until it is up.
- While the exit is down, traffic routed to it is answered as unreachable (a reset for TCP, host unreachable for everything else, counted under `unreachable` in the drop counters). It never leaves through another exit. The node logs a warning with the step that failed when the exit goes down and for every try that fails, and an info line when it is up again. `GET /v1/exits` shows the state in `interface_up`, `interface_down_secs` and `interface_flips`.
- A reload that leaves the `l3` exit as it is goes through while the exit is down, and makes the node try at once. A reload that changes or removes the exit ends the tries for the old one. Stopping the node ends them too and leaves no interface, route, nftables table or sysctl behind.

### The destination gate

Every exit refuses these destinations, whatever the config says: every address inside an inbound pool (traffic between users never leaves through an exit, see below), the node's own addresses, loopback, link-local (`169.254.0.0/16`, `fe80::/10`), multicast, broadcast, unspecified, `0.0.0.0/8`, and IPv6 addresses that embed an IPv4 address (IPv4-compatible, NAT64, 6to4, Teredo) whose embedded address is refused. Every IPv4-mapped IPv6 destination (`::ffff:a.b.c.d`) is refused outright.

Private networks are not part of that fixed list. They are ordinary destinations, and routing rules decide about them, so an operator can refuse them, allow them, or allow them for some users only. See `geoip:private` under routing.

### Traffic between users

A packet whose destination lies inside an inbound pool is never sent to an exit. Routing rules still decide about it, and the name `tunnel:users` in a rule's `ip` list stands for every address in every pool except the gateways:

- If the matching rule says `block` or `reject`, the packet is refused. A config that isolates users, which is the normal case, has a rule that rejects `tunnel:users`.
- Otherwise the packet is delivered inside the node to the device that holds the address, on the same inbound or another one. An address no connected device holds is answered as unreachable.

`tunnel:<inbound tag>`, for example `tunnel:gaming`, stands for the addresses of one inbound only. Together with the `inbound` condition, which says where a packet came from, a rule can be about one tunnel in either direction. An inbound cannot have the tag `users`.

A shared network for games on one tunnel, with every other tunnel isolated, is one rule placed before the isolating rule. Its action `"user"` means "handle normally", which for a destination inside a pool is delivery to that device:

```json
{"tag": "gaming-lan", "inbound": ["gaming"], "ip": ["tunnel:gaming"], "action": "user"},
{"tag": "isolate-users", "ip": ["tunnel:users"], "action": "reject"}
```

Users on `gaming` reach each other. They do not reach users of other tunnels, and users of other tunnels reach nobody.

Three things hold whatever the rules say. A device can only send from its own addresses. A gateway address answers DNS and nothing else, and on a `veilway` inbound the control channel of that inbound. Broadcast and multicast are not carried, so games that find each other by local broadcast will not see other players; connecting by address works.

### `proxy_only` and `unsupported`

`proxy_only` (bool) says that traffic through this exit leaves only through its SOCKS5 proxy. It defaults to `true` when the outbound is `socks5` and must be absent or `false` when the outbound is `direct`.

`unsupported` says what a `netstack` exit does with traffic its outbound cannot carry:

| Key | Applies to | Default | Allowed values |
|---|---|---|---|
| `icmp_echo` | ping | `"local"` | `"local"`, `"reject"`, `"drop"`, `"direct"`, `{"via": "<exit tag>"}` |
| `udp` | UDP when the proxy has no UDP ASSOCIATE (DNS keeps its TCP fallback) | `"reject"` | `"reject"`, `"drop"`, `"direct"`, `{"via": "<exit tag>"}` |
| `other` | every other IP protocol | `"reject"` | `"reject"`, `"drop"`, `{"via": "<exit tag>"}` |

- `reject` answers with the matching ICMP error. `drop` discards. `local` makes the node answer the ping itself, after the destination gate.
- `direct` sends from the node's own address around the proxy, and `via` hands the traffic to another exit. Either one is an error unless the exit sets `"proxy_only": false`, and validation still warns for each use.
- A `via` target must exist, must not be the exit itself, must be an `l3` exit for `icmp_echo` and `other`, and must carry UDP for `udp`. The target's own `unsupported` policy is never consulted, so chains and loops cannot form.
- On a `direct` outbound, setting `udp` is a warning: it never applies.

Engine: `direct` for `icmp_echo` uses unprivileged ping sockets and is checked at start. The `udp` policy is decided once per flow at its first packet and the flow never moves between the proxy and the other path. A destination sent by `direct` or `via` must pass the gate of both exits. A `via` target that cannot carry the packet rejects it. Every switch of an upstream between "has UDP" and "has no UDP" is logged at info and counted.

More engine behavior of `unsupported`:

- A flow sent by `via` needs the user to be entitled to both exits. A UDP flow the proxy has carried is never moved to `direct` or `via` later; it is refused if the proxy loses UDP.
- `reject` answers are rate limited per device (burst 20, then 10 a second).
- ICMP codes used: administratively prohibited for rules, the gate, entitlement and a rejected ping; host unreachable for a tunnel address nobody holds; port unreachable for `unsupported.udp`; protocol unreachable on IPv4 and prohibited on IPv6 for `unsupported.other`.
- `icmp_echo: direct` allows 16 ping identifiers per device, 32 per user and 1024 in total.

## `routing`

The first packet of a flow is matched against `rules` in order. The first match decides, and the whole flow keeps that decision.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `default` | exit tag | required | Used when nothing else chose an exit. |
| `rules` | list | `[]` | See below. |

### A rule

All conditions present in a rule must hold. Inside one list, any entry may match. A rule needs at least one condition.

| Key | Type | Matches |
|---|---|---|
| `tag` | tag | required. The rule's identity for the control API. |
| `enabled` | bool, default `true` | Not a condition. A disabled rule is validated like any other and skipped when flows are matched. |
| `inbound` | list of inbound tags | the inbound the packet arrived on |
| `user` | list of user names | the sending user |
| `group` | list of group names | any group of the sending user |
| `link` | list of link tags | what arrives from one of these links, on a node that is the exit half of each. Not together with `user` or `group`, which a link does not have. |
| `ip` | list of networks, or the names `geoip:private`, `tunnel:users` and `tunnel:<inbound tag>` | destination address |
| `domain` | list of names | a name this user resolved to the destination address through the node. `example.com` matches that name only. `*.example.com` matches every name below it and not `example.com` itself. |
| `protocol` | list of `tcp`, `udp`, `icmp`, `icmpv6`, `gre`, `esp`, `sctp`, or an integer 0 to 255 | IP protocol. A name and its number are the same entry. |
| `port` | list of integers 1 to 65535 or strings `"lo-hi"` with `lo <= hi` | destination port. Needs `protocol` present and limited to `tcp`, `udp` and `sctp`. |
| `icmp_type`, `icmp_code` | lists of integers 0 to 255 | Need `protocol` to be exactly `["icmp"]` or exactly `["icmpv6"]`. `icmp_code` needs `icmp_type`. |
| `action` | `{"exit": "<tag>"}`, `"user"`, `"block"` or `"reject"` | required |

A domain is lowercase ASCII (punycode for other scripts), at most 253 bytes with labels of 1 to 63, no trailing dot, not an IP address in any spelling (a last label that is all digits, or `0x` followed by hex digits, is refused). `*` may only be the whole first label and needs at least two labels after it.

`geoip:private` stands for every private and special-purpose range: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `192.0.0.0/24`, `192.0.2.0/24`, `192.88.99.0/24`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `240.0.0.0/4`, `fc00::/7` and `2001:db8::/32`. It never matches an address inside an inbound pool; those are `tunnel:users`. A network in a rule, and `geoip:private`, also match an IPv6 destination that embeds a matching IPv4 address (IPv4-compatible, NAT64, 6to4, Teredo). No other `geoip:` name is accepted yet, and a `tunnel:` name must be `users` or the tag of an inbound. A config that keeps users away from each other and out of the networks behind its exits starts its rules with:

```json
{"tag": "isolate-users", "ip": ["tunnel:users"], "action": "reject"},
{"tag": "no-private", "ip": ["geoip:private"], "action": "reject"}
```

To let one group reach one private network, put a rule for it before that one. To switch a rule off without deleting it, set `"enabled": false`.

Actions: `{"exit": ...}` sends the flow to that exit. `"user"` sends it to the user's own `exit`, or to `default` when the user has none. `block` drops silently. `reject` answers with an ICMP error, or a TCP reset for TCP. A flow that matches no rule is treated as `"user"`.

### Entitlement

A flow may only leave through an exit in its user's `exits`, whatever chose it: a rule, the user's `exit`, `default`, or a `via`. Otherwise the flow is rejected. It never falls through to another rule.

Validation:

- Error: a rule with a `user` condition sends a named user to an exit outside that user's `exits`.
- Error: a user with a non-empty restricted `exits` has no `exit` and `default` is not in the list.
- Warning, with a count of affected users: a rule without a `user` condition can send users to an exit they are not entitled to, directly or through `via`.
- Error: a rule limited to protocols other than TCP and UDP sends them to a `netstack` exit whose policy for that class is `reject` or `drop`. UDP is never checked, because whether a proxy carries UDP is only known at run time.
- Warning: a `domain` rule with an `exit` action comes before a `block` or `reject` rule. A user who controls any name matching the pattern can point it at any address, so a `domain` rule is a routing convenience and never a security control.
- Warning: no enabled rule isolates users for everyone, that is, no enabled rule with `block` or `reject` has `tunnel:users` in `ip` and no other condition. The warning says that users can reach each other's devices, and names the inbounds where that is so when an `inbound` condition limits the rule.
- Warning: no enabled rule refuses private destinations for everyone, that is, no enabled rule with `block` or `reject` has `geoip:private` in `ip` and no other condition. The warning says that private networks behind the exits are reachable.
- Warning: an enabled `block` or `reject` rule whose only conditions are `ip`, `protocol` and `port` matches a server of `dns.servers` or of a DNS set on port 53 before any rule that would send it to an exit, so the node cannot reach its own resolver. The warning gives the path of the server, for example `dns.sets[0].servers[1]`.
- Error: a rule with a `link` condition names a link that is not the exit half on this node, a link no config has, or also has a `user` or `group` condition. Sending a link to an exit that is not in that link's `exits` is an error too.
- Warning: a rule with a `domain` condition and no `user` or `group` that could apply to a link. The exit never learns the names behind a link's traffic, so the rule never matches it, and a block by name does not cover a link.
- Warning, best effort: a rule is completely covered by a single earlier rule. `check` does this within a fixed budget; a reload does not.

Engine: `protocol` is the upper-layer protocol after walking IPv6 extension headers. Fragments are reassembled before routing, within a per-user bound, or dropped. A packet whose headers cannot be parsed is dropped and counted.

For flows between users, only an echo reply counts as the answer to a delivered echo request; every other ICMP message is decided by the rules for its own direction.

The flow table holds at most 65536 flows in total, 1024 per user and 512 per device. Refused flows are remembered apart from these limits (4096, the oldest gives way).

## `users`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | matching `[a-z0-9][a-z0-9._-]{0,63}` | required | Unique. This is the user's identity: usage counters and rules refer to it, and renaming a user is removing one and adding another. |
| `enabled` | bool | `true` | |
| `groups` | list of declared group names | `[]` | |
| `devices` | list of 1 to 16 | required | See below. |
| `exits` | `"all"` or a list of exit tags | required | Exits the user may leave through. An empty list means none: the user can connect but every flow is rejected, and validation warns. |
| `exit` | exit tag | none | The user's own exit. Must be in `exits`. |
| `quota_bytes` | integer 1 to 9007199254740991 | none | Bytes of inner IP traffic, both directions, per period, including traffic that was rejected or answered locally. See Usage and quota. |
| `quota_period` | `daily`, `weekly`, `monthly` | none | When the count resets, at 00:00 UTC (weekly on Monday, monthly on the 1st). Needs `quota_bytes`. Without it the quota never resets. |
| `expires_at` | RFC 3339 timestamp with an explicit offset | none | From this moment the user is treated as disabled. |

### `devices`

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | matching `[a-z0-9][a-z0-9._-]{0,63}` | required | Unique within the user. |
| `public_key` | key | required | Unique across all devices of all users, and never equal to the public key of an inbound. |
| `preshared_key` | key | none | Secret. |
| `transport_secrets` | list of 1 or 2 secrets | none | Secret. Required for a device with an address in a `veilway` inbound, where the device proves one of them to the control channel. A secret is 32 random bytes written like a key, and `veilway gensecret` prints one. No two devices share one, and none is a WireGuard key of the config. Two are for rotation: add the new one, give it to the device, remove the old one later. On a device with no address in a `veilway` inbound the key is a warning. |
| `addresses` | list of 1 to 16 host addresses, written without a prefix | required | The device's tunnel addresses. |

Each address must lie in the pool of exactly one inbound and may not be that pool's gateway, network or IPv4 broadcast address. A device has at most one IPv4 and one IPv6 address per inbound. No address is used by two devices.

Engine: when a user is disabled, expires, runs out of quota or is removed, or when a device's key or addresses change or it is removed, then within one second the core drops the session keys, resets every flow and clears the DNS memory that belong to it, and logs it at info. Expiry and quota are driven by a timer and by the byte count, not only checked at handshake. A backward step of the node's clock does not re-enable a user. Usage is kept outside this document, see below.

### Usage and quota

Engine. Usage never lives in the config document. It is kept in one state file (see `--state` under Commands) and survives reloads and restarts. Without a state file path the node keeps usage in memory only and it is lost on restart.

- **Counting.** `quota_bytes` counts inner IP bytes in both directions. Traffic that is rejected or answered locally counts too.
- **Over quota.** A user at or over quota is cut off by the same path as a disabled user, within one second, and the info log line names quota as the reason. The user cannot shake hands again until the period rolls over, a reload raises or removes the quota, or the operator resets the user's usage.
- **Period.** Without `quota_period` the count never resets by itself. With it the count resets at 00:00 UTC (weekly on Monday, monthly on the 1st).
- **Clock steps back.** A backward step of the clock by less than one period never resets a count and never re-enables a user, at that moment or when the clock moves forward again. The period start stays where it was.
- **A period start far in the future.** A period start that lies more than one whole period after the node's clock (more than 1 day for `daily`, 7 days for `weekly`, 31 days for `monthly`) is not trusted. It can come from a state file that was edited or written while the clock was wrong, or from a clock that was ahead by more than a period and was then set right. Left alone, such a count would not reset until the clock reached that time, which can be years. So the node sets the period start to the start of the period its clock is in, keeps `used_bytes`, and logs one warning that names the user. This is checked when the state file is loaded and four times a second while the node runs. The price: a clock that jumps back by more than a period and then forward again gives that period's quota a second time. Keep the node's clock synchronized.
- **Without `quota_period`.** Any period start after the node's clock is set to `0` with `used_bytes` kept and one warning. Nothing resets by itself for such a user, so this costs nothing.
- **Reset by the operator.** `veilway usage reset --user <name>`, or `POST /v1/users/{name}/usage/reset` on the control API, sets `used_bytes` to 0 and the period start to the start of the current period. A user who was over quota can connect again at once, without a reload. Lifetime totals are kept unless `--totals` (`"totals": true`) is given. See Commands and the control API reference.
- **Counters.** Every user, inbound and exit has totals of up and down bytes and packets, which the control API serves. They are totals; rates are computed by whoever polls. Counters follow names and tags across reloads. Exit counters count inner IP packets and bytes where a packet is handed to or taken from the exit, and a flow that leaves by way of another exit (`via`) is counted on the exit that carries it and not on the exit the rule chose.
- **State file.** Versioned JSON keyed by user name. Per user it holds the bytes used in the current quota period, the start of that period, and lifetime totals (up and down, bytes and packets). Next to the users it holds `devices`: for each device that chose an exit on the control channel, its public key and that exit's tag. The version stays 1, because an older build passes that key over and still reads every user's count. The choices of at most 65,536 devices are kept, and no more than fit in the 16 MiB a state file may have next to its users (with 65,536 users that is about 1,500). A device whose choice is not kept has chosen no exit after a restart, and the node warns when that happens.
- **Writes.** The file is written with mode 600 through a temporary file in the same directory, then fsync, then rename. It is written at most once every 10 seconds and only when something changed, once more on shutdown, right after a user is cut off for quota, and right after a usage reset. Writing never blocks traffic. A failed write is retried, and logged once and then every 10 minutes while writes keep failing. If the node is killed, at most about 10 seconds of counted usage can be lost.
- **Start.** A missing file means zero usage. A file that cannot be parsed, has an unknown version, or is larger than 16 MiB is kept under the same name with `.bad` appended, logged at error, and the node starts from zero, since an unreadable state file must not keep a node down. A state file that group or others can write is treated the same way. Values are clamped, never trusted: a count above 9007199254740991 saturates at it. One entry that is not a valid entry is skipped and only that user starts from zero, or only that device has chosen no exit. No more than 65,536 users and 65,536 devices are read from a file, whatever it holds. An exit in the file is held against the config like one a device asks for: when it is not in the user's `exits` it is dropped at start and logged at info. If the path is not a regular file (a directory, a symbolic link, a device), the node leaves it untouched, logs an error and keeps usage in memory until it stops.
- **Removed users.** The entry of a user the config no longer names is dropped at the commit that removes it, and so is the entry of a device. Renaming a user is removing one and adding another, so it starts from zero.

## `notices`

A list of at most 4 notices that the control channel of every `veilway` inbound gives to every device. The node writes none of its own.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `severity` | `information` or `warning` | `information` | |
| `text` | 1 to 280 bytes | required | Plain text. Control characters, line breaks, bidirectional formatting and zero-width or other invisible characters are refused, so a client shows it as it was written. A client shows no link in it. |

```json
"notices": [{"severity": "warning", "text": "Maintenance on Friday from 02:00 UTC"}]
```

Notices on a node with no `veilway` inbound are a warning.

## `public_addresses`

A list of at most 8 host names or IP addresses, with no port and none twice. They are the addresses a profile of this node is given, each with the port of the listener of one of its transports. The control API shows them in `GET /v1/status` and `GET /v1/inbounds`. A host name is lowercase ASCII, written as for a rule's `domain` without `*`. An IPv4-mapped IPv6 address and an address with a zone are errors, as everywhere.

```json
"public_addresses": ["node.example.com", "203.0.113.7"]
```

## `replay`

Engine. The replay memory makes sure that a proof (for `udp-obfs` an opening packet, for `tls` the token of an upgrade request) is accepted once. One memory serves every obfuscated transport of the node. A node without such a transport keeps none, and the key is then a warning.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `cache` | integer 1024 to 1,048,576 | `262144` | How many accepted proofs the node remembers at once. When it is full, every proof is refused until entries leave, which they do 60 seconds after their time. It is read when the node starts: a reload that changes it logs a warning and changes nothing until the next start. |
| `per_source` | object with `burst` and `rate`, each 1 to 65,536 | `{"burst": 256, "rate": 32}` | Accepted proofs one source may bring: `burst` at once, then `rate` a second. A source is an IPv4 address or an IPv6 /64. Raise it when many users share one address. A reload changes it at once. |

```json
"replay": {"cache": 262144, "per_source": {"burst": 256, "rate": 32}}
```

### The replay file

The memory is kept in a file of its own: `veilway-replay` next to the state file, or the path given with `run --replay`. Next to it the node keeps a lock file (`veilway-replay.lock`) and, during a write, a temporary file (`veilway-replay.tmp`).

- **Start.** A node does not start a config with an obfuscated transport, and does not reload into one, without a replay path whose directory it can write. A second node on the same file does not start: two nodes never share a replay file, and an inbound's keys belong to one node.
- **Size.** While the node runs the file is 68 bytes and is written about every 10 seconds, with mode 600. A clean stop writes the cache as well, 41 bytes for each entry, at most about 10 MiB at the default `cache`.
- **After a clean stop** nobody is refused because of the restart.
- **After a kill or a crash** the node refuses proofs for up to 20 seconds, or up to 80 if a device with a fast clock had connected just before. Logged at info.
- **With no file**, which is how a node starts for the first time, every proof is refused for 60 seconds. Logged at warn.
- **A file that cannot be used** (cut short, damaged, larger than `cache` allows, writable by group or others) is moved aside with `.bad` behind its name and logged at error. The node then starts as with no file. A config that lowers `cache` below the entries of the last clean file makes that file unusable in this way.
- **A file that cannot be written while the node runs**: within about 20 seconds the node accepts no new proof. Sessions that are open go on. Logged at error once a minute, and counted in `replay.write_failures` of `/v1/stats`.

Three things undo replay protection:

- **Never restore the replay file from a backup or a machine snapshot.** An older file reopens replay for everything accepted since it was taken. If in doubt, delete it: that costs 60 seconds of refusals.
- A reset (below) after the node's clock ran ahead.
- A lost file on a node whose clock is behind where it has been. Do not start the node before its clock is synchronized.

### When the floor is ahead of the clock

A node whose clock ran ahead, and was then put right, can be left refusing every device: its floor, the time up to which proofs are refused, lies in the future. This is an outage that lasts as long as the clock was wrong by, and waiting is the only thing that ends it by itself.

It is not the same as what a start costs. After a start or a reset the floor is up to 80 seconds ahead of the clock, as the list above says. That passes by itself, is logged once at start with the time left, and is shown as `replay.refusing_secs` of `/v1/stats`. Do not reset for it: a reset costs another 60 seconds.

The fault is a floor more than 80 seconds ahead of the clock, or one that rose while the node ran:

- The node logs it at error once a minute with the distance, and counts the refused proofs in `replay.refused_floor_ahead`. `replay.floor_ahead` of `/v1/stats` is true.
- `veilway doctor` shows the floor, the limit and the clock, fails when the floor is more than 80 seconds ahead, and warns when the limit is. A floor up to 80 seconds ahead is reported as what a start costs, with the time left.
- `veilway replay reset` ends it, see Commands.

## `links`

A list of at most 64 node links. A link joins this node to one other node, so that users connect to one of the two (the entry) and their traffic leaves from the other (the exit). See the [node links page](../../protocol/node-links/) for roles, directions, pairing and what each node enforces.

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
| `inbound` | inbound tag | none | On the node that is dialled: the `veilway` inbound the link connects to. It has no `fronted` transport and carries no users' devices. Needs `public_key`. |
| `public_key` | key | none | On the node that is dialled: the WireGuard public key the other node made for this link. Needs `inbound`. |
| `private_key` | key | none | Secret. On the node that dials: the WireGuard key it made for this link. Needs `peer`. |
| `peer` | object | none | On the node that dials: `inbound_public_key` (the key of the other node's inbound), `transport_public_key` (needed when a `tls` or `ws` transport is listed) and `transports` (1 to 8). Needs `private_key`. See below. |
| `exit` | exit tag | none | On the exit half: the exit the link leaves through when no rule names one. Without it that is `routing.default`. Must be in `exits`. |
| `exits` | list of exit tags | required on the exit half | On the exit half: the exits the link may leave through. None is a `chain` exit, because a link may not leave through another link. |
| `allow_private` | bool | `false` | On the exit half: whether rules decide about private networks for this link. Without it they are refused whatever the rules say. |
| `max_flows` | integer 1 to 65,536 | `16384` | On the exit half: the flows the link may have at once. The `max_flows` of the links this node is the exit of coming to more than half of the 65,536 flows the node holds is a warning. |
| `quota_bytes`, `quota_period`, `expires_at` | as for a user | none | On the exit half. They mean what they mean for a user. |

Which half a node is follows from `direction` and from whether the link has `inbound` or `peer`: the entry half has the users and is used through a `chain` exit, the exit half takes traffic from the other node. `exit`, `exits`, `allow_private`, `max_flows`, `quota_bytes`, `quota_period` and `expires_at` are errors on the entry half, and `exits` is required on the exit half. An entry half that no `chain` exit names is a warning.

`peer.transports` lists the other node's transports in its order of preference, in the shape a profile of a subscription has:

| Key | Type | Meaning |
|---|---|---|
| `type` | `udp`, `udp-obfs`, `tls` or `ws` | `fronted` is read and refused: a link carries the traffic of many users, and polling that through a CDN is not a transport of a link. |
| `endpoints` | list of 1 to 16 `ip:port` | For `udp` and `udp-obfs`, which take neither `path` nor `candidates`. |
| `path` | as for `tls` | For `tls` and `ws`, together with `candidates`. |
| `candidates` | list of 1 to 16 objects | For `tls` and `ws`. Each has `address` (`ip:port`), `sni` (a lowercase host name, or `""` for none), `host` (the `Host` of the request), `verify_name` (the name the certificate is held against: required when `sni` is empty and not allowed otherwise) and `pins` (1 to 4 SHA-256 hashes of the certificate's SubjectPublicKeyInfo, in base64). A `tls` candidate needs `pins`. The chain is always validated and a pin is a second condition. |

An address the node dials may not be loopback, link-local, unspecified, multicast, broadcast, in `0.0.0.0/8`, inside an inbound pool of this node, or an IPv6 address that carries an IPv4 address. A private address is a warning.

Other checks: a link's key is not an inbound's or a device's, and no two links share a key. The addresses of a link must be host addresses (not the gateway, network or broadcast address) of its inbound's pool on the node it connects to. On the node that dials they must lie outside every pool of this node, inside `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10` or `fc00::/7`, where the pool they come from lies. The `chain` exit that names a link must name an entry half, and no two exits name the same link.

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

Engine. A tunnel's connections leave from the entry's link address with ports from the entry's translation, as users' flows do, and are decided by the far node's rules for the link. While the `chain` exit is down, connections are refused. `/v1/stats` counts each tunnel under `tunnels`.

## `xray`

The Xray add-on: inbounds that the official `xray` binary serves, with users that are users of this node. It is off when the key is absent, and nothing runs until the add-on is installed, see the [Xray manual](../../manuals/xray/). Xray reaches the network only through the node, so the gate, the rules, the exits, the quotas and the counters apply to its users as they do to a tunnel's. An Xray user's traffic leaves through `netstack` exits only: `l3` and `chain` exits are not built for it.

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
| `decoy` | `http://` URL, as `decoy.origin` of `tls` | required for `vless` and `trojan`, not allowed for `shadowsocks` | Your own web server. A connection that does not carry a user's credential is handed to it after the TLS handshake. |
| `server_key` | 32 bytes as standard base64 (44 characters) | required for `shadowsocks`, not allowed for the others | Secret. The server's key of the cipher `2022-blake3-aes-256-gcm`. |
| `clients` | list of at most 65,536 | required | The users that may use this inbound. Each has `user` (the name of a user, once per inbound) and `secret`. |

The `secret` of a client is secret and unique within its inbound. For `vless` it is a UUID. For `trojan` it is a password of 22 to 128 characters from `A-Z a-z 0-9 _ - . + / =`. For `shadowsocks` it is a key of 32 bytes as standard base64 (44 characters).

Engine. A user who is disabled, expired or over quota is left out of what Xray is given, and the node holds quota and expiry itself. A change of the section, or of the users it names, starts Xray again with a new document after 2 seconds without another change, and connections on it drop for that moment. Without the add-on's executable, or with no Xray host to ask, the node keeps running and Xray is not started.

## Reloading

Engine. The core reloads on `SIGHUP` and on an apply through the control API. It does not watch the file.

1. The new document is parsed and validated. An error leaves the running config in force and is logged once with the field path.
2. Prepare: every new listener is bound, every certificate loaded, every device and firewall change staged, while the old config keeps running. Any failure aborts the reload and the old config stays whole.
3. Commit: the new config replaces the old one in one step. The core logs which inbounds, outbounds, exits, rules and users were added, changed or removed, by tag or name.

After a commit:

- A flow belongs to a user and device, not to an address. A device is identified by its public key across reloads.
- Every live flow is checked again. It is reset when its exit is gone, its exit's backend or outbound changed, its destination no longer passes the gate, its user is no longer entitled to the exit, or the rules now decide differently for it.
- Changing an inbound's `private_key`, `address` or `mtu` restarts that tunnel and drops its sessions. Changing one transport restarts that transport only. Changing a tag is removing one object and adding another.
- Certificates are read again on every reload.
- A device's chosen exit is kept across a reload while it is still in the user's `exits`. One that is not is dropped and logged at info, and the device leaves through the user's exit. It does not come back when the exit is given back.
- A control connection proved one transport secret. When a reload removes that secret from the device, the connection is closed within a second and the secret opens no new one. The same holds for a `udp-obfs` session: one that was opened with the removed secret ends at the reload, and an opening packet under that secret is a stranger's from then on. A session opened with the device's other secret, and a tunnel that came over `udp`, where no secret opened it, stay up. Adding a second secret disturbs nothing.
- A `udp-obfs` transport that stays as it was keeps its sessions across a reload, also when `limits.sessions` or the inbound's `padding` change. New padding bounds apply to sessions opened afterwards. A transport whose `listen` changes, or whose tunnel restarts, loses its sessions, and its devices open new ones.
- A `tls` transport whose `listen` and `path` stay as they were keeps its sessions across a reload, also when its `limits`, its `decoy`, its certificate files, the inbound's `upgrade_cookie`, `upgrade_headers` or `padding` change. The certificate and key files are read again at every reload, also at a `SIGHUP` on an unchanged config file, and connections made afterwards get the new certificate. A file that cannot be used refuses the reload and the certificate that runs stays. A new `path` ends the sessions that came in by the old one, which is the origin's from then on. Removing the transport closes its listener with every connection on it. Connections that are being relayed to the origin stay with the origin they are connected to.
- A session opened with a `tls` proof ends at the reload that removes the transport secret it was opened with, like a `udp-obfs` session. Adding a key to `transport_keys` ends no session. Removing one ends, within a second, every session that was opened under it, and a token sealed to it opens nothing from then on: the keys of a session's chunks come from the key its proof was sealed to, so removing a key is the answer to one that leaked. Keep the old key in the list until every profile carries the new one, then remove and destroy it. Devices that were still connected under it connect again under the new one.
- A `ws` or `fronted` transport behind your web server whose `listen` and `path` stay as they were keeps its sessions across a reload, and a session ends with its transport secret or its transport key like a `tls` one. A new `path` ends the sessions that came in by the old one, which is the origin's from then on. A proxy that is taken out of `trusted_proxies` is a stranger from its next connection on. Removing the transport ends its sessions, and removing the last one on a listener closes the listener with every connection on it.
- The name of a `decoy.origin` is resolved at start and at every reload, and the header fields of the upgrade answer are asked for again.
- `replay.per_source` changes at once. `replay.cache` changes at the next start.
- An inbound whose `type` changes from `veilway` to `wireguard` loses its control channel: its connections are closed and the port is refused. The other way round the port starts to answer. Sessions stay.
- Changed `notices` are sent to every open control connection.
- A link that keeps its `id` and its key keeps its state across a reload. A changed `xray` section starts Xray again, see `xray`.
- DNS sets change without touching a tunnel or a session: a set can be added, removed, given other servers or given to other inbounds, groups and users. The next query of every user goes to the list the new config gives them.
- A user whose queries go to other servers than before loses the names the node remembered for them, so that no `domain` rule keeps matching by the word of a resolver that is no longer theirs. This is logged at info. What counts is the servers of the list the user's queries go to, looked at for each inbound their devices are on: moving a user, a group or an inbound into, out of or between sets clears the memory, and so does changing the `servers` of the set they are on. The same holds for `dns.servers`: changing it clears the memory of every user who resolves through it, which earlier builds did not do. The same servers in another order, and another set with the same servers, are no change. `domain` rules match for that user again as their names are resolved again; open flows are checked like after any reload.
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
veilway mirror --config mirror.json
veilway mirror --config mirror.json --check
```

`run` refuses a config file that group or others can read unless started with `--allow-readable-config`. `run --state <file>` sets the path of the usage state file, `veilway-state.json` next to the config file by default. `run --replay <file>` sets the path of the replay file, `veilway-replay` next to the state file by default; only a config with an obfuscated transport uses it, see `replay`. `run --api <path>` sets the unix socket of the control API, `veilway.sock` next to the config file by default, and `run --no-api` starts the node without the API; the two cannot be combined. Whoever can open the socket administers the node, see the control API reference. Both flags exist on Unix only. `run --addons <folder>` is the folder the Xray add-on is installed in (`/usr/local/lib/veilway/addons` by default), which must not be writable by the user the node runs as, and `run --xray-socket <path>` is the socket of the Xray host that starts Xray (`/run/veilway-xray/host.sock` by default). Only a config with an `xray` section uses them, see `xray`. `veilway xray-host` is that host, which the install script runs as its own service on Linux. `check` prints every error and warning and exits with a non-zero status when there is an error. It gives the same answer on any operating system. `schema` prints the JSON Schema of this format. `genkey` prints a new WireGuard private key and its public key. `genkey --transport` prints a new node transport key for `transport_keys` of one inbound of one node, and its public half, which is what the profiles of that inbound carry: it is an X25519 key of its own and never a WireGuard key. `gensecret` prints a new transport secret for one device of a `veilway` inbound.

`doctor` tries what a config needs of this host and of the network, once, before the node is started or after it misbehaves. It needs no running node. It never changes the node, the host or any file, and it never prints a secret: a line names tags, user-chosen names, field paths and listen addresses, and no other value of the config. `--config <file>` is the config to check (`config.json` by default). `--state <file>`, `--replay <file>`, `--api <path>` and `--no-api` mean what they mean for `run`, with the same defaults. `--json` prints one JSON document with the same lines in place of text. `--timeout <seconds>` is how long each step on the network may take, 5 by default and 10 at most. Checks run a few at a time, so the command ends in well under a minute on a network that answers nothing.

`link offer` and `link answer` pair this node with another one, one command on each node, and print the entry for each node's `links` once both operators have compared the fingerprint. Neither writes the config: you put the entry in yourself. Exit status: 0 paired, 2 not confirmed, 1 anything else.

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

`usage reset` starts one user's quota count over on a node that is running. It talks to the node through the control socket, so it exists on Unix only and needs a node started without `--no-api`. It does not read or change the config file or the state file itself.

| Flag | Meaning |
|---|---|
| `--user <name>` | The user to reset. Required. |
| `--totals` | Also zero the user's lifetime totals (up and down, bytes and packets). Without it they are kept. |
| `--api <path>` | The control socket of the node. Default: `veilway.sock` next to the config file. |
| `--config <file>` | Only used to find the default socket path. Default: `config.json`. |

On success it prints one line with the new `used_bytes` and `period_start`, and says so if the user still cannot connect because they are disabled or expired. Errors go to standard error.

| Exit status | Meaning |
|---|---|
| 0 | The usage was reset. |
| 1 | Anything else: the node answered with another error, or did not answer within 30 seconds. |
| 2 | Wrong command line, for example no `--user`. |
| 3 | The running config has no user of that name. Nothing was changed. |
| 4 | No node answers on the socket: nothing is at the path, or a node that was killed left its socket behind. |
| 5 | This user may not open the socket. Run the command as the user the node runs as, or as root. |

Running it twice is safe: the second run sets the count to 0 again and changes nothing more.

`replay reset` empties the replay memory of a node that is running and sets its floor and its limit to the node's clock plus 60 seconds. It is for a node whose floor is ahead of its clock, see `replay`. It talks to the node through the control socket, like `usage reset`, and never touches the replay file itself: a file edited under a running node would be undone by the node's next write. With the node stopped, deleting the replay file has the same effect. Usage and quotas are not touched.

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
| 1 | Anything else. The node could not write the replay file: it then accepts no proof until it has written the floor and the limit it had back, and the reset has to be run again. Or the node did not answer within 30 seconds. |
| 6 | The node has not finished writing the reset after 10 seconds. The reset is in force when the write ends. Do not run the command again: that would cost another 60 seconds. `replay.resets` of `/v1/stats` grows by one when it has landed. |
| 2 | `--yes` was not given, or the command line is wrong. Nothing was changed. |
| 3 | The node keeps no replay memory, because it has run no obfuscated transport. |
| 4 | No node answers on the socket. |
| 5 | This user may not open the socket. |

Each check prints one line: its status, the kind of check, what it looked at, and one sentence on what was found and, on `warn` and `fail`, what to do about it. The checks run in this order:

1. The config file: its mode, and the validation report with every error and warning. A config that does not validate ends the run here, and everything after it is reported as `skipped`.
2. The control socket: whether a node answers on it. If one does, a listen address that is taken and an l3 interface that exists are expected, not failures.
3. Every listen address of every inbound: whether it can be bound right now, over UDP or over TCP as the transport needs. Transports that share an address are tried once.
4. Every certificate and key of a `ws` or `tls` transport: both load, the key matches the certificate, the certificate is not expired and not yet valid, and the names it covers. Under 14 days left is a warning.
5. The decoy origin of every `tls` transport, with two requests made the way the node makes its own. The first asks for the origin's page: an origin that is not reached, or does not answer as a web server, is a failure, because whoever is not a user would then be closed with no answer. An answer that redirects to an `https://` address is a warning: behind the node's TLS that redirect never ends. A field of `upgrade_headers` that the origin does not send is a warning. The line says which `Host` the request carried. The second asks for the path of the transport with a query that is no proof: the origin has to answer it itself, as it answers a path it does not have. An answer below 400 is a warning, since the origin must serve nothing there. A 5xx answer, or none in time, is a failure: an origin that hands the path on to the node would send every stranger's request round in a loop. The path is sent to the origin and printed nowhere. That request, with the path and a query of 144 letters, is in the origin's access log afterwards. `doctor` does not measure how long the origin keeps a connection that sends nothing.
6. The proxy path of every `ws` and `fronted` listener: whether anybody but this host can reach it, whether the web server in front speaks HTTP/1.1 to the node, and, from a running node, whether the requests it has read named their source in `client_address_header`.
7. Every link that is enabled, without dialing anything: a clock that is set, whether an exit with a `chain` backend names each entry half, whether its `mtu` is below that of an inbound with users, and, from a running node, each link's state.
8. Every DNS server of the config, those of `dns.servers` and then those of every DNS set: one query over UDP and the same query over TCP from the node itself, with the answer time. The line of a server of a set names the set, as in `set family, servers[0], udp`. A server that stands in two lists is asked once for each. Silence over UDP is a failure when some exit leaves directly, and a warning otherwise. Silence over TCP is a warning, because answers too long for one datagram and every lookup through a SOCKS5 proxy need TCP.
9. Every outbound. A `direct` one gets a TCP connect and a UDP exchange to the first DNS server it can reach from the node itself. A `socks5` one gets four separate lines: the TCP connect to the proxy, the handshake with the authentication of the config, a CONNECT through the proxy to the first DNS server with a real DNS query, and a UDP ASSOCIATE with a real DNS query through the relay. A proxy without UDP therefore shows as one clear warning on the last line. The relay must be on the host the control connection reached, as the node requires. The DNS servers meant here are those of `dns.servers`. The servers of DNS sets are not tried through the outbounds, and when the config has sets a `skipped` line (`sets, through the outbounds`) after the DNS lines says so: where the queries of a set leave through a proxy, doctor does not tell whether that proxy reaches the set's servers.
10. Every l3 exit (Linux only): `CAP_NET_ADMIN`, `/dev/net/tun`, `ip` and `nft` on the `PATH`, the forwarding sysctls as they are now and what the node would change with `masquerade`, and whether the interface name is free. When a running node has the exit and its interface is not there, a warning says the exit is down and being retried.
11. ICMP ping sockets, when a policy uses `icmp_echo: direct`.
12. The state file: a regular file or absent, a directory the user can write, the mode, and whether it parses.
13. The replay file, for a config with an obfuscated transport: a regular file or absent, a directory the user can write, whether it is a replay file, and its floor, its limit and the clock. A floor more than 80 seconds ahead of the clock is a failure, because the node then refuses every device for longer than any start costs. A floor up to 80 seconds ahead is what a start or a reset leaves, and the line says how long it lasts. A limit more than 80 seconds ahead of the clock is a warning: a clock ran ahead, and a node that is started on that file refuses every device until the clock passes the limit. A file that is not a replay file is a failure. Doctor reads the file and never moves or writes it.
14. The control socket path: what is there, and whether its directory can be written.

The four statuses: `ok` means the check passed. `warn` means the node starts and works, but something is likely not what you want. `fail` means the node would not start or would not work for the thing checked. `skipped` means the check was not tried because a step before it failed, or because of `--no-api`. A final line counts the statuses.

The exit status is 0 when nothing failed, 1 when a check failed (a config that reads but does not validate counts), and 2 when the config could not be read at all. Warnings do not change it.

## `veilway mirror`

`veilway mirror --config mirror.json` runs a relay mirror of a subscription endpoint, see [Relay mirrors](../../manuals/panel/#relay-mirrors). `--check` only validates the file and prints every error and warning; it exits with a non-zero status on an error. The file holds the secret it shares with the panel, so the command refuses a file that group or others can read. It is JSON, unknown members are errors, and it is read once at start. The command exists on Unix only.

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

The mirror forwards a `POST` with `Content-Type: application/octet-stream` and a body of exactly 1,073 bytes, a request sealed to the panel's gateway that the mirror cannot open, in HTTP/1.0 or HTTP/1.1. Anything else, and every request while the upstream fails or answers with anything but a `200` with `Content-Type: application/octet-stream` and a body of 9,413, 36,979, 140,867, 538,201 or 1,089,437 bytes (a sealed answer), the panel's own 599 included, is handed back with status 599 for the web server to answer. A sealed answer is passed on unchanged with that status and content type, and with `Cache-Control: no-store`. The panel is sent `X-Veilway-Mirror: v1;name;address;timestamp;nonce;mac`, where `mac` is HMAC-SHA-256 under the secret over `veilway mirror v1`, then the name, address, timestamp (seconds), nonce (16 random bytes) and the SHA-256 of the body, each after a line feed, with the nonce, the hash and the mac in unpadded base64url. The panel accepts it within 60 seconds of its clock and once per nonce.
