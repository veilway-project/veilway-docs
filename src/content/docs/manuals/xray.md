---
title: Xray add-on
description: Running the official Xray beside a Veilway node, so stock VLESS, Trojan and Shadowsocks apps can connect.
---

:::note[Server side]
This page describes the server side as built. Its tests run in Docker (`scripts/gate-xray.sh`, 119 checks, all passing), over TCP and UDP. It has not run on a real server yet. The desktop app connects to Xray links since v0.2.0-alpha, see [Xray profiles](../../guides/xray-profiles/). The Android app cannot yet.
:::

## What it is

The add-on runs the official Xray-core release next to your Veilway node. It is off by default: nothing is installed or started until you install it.

It does not replace Xray, 3x-ui or v2ray. It lets people with stock Xray apps connect through your node, and their traffic is handled like all other Veilway traffic: same per-user stats and quotas, the node's exits and rules.

## Install and remove

Run these on the server as root:

```
sudo bash veilway.sh addon xray install
sudo bash veilway.sh addon xray remove
sudo bash veilway.sh addon xray status
```

`install` downloads the Xray-core release archive for your CPU (x86_64 or arm64) and compares its SHA-256 with a value pinned in `veilway.sh`. If they differ, nothing is installed. The executable goes into a folder only root can write. Before every start, Veilway checks it against its own copy of the pin and refuses one that does not match.

After `install`, the node starts Xray only when its config has an Xray inbound. Create one in the panel, on the **Inbounds** page.

`remove` stops the Xray host, deletes the executable and unit files, and restarts the node, which stops Xray. Inbounds you created stay in the config until you delete them.

`status` shows whether the executable is installed, the pinned release, and the state of the host.

## What it gives you

The panel can create three kinds of Xray inbound:

| Protocol | Encryption | Credential per user |
|---|---|---|
| VLESS | TLS, with your certificate | A UUID |
| Trojan | TLS, with your certificate | A password |
| Shadowsocks 2022 | Its own (no certificate) | A key |

Each user gets one credential per inbound. On the user's page, **Xray links** shows each inbound's link (`vless://`, `trojan://` or `ss://`) as copyable text and a QR code.

The test uses Xray-core itself as the client, with all three links. Other v2ray and Xray apps use the same kinds of links but are untested here.

Xray client traffic works like tunnel traffic:

- It counts in the user's stats, and the user's quota applies.
- It leaves through the user's exit and follows the rules.
- The node resolves names, not the client.

UDP works with all three protocols (QUIC, DNS over UDP, calls, games). VLESS and Trojan carry UDP inside their own stream. A Shadowsocks inbound also listens on UDP, on the same port number as its TCP port. Open that port for UDP in your firewall too. No other inbound of the node (a `udp` or `udp-obfs` transport) may use it, or the config is refused.

Each UDP destination of a user is a flow like any other. The node refuses loopback and the like, the rules choose the exit, and the user's exits and quota apply, with bytes counted for the user and the exit. UDP to port 53 follows the tunnel's rule: while `dns.hijack` is on (the default), the node's own resolver answers a DNS query with the user's DNS set, wherever it was sent. The caps are 32 UDP associations per user and 4096 in all, 64 flows in one association, 256 UDP flows per user, and the user's flow cap, which UDP shares with TCP connections. A malformed or fragmented datagram is dropped and counted. If the exit's SOCKS5 upstream does not relay UDP, the exit's `unsupported.udp` policy decides. The node retries the upstream every minute and logs the change.

## Creating an inbound

In the panel, open **Inbounds**, choose **Add Xray inbound**, pick the protocol and fill in:

- **Tag**: a short name for the inbound, such as `vless-443`.
- **Port**: the TCP port Xray listens on. Open it in your firewall, and UDP too for Shadowsocks.
- **Certificate file and key file** (VLESS and Trojan): paths on the node, such as your certificate's full chain file. Shadowsocks needs neither.
- **Decoy web server** (VLESS and Trojan): the address of your own web server, such as `http://127.0.0.1:8080`. Required. If empty, the panel uses the decoy of the node's `tls` transport.
- **Host in links** (optional): the name or address the links give. Empty means the node's first public address.

### The decoy

