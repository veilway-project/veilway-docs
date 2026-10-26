---
title: Use another provider as an exit
description: Let your node send some users' traffic out through another provider's Veilway subscription, what that provider sees, and how to keep it, refresh it and remove it.
---

An upstream is another provider's Veilway subscription, on which your node holds one device. Make an exit that uses it and route some users or rules to it, and their traffic leaves through the other provider's network instead of your server's. The [protocol page](../../protocol/upstreams/) has every route and number.

```text
 users ---> your node ===== your device =====> other provider ---> internet
```

## When it fits

- You want an exit where you run no server, and you have an account with a provider that has one.
- You want a second path out for the users of one rule, such as a site your own server's address cannot reach.

If you run both servers, use a [node link](../entry-node/) instead. A link is for two nodes that agree with each other. An upstream works with a provider who does not know your users.

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

All routed users arrive as one device. The provider cannot tell your users apart by name, but can often tell flows apart and correlate them. With few users, it can tie every flow to a user.

The provider can also misbehave: cut your device off, refuse your account or let it expire, forge DNS answers, or send packets nobody asked for. The node drops anything that does not answer a flow it sent, never lets a user's flow reach the provider's own gateways, and never dials addresses on your host or networks. That does not make the provider honest. Pick one you would trust with that traffic.

Your users are not asked. You add a second provider to their path, so tell them.

## Add one

Three steps. Nothing is saved before the last.

1. **Paste the link and check the fingerprint.** Open **Exits and routing**, choose the **Other providers** tab and choose **Add another provider**. Paste the provider's `veilway://sub/` link into **Subscription link**. To reach the provider through a proxy, choose it in **Reach the provider through**, otherwise leave **Directly**. Choose **Read link**. The panel reads the link without using the network and shows the **Provider address** and **Signing key fingerprint**. Compare the fingerprint with one the provider gave you by another channel. Only native Veilway links are accepted.
2. **Fetch and review.** Choose **Fetch**. Your node asks the provider for its document, using a device the panel just made. This takes one of your account's device places, and the provider sees your node's address. The review shows the provider's name, its profiles with transports and ratings, its exits, your quota and expiry, the device limit and any private addresses a profile names, and says why your node would not use a profile, if so. If the account is at its device limit, the fetch fails and nothing is stored. The review is kept for 10 minutes. At most 4 places can be taken at a time, counting fetches still running. **Decline** or a timeout gives the place back to the provider.

   On the review, set what you need:
   - **Profile to use**, **The provider's exit** and **Transports that can be recognized**: see the list below.
   - **Allow private addresses**: only if you need it (see [Private addresses](#private-addresses)).
   - **Name** and **Display name of the exit**: the name gives the provider and the new exit their tag. The display name is optional.

3. **Add provider.** The panel asks for your password and code again, then adds the upstream and an exit that uses it to the config. Your node uses the document you reviewed and does not ask the provider again.

Then route traffic to the new exit as for any exit: give it to users, name it in a rule, or make it the default. The panel shows a card for the upstream with its state, reason, last refresh, quota, notices, MTU, the exit in use and counters. Run `veilway check` before you apply. It warns when no provider exit is set, and when an upstream exit is used beside `routing.fallback`, because users fall back to it while the provider is down.

The review options in detail:

- **Profile to use.** Which of the provider's profiles to use. Without a choice (Automatic), the node tries every profile in the provider's order and moves to the next when one fails. A profile you pick is the only one used, unless you also turn on **Try the other profiles too**.
- **The provider's exit.** Which of the provider's exits to leave through. Without a choice, the provider's own default, which the provider picks.
- **Transports that can be recognized.** By default only web-like transports (`tls`, `ws`, `fronted`, `faketls`) are used. You can also allow `udp-obfs`, `ws-plain` or plain `udp`, which are easier to spot. A profile with none of the allowed transports is not used.
- **Reach the provider through.** A `direct` or `socks5` outbound for the fetch and the connection. `udp` and `udp-obfs` cannot go through a `socks5` outbound. A proxy on this host or at a link-local address is refused.

## Private addresses

A profile names the addresses your node connects to. Your node refuses a profile if any is loopback, link-local, multicast, an address of your own server, inside your tunnel pools, or private or shared, such as `10.x.x.x` or `192.168.x.x`. One refused address makes the whole profile unusable.

Private addresses are the only kind you can allow. Turn on **Allow private addresses** only when the provider is on your own network, such as a home lab. With it on, that provider can make your node dial anything it can reach in the private ranges, so never turn it on for a provider you do not run. The review lists each profile's private addresses first.

## Refresh, refusal and expiry

The node refreshes the provider's document by itself, between once an hour and once a day as the document asks, with a small random delay.

If the provider refuses your account, revokes the device or lets the document run out:

- The exit goes down. Everything routed to it is refused as unreachable.
- It does not fall back. Traffic does not move to the provider's default exit, to another exit of yours or to a direct connection. For a fallback, set `routing.fallback` yourself.
- The node asks the provider again every hour for the first day, then every day. The first answer that lets you back in lifts the block.
- The card shows the reason in plain words. **Retry now** asks again at once.

If your network drops, or the tunnel ends for any other reason, the node retries after 30 seconds, then waits longer each time, up to an hour. For a device the provider cut off, it asks every hour. Nothing stays down for good.

If a refresh changes the profile's keys, addresses, MTU or candidates, the node rebuilds the tunnel. The exit is down meanwhile and its connections end, so they are decided again against the new profile.

The log has an info line for every change, with its reason, and a warning when the provider says 90% of your quota is used. The provider's notices appear on the card as plain text.

## When the provider moves or adds hosts

A provider may announce that its subscription endpoint moved or that it added refresh hosts. The node does not follow it by itself. It keeps the old endpoint and hosts, and the card shows the pending change under **The provider announced a change**. Choose **Confirm** only if you expect the change, for instance from the provider's own notice. Confirming a move makes the node try the new endpoint at once. The apps follow the same rule, which keeps a stolen signing key or hijacked name from sending your node elsewhere.

A provider can also renew its signing key. The node accepts a new key only from a document signed by a key it already holds, and refuses any other. If you lose your state file after a renewal, the card shows the new fingerprint. Check it with the provider through another channel before using its new link.

## Remove one

Choose **Remove** on the card. The node tells the provider the device left, waiting at most 10 seconds, and the card says whether the provider confirmed. If the provider could not be told, the device place stays on your account until the provider removes it, and **Remove** tells it again. The node keeps the document and keys until the provider confirms, then deletes them. It also keeps a mark, so a restart does not enroll the device again, until a config without the upstream is applied. The panel then applies the config without the upstream and its exit.

Editing the upstream out of the config by hand never tells the provider. Use **Remove** unless you mean to leave the place taken.

## Limits

- **The provider sees the exit's traffic.** There is no anonymity from it. Use it only for traffic you accept it seeing.
- **The provider can forge DNS and unencrypted content.** Encrypted connections protect themselves. Plain ones do not.
- **You depend on its availability.** It can cut you off at any time.
- **At most 8 upstreams** on a node, with one exit and one device place each.
- The Xray add-on cannot use an upstream exit.
- No one outside the project has reviewed this feature yet.
