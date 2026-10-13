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

`version`, `dns`, `inbounds`, `outbounds`, `exits`, `routing` and `users` are required. `log` and `groups` are optional.

## Rules that apply everywhere

- **Strict JSON.** Unknown keys and duplicate keys are errors at every level. A byte order mark, data after the document, invalid UTF-8 and a NUL inside a string are errors. Where an integer is expected, only an integer token is accepted (`1`, never `1.0`).
- **Growth.** Version 1 only grows by new optional keys and new enum values. A build that meets a key or value it does not know refuses the file and says the config may be newer than the build.
- **Tags.** Inbounds, outbounds, exits and routing rules each have a `tag` matching `[a-z0-9][a-z0-9_-]{0,63}`, unique within its section. These words cannot be tags: `all`, `any`, `block`, `reject`, `drop`, `local`, `direct`, `user`.
- **References.** Every tag, user name and group name used anywhere must exist. A dangling reference is an error.
- **Lists.** A list never contains the same entry twice. Inside a routing rule, a condition that is present must not be an empty list.
- **Canonical spelling.** Numbers inside strings (a port, a prefix length, a `lo-hi` range) have no sign and no leading zeros. A timestamp uses `T` between date and time.
- **Addresses.** IPv4-mapped IPv6 addresses (`::ffff:a.b.c.d`) and addresses with a zone (`%eth0`) are errors everywhere. A network written with host bits set (`10.7.0.5/24`) is an error, except in an inbound's `address`, where the host part is the gateway. Port 0 is an error everywhere.
- **Secrets.** `private_key`, `preshared_key`, `username` and `password` are secrets. No error, warning, log line or API response contains a field's value, only its path (`outbounds[1].password`) and what was expected. On Unix, `veilway run` refuses a config file that group or others can read unless started with `--allow-readable-config`; `veilway check` warns.
- **Keys.** A WireGuard key is standard base64 with padding, exactly 44 characters, decoding to 32 bytes. Keys are compared as decoded bytes. An all-zero key is an error.
- **Paths.** A file path in the config is relative to the directory of the config file. Absolute paths and any `..` component are errors.
- **Limits.** File at most 64 MiB and at most 8,000,000 JSON values. At most 64 inbounds with 8 transports each, 256 outbounds, 256 exits, 256 groups, 32 DNS sets, 4096 routing rules, 1024 entries in any list inside a rule, 65,536 users and 16 devices per user.
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
| `type` | `wireguard` | required | Stock WireGuard peers. The `veilway` type arrives with the native protocol in Phase 2. |
| `private_key` | key | required | The tunnel's static key. Secret. Unique across inbounds, compared by the public key derived from it. |
| `address` | list of 1 or 2 networks | required | The gateway address with its prefix, at most one IPv4 and one IPv6, for example `["10.7.0.1/24", "fd7a:115c:a1e0::1/64"]`. The network is the address pool for this tunnel. |
| `mtu` | integer 1280 to 1500 | `1420` | MTU inside the tunnel. Above 1420 is a warning, since the outer packet then fragments on a normal path. |
| `transports` | list of 1 to 8 | required | See below. |

Rules for `address`:

- IPv4 prefix from /16 to /30, inside `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` or `100.64.0.0/10`. IPv6 prefix from /48 to /126, inside `fc00::/7`.
- The gateway is a host address in the pool, never the network address and, for IPv4, never the broadcast address.
- Pools of different inbounds do not overlap.

Who may use an inbound is decided by addresses alone: a device belongs to the inbound whose pool contains its address.

### `transports`

| `type` | Keys | Meaning |
|---|---|---|
| `udp` | `listen` (`ip:port`) | Plain WireGuard datagrams. |
| `ws` | `listen` (`ip:port`), `path`, optional `tls` with `cert` and `key` (both required) | One WireGuard datagram per binary WebSocket frame. Without `tls` it serves plain `ws` for a reverse proxy that terminates TLS; validation warns when such a listener is not on a loopback address. |

`path` starts with `/`, is at most 256 bytes from `A-Z a-z 0-9 . _ ~ / -`, has no `..` component, and is matched exactly against the request path before any `?`.

Engine: a `ws` connection that does not finish the WebSocket upgrade within 10 seconds is dropped, and one source (an IPv4 address or an IPv6 /64) may have 64 unfinished upgrades at once. This also applies to a reverse proxy in front of a plain `ws` listener, whose connections all come from one source.

Listen conflicts, across all inbounds:

- IPv6 sockets are always IPv6-only, so `0.0.0.0:443` and `[::]:443` do not conflict. A wildcard address conflicts with every address of its own family on the same port.
- Two `udp` transports never share an address and port.
- Two `ws` transports may share an address and port when their `path` differs and their `tls` is identical. Otherwise they conflict.

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

