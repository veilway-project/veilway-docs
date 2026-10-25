---
title: First inbound and user
description: From the panel's first sign-in to a subscription link a device connects with, step by step. The settings, one inbound, its profile and one user.
---

This guide starts after `sudo bash veilway.sh install both` and ends with a link you can send to a user. It takes about 10 minutes. Each step names the page and fields as the panel shows them. The [panel manual](../../manuals/panel/) explains every field and option.

The examples use `vpn.example.com`. Use your own domain.

## Before you start

- A domain name that points at the server, with a web server in front of the panel. The install script can set one up. See [Put a web server in front](../../getting-started/#put-a-web-server-in-front).
- The admin pages address and setup token the install printed. To read the token again, run `sudo journalctl -u veilway-panel -o cat | grep 'Setup token' | tail -n 1`.
- Panel v0.2.8 or later. An older panel needs more steps. See [On an older panel](#on-an-older-panel).

## 1. Make the admin account

1. Open the admin pages, `https://vpn.example.com/<prefix>/`. The page is **Set up this panel**.
2. Paste the token into **Setup token**. Choose a **Username** and a **Password** of 12 characters or more. Enter it again under **Password again**.
3. Tick **I have read and accept these terms**, then choose **Make admin account**.
4. The next page shows a key and QR code for your authenticator app, once. Add the key to the app, then choose **I added it, go to login**.
5. Log in with your username, password and the 6-digit code from the app. If two-step sign-in is off, the panel does not ask for the code. Keep the key for when you turn it on.

## 2. Settings

Open **Settings**. If you opened the panel at your domain, setup already filled in steps 1 and 2 (from v0.3.2): check them and go on to step 3.

1. Under **Provider**, set **Node address** to `vpn.example.com`, or the server's public IP address. Devices connect to it, and profiles are built with it. The panel looks the domain up each time it makes a user's subscription, and apps get the IP addresses it finds then.
2. Under **Endpoints**, choose **Add endpoint**. Set **Name** to `main` and **Address** to `https://vpn.example.com/sub/main`. Apps fetch the user's subscription here. The web server sends `/sub/` to the panel, and the name is the last part of the path. The first endpoint becomes the **Default endpoint** by itself.
3. Under **New users**, leave **Device address pool** at `10.66.0.0/16`. Each device gets one address from it. Change it only if your users' own networks use that range.
4. Choose **Save changes** in the bar at the bottom.

## 3. Add the inbound

Open **Inbounds** and choose **Add inbound**.

1. **Tag**: `main`. Rules and links name the inbound by its tag.
2. **Type**: leave it at **Veilway**.
3. **Private key**: choose **Generate**. This is the inbound's secret, and the panel derives the public half. To make the key on the server instead, run `veilway genkey` and paste the value of `private_key`.
4. **Gateway addresses**: `10.66.0.1/16`, the first address of the device address pool with the pool's prefix. The panel never gives it to a device.
5. **Transport 1** and **Listens on**: how devices reach the node. `udp-obfs` needs only a port, for example `0.0.0.0:8443`. `tls`, `ws` and `fronted` need more settings in the JSON view. See [Inbounds](../../manuals/panel/#inbounds). Pick a port nothing else on the server uses. A web server with HTTP/3 already uses UDP port 443.
6. Choose **Review changes**, which lists what the node will add, then **Apply to the node**.

Open the port in the server's firewall, for example with `sudo ufw allow 8443/udp`.

## 4. Publish the profile

Open **Profiles**. The inbound's profile shows **Ready**. Choose **Publish profiles**. Apps get it at their next refresh.

If it is not ready, the page lists what it needs, most often the **Node address** from step 2.

## 5. Add a user and send the link

1. Open **Users** and choose **Add user**.
2. Enter a **Name**, for example `ana`. The other fields are optional: quota, expiry date, device limit, groups and a note.
3. Choose **Add user** at the bottom of the form.

The user's page opens with **New subscription link**: a QR code, the **Veilway link** and a web link for apps that open a browser first. Choose **Copy Veilway link** and send it over a channel you trust. Anyone with the link can enroll a device, so treat it like a password.

The user opens the link in the Veilway app, and the app connects. To see the link again, choose **Show link and QR** on the user's page. The panel asks for your password, and your code when two-step sign-in is on.

## When it does not connect

- **The app cannot fetch the subscription.** The web server must send `/sub/` to the panel. `sudo bash veilway.sh status` shows the admin pages address and the subscription path to forward.
- **The app fetches, but the tunnel does not come up.** Check that the inbound's port is open in the firewall (UDP for `udp-obfs`) and that **Node address** reaches this server.
- **The app has no profile to connect with.** Publish the profiles again after every inbound change.

## On an older panel

Before v0.2.8:

- **Private key** has no **Generate** button. Run `veilway genkey` on the server and paste the value of `private_key`.
- **Node address** must be the server's IP address. With a domain, apps say "The provider's subscription is not one this app can read". Set the IP address, save, publish the profiles again, and add the link in the app again.

Before v0.2.7, also:

- In step 2, pick `main` under **Default endpoint**, below the list of endpoints, before you save. Otherwise the save fails with `default_endpoint "" is not one of the endpoints`.
- In step 4, paste the value of `public_key` that `veilway genkey` printed into **Inbound public key**, choose **Save changes**, then publish.

To update the panel, run `sudo bash veilway.sh update`.
