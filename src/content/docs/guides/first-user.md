---
title: First inbound and user
description: From the panel's first sign-in to a subscription link a device connects with, step by step. The settings, one inbound, its profile and one user.
---

This guide starts after `sudo bash veilway.sh install both` and ends with a link you can send to a user. It takes about 10 minutes. Each step names the page and the fields as the panel shows them. The [panel manual](../../manuals/panel/) explains every field and option.

The examples use `vpn.example.com`. Put your own domain wherever it appears.

## Before you start

- A domain name that points at the server, with a web server in front of the panel. The install script can set one up, see [Put a web server in front](../../getting-started/#put-a-web-server-in-front).
- The admin pages address and the setup token that the install printed. To read the token again, run `sudo journalctl -u veilway-panel -o cat | grep 'Setup token' | tail -n 1`.
- Panel v0.2.7 or later. An older panel needs two more steps, see [On a panel older than v0.2.7](#on-a-panel-older-than-v027).

## 1. Make the admin account

1. Open the admin pages, `https://vpn.example.com/<prefix>/`. The page is **Set up this panel**.
2. Paste the token into **Setup token**. Choose a **Username**, and a **Password** of 12 characters or more. Enter it again under **Password again**.
3. Tick **I have read and accept these terms**, then choose **Make admin account**.
4. The next page shows a key and a QR code for your authenticator app, once. Add it to the app, then choose **I added it, go to login**.
5. Log in with your username, your password and the 6-digit code from the app. If two-step sign-in is off, the panel does not ask for the code, but keep the key for when you turn it on.

## 2. Settings

Open **Settings**.

1. Under **Provider**, set **Node address** to the server's public IP address, such as `203.0.113.10`. Devices connect to it and the profiles are made with it. Use the IP address, not the domain: apps refuse a profile that names a host, and show "The provider's subscription is not one this app can read".
2. Under **Endpoints**, choose **Add endpoint**. Set **Name** to `main` and **Address** to `https://vpn.example.com/sub/main`. This is where apps fetch the user's subscription: the web server sends `/sub/` to the panel, and the name is the last part of the path. The first endpoint becomes the **Default endpoint** by itself.
3. Under **New users**, leave **Device address pool** at `10.66.0.0/16`. Each device gets one address from it. Change it only if your users' own networks use the same range.
4. Choose **Save changes** in the bar at the bottom.

## 3. Make the inbound's key

On the server, run:

```
veilway genkey
```

It prints two lines, `private_key` and `public_key`. Copy the value of `private_key` for the next step. It is the inbound's secret: do not send it to anyone or put it in a profile. The panel makes the public half from it by itself.

## 4. Add the inbound

Open **Inbounds** and choose **Add inbound**.

1. **Tag**: `main`. Rules and links name the inbound by its tag.
2. **Type**: leave it at **Veilway**.
3. **Private key**: paste the value from step 3.
4. **Gateway addresses**: `10.66.0.1/16`, the first address of the device address pool with the pool's prefix. The panel never gives this address to a device.
5. **Transport 1** and **Listens on**: how devices reach the node. `udp-obfs` needs only a port, for example `0.0.0.0:8443`. `tls`, `ws` and `fronted` need more settings in the JSON view, see [Inbounds](../../manuals/panel/#inbounds). Pick a port nothing else on the server uses. A web server with HTTP/3 already uses UDP port 443.
6. Choose **Review changes**. The review lists what the node will add. Choose **Apply to the node**.

Open the port in the server's firewall, for example with `sudo ufw allow 8443/udp`.

## 5. Publish the profile

Open **Profiles**. The inbound's profile shows **Ready**. Choose **Publish profiles**. Apps get the profile at their next refresh.

If the profile is not ready, the page lists what it still needs. Most often it is the **Node address** from step 2.

## 6. Add a user and send the link

1. Open **Users** and choose **Add user**.
2. Enter a **Name**, for example `ana`. The other fields are optional: quota, expiry date, device limit, groups and a note.
3. Choose **Add user** at the bottom of the form.

The user's page opens with **New subscription link**: a QR code, the **Veilway link** and a web link for apps that open a browser first. Choose **Copy Veilway link** and send it over a channel you trust. Anyone who has the link can enroll a device, so treat it like a password.

The user opens the link in the Veilway app, and the app connects. You can show the link again later on the user's page with **Show link and QR**, after you confirm your password, and your code when two-step sign-in is on.

## When it does not connect

- **The app cannot fetch the subscription.** The web server must send `/sub/` to the panel. `sudo bash veilway.sh status` shows the admin pages address and the subscription path the web server has to forward.
- **The app says "The provider's subscription is not one this app can read".** **Node address** is a host name. Set it to the server's IP address, save, publish the profiles again, and add the link in the app again.
- **The app fetches, but the tunnel does not come up.** Check that the inbound's port is open in the firewall, for UDP when the transport is `udp-obfs`, and that **Node address** reaches this server.
- **The app has no profile to connect with.** Publish the profiles again after any change to an inbound.

## On a panel older than v0.2.7

Two steps were done by hand before v0.2.7:

- In step 2, pick `main` under **Default endpoint**, below the list of endpoints, before you save. Without it the save fails with `default_endpoint "" is not one of the endpoints`.
- In step 5, paste the value of `public_key` from step 3 into **Inbound public key**, choose **Save changes**, then publish.

To update the panel, run `sudo bash veilway.sh update`.
