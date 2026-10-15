---
title: The alpha release
description: What the Veilway alpha, v0.1.0-alpha, includes, where each part stands, and its known limits.
---

The alpha is `v0.1.0-alpha`. It is the first public release of Veilway: a node for a server, a web panel for the node's operator, and client apps. It is for people who want to try the software and report what breaks. Do not rely on it for anything you cannot afford to lose access to.

Downloads and release notes:

- Node and install script: [veilway releases](https://github.com/veilway-project/veilway/releases)
- Panel: [veilway-panel releases](https://github.com/veilway-project/veilway-panel/releases)

Report problems on the [issue tracker of the core repository](https://github.com/veilway-project/veilway/issues).

## What the alpha includes

- **Node.** The `veilway` binary, with routing rules, users and quotas, per-user counters, and a control API on a unix socket. Install it with the [install script](../getting-started/) or the [Docker images](../getting-started/#install-with-docker).
- **Panel.** A web panel for users, inbounds, outbounds, exits, routing, subscriptions and traffic. Read the [panel manual](../manuals/panel/).
- **Transports.** Five ways for a client to reach a node: plain WireGuard over UDP (`udp`), UDP in Veilway's own envelope (`udp-obfs`), TLS that the node ends itself (`tls`), WebSocket behind your web server (`ws`), and HTTP requests through a CDN (`fronted`). The [transports page](../protocol/transports/) has the details.
- **Client TLS.** The client's TLS hello is built on BoringSSL and set up to match a current Chrome. Certificate checks still use the pins and the chain rules described in the transports page.
- **Desktop app.** For Linux, macOS and Windows. The [client manual](../manuals/client/) says where each platform stands.
- **Android app.** An arm64 APK. Read the [Android app manual](../manuals/android/).

## Where each part stands

| Part | Tested so far | Not yet |
|---|---|---|
| Node on Linux | Tests in the code, and a check in Docker with two kernel WireGuard clients | A fresh server install checked against the release, and long use |
| Panel | Built and reviewed once | A run against a real node |
| Desktop on Linux | A check of 70 points in Docker, against a real node and client | A real machine with systemd-resolved, and a reboot |
| Desktop on macOS | Unit tests on a macOS runner | A real Mac. It has never connected |
| Desktop on Windows | Unit tests on a Windows runner | A real PC. It has never connected |
| Android | Builds in CI and in Docker | A real phone, with the app's blocking during a reconnect and Always-on VPN with Block connections without VPN on |

## Known limits

- **Every transport is rated Detectable.** A censor that looks closely can tell Veilway's traffic from ordinary traffic. Nothing in the alpha makes the traffic undetectable or unblockable.
- **Desktop on macOS and Windows has never connected on a real machine.** Expect bugs in the routes, the firewall and DNS on those systems.
- **`fronted` speaks HTTP/1.1 only, and it has not been run behind a real CDN.** `ws` and `fronted` were tested behind nginx and HAProxy in Docker. A real CDN may behave differently.
- **Some TLS details still differ from a browser.** No TLS session is resumed, and the fetch of a pinned subscription page sends a TLS hello that no browser sends.
- **Android has no camera QR scan and no deep links yet.** Import a subscription by pasting its link or choosing its file. While it runs, the app blocks traffic when the VPN drops. If the app is killed, use Android's Always-on VPN with Block connections without VPN, which is the full kill switch.
