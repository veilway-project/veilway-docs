---
title: FAQ
description: Short answers to the questions newcomers ask most. Sharing a server with x-ui, iPhone, routers, leaks and slow local sites.
---

## Can I run Veilway on the same server as x-ui or 3x-ui?

Yes, if the ports do not clash. Veilway needs these:

- **The panel** listens on `127.0.0.1:8480`. Only this server can reach it, so it clashes with nothing.
- **A web server for the panel** needs ports 80 and 443 when you give the installer a domain. If x-ui holds 443, the installer explains and stops before it changes anything. Put the web server on another port instead: `sudo bash veilway.sh install both --domain panel.example.com --https-port 8443`. Port 80 must stay free, because the certificate is checked over it. The panel is then at `https://panel.example.com:8443/<prefix>/`.
- **No domain** is simpler: `sudo bash veilway.sh install both --no-domain`. The installer takes port 443 if it is free, and 8443 if not.
- **An inbound** needs a TCP port nothing else uses. The installer's first inbound already takes a random free one. Do not put a Veilway `tls` transport on 443 if x-ui holds it.

Veilway does not take over x-ui or import its users. Its [Xray add-on](../manuals/xray/) runs its own Xray, with its own ports.

## Is there an app for iPhone?

No. There is no iPhone or iPad app yet, and the Veilway link does not work in other iOS apps.

What can work is the [Xray add-on](../manuals/xray/). Install it on the server, add a VLESS, Trojan or Shadowsocks inbound, and copy the user's Xray link from the user's page (**Xray links**). Paste it into a stock iOS app that speaks that protocol. Only Xray-core itself has been tested as the client, so other apps are untested. An Xray inbound shares the server's address with your Veilway profiles, so the panel rates those **Detectable**.

## Must I use the Veilway app?

No, but it is the best-tested way. Two other ways exist:

- **An Xray link** in a stock Xray app. See the iPhone answer above.
- **A WireGuard file** for a stock WireGuard app. Add a plain WireGuard inbound with a `udp` transport, open the user's page and choose **WireGuard config for**. A censor can easily recognize plain WireGuard, so use it only where that does not matter. See [the user page](../manuals/panel/#the-user-page).

Devices that connect these ways get no notices and no list of exits.

## Does it work on a MikroTik or another router?

There is no Veilway app for routers, and it is not tested on one. Two things might work:

- **WireGuard.** If your router has a WireGuard client and the server has a plain WireGuard inbound with a `udp` transport, the router can use the WireGuard file from the user's page. Plain WireGuard is easy to recognize. We did not try it on a MikroTik.
- **SOCKS5 or HTTP proxy.** A node can offer a [proxy login](../guides/proxy-inbound/), but the traffic is not encrypted. Keep it on the server's own address and reach it through SSH. It is not for a router across the internet.

## Does it leak my IP or DNS?

What the docs and code say, by device:

- **Linux desktop.** The kill switch is on by default. It blocks everything outside the tunnel if the connection drops, for IPv4 and IPv6. DNS goes to the tunnel's own servers, and the kill switch drops a query to any other server. A 70-point check in Docker covers this against a real node. See the [kill switch](../manuals/client/#kill-switch).
- **Windows desktop.** A smoke test on a real Windows runner showed nothing leaked. It has never connected to a real node on a real PC. Expect bugs.
- **macOS.** Only a command-line client exists. It has never run on a real Mac. Do not rely on it.
- **Android.** While the app runs, it blocks traffic when the VPN drops. If the app is killed, turn on Android's Always-on VPN with **Block connections without VPN**. See the [Android manual](../manuals/android/#the-kill-switch).

We do not know how IPv6 behaves on Windows, macOS and Android. Browser leaks such as WebRTC are not tested. To check, open a "what is my IP" page and a DNS leak test while connected. Both should show your server, not your own network.

## What is the simplest setup for family or myself?

One server abroad, one `tls` inbound, one user for each person. Follow the [Quick start](../quick-start/). Give each person their own user, so you can stop one without touching the rest.

If users cannot reach any server abroad, see [Tunnel: a server in Iran in front of a foreign server](../guides/entry-node/).

## Why are sites inside Iran slow when the VPN is on?

All traffic goes to the server abroad and back, even to Iranian sites. That is slow, and some Iranian sites refuse foreign addresses.

The apps have no split tunneling in this release, so turn the VPN off for those sites.

Do not send users' traffic out of a server in Iran directly, not even for Iranian sites. That traffic leaves unprotected from your server, and it carries its own risks.
