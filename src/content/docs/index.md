---
title: Introduction
description: What Veilway is, what the alpha includes, and how this documentation is organized.
---

Veilway is a proxy and VPN platform for networks that block or watch the internet. It has three parts:

- **The node** is a Rust program on your server. It accepts device connections, applies your routing rules, and sends traffic out through your exits.
- **The panel** is the operator's web page for users, inbounds, exits, routing and subscriptions.
- **The clients** are a desktop app for Linux, macOS and Windows, and an Android app.

The current release is the alpha, `v0.3.8-alpha`. Other software can use a node as a SOCKS5 or HTTP proxy, with a login per user. Routing rules can choose by the transport a user came in on. New in v0.2.0: HTTP/2 on the stream transports, tunnels through node links, offline bundles, Xray links in the desktop app, relays per user and per group, and borrowed-site mode (alpha, off by default).

- [The alpha release](./alpha/) lists what it includes, where each part stands and its known limits.
- The [install guide](./getting-started/) covers the node and the panel.
- The [client manual](./manuals/client/) covers the desktop app.
- The [Android app](./manuals/android/) covers the phone app.

Veilway does not make traffic undetectable. A network that looks closely can still recognize it. Read the [threat model](./security/threat-model/) first.

## How this documentation is organized

- **Getting started** and the **manuals** cover installing, running and using the software.
- **Protocol specification** covers the wire formats and the transports.
- **Config reference** and **Control API reference** cover the node's config file and control API.
- **SDK guides** cover the Rust and TypeScript libraries.
- **Security** holds the threat model and the status of the obfuscation layer.

The Persian pages match the English ones, except the protocol pages, which are still stubs in Persian.
