---
title: "Tunnel: a server in Iran in front of a foreign server"
description: Keep users connected when a country's international links are cut or filtered. Users connect to a server inside the country, which passes their traffic to a server abroad. Often called a tunnel.
---

Many people call this setup a tunnel: a server in Iran that users connect to, in front of a server abroad. Veilway calls the server in Iran the **entry node** and the one abroad the **exit node**. The two are joined by a node link. This page uses the Veilway names.

The entry node is a Veilway server inside the country, where users connect. It does not send their traffic to the internet itself. It carries it over one [node link](../../protocol/node-links/) to an exit node abroad, which does.

```text
 users ---> entry node ===== link =====> exit node ---> internet
            (inside the country)          (abroad)
```

## When you need one

Use one when users can reach servers inside the country but not abroad, because international links are cut, throttled or filtered while the domestic network works. Users need a path only to the entry. The entry needs one path to the exit, in either direction.

Data centers inside a country often keep an international path when home and mobile lines lose theirs. If the entry has no path abroad in either direction, no link can help.

If users can reach your server abroad directly, you do not need an entry node. If their networks block only your node's address, a [relay](../../manuals/panel/#relays) on another address may be enough.

## What to rent where

- **The entry**: a server at a hosting provider inside the country, with a public address users' networks can reach. It runs the node and panel, holds your users and serves their subscriptions.
- **The exit**: a server abroad, at a provider outside the country's reach. It runs its own node and panel. Its only users are the entry's link.

