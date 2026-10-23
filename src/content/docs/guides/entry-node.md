---
title: Set up an entry node
description: Keep users connected when a country's international links are cut or filtered, with one server inside the country and one abroad.
---

An entry node is a Veilway server inside the country, where users connect. It does not send their traffic to the internet itself. It carries the traffic over one [node link](../../protocol/node-links/) to an exit node abroad, which does.

```text
 users ---> entry node ===== link =====> exit node ---> internet
            (inside the country)          (abroad)
```

## When you need one

Use an entry node when users can reach servers inside the country but not servers abroad. International links are cut, throttled or filtered, while the domestic network works. Users need a path only to the entry. The entry needs one path to the exit, in either direction.

Data centers inside a country often keep an international path when home and mobile lines lose theirs. If the entry has no path abroad in either direction, no link can help.

If users can reach your server abroad directly, you do not need an entry node. If their networks block only your node's address, a [relay](../../manuals/panel/#relays) on another address may be enough.

## What to rent where

- **The entry**: a server at a hosting provider inside the country, with a public address that users' networks can reach. It runs the node and the panel, holds your users and serves their subscriptions.
- **The exit**: a server abroad, at a provider outside the country's reach. It runs its own node and panel. Its only users are the entry's link.

Both need a Veilway inbound for the link to connect to, as the [panel manual](../../manuals/panel/#node-links) describes. Install both with [Getting started](../../getting-started/).

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
- **Reverse** when the entry cannot open connections abroad (or they are filtered), but connections into it from abroad still pass. The side that is easy to reach waits, and the other side dials out.

## Step by step

You need the other server's operator on a call or another channel you trust, because the last step compares fingerprints aloud. If you run both servers, open both panels side by side.

1. On the **entry's** panel, open **Nodes** and choose **Set up as entry node**. For a reverse link, choose **Reverse tunnel** and then **The entry**.
2. On the **exit's** panel, open **Nodes** and choose **Set up as exit for an entry node**. For a reverse link, choose **Reverse tunnel** and then **The exit**.
3. Both sides pick the same direction. The panel says who makes the offer: the exit in a forward link, the entry in a reverse one. That side picks the Veilway inbound the link connects to, the transports and the tunnel addresses, then sends the offer code to the other side.
4. The other side pastes the offer, checks where its server would connect, and sends back the answer code. If the offer was made for the other side, the panel says so and refuses to answer.
5. The side that made the offer pastes the answer. Both sides read their eight fingerprint groups aloud and type the other side's. Confirm only when they match. The link is then in each node's config.
6. On the entry, give users an exit through the link. Set its name and country, whether it becomes the default exit, and whether it is added to every user who has a list of exits. Users allowed every exit get it anyway. The review shows each change before you apply it.
7. On the exit, pick which of its exits the link's traffic may leave through. Leave **Let rules reach private networks** off unless you mean it. When on, the entry's users can reach this server's local networks.

Profiles do not change, so there is nothing to publish. Apps see the new exit at their next connect.

## Check that it works

- On both panels the link's card under **Nodes** shows **Up** within a minute. **Unreachable** means the dialing side cannot reach the other. Check the direction, the address in the offer and the firewall.
- Connect a device to the entry, pick the new exit if it is not the default, and open a site that is blocked from inside. A "what is my IP" page should show the exit's address and country.
- The link's **Carried** counter grows on both cards while users browse.

## What each server can see

| | Entry | Exit |
|---|---|---|
| Users' real addresses, names and device keys | Yes | No |
| Every destination and DNS name | Yes | Yes |
| Unencrypted content | Yes | Yes |
| Volume and timing of traffic | Yes | Yes, for all of the entry's users together |
| The other server's address | Yes | Yes |

The exit cannot tell users apart from the link, but it can often tell devices apart and count them. With few users, the owner can tie every flow to a user. The [node links page](../../protocol/node-links/#what-the-exit-learns-about-the-entrys-users) has the detail.

## Limits

- **Users trust both operators.** Each server sees destinations and anything not encrypted end to end. Pair only with someone you would trust to run your exit.
- **The entry is exposed.** It sits inside the country, under its laws, at a provider that knows who rents it. Every user's subscription holds its address, so it is easy to find and block. A seized or ordered entry can log everything in the table above.
- **The link itself is visible** as traffic from a domestic server to one abroad. Pick transports with that in mind. See [obfuscation layer status](../../security/obfuscation/).
- **One exit per entry, as the preset sets it up.** One `chain` exit can list 1 to 4 links to the same exit node for spare paths. Add the extra links by hand under **Exits and routing**.

## Add more entries

Every entry is its own server with its own panel and users. For each new entry, run **Set up as entry node** on it, and run **Set up as exit for an entry node** on the exit again. The exit gets one link per entry, each with its own keys, and takes up to 64 links. Turning off or losing one entry does not affect the others.
