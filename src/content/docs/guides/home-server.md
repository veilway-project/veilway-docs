---
title: Reach a home server through your VPS
description: Link a server at home to your VPS, so your users can reach your home network or one service on it, without opening a port at home.
---

A server at home often has no public address or open port. It can still dial out to your VPS. Once it does, your VPS can pass traffic to it in two ways:

- **Your VPN users reach your home network.** A routing rule sends them there, for example everything to `192.168.0.0/16`.
- **Anyone reaches one service at home.** A tunnel opens a port on the VPS and forwards it to one address at home, such as a web server.

```text
 users ---> VPS ===== link =====> home server ---> 192.168.1.x
            (public)   <-- home dials out
```

This takes about 20 minutes. You need the panel on the VPS, and Veilway on the home server, installed with `veilway.sh install node` (add the panel too if you want to manage it from a browser).

## 1. Link the two servers

The home server dials the VPS, so this is a **reverse** link. The VPS is the entry (your users are there), and the home server is the exit (traffic leaves there).

1. On the **VPS** panel, open **Links**, choose **Guided setup**, then **Reverse tunnel** and **The entry**.
2. On the **home server**, choose **Reverse tunnel** and **The exit**. Without a panel there, use `veilway link answer`, see the [node links page](../../protocol/node-links/).
3. Follow the [entry node guide](../entry-node/#step-by-step) from step 3: the VPS makes the offer, the home server answers, and you compare the fingerprints.
4. On the **home server**, in the link's **Manage**, turn on **Let rules reach private networks**. Without it, the home server refuses every private address through the link, whatever the rules say.

Both cards should show **Up** within a minute.

**If the two servers already share a private network**, such as a WireGuard tunnel between them, the home server can dial the VPS over it. Make the offer on an inbound that listens on the VPS's address in that network. The panel warns that the address is private; that is expected here.

## 2. Check the MTU

When both servers run v0.3.10 or newer, the link tests its path and lowers its MTU by itself within a minute of coming up. The link's **Manage** shows the size in force. Set it by hand only when one server is older, as below, and do it before you test, or large transfers will stall.

The MTU is the largest packet the link carries. It must fit inside the network the link runs over, and nothing is split to make it fit. The default is `1420`, or `1390` with `udp-obfs`. Over a network that already wraps traffic, such as a WireGuard tunnel, that is too big.

1. Find the MTU of the network between the two servers. On the home server, `ip link` shows it for each interface.
2. Set the link's **MTU** at least 90 below that, on **both** servers, under **Manage**. Over a WireGuard tunnel with MTU 1390, `1300` works.

The sign of a wrong MTU: ping and small pages work, but large pages, downloads and SSH sessions hang.

## 3. Let your users reach your home network

On the **VPS**:

1. Open **Exits and routing**, and on the **Exits** tab add an exit that leaves through **Another node**, with your link. Name it, for example `home`.
2. Add a rule with **Add rule**. Add the conditions **Destination network** (`192.168.0.0/16`, or only your home range) and **User** or **Group** (who may reach home). Set **Then send it to** your new exit.
3. Move the rule above the rule that refuses `geoip:private`. The first rule that matches decides.

On the **home server**, limit what the link may do. Add two rules, in this order:

1. **Node link** is your link, **Destination network** is your home range, **Then send it to** an exit with the **Direct** outbound.
2. **Node link** is your link, and the rule rejects. Everything else from the VPS is then refused, so the link cannot be used to browse from your home connection.

Apply on both servers. Nothing needs publishing: the apps don't change. Connect as one of the users in the rule and open a device at home by its address.

### Users on a third server

If your users connect to another server first (for example a server inside the country that links to your VPS), the VPS passes their traffic on to the home server. On the VPS, open the link that comes from that first server, choose **Manage** and turn on **Let this link continue through another link**. Then add the `home` exit to that link's exits, and on the first server add the same kind of rule as in step 3, sending your home range to the exit that leads to the VPS.

A path has at most 3 links. The home server sees the VPS's link address, never the user's.

## 4. Open one service to anyone (optional)

Use a tunnel when something outside your VPN, such as a browser or a game client, must reach one service at home.

1. On the **VPS** panel, open **Links**, choose **Guided setup**, then **Forward a port to a home server** (TCP), or **Forward a UDP port to a home server**.
2. **Exit** is the `home` exit from step 3. **Listen on** is the VPS's address and port, such as `203.0.113.5:8443`. **Target** is the service at home, such as `192.168.1.10:8080`.
3. Fill **Allowed sources** whenever you can. A tunnel has no sign-in: anyone who reaches the port reaches the target. A UDP tunnel on a public address needs allowed sources.

The home server must still allow it: step 1's **Let rules reach private networks**, and a rule that sends the target's address to **Direct**. The [Tunnels section of the panel manual](../../manuals/panel/#tunnels) lists every field.

## When it does not work

- **The link shows Unreachable.** The home server cannot reach the address in the offer. From the home server, check that the VPS's port answers, and that its firewall lets the home server in.
- **The link shows Refused or Key changed.** The two halves no longer match. Remove the link on both servers and pair again.
- **The link is Up, but nothing at home answers.** Check, in order: **Let rules reach private networks** on the home server, the home server's rules, the VPS rule's place above `geoip:private`, and the user in the rule.
- **Small things work, large ones hang.** The MTU is too high. See step 2.
- **A tunnel shows Refused.** Its card gives the reason, such as a source that is not listed or the link being down.

`veilway doctor` on either server checks its links.
