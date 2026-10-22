---
title: Use another provider as an exit
description: Let your node send some users' traffic out through another provider's Veilway subscription, what that provider sees, and how to keep it, refresh it and remove it.
---

:::caution[Panel screens are not built yet]
The node and its control API support upstreams in v0.2.15. The panel's screens for them come later. Until then the steps below are done with the [control API](../../reference/api/) and the config, and the names in bold are the panel's planned labels. The [protocol page](../../protocol/upstreams/) has every route and number.
:::

An upstream is another provider's Veilway subscription that your node holds one device on. You make an exit that uses it, route some users or rules to that exit, and their traffic leaves through the other provider's network instead of your server's.

```text
 users ---> your node ===== your device =====> other provider ---> internet
```

## When it fits

- You want an exit in a place you do not run a server, and you have an account with a provider that has one.
- You want a second path out for the users of one rule, such as one site that your own server's address cannot reach.

If you run both servers, use a [node link](../entry-node/) instead. A link is built for two nodes that agree on each other. An upstream works with a provider who does not know your users and does not need to.

## What the other provider sees

| | The other provider |
|---|---|
| Your node's address | Yes |
| One device on your account | Yes |
| Every destination and DNS name of the traffic routed to it | Yes |
| Unencrypted content and the timing of that traffic | Yes |
| Who your users are, their names, tunnel addresses or keys | No |
| Your other exits, and traffic you route elsewhere | No |
| Your panel's address | No, the node fetches the subscription itself |

The traffic of all users routed to the exit arrives as one device. The provider cannot tell your users apart by name, but it can often tell flows apart and correlate them. With few users, the sum is the user.

It can also misbehave. It can cut your device off, refuse your account or let it expire, forge DNS answers, or send packets nobody asked for. The node drops anything that does not answer a flow it sent, never lets a user's flow reach the provider's own gateways, and never dials addresses on your host or networks. It does not make the provider honest. Pick a provider you would trust with that traffic.

Your users are not asked. You are adding a second provider to their path, so tell them.

## Add one

Three steps. Each one can stop the whole thing, and nothing is saved before the last.

1. **Paste the link and check the fingerprint.** Open **Exits** and choose **Another provider**. Paste the provider's `veilway://sub/` link. The panel reads it without the network and shows the provider's host and the fingerprint of its signing key. Compare the fingerprint with one the provider gave you by another channel. Only native Veilway links are accepted.
2. **Fetch and review.** Choose **Fetch**. Your node asks the provider for its document with a device the panel just made. This takes one of your account's device places, and the provider sees your node's address. The review shows the provider's name, its profiles with their transports and ratings, its exits, your quota and expiry, the device limit and any private addresses a profile names. It also says why your node would not use a profile, if so. If the account is at its device limit, the fetch fails and nothing is stored. The review is kept for 10 minutes, at most 4 places taken at a time, counting fetches still running. **Decline** or a timeout gives the place back to the provider.
3. **Confirm.** Confirm with your password or second factor again. The panel adds the upstream and an exit that uses it to the config. Your node uses the document you reviewed and does not ask the provider again.

Then route traffic to the new exit as for any exit: give it to users, name it in a rule, or leave it as the default. The panel shows a card for the upstream with its state, its reason, the last refresh, the quota, notices, MTU, the exit in use and counters. Run `veilway check` before you apply: it warns when no provider exit is set, and when an upstream exit is used beside `routing.fallback`, since users fall back to it while the provider is down.

Options you can set on the upstream:

- **Profile.** Which of the provider's profiles to use. Without it, the first one.
- **Provider's exit.** Which of the provider's exits to leave through. Without it the provider's own default, which the provider picks.
- **Allowed transports.** By default only web-like transports (`tls`, `ws`, `fronted`, `faketls`) are used. You can add `udp-obfs`, `ws-plain` or plain `udp`, which are easier to spot. A profile with nothing you allowed is not used.
- **Reach the provider through.** A `direct` or `socks5` outbound for the fetch and the connection. `udp` and `udp-obfs` cannot go through a `socks5` outbound. A proxy on this host or at a link-local address is refused.

## Private addresses

A profile names the addresses your node connects to. Your node refuses a profile if any of them is loopback, link-local, multicast, an address of your own server, inside your tunnel pools, or private or shared, such as `10.x.x.x` or `192.168.x.x`. One refused address makes the whole profile unusable.

Private addresses are the only part you can allow. Turn on **Allow private addresses** only when the provider is on your own network, such as a home lab, and you know why its address is private. With it on, that provider can have your node dial anything in the private ranges it can reach, so do not turn it on for a provider you do not run. The review lists the private addresses of each profile before you decide.

## Refresh, refusal and expiry

The node refreshes the provider's document by itself, about once an hour to once a day, as the document asks, with a small random delay. You do not need to do anything.

If the provider refuses your account, revokes the device or lets the document run out:

- The exit goes down. Everything routed to it is refused as unreachable.
- It does not fall back. Traffic does not move to the provider's default exit, to another exit of yours or to a direct connection. If you want a fallback, set `routing.fallback` yourself.
- The node asks the provider again every hour for the first day, and every day after that. The first answer that lets you back in lifts it.
- The card shows the reason in plain words. **Connect now** asks again right away.

If your network drops, or the tunnel ends for any other reason, the node tries again after 30 seconds, then waits longer each time, up to an hour. A device the provider cut off is asked about again every hour. Nothing stays down for good.

If a refresh changes the profile's keys, addresses, MTU or candidates, the tunnel is made again. The exit is down meanwhile, and the connections through it end, so they are decided again against the new profile.

The log has a line at info for every change, with its reason. When the provider says 90% of your quota is used, it logs a warning. The provider's notices appear on the card as plain text.

## When the provider moves or adds hosts

A provider may announce that its subscription endpoint moved, or that it added refresh hosts. The node does not follow it by itself. It keeps using the old endpoint and hosts, and the card shows what waits. Confirm only if the change is expected, for instance after you read the provider's own notice. Confirming a move makes the node try the new endpoint at once. This is the same rule the apps follow, and it keeps a stolen signing key or a hijacked name from sending your node somewhere else.

A provider can also renew its signing key. The node takes that only from a document signed by a key it already holds. A document under any other key is refused. If your state file is lost after a renewal, the card shows the new fingerprint. Check it with the provider through another channel before you use the provider's new link.

## Remove one

Choose **Remove** on the card. The node tells the provider that the device left, waiting at most 10 seconds. The card says whether the provider confirmed. If it could not be told, the device place stays on your account until the provider removes it, and **Remove** tells it again. The node keeps the document and the keys until the provider confirms, then deletes them. It also keeps a mark, so a restart does not enroll the device again, until a config without the upstream is applied. Then the panel applies the config without the upstream and its exit.

Taking the upstream out of the config by hand never tells the provider anything. Use **Remove** unless you mean to leave the place taken.

## Limits

- **The provider sees the traffic of the exit.** There is no anonymity from it. Use it for what you would let that provider see.
- **DNS and unencrypted content can be forged by the provider.** Encrypted connections protect themselves, plain ones do not.
- **You depend on its availability.** It can cut you off at any time.
- **At most 8 upstreams** on a node, one exit for each, and one device place for each.
- The Xray add-on cannot use an upstream exit.
- No one outside the project has reviewed this feature yet.
