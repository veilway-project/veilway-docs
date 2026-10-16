---
title: Home network
description: Reaching devices on your home network through your node, and the app's setting that lets apps reach local devices.
---

Two settings decide what a device on your home network can reach through Veilway. They do different jobs, and a home lab usually needs only the first.

- **The node's routing rules**, in the panel, decide where the node sends traffic for a network. The starting config refuses private addresses, so a rule is needed before the node will reach your home network.
- **The app's setting**, per subscription, is an opt-in named **Let apps reach devices on this network**. It lets apps reach local devices, such as a printer or a router, outside the VPN. It is off by default.

## What the default does

While you are connected, all traffic goes through the tunnel, your local network included. The app needs no setting for your home network. A device at home is reachable through the node once a routing rule sends its range there, as described below.

With **Let apps reach devices on this network** off, a printer or router on the network you are on is not reachable from your device while you are connected.

## Reach your home network through your node

This needs a node that can reach your home network. A node in a data center cannot reach your home LAN. The node must sit on that network, or on a network that is connected to it.

If your home network cannot take connections from outside, a reverse tunnel lets the node there dial out instead. The [entry node guide](../../guides/entry-node/) shows the steps.

1. In the panel, open **Exits and routing**, go to the routing rules, and add a rule:
   - **Destination network:** your home range, for example `192.168.1.0/24`. Check it on your router.
   - **User or group:** the people who need this. Leave it out only if every user should reach the network.
   - **Then send it to:** an exit that leaves through the node's own connection, which is an exit whose outbound is **Direct**.
   - Put the rule above the rule that refuses `geoip:private`. Rules are checked from the top, and the first match decides.

   In the config file, the same rule looks like this, placed after `isolate-users` and before `no-private`:

   ```json
   {"tag": "home-lan", "user": ["alice"], "ip": ["192.168.1.0/24"], "action": {"exit": "open"}}
   ```

   `alice`, `home-lan` and `open` are examples. Use your own user name, tag and exit. The [config reference](../../reference/config/#routing) lists every condition.

2. Connect. When the app asks whether to connect to a private address, answer yes. It asks once for each such connection.

Test it from mobile data before you rely on it, and check that the device reaches the printer or router by its address.

## Let apps reach devices on this network

Use this only if you want apps on your device to reach a printer, a router or another device on the network you are on, while you are connected. It is off by default. Turn it on with the checkbox on the subscription's row in the app.

- Only the private subnets your device is connected to, and the link-local and local multicast ranges, go outside the VPN. A whole private range such as `192.168.0.0/16` never does. The list is read again when you change networks.
- That traffic does not go through the node, so the network can see it.
- On mobile data, nothing goes outside the VPN.
- Names are still looked up through the tunnel.
- The Windows and macOS clients have not been tried on a real machine yet, so this setting is untested there.

The choice applies from the next connect. On the command line, `veilway connect --allow-lan` does the same for one connection, and `--local-names` with it also lets mDNS and LLMNR out so that local names resolve. Those two protocols tell the network which names your device asks for.

## Stop reaching the home network

Turn off the rule in the panel, or delete it. A rule that is turned off stays in the list and is skipped. To keep local devices out of reach again, turn off **Let apps reach devices on this network** for that subscription.