A connection to a VLESS or Trojan port with no user's credential goes to your web server, so a probe sees an ordinary site. The test checks this on both ports. Shadowsocks has no decoy, and the test does not check what a stranger gets from its port.

### The shared address

Xray answers on the same address as your native Veilway profiles, and anyone who finds that address can tell it runs a proxy. So native profiles on that address are rated **Detectable** in the subscriptions, and the panel says so before it creates the inbound. Choose this knowingly. Since v0.2.4, only profiles that share an address with an Xray inbound are capped. An inbound that listens on every address (the default) caps them all. An inbound on a separate IP address of the server, with its own host name, leaves profiles on other addresses as they are. A name the panel cannot resolve, or that resolves to the Xray address, counts as shared.

## Changing credentials

On the user's page, **New Xray credentials** makes new credentials in every Xray inbound. Old links stop working once the node takes the change. The subscription link and devices stay the same, so Veilway apps are not affected. Resetting the subscription link also makes new Xray credentials.

## Quotas, disabling and restarts

- A user over quota loses the Xray connection and gets it back when the quota is raised. The test checks this.
- A disabled user loses it too and gets it back when enabled. The test checks this.
- Creating or removing an inbound, changing its users, and making new credentials all restart Xray briefly. Connections on that inbound drop, and the app reconnects.

## How it is isolated

- Xray runs as its own system user, `veilway-xray`, which cannot log in.
- A small host process, `veilway xray-host`, starts Xray under its own service, `veilway-xray.service`. The node sends Xray's config to the host over a socket only the node can open. When the node stops, Xray stops with it.
- Xray has no capabilities, except the right to bind a port below 1024, and only when one of its inbounds uses such a port.
- Xray cannot read the node's config with the keys, its usage state, or its control socket. The test checks this from inside Xray's own user and mounts.
- Xray runs with an empty environment and cannot gain privileges.
- Xray keeps no access log, and the addresses it writes are masked. The test checks that no client address reaches the journal.
- The host's service has a memory limit of 1 GB.
- Each user's traffic leaves Xray through a local SOCKS hop on `127.0.0.1`, served by the node. It checks every connection and UDP destination against the user's entitlement, quota, rules, exits and counters, as for a tunnel.
- The unit does not stop Xray from connecting to the network, since the servers of [Xray outbounds](#xray-outbounds) can be anywhere. The hop keeps your users' traffic on the node's rules. The unit would not hold a bug in Xray to the address of a provider. See "Xray outbounds" in the threat model.

## Xray outbounds

From v0.2.18, the add-on also works the other way: a node can send an exit's traffic out through a VLESS, VMess, Trojan or Shadowsocks server of another provider, so a server you rent becomes an exit. Add it as an **Xray server** on the **Outbounds** tab. See the [panel manual](../panel/#xray-servers) and the [guide](../../guides/xray-outbound/).

- **Linux nodes only.** The add-on host runs on Linux.
- **The same install.** `sudo bash veilway.sh addon xray install` also puts the node's user in the group `veilway-xray`, so it can use the sockets Xray makes for the outbounds, and restarts a running node. `sudo bash veilway.sh update` does the same for a node with the add-on. A node installed before v0.2.18 needs one update or install run.
- **Without the add-on**, every exit through an Xray outbound is down and says why. Nothing goes around it.
- **A change restarts Xray briefly.** Users of Xray inbounds drop for a moment and connect again.
- **The provider's name is looked up in clear**, through `dns.servers` in plain UDP. Use the provider's IP address in **Proxy address** to hide it.

`veilway doctor` checks the add-on and the folder of the sockets for a config that has an Xray outbound.

## Known limits

- **UDP is carried for all three protocols**, but a UDP flow ends when the exit has no UDP and its policy says so. The node resolves names a UDP datagram asks for, like those of TCP connections.
- **No VMess and no Reality** on Xray inbounds. Xray outbounds speak both.
- **No `l3` or `chain` exits for Xray users.** Xray traffic uses the user's `netstack` exits.
- **Any change restarts Xray briefly.**
- **The Android app does not connect to Xray links yet.** The desktop app does, since v0.2.0-alpha.
- **Not tested yet:** removing the add-on with `remove`, and the decoy for Shadowsocks.
