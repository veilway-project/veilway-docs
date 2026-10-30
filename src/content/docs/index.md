---
title: Introduction
description: What Veilway is, who it is for, and which page to read first.
---

Veilway is a VPN for networks that block or watch the internet. You rent a server, install Veilway on it, and your phone or computer connects to that server. It is for people who run a VPN for themselves, their family or a small group.

It has three parts:

- **The node** runs on your server. It accepts connections from devices and sends their traffic out to the internet.
- **The panel** is the web page where you add users and manage the server.
- **The apps** are a desktop app for Linux and Windows, and an Android app. There is no iPhone app. macOS has only a command-line client that has never run on a real Mac.

The current release is the alpha, `v0.3.12-alpha`. It is for people who want to try the software and report what breaks. [The alpha release](./alpha/) says what works and what does not.

Veilway does not make traffic undetectable. A network that looks closely can still recognize it. Read the [threat model](./security/threat-model/) first.

New here? Start with the [Quick start](./quick-start/). Users in Iran who cannot reach servers abroad? Read [Tunnel: a server in Iran in front of a foreign server](./guides/entry-node/).

## Which page do I need?

- **One server abroad for me and my family:** [Quick start](./quick-start/), then [First inbound and user](./guides/first-user/).
- **A server in Iran in front of a server abroad (a tunnel):** [Tunnel: a server in Iran in front of a foreign server](./guides/entry-node/).
- **A server at home that I want to reach:** [Reach a home server through your VPS](./guides/home-server/).
- **A server that already runs x-ui or 3x-ui:** the [FAQ](./faq/#can-i-run-veilway-on-the-same-server-as-x-ui-or-3x-ui), then the [Xray add-on](./manuals/xray/).
- **Something not working or unclear:** the [FAQ](./faq/).

## How this documentation is organized

- **Quick start**, **Getting started** and **Connect your devices** cover installing and using the software.
- **Guides** and **Manuals** cover one task or one tool in detail.
- **Protocol specification**, **Config reference** and **Control API reference** are for people who build on or check Veilway.
- **SDK guides** cover the Rust and TypeScript libraries.
- **Security** holds the threat model and the status of the obfuscation layer.
- **Changelog** lists what changed in each release.

The Persian pages match the English ones, except the protocol pages, which are still stubs in Persian.
