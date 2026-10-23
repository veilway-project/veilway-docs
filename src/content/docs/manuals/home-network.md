---
title: Home network
description: Reaching devices on your home network through your node, and the app setting for local devices.
---

Two settings decide what a device on your home network can reach. A home lab usually needs only the first.

- **The node's routing rules**, in the panel, decide where the node sends traffic for a network. The starting config refuses private addresses, so add a rule first.
- **The app's setting**, per subscription, is an opt-in named **Let apps reach devices on this network**. It lets apps reach local devices, such as a printer or router, outside the VPN. Off by default.

## What the default does

While connected, all traffic goes through the tunnel, local network included. The app needs no setting for your home network. The node reaches a device at home once a routing rule sends its range there. With **Let apps reach devices on this network** off, you cannot reach a printer or router on your current network.

## Reach your home network through your node

The node must sit on your home network, or on one connected to it. A node in a data center cannot reach it.

If your home network cannot take outside connections, use a reverse tunnel, where the node there dials out. The [entry node guide](../../guides/entry-node/) shows the steps.

1. In the panel, open **Exits and routing**, go to the routing rules, and add a rule:
   - **Destination network:** your home range, for example `192.168.1.0/24`. Check it on your router.
   - **User or group:** who needs this. Leave it out only if every user should reach the network.
   - **Then send it to:** an exit whose outbound is **Direct** (leaves through the node's own connection).
   - Put the rule above the rule that refuses `geoip:private`. Rules are checked from the top, first match wins.

   In the config file, the same rule looks like this, placed after `isolate-users` and before `no-private`:

   ```json
   {"tag": "home-lan", "user": ["alice"], "ip": ["192.168.1.0/24"], "action": {"exit": "open"}}
   ```

   `alice`, `home-lan` and `open` are examples; use your own. The [config reference](../../reference/config/#routing) lists every condition.

2. Connect. When the app asks whether to connect to a private address, answer yes (it asks once per such connection).

Test from mobile data: check that the device reaches the printer or router by its address.

## Let apps reach devices on this network

Use this only if apps must reach a printer, router or other device on your current network while connected. Turn it on with the checkbox on the subscription's row in the app.

- Only the private subnets your device is connected to, plus the link-local and local multicast ranges, go outside the VPN. A whole private range such as `192.168.0.0/16` never does. The list is re-read when you change networks.
- That traffic skips the node, so the network can see it.
- On mobile data, nothing goes outside the VPN.
- Names are still looked up through the tunnel.
- Untested on real Windows and macOS machines.

The choice applies from the next connect. `veilway connect --allow-lan` does the same for one connection. Add `--local-names` to also let mDNS and LLMNR out so local names resolve (they tell the network which names your device asks for).

## Stop reaching the home network

Turn off the rule in the panel (it stays in the list and is skipped), or delete it. To keep local devices out of reach again, turn off **Let apps reach devices on this network** for that subscription.
