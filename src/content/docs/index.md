---
title: Introduction
description: What Veilway is, what the alpha includes, and how this documentation is organized.
---

Veilway is a proxy and VPN platform for people on networks that block or watch the internet. It has three parts that work together:

- **The node**, a Rust program that runs on your server. It accepts connections from devices, applies your routing rules, and sends traffic out through the exits you set up.
- **The panel**, a web page for the operator of a node. It manages users, inbounds, exits, routing and subscriptions.
- **The clients**, the apps people use on their devices: a desktop app for Linux, macOS and Windows, and an Android app.

The current release is the alpha, `v0.2.11-alpha`. It adds proxy chains for outbounds and node links, and its panel can update the node as well as itself. New in v0.2.0: HTTP/2 on the stream transports, tunnels through node links, offline bundles, Xray links in the desktop app, relays per user and per group, and borrowed-site mode as an alpha feature that is off by default. [The alpha release](./alpha/) says what it includes, where each part stands and what its known limits are. The [install guide](./getting-started/) covers the node and the panel. The [client manual](./manuals/client/) covers the desktop app, and the [Android app](./manuals/android/) covers the phone app.

Veilway does not make traffic undetectable. A network that looks closely can still recognize it. Read the [threat model](./security/threat-model/) before you depend on it.

## How this documentation is organized

- **Getting started** and the **manuals** are for operators and users: how to install, run and use the software.
- **Protocol specification** describes the wire formats and how the transports work.
- **Config reference** and **Control API reference** describe the node's config file and its control API.
- **SDK guides** cover the Rust and TypeScript libraries.
- **Security** holds the threat model and the status of the obfuscation layer.

The Persian pages say the same things as the English ones, except the protocol pages, which are still stubs in Persian.
