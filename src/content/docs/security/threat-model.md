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

## What it does not protect against

- **Detection.** No transport is claimed to be undetectable or unblockable. Every transport is rated Detectable.
- **An observer who sees both ends.** Someone who watches your connection and the node's far side can match them by timing and volume.
- **The provider.** The node sees your address, every site you reach and every name you look up. Veilway is a VPN, not an anonymity network.
- **A compromised device, node or panel host.** The measures in the design limit how far one compromise spreads. They do not protect the machine that is compromised.
- **Large denial-of-service attacks on a node's address, and physical access to an unlocked device.**
- **The security of Xray's own protocols.** Those are whatever the Xray software provides.

## Reporting a vulnerability

Do not open a public issue. Use the private form described in `SECURITY.md`: [report a vulnerability](https://github.com/veilway-project/veilway/security/advisories/new). Remove real server addresses, keys, passwords and subscription links from your report.
