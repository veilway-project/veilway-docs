---
title: Use another provider's Xray server as an exit
description: Send some users' traffic out through a VLESS, VMess, Trojan or Shadowsocks server you rent, what its owner sees, and what happens when it is down.
---

An Xray outbound lets your node send traffic out through another party's VLESS, VMess, Trojan or Shadowsocks server. Add the outbound, make an exit that uses it, and route some users or rules to it, and their traffic leaves from the rented server's network instead of yours. The [config reference](../../reference/config/#xray-outbounds) has every field.

```text
 users ---> your node ---> Xray (add-on) ---> rented server ---> internet
```

## When it fits

- You want an exit where you run no server, and you rent a VLESS, VMess, Trojan or Shadowsocks server there.
- You want a second path out for the users of one rule.

If the other side runs Veilway, use [another provider as an exit](../upstream-provider/) or a [node link](../entry-node/) instead. This guide is for servers running other software, and needs a Linux node and the Xray add-on.

## What the server's owner sees

| | The owner of the rented server |
|---|---|
| Your node's address | Yes |
| Every destination name and address of the traffic routed to it | Yes |
| Every byte the destination's own protocol leaves unprotected | Yes |
| Who your users are, their names, tunnel addresses or keys | No |
| Your other exits, and traffic you route elsewhere | No |

All routed users arrive as one customer. With few users, the owner can tie every flow to a user. There is no anonymity from the server. Use it only for traffic you accept its owner seeing, and tell your users you added a second party to their path.

Users stay under the node's rules: the gate, routing rules, quotas and counters apply before a flow reaches Xray.

## Add one

1. **Install the add-on.** On the node, run `sudo bash veilway.sh addon xray install`. It also adds the node's user to the group `veilway-xray` and restarts a running node. See the [Xray add-on](../../manuals/xray/). Without it you can save the outbound, but every exit that uses it stays down until the add-on is installed.
2. **Add the outbound.** Open **Exits and routing**, choose the **Outbounds** tab and **Add outbound**. Set **Type** to **Xray server**. Under **How to add it**, choose **Paste a link** and paste the `vless://`, `vmess://`, `trojan://` or `ss://` link of your server into **Share link**. The node reads the link once and keeps the fields, never the link. Or choose **Fill in the fields** and write the **Protocol**, **Proxy address** as `host:port`, the credential, **Transport** and **Security**. Review and apply as usual.
3. **Check its state.** The **State** column says **Carrying** when Xray is up and the node has a socket to it. **Down** comes with the node's reason, such as a missing add-on or an unresolvable server name.
4. **Make the exit.** On the **Exits** tab choose **Add exit**, choose **An outbound** and pick the Xray outbound. Under **Traffic the outbound cannot carry**, **UDP** can only be **Refuse** or **Drop silently**, since the outbound carries UDP itself. Give the exit a name and country if you want users to see them.
5. **Route traffic to it.** Give the exit to users, name it in a rule, or make it the default, as for any exit.

Run `veilway check` or read the review before applying. It warns when `routing.fallback` lists another exit, because users fall back to it while the Xray server is down.

## Things to know

- **A restart drops Xray inbound users for a moment.** One Xray process serves the Xray inbounds and outbounds, so adding, changing or removing an Xray outbound restarts it. Users of your Xray inbounds are cut off briefly and reconnect on their next try. Users of tunnels are not affected.
- **The provider's name is looked up in clear.** If **Proxy address** is a name, the node looks it up over plain UDP through the resolvers of **DNS** (`dns.servers`), at start, at every reload and every quarter hour. Anyone who sees your node's DNS traffic learns the name. Write the server's IP address instead to hide it. The node must be allowed to dial the address: not loopback or link-local, and not private unless you turn on **Allow a private address**.
- **Certificates are always checked.** You cannot turn that off or pin a certificate in place of the chain. The node refuses a link that tries either, and the panel says why.
- **VLESS and Trojan need TLS or Reality.** They are never spoken in the clear. A path has no `?`. A Shadowsocks password of an old cipher needs 16 characters or more.
- **Linux nodes only.** On other systems the outbound is down and says so.
- **When it is down, nothing goes around it.** If Xray, the add-on or the server is not carrying, flows to the exit end at once and the exit shows as not working. Traffic does not move to `direct` or the provider's default. The node retries by itself. Only a `routing.fallback` you wrote moves users to another exit.
- **Xray itself can reach the whole network.** Its unit is not restricted to the provider's address. The node gives it an address it checked, but a bug in Xray would not be held to that. Use a server whose owner you trust.

`veilway doctor` checks that the add-on is installed and pinned and that the socket folder has the right owner, mode and group. Run it as the node's user.

## Remove one

First point the exits that use it elsewhere, or remove them, because the node refuses a config where an exit names a missing outbound. Then choose **Remove** on the outbound's row. Xray restarts once more.
