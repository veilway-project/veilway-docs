---
title: Use another provider's Xray server as an exit
description: Send some users' traffic out through a VLESS, VMess, Trojan or Shadowsocks server you rent, what its owner sees, and what happens when it is down.
---

An Xray outbound lets your node leave through a server of another party that speaks VLESS, VMess, Trojan or Shadowsocks. You add it, make an exit that uses it, and route some users or rules to that exit. Their traffic then leaves from the rented server's network instead of your server's. The [config reference](../../reference/config/#xray-outbounds) has every field.

```text
 users ---> your node ---> Xray (add-on) ---> rented server ---> internet
```

## When it fits

- You want an exit in a place you do not run a server, and you rent a VLESS, VMess, Trojan or Shadowsocks server there.
- You want a second path out for the users of one rule.

If the other side runs Veilway, use [another provider as an exit](../upstream-provider/) or a [node link](../entry-node/) instead. This is for servers of other software. It needs a Linux node and the Xray add-on.

## What the server's owner sees

| | The owner of the rented server |
|---|---|
| Your node's address | Yes |
| Every destination name and address of the traffic routed to it | Yes |
| Every byte the destination's own protocol leaves unprotected | Yes |
| Who your users are, their names, tunnel addresses or keys | No |
| Your other exits, and traffic you route elsewhere | No |

The traffic of all users routed to the exit arrives as one customer. With few users, the sum is the user, and the owner can correlate every flow. There is no anonymity from the server. Use it for what you would let its owner see, and tell your users that you added a second party to their path.

Your own users are held to the node's rules as ever: the gate, the routing rules, quotas and counters apply before a flow reaches Xray.

## Add one

1. **Install the add-on.** On the node, run `sudo bash veilway.sh addon xray install`. It also lets the node's user into the group `veilway-xray` and restarts a node that was running. See the [Xray add-on](../../manuals/xray/). Without it you can still save the outbound, and every exit that uses it stays down until the add-on is there.
2. **Add the outbound.** Open **Exits and routing**, choose the **Outbounds** tab and **Add outbound**. Set **Type** to **Xray server**. Under **How to add it**, choose **Paste a link** and paste the `vless://`, `vmess://`, `trojan://` or `ss://` link of your server into **Share link**. The node reads it once and keeps the fields, never the link. Or choose **Fill in the fields** and write the **Protocol**, the **Proxy address** as `host:port`, the credential, the **Transport** and the **Security**. Review and apply, as for any change.
3. **Check its state.** The **State** column says **Carrying** when Xray is up and the node has a socket to it. **Down** comes with the node's reason, such as the add-on not being installed or the server's name not resolving.
4. **Make the exit.** On the **Exits** tab choose **Add exit**, choose **An outbound** and pick the Xray outbound. Under **Traffic the outbound cannot carry**, **UDP** can be **Refuse** or **Drop silently** only, since the outbound carries UDP itself. Give the exit a name and a country if you want users to see them.
5. **Route traffic to it.** Give the exit to users, name it in a rule, or make it the default, as for any exit.

Run `veilway check` or read the review before you apply: it warns when `routing.fallback` lists another exit, since users fall back to it while the Xray server is down.

## Things to know

- **A restart drops Xray inbound users for a moment.** One Xray process serves the Xray inbounds and the outbounds. Adding, changing or removing an Xray outbound restarts it, so users of your Xray inbounds are cut off briefly and connect again with their next try. Users of tunnels are not affected.
- **The provider's name is looked up in clear.** If **Proxy address** is a name, the node looks it up itself through the resolvers of **DNS** (`dns.servers`) over plain UDP, at start, at every reload and every quarter hour. Whoever sees your node's DNS traffic learns the provider's name. Write the server's IP address instead to hide it. The address must be one the node may dial: not loopback or link-local, and not private unless you turn on **Allow a private address**.
- **Certificates are always checked.** There is no switch to turn that off, and no way to pin a certificate in place of the chain. A link that does either is refused, and the panel tells you why.
- **VLESS and Trojan need TLS or Reality.** They are never spoken in the clear. A path has no `?`. A Shadowsocks password of an old cipher needs 16 characters or more.
- **Linux nodes only.** On other systems the outbound is down and says so.
- **When it is down, nothing goes around it.** If Xray, the add-on or the server is not carrying, flows to the exit end at once, the exit shows as not working, and traffic does not move to `direct` or to the provider's default. The node tries again by itself. Only a `routing.fallback` that you wrote moves users to another exit.
- **Xray itself can reach the whole network.** Its unit is not restricted to the provider's address. The node writes it an address it checked, and a bug in Xray would not be held to that. Use a server whose owner you trust.

`veilway doctor` checks that the add-on is installed and pinned, and that the folder for the sockets has the right owner, mode and group. Run it as the node's user.

## Remove one

First point the exits that use it somewhere else or remove them, since the node refuses a config where an exit names an outbound that is gone. Then choose **Remove** on the outbound's row. Xray restarts once more.
