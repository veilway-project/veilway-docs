---
title: Give an account a proxy login
description: Add a SOCKS5 inbound on loopback, give one account a proxy login, and use it from your own computer through an SSH tunnel.
---

This guide gives one account a SOCKS5 proxy on the node and reaches it from your computer through an SSH tunnel. It takes about 10 minutes and needs v0.2.17 or later on the node and the panel. The [panel manual](../../manuals/panel/#proxy-inbounds-socks5-and-http) explains every field. The [config reference](../../reference/config/#proxy-inbounds-socks5-http-mixed) has the rules behind them.

:::danger[Do not listen on a public address]
SOCKS5 and HTTP send the password and the traffic in the clear. On a public address, anyone on the path reads both. Anyone who finds the port can tell it is a proxy and block it. The panel rates a proxy inbound Unsafe and refuses a public address until you tick that you understand. This guide keeps the port on loopback, where only the node itself can reach it, and sends the traffic through SSH, which is encrypted.
:::

## Before you start

- A working node with the panel, an account to use (this guide calls it `ana`), and an exit it may use. If you have none, start with [First inbound and user](../first-user/) first.
- SSH access to the node from the computer where you will use the proxy.
- `curl` on that computer.

## 1. Add the inbound

1. Open **Inbounds** and choose **Add inbound**, then **SOCKS5 proxy**.
2. **Tag**: `socks`.
3. **Listen on**: `127.0.0.1:1080`. Pick a port nothing else on the node uses.
4. Leave **UDP through the proxy** on if you want UDP. On a loopback address of a Linux node it needs no other settings.
5. **Who may log in**: **Only chosen accounts and groups**, then tick `ana` under **Accounts**. Leave it on **Every account with a proxy login** if any account with a login may use this port.
6. Choose **Review changes**, then **Apply to the node**.

The form shows **Nobody can log in yet** until an admitted account has a proxy login. The next step adds one.

## 2. Make the login

1. Open the account's page, `ana`, and find **Proxy login**.
2. Choose **Make a proxy login** and confirm your password, and your code when two-step sign-in is on.
3. The panel shows the **User name** (`ana`) and the **Password**. Under them is one line to copy for each proxy inbound the account may use, for example `socks5://ana:<password>@127.0.0.1:1080`. Copy the password. You can see it again with **Show login**.

The login is separate from the subscription link and the device keys. **Make a new password** replaces the password and cuts the account's proxy connections at once. **Remove** deletes the login.

## 3. Open the SSH tunnel

On your computer run:

```
ssh -N -L 1080:127.0.0.1:1080 user@node
```

`user@node` is your own login to the node. The command prints nothing and keeps running. It forwards port 1080 of your computer to port 1080 on the node's loopback, so the password and the traffic cross the network inside SSH. Leave it open while you use the proxy.

## 4. Test it

In another terminal:

```
curl --socks5-hostname ana:PASSWORD@127.0.0.1:1080 https://example.com
```

Replace `PASSWORD` with the password from step 2. `--socks5-hostname` makes the node look up the name instead of your computer, so the lookup goes through the exit too. The command prints the page. To check your address, fetch a page that shows your IP address. It should be the exit's address, not yours.

Apps that take a SOCKS5 proxy use `127.0.0.1`, port `1080`, the user name and the password. For an app that takes only an HTTP proxy, add a second inbound of type **HTTP proxy** on another loopback port, or use **SOCKS5 and HTTP on one port**. Forward that port the same way.

## When it does not work

- **`curl` says the SOCKS5 server rejected the user.** Check that the user name is the account's name, the password is the current one (a new password replaces the old), and the inbound admits the account. The inbound's row on **Inbounds** counts the logins it refused.
- **`curl` says connection refused on 127.0.0.1:1080.** The SSH tunnel is not running, or the inbound is not applied. Check that the `ssh -N -L` command still runs and that **Apply to the node** went through.
- **Login works but the page does not load.** The account's rules and exit decide where the traffic goes, as for its tunnel. Check the account's exits and the **Routing** rules. The node refuses destinations on itself and on its own networks.
- **Many wrong tries.** After 10 wrong logins to one name in a minute, the node refuses that name from your source until the minute ends. Wait, then retry with the right password.

## Use a public address anyway

Do this only when no tunnel is possible. Anyone on the path can read the password and everything the account sends. Put a TLS front in front if you can. In **Listen on**, write the public address, tick **I understand that traffic and passwords cross the network in the clear**, and apply. Clients behind a NAT get no UDP unless you turn on **Allow UDP for clients behind NAT**. That lets a neighbor behind the same NAT take the association. Change the password after any test.
