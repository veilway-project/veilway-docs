---
title: Threat model
description: Who Veilway is designed against, what it does not protect against, and how to report a vulnerability.
---

The full threat model is `THREAT_MODEL.md` in the [main repository](https://github.com/veilway-project/veilway/blob/main/THREAT_MODEL.md). That file is the authoritative version and is much more detailed. This page is a short summary for operators and users.

## Who it is designed against

- A censor that watches the network, records it, and probes servers actively. This is the main case. See [Obfuscation layer status](../obfuscation/) for what the transports do about it and what they leave visible.
- A malicious provider, and a malicious subscription, theme file, link or provider card.
- A stolen panel session, a compromised node, and a hostile peer inside the tunnel.
- A hostile upstream proxy, a static mirror host, and the Xray add-on.
- Anyone who reaches a proxy inbound of the node, see [Proxy inbounds](#proxy-inbounds).
- An attacker on the update and download path, a supply-chain attacker, and an attacker on the local network (a rogue access point or DHCP server).

Every parser that reads network input, subscription data, theme files or provider content is treated as attacker-controlled.

## What Veilway is designed to protect

- The content of your traffic between the app and the node, which WireGuard encrypts.
- Your subscription, which the app checks against the provider's signature before it reads it.
- Your device's routes and DNS settings, with a kill switch so that traffic does not leave outside the tunnel.
- Other users of a node from a hostile user, within what the node's routing rules allow.

## Designed, not built

Three designs for version 0.2.0 are specified and not built: [HTTP/2](../../protocol/http2/) on the stream transports, [other shapes of `fronted`](../../protocol/fronted-shapes/), and [borrowed-site mode](../../protocol/borrowed-site/) (`faketls`). They are not part of what this page describes. Borrowed-site mode would ship as alpha, off by default, without outside review. It changes the threat model in these ways:

- **A third party that never agreed.** The node relays strangers to a real site that the operator borrows. The site carries every probe and every stranger's connection, from the node's address, and can be harmed by it. The operator must choose the site and acknowledge this.
- **A new parser of attacker input.** The node reads a TLS ClientHello from any stranger, in clear on the path, and decides on it.
- **A proof in the clear.** A holder of the node's `faketls` key can open every hello a censor has recorded and so learn the time and source of every connection, and can answer a client as the node. The tunnel stays protected by WireGuard.
- **Not a stronger rating.** It is rated Detectable until its tests pass.

The full model, `THREAT_MODEL.md`, has the rows.

## Proxy inbounds

A node may serve `socks5`, `http` and `mixed` proxy inbounds, which let other software use it as a plain proxy (v0.2.17 and later). They are listeners with no cover: nothing about them looks like a web site, and nothing in them is encrypted. Every connection logs in as a user with that user's proxy password, and then runs through the same destination gate, rules, exits, entitlement, quota and counters as the tunnel. The full model is section 5.16 of `THREAT_MODEL.md`, risks P1 to P10. What it means for an operator:

- **Not encrypted.** Anyone on the path reads the password, every destination and the content. Only loopback passes without a warning. A private address warns, since it may be NATed to a public one. Any other address needs `public: true` and warns. The panel rates a proxy inbound Unsafe. Listen on loopback, behind a tunnel or a TLS front you run.
- **No open proxy.** There is no anonymous method. SOCKS5 offers only user name and password, and HTTP answers 407. A login is a user of the config with a `proxy_password` the inbound admits. A user who is disabled, expired or over quota is refused, and a cut-off ends the user's connections within a second.
- **Guessing.** Passwords have 16 to 128 characters. A source that fails 10 logins to one name in 60 seconds is refused that name, and the wait for a name grows with its failures. Connections, connections per source and unfinished logins are capped.
- **UDP has no login of its own.** The relay carries only datagrams from the client's address and, off loopback, from the port the client named. A client behind a NAT gets no UDP unless the operator turns on `udp_any_port`, which lets a sender that shares the client's address take the association before the client's first datagram.
- **No way to loopback or the node's tunnel networks.** The destination gate refuses loopback, link-local, the cloud metadata addresses and every tunnel pool before any rule. The node's own public addresses are open unless a `host:self` rule refuses them, see [Reaching the server itself](#reaching-the-server-itself). Names are resolved by the node, never by the host.
- **Requests that smuggle another one.** The HTTP reader is strict and bounded, one plain request is carried to a connection, and nothing written behind it reaches the origin. A fuzz target covers both front ends.

What is not defended: everything above that says "not encrypted"; a censor that finds the port can block it and learn what it is; whoever learns a user's proxy password is that user on every proxy inbound that admits them until it changes; and the operator sees what users do through the node. The model has not been reviewed by anyone outside the project.

## Xray outbounds

A node may carry an exit through a VLESS, VMess, Trojan or Shadowsocks server of another party (v0.2.18 and later). The full model is section 5.17 of `THREAT_MODEL.md`, risks X1 to X8. What it means for an operator:

- **The provider sees the exit.** Its owner sees the node's address, every destination and every byte the destination does not protect, for all users sent through it. It does not see users, their tunnel addresses or keys. There is no anonymity from it.
- **The provider's server cannot lead back into the node.** A literal address must pass the node's dial rules, and a name is looked up by the node itself, never by Xray or the host's resolver. That lookup is plain UDP DNS, so the provider's name can be seen by whoever sees the node's DNS. Use the address to hide it.
- **Nothing goes around a down outbound.** The flow ends with a reason. It never goes to `direct`, to another exit or to the provider's default, and `unsupported.udp` of such an exit may not be `direct` or `via`.
- **A share link is read by the same reader as the desktop app**, and what passes becomes typed fields. The link is never kept, shown or logged, and certificates are always checked.
- **The sockets are Xray's.** Each outbound is a Unix socket in a folder only the node's user and Xray's can enter, with a password made new at each start. The node checks that the socket belongs to Xray's user before it sends a byte.
- **A change restarts Xray**, which drops Xray inbound users for a moment.

What is not defended: Xray's own egress, which its unit does not restrict, so a bug in Xray is not held to the provider's address; a hostile provider's bytes, which Xray parses, so a flaw in Xray-core would give an attacker the outbound credentials and every Xray user's flows; and availability, since the provider can cut the exit. Only Linux nodes run it. The model has not been reviewed by anyone outside the project.

## WireGuard outbounds

A node may carry an exit through a WireGuard server of another party (v0.3.6 and later). The full model is section 5.20 of `THREAT_MODEL.md`, risks W1 to W7. What it means for an operator:

- **The server sees the exit.** Its owner sees the node's address, every destination and every byte the destination does not protect, for all users sent through it. It does not see users, their tunnel addresses or keys: every flow leaves from one tunnel address. There is no anonymity from it, and a hostile server can forge DNS answers and unprotected content.
- **The server cannot reach the node.** Anything it sends that is not an answer to a flow the node opened is dropped and counted, and never answered: no reset, no ping reply, no open port. Its queues and flow counts are bounded, so a flood does not grow the node's memory. One user holds at most a quarter of the flows.
- **Users can reach the server's own network.** Its other peers and private ranges are open to them unless a routing rule rejects those ranges. The node only refuses its own addresses and networks, and validation warns about every WireGuard outbound.
- **A forged name cannot aim the node at itself.** An address that is loopback, in an inbound's pool or the node's own is refused. A forged address to somewhere else cannot finish the handshake, because the server's key is in the config, so the outbound is down and nothing but handshakes is sent.
- **Nothing goes around a down tunnel.** The outbound is down about 20 seconds after the server goes silent, and every flow of the exit ends with a reason. It never goes to `direct`, to another exit or to the default, and `unsupported.udp` may not be `direct` or `via`.
- **Keys stay put.** The keys are never shown or logged. A key may not be one the config uses anywhere else, so a leak of one opens nothing else.

What is not defended: the outer UDP is plain WireGuard, so a censor can recognize and block it (use an Xray outbound where that matters); one outbound runs on one core and ends every flow twice, so its speed is bounded; a flaw in the WireGuard or TCP/IP code the node uses on the server's bytes would be reachable by that server; and a server that finishes the handshake and then drops everything keeps the outbound up until the next rekey or keepalive, about 35 seconds on a busy tunnel and up to 2.5 minutes on an idle one. The model has not been reviewed by anyone outside the project.

## Reaching the server itself

Since v0.3.6, users reach services on the node's own public addresses unless a rule refuses them. The routing name `host:self` stands for every address the machine holds, read from its interfaces every 60 seconds. An operator who runs other services there (another panel, a database, an admin port) adds `{"tag": "no-self", "ip": ["host:self"], "action": "reject"}` to the rules. It holds for every exit, door and node link. Nothing adds that rule for the operator. See [Reaching the server itself](../../reference/config/#reaching-the-server-itself).

- **Still refused whatever the rules say:** loopback, link-local, the cloud metadata addresses and every tunnel pool. The panel listens on `127.0.0.1` only, so users cannot reach it.
- **What the rule cannot name:** an address no interface holds (a public address behind a 1:1 NAT), an anycast address and a broadcast address. They stay reachable.
- **A service that listens on every address** is reachable through any of them until the rule is added.
- **A gateway address** answers DNS, ping, and on a `veilway` inbound the control channel, for its own inbound only.

## Node links

A link joins two nodes, and its full model is in the node links page and the threat model. What it means for an operator:

- **Pairing rests on two fingerprints** that the operators read to each other. Nothing else protects the pairing, and the key agreement in it has had no outside review.
- **A self-signed link rests on the same fingerprint.** A `tls` candidate with `self_signed` is trusted through its pins alone, with no certificate authority. Whoever steals the key file of that transport can pose as the exit until the link is paired again.
- **A new key is told, never hidden.** The node remembers the pin of each `tls` transport and warns once when it changes, naming the links that pin the old key. It still serves the new certificate. The dialling node reports `pin_mismatch`, not "unreachable", and never falls back to no pin.
- **Chaining is off by default.** With `allow_chain` on the exit half, a link's traffic may continue through another link, at most 3 links in a row, never through an upstream. The hop limit is only a loop guard between nodes that follow it. The entry cannot see or limit what happens at the middle node, which sees every destination of the flows it forwards.

## Other providers' subscriptions

An exit that uses another provider's subscription (an upstream) is held to section 5.15 of `THREAT_MODEL.md`, risks U1 to U9. The provider sees the node's address and every destination, DNS name and unprotected byte of the flows sent to it. A hostile provider cannot steer the node at its own host or networks: every dial address of every profile it lists is refused if it is loopback, an inbound pool, the node itself or private (unless allowed). Failover between profiles is bounded, so a provider cannot make the node walk through them by cutting it off. `PATCH /v1/upstreams/{tag}` changes only the profile, failover, transport and exit, never the link, the keys or what the node may dial. Nothing goes around a down upstream.

## Speed limits

A user's `speed_up` and `speed_down` only delay or drop. They never reroute a flow or change what a rule decided. TCP the node holds as a stream is delayed, and other traffic over the rate is dropped and counted. DNS and the control channel are never dropped. The limit is per node, so a user online on several nodes at once gets the limit on each, and a per-account cap is not built.

## Exit load

An exit with a `load` setting tells devices a level of low, medium or high, never a number. The level changes only after it held for two looks 10 seconds apart, and a device is told a change at most once a minute. So a peer learns at most that the exit got busier, a minute late, and not when one other user starts or stops. Without the setting the node sends nothing about other users' traffic.

## What it does not protect against

- **Detection.** No transport is claimed to be undetectable or unblockable. Every transport is rated Detectable.
- **An observer who sees both ends.** Someone who watches your connection and the node's far side can match them by timing and volume.
- **The provider.** The node sees your address, every site you reach and every name you look up. Veilway is a VPN, not an anonymity network.
- **A compromised device, node or panel host.** The measures in the design limit how far one compromise spreads. They do not protect the machine that is compromised.
- **Large denial-of-service attacks on a node's address, and physical access to an unlocked device.**
- **The security of Xray's own protocols.** Those are whatever the Xray software provides.

## Reporting a vulnerability

Do not open a public issue. Use the private form described in `SECURITY.md`: [report a vulnerability](https://github.com/veilway-project/veilway/security/advisories/new). Remove real server addresses, keys, passwords and subscription links from your report.
