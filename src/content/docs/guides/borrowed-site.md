---
title: Borrowed-site mode
description: Set up the alpha borrowed-site transport (faketls) from the panel's Inbounds page to a device that connects, with the limits first and the problems you are likely to meet.
---

This guide adds one borrowed-site transport to a node and ends with a device connected through it. It takes about 15 minutes once you have a site in mind. The [panel manual](../../manuals/panel/#borrowed-site-mode-alpha) lists every field. The [protocol page](../../protocol/borrowed-site/) explains the design.

## Limits first

:::danger[Alpha, rated Detectable, no outside review]
- It is alpha. Only the project has reviewed it, and it has not run against real sites. Do not rely on it.
- It is rated Detectable, like every other transport of this release.
- The site you borrow has not agreed to this. The node relays every stranger's connection to the site, and also connects to it for users, from the node's address. You answer for using its name.
- The network can still see that the node's address is not the site's, that round-trip time and TCP behavior differ from the site's, and that one long connection carries traffic both ways. The site can change its handshake at any time. Anyone with a subscription knows the address, the name and the key. See "What remains detectable" on the [protocol page](../../protocol/borrowed-site/).
- It is off unless you add it. An app uses it only after the user turns on **Alpha transports**.
:::

If you own a domain, `tls` or `ws` with your own certificate is the better choice. Use this mode for a node on a bare address with no name.

## Before you start

- A node and panel on the current release, with a working **Veilway** inbound. If you have none, start with [First inbound and user](../first-user/).
- The **Node address** set under **Settings**, as a host name or IP address that apps can dial.
- A site, from step 1.

## 1. Pick a site

The panel does not connect to the site, so check these yourself. The project suggests no site and keeps no list.

- It speaks TLS 1.3. From the node, `openssl s_client -connect www.example.com:443 -tls1_3 -servername www.example.com` should print a TLS 1.3 connection.
- The node's address reaches it with no challenge, block or rate limit. Check from the node, not your laptop.
- Your users' networks reach it, and their country does not block it.
- It is popular and stable, so it ignores the node's connections and rarely changes its handshake.
- It is hosted in the same network as the node, or as near as you can get.
- It is not your own domain.

## 2. Choose the port

The transport needs its own address and port, not shared with another transport. The web server in front of the panel usually holds port 443 on every address. Use another port, or bind the web server to one address only. The panel refuses a shared address when you review the change.

## 3. Add the transport

1. Open **Inbounds** and choose **Edit** on a **Veilway** inbound, or **Add inbound** for a new one.
2. Choose **Add a transport** and set its type to **A real site's handshake, borrowed (alpha)**. A warning, **Alpha, unreviewed, rated Detectable**, appears.
3. **Listens on**: the address and port from step 2, for example `0.0.0.0:8443`.
4. **Site name**: the site from step 1, in lowercase, for example `www.example.com`. Leave **Extra names**, **Site port** and **Site address** empty unless you need them. An empty port means 443.

   **Connect to the site through** (from v0.2.21): by default the server connects to the site from its own address, for strangers it relays and for its probes of the site. Pick one of the node's outbounds to send those connections that way instead. The detour makes the site answer probers later, which makes the server easier to tell apart, and some sites refuse foreign addresses. If that outbound is down, the server does not fall back to its own address.
5. **Transport key, private half**: choose **Pick one**. The key is not shown again, and the panel keeps its public half.
6. Tick **I know the site has not agreed to this, and I answer for using its name**. The node does not run the transport without it.
7. Choose **Review changes**, then **Apply to the node**.

Open the port in the server's firewall, for example with `sudo ufw allow 8443/tcp`. In the node's log (`sudo bash /usr/local/sbin/veilway.sh logs node`), look for a line that says `probed the site`. The node probes the site 8 times at start, then every 6 hours.

## 4. Publish the profile

Open **Profiles**. The transport has its own profile, `<name> (borrowed site, alpha)`, with an **Alpha** mark. `<name>` is the name of the inbound's other profile, or its tag. Rename that profile and this one follows. When it shows **Ready**, choose **Publish profiles**. If not, see "Left out of this profile" and "Still needed" on that page, and the problems below.

Users with a link get the new profile at their next refresh. Profiles of other transports do not change.

## 5. What users do

1. Update the app if it says "This subscription offers a way of connecting this app does not know".
2. Open **Settings**, turn on **Alpha transports**, read the warning and choose **Turn on**. The app asks every time. On the command line, `veilway connect --alpha` asks the same way. `--no-alpha` turns it off.
3. Connect. The connection details list the transport used.

## Problems you are likely to meet

- **The panel says the address is shared.** Another transport uses that address and port. See step 2.
- **The log says the site cannot be reached.** Users are not affected, but the node closes non-users' connections with no answer, which exposes the node. Check from the node that the name resolves and port 443 of the site answers, that the node's firewall lets the traffic out, and that the site does not block the node's address. **Site address** sets an address to use instead of a lookup.
- **The log says a probe failed, or none has succeeded for 24 hours.** After 24 hours without a successful probe, the node stops accepting proofs and relays everything, so users cannot connect. Fix the route to the site, or pick another site.
- **The app does not offer it.** **Alpha transports** is off. The app says "This connection can only be made in a way that is still being tested, and that is switched off". Turn it on in **Settings**, then connect again.
- **The profile says something is left out.** The page lists the reasons: the site is not acknowledged, the listener sits behind trusted proxies or a CDN, the key is the same as another transport's, the panel never saw the key in full (pick a new key and apply), the site name or listen address does not parse, or **Node address** is not something apps can dial.
- **No user is served through a relay.** A relay never carries this transport, and **Relays only** leaves it out.
- **You changed the site.** Publish the profiles again. Apps take the site name from the profile.
