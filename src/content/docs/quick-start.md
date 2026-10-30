---
title: Quick start
description: From a new server to a working VPN on your phone or computer, in six steps.
---

This is the short way: one server outside the country, one user, one device. It takes about 15 minutes.

Your users are in a country where servers abroad are cut off? Read [Tunnel: a server in Iran in front of a foreign server](../guides/entry-node/) after this page.

## 1. Rent a server

Rent a Linux server outside the country. Debian or Ubuntu, with root access. Any small plan works for a few users.

You need a domain name that points at the server for the easiest setup. No domain? You can still do it: see [Without a domain](../getting-started/#without-a-domain).

## 2. Install

Log in to the server and run:

```
curl -fsSL https://raw.githubusercontent.com/veilway-project/veilway/main/scripts/veilway.sh | sudo bash
```

Choose `1` (Install), then `both`. The script checks every download before it installs anything. When it asks about a web server, give your domain.

At the end it prints the admin page address and a one-time setup token. Keep both.

## 3. Open the panel

Open the address it printed. Paste the setup token, choose a user name and a password of 12 characters or more, and add the authenticator key to your phone. [First inbound and user](../guides/first-user/#1-make-the-admin-account) shows each screen.

## 4. Add a user

The dashboard has a setup checklist. Follow it down to the first user. If the panel shows no inbound, follow [First inbound and user](../guides/first-user/) instead. It takes about 10 minutes.

If the server has a firewall, open the inbound's UDP port. The installer printed it ("inbound main on UDP port ..."). For example `sudo ufw allow 31234/udp`.

When the user exists, choose **Copy Veilway link**. Send it over a channel you trust. Anyone with the link can use the account.

## 5. Install the app

- **Android:** download the APK ending in `-arm64.apk` from the [release page](https://github.com/veilway-project/veilway/releases). See the [Android app](../manuals/android/).
- **Linux or Windows:** download the app from the same page. See the [client manual](../manuals/client/#install).
- **iPhone:** there is no app. See the [FAQ](../faq/#is-there-an-app-for-iphone).

## 6. Add the link and connect

Open the app, paste the link, follow its steps and tap **Connect**. Then open a "what is my IP" page. It should show your server's address.

## Next

- [Tunnel: a server in Iran in front of a foreign server](../guides/entry-node/): when the server abroad is blocked for your users.
- [The same server as x-ui](../faq/#can-i-run-veilway-on-the-same-server-as-x-ui-or-3x-ui): sharing port 443.
- [The panel manual](../manuals/panel/): every page and field.
- [FAQ](../faq/): leaks, routers, slow Iranian sites.
