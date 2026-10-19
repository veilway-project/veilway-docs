---
title: The alpha release
description: What the Veilway alpha, v0.2.3-alpha, includes, where each part stands, and its known limits.
---

The alpha is `v0.2.3-alpha`. It follows `v0.2.2-alpha`. Veilway is a node for a server, a web panel for the node's operator, and client apps. It is for people who want to try the software and report what breaks. It has had no outside security review. Do not rely on it for anything you cannot afford to lose access to.

Downloads and release notes:

- Node and install script: [v0.2.3-alpha release page](https://github.com/veilway-project/veilway/releases/tag/v0.2.3-alpha)
- Panel: [veilway-panel releases](https://github.com/veilway-project/veilway-panel/releases)

Report problems on the [issue tracker of the core repository](https://github.com/veilway-project/veilway/issues).

## New in v0.2.3-alpha

- **Proxy chains.** A `socks5` outbound can go through another one with `via`, up to 8 proxies, and a node link this node dials can reach the other node through one. See `outbounds` in the [config reference](../reference/config/) and "Through an outbound" in [node links](../protocol/node-links/). In the panel it is the **Through** setting. SOCKS5 is not encrypted, so each earlier proxy sees the later proxies' credentials and the traffic.

## New in v0.2.2-alpha

- **Update the node from the panel.** The panel checks for a newer node release next to its own, and has **Update node**, **Update panel** and **Update both**. See [Updating the panel](../manuals/panel/#updating-the-panel). Updating the node restarts it, which drops every live tunnel for a moment.
- **The installer updates itself.** Every `veilway.sh update` also replaces the saved installer with the signed one of the same release, never with an older one. Servers installed before v0.2.2 need one update with the command in [Getting started](../getting-started/) to get it.
- **Installer.** The interactive install asks for the HTTPS port, and an empty domain name now skips the web server instead of stopping the install.

## New in v0.2.1-alpha

- **The panel is released again.** v0.2.0 shipped without a new panel release, so installs got the v0.1.0 panel. v0.2.1 ships the panel with all the v0.2.0 panel work: the borrowed-site transport, relays per user and per group, tunnels, bulk link reset, fronted-shaped presets and the HTTP/2 switch.
- **Profile editor.** The panel's hand-written profile editor has fronted-shaped and borrowed-site. Relays can carry fronted-shaped.
- **TLS names in profiles.** Profiles for `tls`, `ws` and fronted-shaped with a decoy take their TLS name from the certificate, the decoy or the node's DNS name. A transport with no name is left out and named on the Profiles page, instead of being published broken.
- **Installer.** `--https-port` with `--domain` puts the panel's web server on a port other than 443. See [Getting started](../getting-started/).

## New in v0.2.0-alpha

- **HTTP/2 on the stream transports.** The client speaks HTTP/2 like Chrome on `tls`, `ws` and `fronted`. The node offers it only when you turn on `http2`. See [HTTP/2](../protocol/http2/).
- **Shapes of `fronted`.** The panel has presets for them. See [Shapes of fronted](../protocol/fronted-shapes/).
- **Tunnels.** A node forwards a TCP or UDP port through a node link, with limits per source. See [Node links](../protocol/node-links/) and the [config reference](../reference/config/).
- **Offline bundles.** One signed file can carry app updates, subscription documents and notices. Make it with `veilway bundle make` and check it with `veilway bundle inspect`. The desktop and Android apps show what is in it, and nothing applies until the user taps. See [Offline bundles](../guides/offline-bundle/).
- **Xray links in the desktop app** on Linux, macOS and Windows: vless, vmess, trojan and ss. The add-on is installed on request from a pinned release, and these profiles show "TCP and UDP only". See [Xray profiles](../guides/xray-profiles/).
- **Borrowed-site mode (alpha, off by default).** A connection that does not prove itself is relayed to a real website, byte for byte. The panel sets it up, and the apps use it only after "Alpha transports" is turned on. It has had internal reviews only and is rated Detectable. See [Borrowed-site mode](../protocol/borrowed-site/).
- **Relays** per user and per group, and `veilway.sh install relay`.
- **Installer mirrors** are signed and refuse an older release. The installer can set up Caddy or nginx with a site you can edit. The mirror also exists as the separate veilway-release-mirror project, see [Release mirror](../guides/release-mirror/).
- **Panel.** Bulk link reset, tunnels, new subscription settings pages, and no more `/p-` in its address.
- **Smaller changes.** A malformed address in a subscription drops only that address. The node answers ping from its own devices.

## What else the alpha includes

- **Node.** The `veilway` binary, with routing rules, users and quotas, per-user counters, and a control API on a unix socket. Install it with the [install script](../getting-started/) or the [Docker images](../getting-started/#install-with-docker).
- **Panel.** A web panel for users, inbounds, outbounds, exits, routing, subscriptions and traffic. It also has several admins, notices, DNS and logs, backup and restore, an update button, and a guided setup for an entry node and for a reverse tunnel, see [Set up an entry node](../guides/entry-node/). It listens on loopback only, so a web server with TLS sits in front of it. Read the [panel manual](../manuals/panel/).
- **Subscriptions.** Requests and answers are encrypted end to end, and links carry the panel's gateway key. Named endpoints can be assigned per user and per group, and a move to another endpoint is signed. Static mirrors and relay mirrors keep a subscription reachable, and the app asks before it uses a backup update address. Plain `http://` endpoints are possible, with a warning. The [subscription format](../protocol/subscription-format/) has the details.
- **Xray add-on.** An optional add-on that runs the official `xray` binary beside the node. VLESS and Trojan with TLS and Shadowsocks work, over TCP and UDP. It is for people who use stock Xray apps. The desktop app connects to Xray links, see [Xray profiles](../guides/xray-profiles/). See the [Xray add-on](../manuals/xray/) for the server side.
- **Transports.** Five ways for a client to reach a node: plain WireGuard over UDP (`udp`), UDP in Veilway's own envelope (`udp-obfs`), TLS that the node ends itself (`tls`), WebSocket behind your web server (`ws`), and HTTP requests through a CDN (`fronted`). The [transports page](../protocol/transports/) has the details.
- **Client TLS.** The client's TLS hello is built on BoringSSL and set up to match a current Chrome. Certificate checks still use the pins and the chain rules described in the transports page.
- **Desktop app.** For Linux, macOS and Windows. It shows the connection's details, shares a subscription (the link only, as text, a QR code or a sealed file locked with a password), and updates itself. The [client manual](../manuals/client/) says where each platform stands.
- **Android app.** An arm64 APK with the same screens and its own in-app updater. Read the [Android app manual](../manuals/android/).

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

- **Every transport is rated Detectable.** A censor that looks closely can tell Veilway's traffic from ordinary traffic. Nothing in the alpha makes the traffic undetectable or unblockable.
- **Desktop on macOS and Windows is compiled and tested on CI only.** It has never connected to a node on a real Mac or PC. On Windows the tunnel setup and its cleanup passed a smoke test on a CI runner; expect bugs in the routes, the firewall and DNS on both systems.
- **HTTP/2 and the shapes of `fronted` have not been run behind a real CDN.** `ws` and `fronted` were tested behind nginx and HAProxy in Docker. A real CDN may behave differently. On the node, `http2` is off unless you turn it on.
- **Borrowed-site mode is alpha.** It is off by default and labeled alpha in the panel and the apps. Only the project's own people have reviewed it, it is rated Detectable, and it has not run against real sites. Do not rely on it.
- **Not in this release.** Xray on Android, split tunneling and store builds. They are planned for v0.3.0.
- **Some TLS details still differ from a browser.** No TLS session is resumed, and the fetch of a pinned subscription page sends a TLS hello that no browser sends.
- **Android has no camera QR scan and no deep links yet.** Import a subscription by pasting its link or choosing its file or a picture of its QR code. While it runs, the app blocks traffic when the VPN drops. If the app is killed, use Android's Always-on VPN with Block connections without VPN, which is the full kill switch.