Both need a Veilway inbound for the link to connect to, as the [panel manual](../../manuals/panel/#node-links) describes. Install both with [Getting started](../../getting-started/).

## If you run both servers

The steps below are for two operators, each with a panel. If both servers are yours, the exit needs no panel of its own: your entry's panel manages it.

1. On the exit, run `sudo bash veilway.sh install node`. It installs the node only.
2. On the entry's panel, add the exit with [Add a second server](../second-server/). The link it makes carries the panel's control and users' traffic both.
3. On the entry's panel, open **Exits and routing** with **Server** set to this server. On the **Exits** tab, add an exit that leaves through **Another node**, with that link. Give it the name and country users see, and make it the default exit if all traffic should go abroad.
4. On each user, set **Servers this user may use** to **Only these servers** with the entry ticked. Otherwise users also get profiles that connect to the exit directly.

The link's traffic leaves through the exit server's own default exit. To change that, open **Exits and routing** with **Server** set to the exit server.

## Forward or reverse

The two servers agree on which one opens the connection. Traffic flows both ways either way.

```text
 Forward: the entry dials the exit (the usual case)

   entry  ------ dials ------>  exit
   (needs a way out)            (needs an address the entry can reach)

 Reverse: the exit dials the entry

   entry  <----- dials -------  exit
   (needs an address the exit can reach)   (needs nothing reachable)
```

- **Forward** when the entry can open connections abroad.
- **Reverse** when it cannot open connections abroad (or they are filtered) but connections into it from abroad pass. The easy-to-reach side waits, and the other dials out.

## Step by step

Have the other server's operator on a call or another channel you trust, because the last step compares fingerprints aloud. If you run both servers, open both panels side by side.

1. On the **entry's** panel, open **Links** and choose **Set up as entry node**. For a reverse link, choose **Reverse tunnel** and then **The entry**.
2. On the **exit's** panel, open **Links** and choose **Set up as exit for an entry node**. For a reverse link, choose **Reverse tunnel** and then **The exit**.
3. Both sides pick the same direction. The panel says who makes the offer: the exit in a forward link, the entry in a reverse one. That side picks the Veilway inbound, the transports and the tunnel addresses, then sends the offer code to the other side.
4. The other side pastes the offer, checks where its server would connect, and sends back the answer code. If the offer was made for the other side, the panel says so and refuses to answer.
5. The offering side pastes the answer. Both sides read their eight fingerprint groups aloud and type the other's. Confirm only when they match. The link is then in each node's config.
6. On the entry, give users an exit through the link. Set its name and country, whether it becomes the default exit, and whether it is added to every user who has a list of exits. Users allowed every exit get it anyway. The review shows each change before you apply it.
7. On the exit, pick which of its exits the link's traffic may leave through. Leave **Let rules reach private networks** off unless you mean it. When on, the entry's users can reach this server's local networks.

Profiles do not change, so there is nothing to publish. Apps see the new exit at their next connect.

## Pick the link's transports

The offer lists the inbound's transports, and you untick the ones the link should not use.

- **`tls` is usually best between countries.** UDP is often throttled or dropped on international routes.
- **An exit with no domain still works over `tls`.** Since v0.3.6 a self-signed certificate is trusted through its pin, and the fingerprints you compare are the whole check.
- **Keep two transports** if the inbound has them, so the link can switch when one is blocked.

## The MTU

The link's MTU defaults to `1420`, or `1390` when it uses `udp-obfs`. From v0.3.10, when both servers run it, the link tests its path and lowers the MTU by itself, so there is nothing to set. With an older server on either side, the link cannot test. Over `tls` and `ws` that rarely matters. Over `udp` and `udp-obfs`, lower it on **both** servers under **Manage** when the path between them is itself a tunnel or a PPPoE line. The sign of a wrong MTU: pings and small pages work, but large pages and downloads hang.

## Keep sites inside the country on the entry

By default, users' traffic for sites inside the country also travels abroad and back. That is slow, and some domestic sites refuse foreign addresses. Send it out of the entry directly instead:

1. On the entry, open **Exits and routing**. The entry's own **Direct** exit should already exist.
2. Add a rule with the condition **Destination network** set to the country, such as `geoip:tr`, and **Then send it to** the Direct exit. From v0.3.10, this matches every address registered in that country.
3. For sites hosted abroad but meant for the country, add a rule with the condition **Domain**, with the names, or a wildcard of at least two labels such as `*.com.tr`. A whole top-level domain such as `*.tr` is refused.

The country list comes from the internet registries and installs with the node. A rule naming a country does not validate until it is there, see the [config reference](../../reference/config/#a-rule). **Domain** matches names that users looked up through the node, which apps do by default. The entry's provider sees these sites, as any local network would.

## Check that it works

- On both panels the link's card under **Links** shows **Up** within a minute.
- **Connecting** for more than a minute: the waiting side has not heard from the dialing side. Check that both sides picked the same direction, and that the dialing side's link is turned on.
- **Unreachable**: the dialing side cannot reach the other. Check the address in the offer, the port, and the waiting server's firewall. Try the link's other transports.
- **Refused**: the other server answers but does not accept the link. Its half was removed or changed. Remove the link on both sides and pair again.
- **Key changed**: the other server's certificate has a new key. Pair again.
- Connect a device to the entry, pick the new exit if it is not the default, and open a site blocked from inside. A "what is my IP" page should show the exit's address and country.
- The link's **Carried** counter grows on both cards while users browse.

## What each server can see

| | Entry | Exit |
|---|---|---|
| Users' real addresses, names and device keys | Yes | No |
| Every destination and DNS name | Yes | Yes |
| Unencrypted content | Yes | Yes |
| Volume and timing of traffic | Yes | Yes, for all of the entry's users together |
| The other server's address | Yes | Yes |

The exit cannot tell users apart from the link, but can often tell devices apart and count them. With few users, the owner can tie every flow to a user. See [what the exit learns](../../protocol/node-links/#what-the-exit-learns-about-the-entrys-users).

## Limits

- **Users trust both operators.** Each server sees destinations and anything not encrypted end to end. Pair only with someone you would trust to run your exit.
- **The entry is exposed.** It sits inside the country, under its laws, at a provider that knows who rents it. Every subscription holds its address, so it is easy to find and block. A seized or ordered entry can log everything in the table above.
- **The link itself is visible** as traffic from a domestic server to one abroad. Pick transports with that in mind. See [obfuscation layer status](../../security/obfuscation/).
- **One exit per entry, as the preset sets it up.** One `chain` exit can list 1 to 4 links to the same exit node for spare paths. Add the extra links by hand under **Exits and routing**.

## Add more entries

Every entry is its own server with its own panel and users. For each new entry, run **Set up as entry node** on it, and **Set up as exit for an entry node** on the exit again. The exit gets one link per entry, each with its own keys, up to 64 links. Losing or turning off one entry does not affect the others.
