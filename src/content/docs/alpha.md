---
title: The alpha release
description: What Veilway v0.3.10-alpha includes, where each part stands, and its known limits.
---

The alpha is `v0.3.10-alpha`, after `v0.3.9-alpha`. Veilway is a node for a server, a web panel for its operator, and client apps. It is for people who want to try the software and report what breaks. It has had no outside security review. Do not rely on it for anything you cannot afford to lose access to.

Downloads and release notes:

- Node and install script: [v0.3.10-alpha release page](https://github.com/veilway-project/veilway/releases/tag/v0.3.10-alpha)
- Panel: [veilway-panel releases](https://github.com/veilway-project/veilway-panel/releases)

Report problems on the [issue tracker of the core repository](https://github.com/veilway-project/veilway/issues).

What changed in each release is in the [changelog](../changelog/). New here? Start with the [quick start](../quick-start/).

## What else the alpha includes

- **Node.** The `veilway` binary, with routing rules, users and quotas, per-user counters, and a control API on a unix socket. Install it with the [install script](../getting-started/) or the [Docker images](../getting-started/#install-with-docker).
- **Panel.** A web panel for users, inbounds, outbounds, exits, routing, subscriptions and traffic. It also has several admins, notices, DNS and logs, backup and restore, an update button, and a guided setup for an entry node and for a reverse link (see [Tunnel: a server in Iran in front of a foreign server](../guides/entry-node/)). It listens on loopback only, so put a web server with TLS in front of it. Read the [panel manual](../manuals/panel/).
- **Subscriptions.** Requests and answers are encrypted end to end, and links carry the panel's gateway key. You can assign named endpoints per user and per group, and a move to another endpoint is signed. Static mirrors and relay mirrors keep a subscription reachable, and the app asks before it uses a backup update address. Plain `http://` endpoints work, with a warning. See the [subscription format](../protocol/subscription-format/).
- **Xray add-on.** An optional add-on that runs the official `xray` binary beside the node, for people who use stock Xray apps. VLESS and Trojan with TLS and Shadowsocks work, over TCP and UDP. The desktop app connects to Xray links (see [Xray profiles](../guides/xray-profiles/)). See the [Xray add-on](../manuals/xray/) for the server side.
- **Transports.** Six ways for a client to reach a node: plain WireGuard over UDP (`udp`), UDP in Veilway's own envelope (`udp-obfs`), TLS that the node ends itself (`tls`), WebSocket behind your web server (`ws`), WebSocket over plain HTTP with no TLS (`ws-plain`, the weakest), and HTTP requests through a CDN (`fronted`). See the [transports page](../protocol/transports/).
- **Client TLS.** The client's TLS hello is built on BoringSSL and set up to match a current Chrome. Certificate checks still use the pins and chain rules described on the transports page.
- **Desktop app.** For Linux, macOS and Windows. It shows the connection's details, shares a subscription (the link only, as text, a QR code or a sealed file locked with a password), and updates itself. The [client manual](../manuals/client/) says where each platform stands.
- **Android app.** An arm64 APK with the same screens and its own in-app updater. See the [Android app manual](../manuals/android/).

## Where each part stands

| Part | Tested so far | Not yet |
|---|---|---|
| Node on Linux | Tests in the code, a check in Docker with two kernel WireGuard clients, and the alpha gate (55 checks): a fresh systemd server installed with the script from signed release files, through to a client connecting | Long use on a real server |
| Panel | Used by hand on a demo server with a real node, driven through its API by the alpha gate, and reviewed for security | Long use, and many admins at once |
| Xray add-on | The Xray gate (119 checks) in Docker: a stock Xray client over TCP and UDP through a node installed by the script | A real server, and Xray links in the Android app |
| Desktop on Linux | A check of 70 points in Docker, against a real node and client | A real machine with systemd-resolved, and a reboot |
| Desktop on macOS | Unit tests on a macOS runner | A real Mac. It has never connected |
| Desktop on Windows | Unit tests and a smoke test on a real Windows runner: the adapter, routes, DNS rule and kill switch take effect, nothing leaks, and disconnect undoes it | A connection to a real node on a real PC |
| Android | Builds in CI and in Docker, and used on a real phone (Android 14) against a demo node | The app's blocking during a reconnect, and Always-on VPN with Block connections without VPN on |

## Known limits

- **Every transport is rated Detectable.** A censor that looks closely can tell Veilway's traffic from ordinary traffic. Nothing in the alpha makes it undetectable or unblockable.
- **Desktop on macOS and Windows is compiled and tested on CI only.** It has never connected to a node on a real Mac or PC. On Windows the tunnel setup and cleanup passed a smoke test on a CI runner. Expect bugs in the routes, the firewall and DNS on both.
- **HTTP/2 and the shapes of `fronted` have not been run behind a real CDN.** `ws`, `ws-plain` and `fronted` were tested behind nginx and HAProxy in Docker. A real CDN may behave differently. On the node, `http2` is off unless you turn it on.
- **Borrowed-site mode is alpha.** It is off by default and labeled alpha in the panel and the apps. Only the project's own people have reviewed it, it is rated Detectable, and it has not run against real sites. Do not rely on it.
- **Not in this release.** Xray on Android, split tunneling and store builds. They are planned for a later release.
- **Some TLS details still differ from a browser.** No TLS session is resumed, and the fetch of a pinned subscription page sends a TLS hello that no browser sends.
- **Android has no deep links yet.** Import a subscription by pasting its link, scanning its QR code with the camera, or choosing its file or a picture of the code. While it runs, the app blocks traffic when the VPN drops. If the app is killed, use Android's Always-on VPN with Block connections without VPN, which is the full kill switch.