Three things hold whatever the rules say. A device can only send from its own addresses. A gateway address answers DNS and nothing else. Broadcast and multicast are not carried, so games that find each other by local broadcast will not see other players; connecting by address works.

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

More engine behaviour of `unsupported`:

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
| `addresses` | list of 1 to 16 host addresses, written without a prefix | required | The device's tunnel addresses. |

Each address must lie in the pool of exactly one inbound and may not be that pool's gateway, network or IPv4 broadcast address. A device has at most one IPv4 and one IPv6 address per inbound. No address is used by two devices.

Engine: when a user is disabled, expires, runs out of quota or is removed, or when a device's key or addresses change or it is removed, then within one second the core drops the session keys, resets every flow and clears the DNS memory that belong to it, and logs it at info. Expiry and quota are driven by a timer and by the byte count, not only checked at handshake. A backward step of the node's clock does not re-enable a user. Usage is kept outside this document, see below.

### Usage and quota

Engine. Usage never lives in the config document. It is kept in one state file (see `--state` under Commands) and survives reloads and restarts. Without a state file path the node keeps usage in memory only and it is lost on restart.

- **Counting.** `quota_bytes` counts inner IP bytes in both directions. Traffic that is rejected or answered locally counts too.
- **Over quota.** A user at or over quota is cut off by the same path as a disabled user, within one second, and the info log line names quota as the reason. The user cannot shake hands again until the period rolls over, a reload raises or removes the quota, or the operator resets the user's usage.
- **Period.** Without `quota_period` the count never resets by itself. With it the count resets at 00:00 UTC (weekly on Monday, monthly on the 1st).
- **Clock steps back.** A backward step of the clock by less than one period never resets a count and never re-enables a user, at that moment or when the clock moves forward again. The period start stays where it was.
- **A period start far in the future.** A period start that lies more than one whole period after the node's clock (more than 1 day for `daily`, 7 days for `weekly`, 31 days for `monthly`) is not trusted. It can come from a state file that was edited or written while the clock was wrong, or from a clock that was ahead by more than a period and was then set right. Left alone, such a count would not reset until the clock reached that time, which can be years. So the node sets the period start to the start of the period its clock is in, keeps `used_bytes`, and logs one warning that names the user. This is checked when the state file is loaded and four times a second while the node runs. The price: a clock that jumps back by more than a period and then forward again gives that period's quota a second time. Keep the node's clock synchronised.
- **Without `quota_period`.** Any period start after the node's clock is set to `0` with `used_bytes` kept and one warning. Nothing resets by itself for such a user, so this costs nothing.
- **Reset by the operator.** `veilway usage reset --user <name>`, or `POST /v1/users/{name}/usage/reset` on the control API, sets `used_bytes` to 0 and the period start to the start of the current period. A user who was over quota can connect again at once, without a reload. Lifetime totals are kept unless `--totals` (`"totals": true`) is given. See Commands and the control API reference.
- **Counters.** Every user, inbound and exit has totals of up and down bytes and packets, which the control API serves. They are totals; rates are computed by whoever polls. Counters follow names and tags across reloads. Exit counters count inner IP packets and bytes where a packet is handed to or taken from the exit, and a flow that leaves by way of another exit (`via`) is counted on the exit that carries it and not on the exit the rule chose.
- **State file.** Versioned JSON keyed by user name. Per user it holds the bytes used in the current quota period, the start of that period, and lifetime totals (up and down, bytes and packets).
- **Writes.** The file is written with mode 600 through a temporary file in the same directory, then fsync, then rename. It is written at most once every 10 seconds and only when something changed, once more on shutdown, right after a user is cut off for quota, and right after a usage reset. Writing never blocks traffic. A failed write is retried, and logged once and then every 10 minutes while writes keep failing. If the node is killed, at most about 10 seconds of counted usage can be lost.
- **Start.** A missing file means zero usage. A file that cannot be parsed, has an unknown version, or is larger than 16 MiB is kept under the same name with `.bad` appended, logged at error, and the node starts from zero, since an unreadable state file must not keep a node down. A state file that group or others can write is treated the same way. Values are clamped, never trusted: a count above 9007199254740991 saturates at it. One entry that is not a valid entry is skipped and only that user starts from zero. If the path is not a regular file (a directory, a symbolic link, a device), the node leaves it untouched, logs an error and keeps usage in memory until it stops.
- **Removed users.** The entry of a user the config no longer names is dropped at the commit that removes it. Renaming a user is removing one and adding another, so it starts from zero.

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
- DNS sets change without touching a tunnel or a session: a set can be added, removed, given other servers or given to other inbounds, groups and users. The next query of every user goes to the list the new config gives them.
- A user whose queries go to other servers than before loses the names the node remembered for them, so that no `domain` rule keeps matching by the word of a resolver that is no longer theirs. This is logged at info. What counts is the servers of the list the user's queries go to, looked at for each inbound their devices are on: moving a user, a group or an inbound into, out of or between sets clears the memory, and so does changing the `servers` of the set they are on. The same holds for `dns.servers`: changing it clears the memory of every user who resolves through it, which earlier builds did not do. The same servers in another order, and another set with the same servers, are no change. `domain` rules match for that user again as their names are resolved again; open flows are checked like after any reload.
- A query that is waiting for a server when the reload happens is answered by that server. Its answer is not remembered when the servers its user resolves through changed in the meantime.

