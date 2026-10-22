---
title: The alpha release
description: What the Veilway alpha, v0.2.14-alpha, includes, where each part stands, and its known limits.
---

The alpha is `v0.2.14-alpha`. It follows `v0.2.13-alpha`. Veilway is a node for a server, a web panel for the node's operator, and client apps. It is for people who want to try the software and report what breaks. It has had no outside security review. Do not rely on it for anything you cannot afford to lose access to.

Downloads and release notes:

- Node and install script: [v0.2.14-alpha release page](https://github.com/veilway-project/veilway/releases/tag/v0.2.14-alpha)
- Panel: [veilway-panel releases](https://github.com/veilway-project/veilway-panel/releases)

Report problems on the [issue tracker of the core repository](https://github.com/veilway-project/veilway/issues).

## New in v0.2.14-alpha

- **`ws-plain`.** A WebSocket over plain HTTP to your own web server, with no TLS, for networks where TLS to your server is blocked or slowed and plain HTTP passes. It is the weakest transport: the network sees the server's name and the token, so it has its own consent question in the apps, its own transport keys and its own cookie. Add it on **Inbounds**, and set **Plain HTTP host name** (a name no other transport uses) and **Plain HTTP port** on **Profiles**. The client drops a `ws-plain` transport whose host or path a covered transport of the subscription uses, and keeps the rest of the profile. An app older than v0.2.14 does not know the type and refuses a profile that lists it, so update the apps first. See [`ws-plain`](../protocol/transports/#ws-plain-websocket-without-tls) and the [config reference](../reference/config/).
- **The panel rotates transport keys.** Every inbound's key and every `ws-plain` key is replaced after **Rotate transport keys every** days (7 to 30, 30 by default; a `ws-plain` key at most 7). The old key keeps working for one more period, and the published profiles get the new public key without you publishing. The panel never holds a private key. See [Transport keys](../manuals/panel/#transport-keys).
- **Relays only.** A switch on each profile gives apps only relay addresses, never the node's own. A user whom no relay reaches gets no profile for that inbound. Xray links are not affected.
- **Relay ports per inbound.** When a relay carries two inbounds with the same transport type, it has one port field for each inbound and type.
- **Check for updates.** A button on **Nodes**, next to **Restart node** and **Restart panel**, asks GitHub now, at most once a minute. The panel SDK has `checkUpdates()`.
- **`veilway remove`.** The command line client removes a subscription and tells the provider first, as the apps do, so the device's place is freed.
- **A reset after an upgrade answer on plain HTTP** counts as the network's answer, not a refusal, as a Windows test showed.
- **Apps skip a transport they do not know.** An app from this release keeps a profile that has a transport of a newer type, leaves that transport out, and says an update adds a way of connecting. Apps before v0.2.14 still drop the whole profile, so have users update before you add `ws-plain`.
- **MTU probes vary.** Each probe of an MTU run comes down by a random 0 to 16 bytes, never below the tunnel's floor, so the sizes are not one fixed list on every device.

## New in v0.2.13-alpha

- **WebSocket connects.** The panel gave apps the node's own listener port for a `ws` or `fronted-shaped` transport, where it only reads plain HTTP from your web server, so those connections never connected. Apps now get the web server's port: 443, or **Web server port** on the profile. Publish the profiles once after updating.
- **Restart panel** reloads the page once the panel is back, not after a fixed 8 seconds.

## New in v0.2.12-alpha

- **Adding a device no longer gets stuck on "asked too often".** The panel lets an account add one new device per wait, and the wait is now the setting **Wait between new devices of one account**: 1 minute by default (it was 10), 0 for none. A refused try no longer extends the wait, and a cancelled import gives it back. This is a panel change: a v0.2.11 node works with it.

## New in v0.2.11-alpha

- **Automatic exit that switches.** When a device is on **Automatic** and its exit stops working, it leaves through one of the exits the operator lists under **Exits Automatic may switch to** (`routing.fallback`), and comes back once its own works again. Without that list nothing switches, so an entry node still never sends traffic around a link that is down. The node now finds out when an exit through a SOCKS5 proxy stops working: 3 failed connections to the proxy in a row mark it down, and the node checks it again every 30 seconds. The apps show which exit Automatic is using, such as **Automatic: Amsterdam**. It needs the node of v0.2.11. See `exits` on the [control channel page](../protocol/control-channel/).
- **Removing a subscription frees its place.** When you remove a subscription in the app, the app first tells the provider, and the panel removes the device. Before, the device kept its place on the account until the operator removed it. It needs the app and the panel of v0.2.11.
- **Idle devices.** The panel setting **Remove devices that have not refreshed for** removes devices whose app has not refreshed in that many days, such as an uninstalled app or a lost phone. It is off by default. See [Subscription settings](../manuals/panel/#subscription-settings).
- **Panel SDK.** `@veilway/panel-sdk` has a method for every route an API token may call.

## New in v0.2.10-alpha

- **`udp-obfs` on networks with small packets.** On some mobile and home networks, packets above about 1370 bytes are lost. There `udp-obfs` failed: small requests worked, HTTPS sites did not load, and the app kept reconnecting. When the tunnel has IPv4 addresses only, which is the case for every device the panel adds, the app now tests packet sizes down to 1080 and keeps the largest that works. It needs the node and the app of v0.2.10. With an older node the app stops at 1280 as before.
- **Padding.** The app no longer pads `udp-obfs` packets above the size the test found, and its test packets carry no padding, as the node's already did. Before, padding could make packets too large for the network right after the size was lowered.

## New in v0.2.9-alpha

- **Restart from the panel.** **Restart node** and **Restart panel** on this node's card on **Nodes**. A node restart drops every connected device for a moment. The installer of v0.2.9 does the restart, and an update from the panel installs it. See [Updating the panel](../manuals/panel/#updating-the-panel).
- **Update progress.** The desktop and Android apps show the bar while an update downloads. Before, only the percentage showed.

## New in v0.2.8-alpha

- **Outbound on a network interface.** A `direct` outbound can name a network interface of the server with `interface`, such as `eth1`, so its traffic leaves through that card. It works on Linux and macOS, and `veilway doctor` says when the interface is missing. In the panel it is the **Network interface** setting of a Direct outbound. See `outbounds` in the [config reference](../reference/config/).
- **Host names for the node and relays.** **Node address** and a relay's address may be a host name, such as the node's domain or a content delivery network's. The panel looks it up each time it makes a user's subscription and puts the current IP addresses into the profiles, so apps still never look a name up themselves. Hand-written profiles take host names too. Before, a host name as **Node address** made every app say the subscription could not be read.
- **Addresses per inbound.** Each profile on **Profiles** has **Addresses**, the IP addresses or host names apps reach that inbound at. An inbound that listens on a public IP address is reached there by default. See [Profiles](../manuals/panel/#profiles).
- **Keys from the panel.** The private key and transport key fields of an inbound have **Generate**, so the first setup needs no `veilway genkey` on the server. The panel puts the transport key's public half in the profile by itself, like the inbound key's.
- **Android updates install.** On Android 10 and later the app downloaded an update but never showed the installer, so it downloaded again on the next tap. The installer now opens while the app is on screen, and a failed install says why. A phone on v0.2.7 or older needs this update installed by hand once, from the release page.

## New in v0.2.7-alpha

- **Easier first setup.** The first endpoint becomes the default by itself, and a missing default now says where to pick one. The panel makes each inbound's public key from the private key it applies, so a profile is ready to publish without pasting the key. The new guide [First inbound and user](../guides/first-user/) goes from the first sign-in to a user's link.
- **Security.** `rustls-webpki` 0.103.16 and `webpki-roots` and `webpki-root-certs` 1.0.10, for advisories about distrusted certificate intermediates (RUSTSEC-2026-0381, 0382 and 0383), in the node, the panel and the apps.

## New in v0.2.6-alpha

- **Fixed.** `veilway.sh admin` and `status` no longer say an admin has not signed in with an authenticator code while two-step sign-in is off.

## New in v0.2.5-alpha

- **Reset an admin password from the server.** `sudo bash veilway.sh admin reset <username>` gives a locked-out admin a new password, and `sudo bash veilway.sh admin` lists the usernames. Menu entry 12 does both, and `status` now shows the admin pages address, the subscription path and the admins. See [Getting started](../getting-started/#commands).

## New in v0.2.4-alpha

- **Xray caps only the profiles on its address.** Put Xray on a separate IP address of the server, with its own host name, and the other profiles keep their rating. See [Xray add-on](../manuals/xray/).
- **Panel.** Xray is a choice when you add an inbound. Account, Display has a layout direction, and the docs and the website have the same choice. The side panel's config counter reads as a config version.

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
- **Transports.** Six ways for a client to reach a node: plain WireGuard over UDP (`udp`), UDP in Veilway's own envelope (`udp-obfs`), TLS that the node ends itself (`tls`), WebSocket behind your web server (`ws`), WebSocket over plain HTTP with no TLS (`ws-plain`, the weakest), and HTTP requests through a CDN (`fronted`). The [transports page](../protocol/transports/) has the details.
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
- **HTTP/2 and the shapes of `fronted` have not been run behind a real CDN.** `ws`, `ws-plain` and `fronted` were tested behind nginx and HAProxy in Docker. A real CDN may behave differently. On the node, `http2` is off unless you turn it on.
- **Borrowed-site mode is alpha.** It is off by default and labeled alpha in the panel and the apps. Only the project's own people have reviewed it, it is rated Detectable, and it has not run against real sites. Do not rely on it.
- **Not in this release.** Xray on Android, split tunneling and store builds. They are planned for v0.3.0.
- **Some TLS details still differ from a browser.** No TLS session is resumed, and the fetch of a pinned subscription page sends a TLS hello that no browser sends.
- **Android has no camera QR scan and no deep links yet.** Import a subscription by pasting its link or choosing its file or a picture of its QR code. While it runs, the app blocks traffic when the VPN drops. If the app is killed, use Android's Always-on VPN with Block connections without VPN, which is the full kill switch.
