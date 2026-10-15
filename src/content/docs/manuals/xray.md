---
title: Xray add-on
description: Running the official Xray beside a Veilway node, so that stock VLESS, Trojan and Shadowsocks apps can connect.
---

:::note[Server side only]
This page describes the server side as it is built. Its tests run in Docker containers (`scripts/gate-xray.sh`). It has not run on a real server yet. The Veilway apps do not connect to Xray links yet, and the client side is still to do.
:::

## What it is

The Xray add-on runs the official Xray-core release next to your Veilway node. It is off by default. Nothing is installed or started until you install it.

Veilway does not replace Xray, 3x-ui or v2ray. The add-on lets people who use stock Xray apps connect through your node, and their traffic is handled the way Veilway handles everything else: it counts in the same per-user stats and quotas, and it leaves through the node's exits and follows its rules.

## Install and remove

Run these on the server as root:

```
sudo bash veilway.sh addon xray install
sudo bash veilway.sh addon xray remove
sudo bash veilway.sh addon xray status
```

`install` downloads the Xray-core release archive for your CPU (x86_64 or arm64). It compares the archive's SHA-256 with a value pinned in `veilway.sh`. If the two differ, the install stops and nothing is installed. The executable goes into a folder that only root can write. The node checks the executable against its own copy of the pin before every start, and refuses to start an executable that does not match.

After `install`, the node starts Xray only when its config has an Xray inbound. Create one in the panel, on the Xray tab of the node.

`remove` stops the Xray host and deletes the executable and the unit files. The script then restarts the node, which stops Xray. Inbounds you created stay in the config until you delete them.

`status` shows whether the executable is installed, the pinned release, and the state of the host.

## What it gives you

The panel can create three kinds of inbound for Xray:

| Protocol | Encryption | Credential per user |
|---|---|---|
| VLESS | TLS, with your certificate | A UUID |
| Trojan | TLS, with your certificate | A password |
| Shadowsocks 2022 | Its own (no certificate) | A key |

Each user gets one credential for each inbound. On the user's page, the **Xray links** button shows the link for each inbound, as text you can copy and as a QR code. The links are `vless://`, `trojan://` and `ss://`.

The gate tests Xray-core itself as the client, with all three links. Other v2ray and Xray apps use the same kinds of links, but they have not been tested here.

Traffic from an Xray client works like traffic from a tunnel:

- It counts in the user's stats, and the user's quota applies.
- It leaves through the user's exit and follows the rules.
- Names are resolved by the node, not by the client.

**Limit: TCP only.** The add-on carries TCP connections and nothing else. Anything that needs UDP, such as QUIC, DNS over UDP, or some calls and games, does not go through an Xray inbound yet.

## Creating an inbound

In the panel, choose the protocol and fill in:

- **Tag**: a short name for the inbound, such as `vless-443`.
- **Port**: the TCP port Xray listens on. Open it in your firewall.
- **Certificate file and key file** (VLESS and Trojan): the paths on the node, such as your certificate's full chain file. Shadowsocks needs neither, because it encrypts itself.
- **Decoy web server** (VLESS and Trojan): the address of your own web server, such as `http://127.0.0.1:8080`. This is required for VLESS and Trojan. If you leave it empty, the panel uses the decoy of the node's `tls` transport.
- **Host in links** (optional): the name or address the links give. Empty means the node's first public address.

### The decoy

A connection to a VLESS or Trojan port that does not carry a user's credential is handed to your web server. To anyone who probes the port, it looks like an ordinary site. The gate checks this on both ports.

Shadowsocks has no decoy. The gate does not test what a stranger gets from a Shadowsocks port.

### The shared address

Xray answers on the same address as your native Veilway profiles. Anyone who finds that address can tell that it runs a proxy. Because of this, every native profile is rated **Detectable** in the subscriptions, and the panel says so before it creates the inbound. Choose this knowingly.

## Changing credentials

On the user's page, **New Xray credentials** makes new credentials for the user in every Xray inbound. The old links stop working once the node takes the change. The user's subscription link and devices are not changed, so the Veilway apps are not affected.

## Quotas, disabling and restarts

- A user over quota loses the Xray connection, and gets it back when the quota is raised. The gate checks this.
- A disabled user loses the connection too, and gets it back when enabled. The gate checks this.
- Creating or removing an inbound, changing the users of an inbound, and making new credentials all restart Xray briefly. Connections on that inbound drop during the restart, and the app reconnects.

## How it is isolated

- Xray runs as its own system user, `veilway-xray`, which cannot log in.
- A small host process, `veilway xray-host`, starts Xray under its own service, `veilway-xray.service`. The node asks the host over a socket that only the node can open, and sends Xray's config through that socket. When the node stops, Xray stops with it.
- Xray has no capabilities. The only exception is that it keeps the right to bind a port below 1024, and only when one of its inbounds uses such a port.
- Xray cannot read the node's files: its config with the keys, its usage state, or its control socket. The gate checks this from inside Xray's own user and mounts.
- Xray runs with an empty environment, and it cannot gain privileges.
- Xray keeps no access log, and the addresses it writes are masked. The gate checks that no client address reaches the journal.
- The host's service has a memory limit of 1 GB.
- Each user's traffic leaves Xray through a local SOCKS hop on `127.0.0.1`. The node serves the hop. It checks every connection against the user's entitlement, quota, rules, exits and counters, the same as a tunnel.

## Known limits

- **No UDP.** Only TCP is carried.
- **No VMess and no Reality.**
- **No `l3` or `chain` exits for Xray users.** Xray traffic uses the user's `netstack` exits.
- **Any change restarts Xray briefly.**
- **The Veilway apps do not connect to Xray links yet.**
- **Not tested yet:** removing the add-on with `remove`, the decoy for Shadowsocks, and UDP.