## Commands

```
veilway run --config config.json
veilway run --config config.json --state veilway-state.json
veilway run --config config.json --api /run/veilway/veilway.sock
veilway run --config config.json --no-api
veilway check --config config.json
veilway doctor --config config.json
veilway doctor --config config.json --json --timeout 3
veilway usage reset --user alice
veilway usage reset --user alice --totals --api /run/veilway/veilway.sock
veilway schema
```

`run` refuses a config file that group or others can read unless started with `--allow-readable-config`. `run --state <file>` sets the path of the usage state file, `veilway-state.json` next to the config file by default. `run --api <path>` sets the unix socket of the control API, `veilway.sock` next to the config file by default, and `run --no-api` starts the node without the API; the two cannot be combined. Whoever can open the socket administers the node, see the control API reference. Both flags exist on Unix only. `check` prints every error and warning and exits with a non-zero status when there is an error. It gives the same answer on any operating system. `schema` prints the JSON Schema of this format.

`doctor` tries what a config needs of this host and of the network, once, before the node is started or after it misbehaves. It needs no running node. It never changes the node, the host or any file, and it never prints a secret: a line names tags, user-chosen names, field paths and listen addresses, and no other value of the config. `--config <file>` is the config to check (`config.json` by default). `--state <file>`, `--api <path>` and `--no-api` mean what they mean for `run`, with the same defaults. `--json` prints one JSON document with the same lines in place of text. `--timeout <seconds>` is how long each step on the network may take, 5 by default and 10 at most. Checks run a few at a time, so the command ends in well under a minute on a network that answers nothing.

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

Each check prints one line: its status, the kind of check, what it looked at, and one sentence on what was found and, on `warn` and `fail`, what to do about it. The checks run in this order:

1. The config file: its mode, and the validation report with every error and warning. A config that does not validate ends the run here, and everything after it is reported as `skipped`.
2. The control socket: whether a node answers on it. If one does, a listen address that is taken and an l3 interface that exists are expected, not failures.
3. Every listen address of every inbound: whether it can be bound right now, over UDP or over TCP as the transport needs. Transports that share an address are tried once.
4. Every certificate and key of a `ws` transport: both load, the key matches the certificate, the certificate is not expired and not yet valid, and the names it covers. Under 14 days left is a warning.
5. Every DNS server of the config, those of `dns.servers` and then those of every DNS set: one query over UDP and the same query over TCP from the node itself, with the answer time. The line of a server of a set names the set, as in `set family, servers[0], udp`. A server that stands in two lists is asked once for each. Silence over UDP is a failure when some exit leaves directly, and a warning otherwise. Silence over TCP is a warning, because answers too long for one datagram and every lookup through a SOCKS5 proxy need TCP.
6. Every outbound. A `direct` one gets a TCP connect and a UDP exchange to the first DNS server it can reach from the node itself. A `socks5` one gets four separate lines: the TCP connect to the proxy, the handshake with the authentication of the config, a CONNECT through the proxy to the first DNS server with a real DNS query, and a UDP ASSOCIATE with a real DNS query through the relay. A proxy without UDP therefore shows as one clear warning on the last line. The relay must be on the host the control connection reached, as the node requires. The DNS servers meant here are those of `dns.servers`. The servers of DNS sets are not tried through the outbounds, and when the config has sets a `skipped` line (`sets, through the outbounds`) after the DNS lines says so: where the queries of a set leave through a proxy, doctor does not tell whether that proxy reaches the set's servers.
7. Every l3 exit (Linux only): `CAP_NET_ADMIN`, `/dev/net/tun`, `ip` and `nft` on the `PATH`, the forwarding sysctls as they are now and what the node would change with `masquerade`, and whether the interface name is free. When a running node has the exit and its interface is not there, a warning says the exit is down and being retried.
8. ICMP ping sockets, when a policy uses `icmp_echo: direct`.
9. The state file: a regular file or absent, a directory the user can write, the mode, and whether it parses. Then the control socket path: what is there, and whether its directory can be written.

The four statuses: `ok` means the check passed. `warn` means the node starts and works, but something is likely not what you want. `fail` means the node would not start or would not work for the thing checked. `skipped` means the check was not tried because a step before it failed, or because of `--no-api`. A final line counts the statuses.

The exit status is 0 when nothing failed, 1 when a check failed (a config that reads but does not validate counts), and 2 when the config could not be read at all. Warnings do not change it.
