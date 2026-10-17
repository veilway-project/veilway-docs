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
- **Panel.** A web panel for users, inbounds, outbounds, exits, routing, subscriptions and traffic. It also has several admins, notices, DNS and logs, backup and restore, an update button, and a guided setup for an entry node and for a reverse tunnel, see [Set up an entry node](../guides/entry-node/). It listens on loopback only, so a web server with TLS sits in front of it. Read the [panel manual](../manuals/panel/).
- **Subscriptions.** Requests and answers are encrypted end to end, and links carry the panel's gateway key. Named endpoints can be assigned per user and per group, and a move to another endpoint is signed. Static mirrors and relay mirrors keep a subscription reachable, and the app asks before it uses a backup update address. Plain `http://` endpoints are possible, with a warning. The [subscription format](../protocol/subscription-format/) has the details.
- **Xray add-on.** An optional add-on that runs the official `xray` binary beside the node. VLESS and Trojan with TLS and Shadowsocks work, over TCP and UDP. It is for people who use stock Xray apps. The Veilway apps do not connect to Xray links. See the [Xray add-on](../manuals/xray/).
- **Transports.** Five ways for a client to reach a node: plain WireGuard over UDP (`udp`), UDP in Veilway's own envelope (`udp-obfs`), TLS that the node ends itself (`tls`), WebSocket behind your web server (`ws`), and HTTP requests through a CDN (`fronted`). The [transports page](../protocol/transports/) has the details.
- **Client TLS.** The client's TLS hello is built on BoringSSL and set up to match a current Chrome. Certificate checks still use the pins and the chain rules described in the transports page.
- **Desktop app.** For Linux, macOS and Windows. It shows the connection's details, shares a subscription (the link only, as text, a QR code or a sealed file locked with a password), and updates itself. The [client manual](../manuals/client/) says where each platform stands.
- **Android app.** An arm64 APK with the same screens and its own in-app updater. Read the [Android app manual](../manuals/android/).

## Where each part stands

| Part | Tested so far | Not yet |
|---|---|---|
| Node on Linux | Tests in the code, a check in Docker with two kernel WireGuard clients, and the alpha gate (55 checks): a fresh systemd server installed with the script from signed release files, through to a client connecting | Long use on a real server |
| Panel | Used by hand on a demo server with a real node, driven through its API by the alpha gate, and reviewed for security | Long use, and many admins at once |
| Xray add-on | The Xray gate (119 checks) in Docker: a stock Xray client over TCP and UDP through a node installed by the script | A real server, and the Veilway apps connecting to Xray links |
| Desktop on Linux | A check of 70 points in Docker, against a real node and client | A real machine with systemd-resolved, and a reboot |
| Desktop on macOS | Unit tests on a macOS runner | A real Mac. It has never connected |
| Desktop on Windows | Unit tests and a smoke test on a real Windows runner: the adapter, routes, DNS rule and kill switch take effect, nothing leaks, and disconnect undoes it | A connection to a real node on a real PC |
| Android | Builds in CI and in Docker, and used on a real phone (Android 14) against a demo node | The app's blocking during a reconnect, and Always-on VPN with Block connections without VPN on |

## Known limits

- **Every transport is rated Detectable.** A censor that looks closely can tell Veilway's traffic from ordinary traffic. Nothing in the alpha makes the traffic undetectable or unblockable.
- **Desktop on macOS and Windows has never connected to a node on a real machine.** On Windows the tunnel setup and its cleanup passed a smoke test; expect bugs in the routes, the firewall and DNS on both systems.
- **`fronted` speaks HTTP/1.1 only, and it has not been run behind a real CDN.** `ws` and `fronted` were tested behind nginx and HAProxy in Docker. A real CDN may behave differently. HTTP/2 for the stream transports is designed and not built, see [HTTP/2](../protocol/http2/).
- **Designed and not built.** Other shapes of `fronted` ([Shapes of fronted](../protocol/fronted-shapes/)) and borrowed-site mode, the `faketls` transport ([Borrowed-site mode](../protocol/borrowed-site/)), are specifications only, and none of them is in this alpha. Borrowed-site mode is planned to ship in version 0.2.0 as an alpha feature: off by default, labeled alpha in the panel and the apps, and without outside review.
- **Some TLS details still differ from a browser.** No TLS session is resumed, and the fetch of a pinned subscription page sends a TLS hello that no browser sends.
- **Android has no camera QR scan and no deep links yet.** Import a subscription by pasting its link or choosing its file or a picture of its QR code. While it runs, the app blocks traffic when the VPN drops. If the app is killed, use Android's Always-on VPN with Block connections without VPN, which is the full kill switch.
