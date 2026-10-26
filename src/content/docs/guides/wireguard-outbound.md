---
title: Use a WireGuard server as an exit
description: Send some users' traffic out through a WireGuard server such as Mullvad or one of your own, what its owner sees, and what happens when it is down.
---

A WireGuard outbound lets your node send traffic out through a WireGuard server of another party: Mullvad, a server at home, any `wg-quick` peer. The node runs the tunnel itself, so you install nothing on the host. Add the outbound, make an exit that uses it, and route some users or rules to it. Their traffic leaves from that server's network. The [config reference](../../reference/config/#wireguard-outbounds) has every field.

```text
 users ---> your node ---> WireGuard server ---> internet
```

## What the server's owner sees

| | The owner of the WireGuard server |
|---|---|
| Your node's address | Yes |
| Every destination name and address of the traffic routed to it | Yes |
| Every byte the destination's own protocol leaves unprotected | Yes |
| Who your users are, their names, tunnel addresses or keys | No |
| Your other exits, and traffic you route elsewhere | No |

All routed users arrive from one tunnel address. There is no anonymity from the server. Use it only for traffic you accept its owner seeing.

## Add one

1. **Get a config.** Download the `.conf` file from your provider, or take it from your own server. It has an `[Interface]` and one `[Peer]`.
2. **Add the outbound.** Open **Exits and routing**, choose the **Outbounds** tab and **Add outbound**. Set **Type** to **WireGuard server**.
3. **Import it.** Paste the text of the file into **Import a WireGuard config** and choose **Read config**. It is read in your browser and never sent anywhere. Scripts and other settings in the file are never run.
4. **Check the fields.** The panel fills in **Server address**, **Server public key**, **Private key**, **Preshared key** if the file has one, and **Addresses inside the tunnel**. Under **Tuning and network** are **MTU**, **Keepalive** and **Most open flows**. Read the notes it shows. If the file lists DNS servers, they are not used here. If its `AllowedIPs` is not every address, that list is not used: the node sends every flow of the exit through the tunnel.
5. **Save.** Review and apply as usual.
6. **Make the exit.** On the **Exits** tab choose **Add exit**, choose **An outbound** and pick the WireGuard outbound. Under **Traffic the outbound cannot carry**, **UDP** can only be **Refuse** or **Drop silently**, since the outbound carries UDP itself.
7. **Route traffic to it.** Give the exit to users, name it in a rule, or make it the default, as for any exit.

You can also fill the fields by hand instead of importing.

## What the health shows

The **State** column of the outbound says **Carrying** or **Down for** a time, with the reason. It also shows the last handshake, the server address the node talks to now, and the flows open. It refreshes every 10 seconds.

- The outbound is down when the server has not answered a handshake for 20 seconds. The node tries again by itself, after 2 seconds, then 4, up to a minute between tries.
- While it is down, flows to the exit end at once. Nothing goes to `direct`, to another exit or to your default. Only a `routing.fallback` you wrote moves users.
- An idle tunnel with no handshake for a few minutes still counts as up. The node starts a handshake when traffic needs one.

The same fields are in `GET /v1/exits`, see the [API reference](../../reference/api/#get-v1exits).

## Limits

- **One outbound runs on one core.** Expect tens of MB/s at most through one outbound, and less with many flows. Use several outbounds and exits to spread users.
- **A user may hold at most a quarter of the outbound's flows**, never fewer than 16. The default total is 1,024 (`max_flows`, 16 to 4,096). Each flow with data costs about 272 KiB of memory.
- **The outer traffic looks like WireGuard.** A censor can recognize and block it. Use this where WireGuard works. Where it is blocked, use an [Xray outbound](../xray-outbound/) instead.
- **A name is looked up in clear.** If **Server address** is a name, whoever sees your node's lookups learns it. Write the IP address to hide it.
- **Changing the tunnel restarts it.** A change to the server, keys, addresses, MTU or most open flows ends the flows open through it.
- **Keys are yours alone.** The node refuses a private key that another outbound, an inbound, a device or a link uses.

## Keep users out of the server's network

Users routed through the outbound can reach whatever the server's network reaches, its other peers included. The node only blocks its own addresses and networks. The panel and `veilway check` warn about this. If users must not reach the server's private range, add a routing rule above the exit that rejects it, for example `10.2.0.0/16` with **Nowhere, refused**. See [routing rules](../../reference/config/#routing).

## Remove one

First point the exits that use it elsewhere, or remove them, because the node refuses a config where an exit names a missing outbound. Then choose **Remove** on the outbound's row.
