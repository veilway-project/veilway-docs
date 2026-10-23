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
- **No way to the node's own networks.** The destination gate refuses the node's own addresses and pools before any rule. Names are resolved by the node, never by the host.
- **Requests that smuggle another one.** The HTTP reader is strict and bounded, one plain request is carried to a connection, and nothing written behind it reaches the origin. A fuzz target covers both front ends.

What is not defended: everything above that says "not encrypted"; a censor that finds the port can block it and learn what it is; whoever learns a user's proxy password is that user on every proxy inbound that admits them until it changes; and the operator sees what users do through the node. The model has not been reviewed by anyone outside the project.

## What it does not protect against

- **Detection.** No transport is claimed to be undetectable or unblockable. Every transport is rated Detectable.
- **An observer who sees both ends.** Someone who watches your connection and the node's far side can match them by timing and volume.
- **The provider.** The node sees your address, every site you reach and every name you look up. Veilway is a VPN, not an anonymity network.
- **A compromised device, node or panel host.** The measures in the design limit how far one compromise spreads. They do not protect the machine that is compromised.
- **Large denial-of-service attacks on a node's address, and physical access to an unlocked device.**
- **The security of Xray's own protocols.** Those are whatever the Xray software provides.

## Reporting a vulnerability

Do not open a public issue. Use the private form described in `SECURITY.md`: [report a vulnerability](https://github.com/veilway-project/veilway/security/advisories/new). Remove real server addresses, keys, passwords and subscription links from your report.
