---
title: Panel manual
description: Run a Veilway node from the web panel.
---

:::note[Part of the alpha]
The panel ships in the alpha, `v0.3.2-alpha`, from the [panel release page](https://github.com/veilway-project/veilway-panel/releases). Its alpha gate installs a node and the panel with the install script in Docker containers, drives the panel, and connects a client through the node. [The alpha release](../../alpha/) lists the limits.
:::

The panel is the admin side of a node. It runs on the node's host and changes users and settings through the node's control socket. Use it in a browser, or call its [admin API](#the-admin-api).

## Before you start

Install the node and the panel with the [install guide](../../getting-started/). The panel listens on `127.0.0.1` only, so serve it with a TLS web server on the same host.

## The panel's config

The panel reads `panel.json` at start. After editing, run `sudo bash veilway.sh restart panel`. Unknown fields stop the panel from starting.

| Field | Default | What it does |
|---|---|---|
| `listen` | `127.0.0.1:8480` | Listen address. Must be loopback, because the panel has no TLS. |
| `prefix` | `/panel` | The admin path. Random at install. No trailing slash. Letters, digits, `-`, `_`, `.` and `/` only. |
| `sub_path` | `/sub` | The path your web server forwards subscription requests to. An endpoint is at this path, a slash and its name, such as `/sub/main`. Must differ from `prefix`, and neither may sit inside the other. |
| `database` | `panel.db` | The SQLite database. It holds no keys. |
| `keys` | `panel.keys` | Keys for sealed secrets. Mode `600`. Kept apart from the database. |
| `signing` | `signing.keys` | Subscription signing keys. Mode `600`. |
| `gateway` | `gateway.keys` | Gateway keys that open subscription requests. Mode `600`. See [Gateway keys](#gateway-keys). |
| `gateway_next` | `gateway.next` | Where the panel writes the next gateway key's private half, once. Mode `600`. Move the file off the server. |
| `node_socket` | `/run/veilway/control.sock` | The node's control socket. |
| `allowed_hosts` | `[]` | Host names the admin pages answer to. Empty accepts any host, which is safe only behind a web server that checks the host. |
| `trusted_proxies` | `[]` | Addresses whose `X-Forwarded-For` the panel trusts. Put your web server's address here. Required unless `direct` is `true`. |
| `not_found` | a plain 404 page | Status, headers and body for every path the panel does not serve. Copy your web server's 404 into it. |
| `trusted_mirrors` | `[]` | Up to 8 relay mirrors, each `{"name": "...", "secret": "..."}`. The secret is 32 to 64 random bytes in unpadded base64url. See [Relay mirrors](#relay-mirrors). |
| `secure_cookies` | `true` | Marks the session cookie secure. Turn it off only for tests, or plain HTTP on localhost. |
| `direct` | `false` | Set `true` only when no proxy is in front of the panel. |
| `update_check` | `true` | Asks GitHub every 6 hours whether a newer panel release exists. Nothing else about the panel is sent. See [Updating the panel](#updating-the-panel). |
| `update_request` | `/var/lib/veilway-panel-update/request` | Where the panel writes an update request. The install script makes the folder. |
| `two_step` | `"on"` | `"off"` turns the authenticator code off. Any other value keeps it on. See [Two-step sign-in off](#two-step-sign-in-off). |

The panel refuses to start if `listen` is not loopback, if `prefix` and `sub_path` break the rules above, or if `trusted_proxies` is empty and `direct` is not `true`.

### Moving the admin pages

Run `sudo bash veilway.sh panel-prefix /new-path`. Without a path, the script picks a random one. It asks you to confirm, changes `prefix` in `panel.json`, restarts the panel and prints the lines your web server needs. If the panel does not start, it restores the old path. The new path follows the rules of `prefix` and must not be, sit inside or hold `sub_path`. Update your bookmarks and web server config.

### Two-step sign-in off

Use this only for tutorials and demos. With it off, anyone who learns an admin's password gets into the panel, your node and every user's links. Never use it on a panel that holds real users.

Add this line to `panel.json`, then run `sudo bash veilway.sh restart panel`:

```json
"two_step": "off"
```

Installs from 2026-10-19 on have `"two_step": "on"` in the file. These two commands change it to `off` and restart the panel:

```
sudo sed -i 's/"two_step": "on"/"two_step": "off"/' /etc/veilway/panel.json
sudo bash veilway.sh restart panel
```

Older installs have no such line (a file without it has the code on). There the first command adds it at the top of the file instead:

```
sudo sed -i '0,/^{$/s//{\n\t"two_step": "off",/' /etc/veilway/panel.json
```

`curl -s http://127.0.0.1:8480/<prefix>/api/status` on the server then shows `"two_step":false`. Before the first setup, the restart also makes a new setup token and the one the install printed stops working. Read the new one with `sudo journalctl -u veilway-panel -o cat | grep 'Setup token' | tail -n 1`.

In this mode, sign-in, first setup, adding an admin and re-authentication ask for the password only. Every admin still gets an authenticator key, shown once, so it is ready when the code comes back. Passwords of 12 characters or more, sessions, CSRF checks, API tokens and the audit log stay. Sign-in is stricter: a source gets 5 tries in 15 minutes, and an account waiting after wrong tries refuses even the right password until the wait ends. Someone who keeps guessing can keep the admin waiting up to 15 minutes at a time.

Only `panel.json` sets the switch. No page or API route can change it, so whoever can write that file already owns the panel. While it is off, every page shows a red banner, the login page says so, and the panel logs a warning at every start. The audit log records `panel.two_step` with `off`, or with `on` and the counts below, whenever the value differs from the last start.

To turn it on again, for example after a demo:

1. While it is still off, sign in, open **Account**, then **Password and code**, choose **Change authenticator code** and add the key to your authenticator app. Every admin made while the switch was off needs to do this first: at the start that turns it on, they get a new key that nobody has seen, and cannot sign in.
2. On the server, run:

   ```
   sudo sed -i 's/"two_step": "off"/"two_step": "on"/' /etc/veilway/panel.json
   sudo bash veilway.sh restart panel
   ```

   On an older install whose file has no such line, remove the line you added instead.
3. Sign in with your password and the 6-digit code.

The start that turns it on ends every session and revokes every API token made while the switch was off. The audit entry counts both, for example `on, 2 sessions ended, 1 tokens revoked`. An admin made while the switch was off gets a new key at that start, which nobody has seen, so they cannot sign in while the code is on. An admin who skipped step 1 can be reset by another admin under **Admins**, or follow the last case of the next section.

### Lost the authenticator

The panel never shows an authenticator key again, but you can make a new one, shown once.

- Signed in: open **Account**, then **Password and code**, and choose **Change authenticator code**.
- Another admin can sign in: they open **Account**, then **Admins**, and choose **Reset** for your account. You get a new password and a new key.
- You are the only admin and cannot sign in:
  1. `sudo bash veilway.sh admin reset <username>` asks twice for a new password and signs that admin out everywhere. It changes the password only: the old key stays.
  2. Turn two-step sign-in off as above and restart the panel.
  3. Sign in with the new password and make a new key under **Password and code**.
  4. Turn it on again as above. That start ends every session.

## First login

1. Open `https://your-domain/<prefix>/`.
2. On the setup page, enter the one-time setup token, a username, and a password of 12 characters or more. Enter the password again, tick **I have read and accept these terms**, then choose **Make admin account**. The panel logs a new token at every start until the first admin exists, and the install script prints it too. Only the newest works.
3. The next page shows a TOTP key and a QR code, once. Add it to your authenticator app, then choose **I added it, go to login**. Without the key you cannot log in.
4. Log in with your username, password and the 6-digit code from the app. Login is rate limited: after several wrong tries, wait a few minutes.
5. Before you add users, go to **Settings**. Set the node address under **Provider**, add an endpoint under **Endpoints**, and set the device address pool under **New users**. A setup done at a domain name (from v0.3.2) has already set the node address to that name and added the endpoint `main` at `https://<domain><sub_path>/main`, as the default. One done at an IP address leaves both to you, since that endpoint needs a pin. Then add an inbound on **Inbounds** and publish its profile on **Profiles**. The guide [First inbound and user](../../guides/first-user/) walks through these steps.

To set up by script, send the token, a username and a password to `{prefix}/api/setup`. The answer holds the TOTP secret, shown once.

Some changes ask for your password and code again. The confirmation holds five minutes.

Setup needs you to accept the [Veilway operator terms](../../legal/operator-terms/). The audit log records the acceptance, its time and the terms version. A script must send `accepted_terms: true`.

## Dashboard

The **Dashboard** is the first page after sign-in. It shows:

- the speed now and the peak today
- how much the node carried this month
- how many devices wait for their app to confirm
- the users who have used more than 85 percent of their quota
- where traffic leaves, from the node's last report
- the newest entries of the audit log

Figures refresh every 10 seconds. You also edit [Notices](#notices) here.

## Users and devices

The **Users** page lists every user. Search by name, group or note, and filter by enabled or disabled. Select users to change them in bulk: enable, disable, reset usage, reset links, delete, add or remove a group, set the quota, expiry or device limit, or set the exits to all exits or a chosen set. A default exit that the new set leaves out is cleared.

**Reset links** makes a new link and new Xray credentials for each selected user. The old links stop working at once. Tick **Also remove the devices enrolled with the old links** to remove those devices too. Without the tick they keep working until you remove them. The dialog does not show the new links. Open the user's page and choose **Show link and QR**. With **Show links once** on, the panel keeps no copy, so reset that user's link on their page instead, which is the only time the link is shown.

### Add a user

Fill in the form:

- **Name**: lowercase letters, digits, dot, dash and underscore. Clients show it.
- **Groups**: separate with commas. Routing rules and DNS sets can name a group.
- **Quota** and **Count starts over**: leave the quota empty for no limit. Pick never, every day, every week or every month for the reset. The reset needs a quota.
- **Expires on**: leave empty for no expiry.
- **Device limit**: `0` means the node's own limit of 16.
- **Note**: only admins see it.
- **Enabled**: a disabled user cannot connect. Their devices stay.
- **Exits**: **All exits**, or **Only these** with the exits you tick. The user's app lists only these exits, though routing rules can still send their traffic to a specific exit. **Default exit** is where their devices leave when they pick none, among those exits. **Node default** leaves it to the node's routing default.

Saving shows the subscription link to copy.

### The user page

- **Usage** shows what counts toward the quota, since when, and the total sent and received. **Reset usage** starts the quota count over, and a user cut off for going over the quota can connect again. You can also set the total back to zero.
- **Subscription link** holds the link and its QR code. Anyone with the link can enroll a device, so send it like a password. The panel keeps it sealed with the keys in `panel.keys`. **Show link and QR** opens it again after you confirm your password and code. With **Show links once** on (see [Subscription settings](#subscription-settings)) the link can be shown only when it is made or reset. The dialog gives the Veilway link, and a web link for apps that open a browser first. **Reset link** makes a new link, stops the old one at once and makes the user's Xray credentials new. You choose whether devices enrolled with the old link are removed too.
- **Download sealed file** makes a `.vwsealed` file that holds the link, locked with a password you choose (at least 10 characters). The app asks for the password when it opens the file, then goes on as with any link. The panel keeps no copy of the password and asks for your password and code again. The audit log records that a file was made, not the password or the link. Send the password by another route than the file: anyone who has both gets the link, and the link is the account. No API token can do this. The format is in the [subscription format](../../protocol/subscription-format/).
- **Proxy login** gives the account a name and password for the node's SOCKS5 and HTTP inbounds. See [Proxy inbounds](#proxy-inbounds-socks5-and-http).
- **Xray links** shows the user's link for each Xray inbound, as text and a QR code. A user gets links once they have a device and an Xray inbound exists. It asks for your password and code again. **New Xray credentials** makes new ones and the old links stop working. See [Xray inbounds](#xray-inbounds).
- **Devices** lists each device, whether it is waiting for the app to confirm or enrolled, and when it was last seen. A device makes its own key (which never leaves it) or uses one the panel made. **Remove device** stops it from connecting at once. An app of v0.2.11 or later removes its own device when its user removes the subscription, and the audit log says so.
- **Add a device with a panel key** lets the panel make the private key and export it as a signed file. This is weaker than enrolling from the device. Use it only for a device that cannot open the link.
- **WireGuard config for** a device whose key the panel made gives a file for a stock WireGuard app, as text to copy, a download and a QR code. The button is off for a device that made its own key, since the panel has no private key for it. The panel makes one file for each plain WireGuard inbound that has a `udp` transport and in whose range the device has an address, naming the inbound above each when there are several. The file uses the device's address in that inbound, sends all traffic through the tunnel, uses the inbound's gateway as DNS and sets the inbound's MTU when the config has one. The node address in it is the one apps would use, from **Node address** or the profile's **Addresses**. If no inbound qualifies, the panel says what to check. The file holds the private key, so the panel asks for your password and code again, the audit log records only that a file was made, and no API token can do this. Move it to the device over a channel you trust and delete your copy. The dialog warns that a censor can easily recognize plain WireGuard, so use it where that does not matter, and a Veilway profile where it does. A device using the file has no control channel and gets no notices, exits list or load.
- **Exits** sets which exits the user's app lists, with each exit's country and whether it is up. If the node deletes an exit the user was limited to, it shows as **Removed from the node**, and **Save exits** drops it from the list. The next time the panel updates the node, it clears a default exit that the node no longer has or that the user may no longer use.
- **Delete user** stops the user's devices and links at once. This cannot be undone.

The **Users** list shows each user's exits as **All exits** or a count.

## Subscription settings

**Settings** is one page. It sets what every user's link points to and how documents are signed. A list at the top jumps to each section: **Provider**, **Endpoints**, **Refresh**, **New users**, **Mirrors**, **Static mirrors**, **Relays**, **Answer to strangers**, **Published profiles**, **Gateway keys** and **Signing keys**. Change the form and save from the bar that appears. Gateway keys and signing keys act on their own.

### Provider, refresh and new users

- **Provider name** is shown next to the subscription in apps.
- **Node address** is the public IP address or host name devices reach this node on. Profiles are made with it. Apps connect to the IP address the signed profile names and never look a name up themselves, so no lookup shows on the user's network and a forged DNS answer cannot redirect them. The panel looks a host name up each time it makes a user's subscription, at most every five minutes, and puts the IP addresses into the profiles. If a lookup fails, the last addresses are used for up to a week. Apps follow a change at their next refresh. Before v0.2.8 it had to be an IP address. An inbound can have addresses of its own, see [Profiles](#profiles).
- **Endpoints** are set under **Endpoints**, see [Endpoints and moves](#endpoints-and-moves).
- **Apps check for changes every** sets the refresh interval, in minutes.
- **Documents stay valid for** sets how many days a signed document can be used.
- **Remove devices that have not refreshed for** removes confirmed devices whose app has not asked for its document in that many days, which frees the places of uninstalled apps and lost phones. 0, the default, keeps them. It must be at least three refresh intervals. Devices whose key the panel made are never removed this way. The audit log records the removals.
- **New devices per link** and **In any window of** slow down a link that leaked. One link can add at most the first number of new devices (1 to 64, 3 by default) in any sliding window as long as the second (1 to 1440 minutes, 60 by default). A refused try is not counted, and a cancelled import gives its place back. The device limit applies either way. These replace **Wait between new devices of one account**, and the old value carries over: 1 minute, the old default, becomes the new defaults, any other wait becomes 1 device in a window of that many minutes, and no wait (0) becomes 64 devices in 1 minute. A large number with a short window comes close to no limit.
- **Rotate transport keys every** sets how many days, from 7 to 30 (30 by default), before the panel makes a new transport key. See [Transport keys](#transport-keys).
- **Show links once** means the panel keeps no copy of a link. A link is shown when it is made or reset, and never again. Off is the default.
- **Device limit for new users** and **Device address pool** set the defaults for new users. The pool is an IPv4 network from `/16` to `/30`, and each device gets one address from it. The panel also gives a device an address in every other Veilway inbound and every plain WireGuard inbound (plain inbounds from v0.2.18), at the same offset in that inbound's range as in the pool. If an inbound range overlaps the pool without holding the device's address, or the offset is past the end of a range or on its gateway, the device gets no address there and its subscription leaves that inbound's profile out.
- **Answer to strangers** is the answer to a request without a valid token. It is the 404 your web server gives on an unknown path, so a stranger cannot tell the panel is there. Turn on **Set the answer here** to set the status, headers and body in the panel. Off uses `not_found` from `panel.json`.

**Terms of service URL** and **Privacy policy URL** are your own pages as the provider. Enter an `https` address for each, or leave it empty. Every subscription then shows them as support links. Starting texts are on the [provider templates](../../legal/provider-templates/) page.

### Transport keys

Each `veilway` inbound has a transport key that its `tls`, `ws` and `fronted` transports use. Each `ws-plain` transport has a key of its own. The panel rotates these keys by itself once **Rotate transport keys every** has passed (7 to 30 days, 30 by default). A `ws-plain` key rotates at most every 7 days whatever the setting is, since its proofs travel in clear on the path. It checks hourly.

A rotation makes a fresh key and sets the node's keys to the fresh key first and the current one second. The previous key keeps working for one more full period, so an app that refreshed within that time still connects. The next rotation drops it and the panel destroys it. Published profiles get the new public key without you publishing anything. The panel never holds a private key: it sends the new one to the node and keeps only the public half.

If the node does not confirm a rotation, the panel starts no other one for that key and shows a warning. After 2 days it gives up and resets, and the next pass may try again. The audit log records key rotations.

### Signing keys

Every document is signed. To change keys without cutting users off:

1. Choose **Add a new key**. Both keys sign from then on.
2. Wait until every app has fetched a document that lists both keys. This takes at least one update interval.
3. Choose **Retire the older key**.

A retired key is kept for 365 days so it can sign refusals. An app that never fetched the new key refuses the next document and needs its link again, so do not retire the old key too early.

### Mirrors

A mirror is another address for the same subscription. Apps try the mirrors when the endpoint is blocked. You can add up to four. A mirror with no certificate from an authority needs its own pins, one per line.

### Relay mirrors

A mirror in the list above is only another address for the same panel. A relay mirror is a small program on another server and domain. It serves the subscription path and forwards each request to your panel over HTTPS, so apps can refresh through it while your main endpoint is blocked. Every request is sealed to your panel's gateway key and every answer to its own request, so the mirror reads no token, device secret or document and cannot change or replay anything in a way that is accepted. It still sees each visitor's address and refresh times, so run it on servers you trust with that.

1. On the other server, run `sudo bash veilway.sh install mirror`. It installs the node's binary, a `veilway-mirror` service that runs as its own user with no capabilities, and a config at `/etc/veilway-mirror/mirror.json` with a new secret. See [the mirror's config](../../reference/config/#veilway-mirror).
2. In that file, set `upstream` to your panel's URL for the endpoint the mirror stands for. It ends in the panel's `sub_path`, a slash and that endpoint's name, such as `https://panel.example.org/sub/main`. Set `path` to the path your web server gives the mirror. Check it with `veilway mirror --check --config /etc/veilway-mirror/mirror.json`, then start it with `sudo bash veilway.sh restart mirror`.
3. In `panel.json`, add the mirror and its secret to `trusted_mirrors`, then restart the panel:

```json
"trusted_mirrors": [{"name": "mirror-1", "secret": "<the secret from mirror.json>"}]
```

4. Put your web server in front of the mirror, which listens on `127.0.0.1:8490` and speaks plain HTTP. The mirror takes only a `POST` of exactly 1,073 bytes of `application/octet-stream` to its path, a request sealed to your panel that the mirror cannot open. For anything else it answers with status 599. The web server must turn that into the answer it gives on any path it does not serve. In nginx:

```
location = /sub {
    proxy_pass http://127.0.0.1:8490;
    proxy_http_version 1.1;
    proxy_intercept_errors on;
    error_page 599 = @unknown;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

   `@unknown` is a location of yours that answers like the rest of the site, for example `return 404;`.
5. Add the mirror's public URL under **Mirrors** above, with its pins if its certificate is not from a certificate authority. Apps learn it from the signed document at their next import or refresh.

The mirror tells the panel each visitor's real address in an `X-Veilway-Mirror` header signed with the shared secret, so the panel's limits per source count the visitor, not the mirror. The panel accepts the header only from a mirror in `trusted_mirrors`, only for 60 seconds, and only once. A request whose header fails any of that is answered like an unknown path. The mirror keeps nothing after a request and reaches the panel over HTTPS only. To a request with a valid header that it will not serve, the panel answers with status 599. If the panel cannot be reached, or answers with anything but a sealed answer (a `200` with `Content-Type: application/octet-stream` and a body of 9,413, 36,979, 140,867, 538,201 or 1,089,437 bytes), the mirror hands the request back like any other it will not take.

### Static mirrors

A static mirror is a place that only serves files: a storage bucket, the raw file service of a code host, a content delivery network or your own web server. The panel writes one sealed file for each device there. Apps try it last, after the endpoint and every relay mirror have failed. They fetch their file with a plain `GET` and check it as strictly as an answer from the endpoint. The host runs nothing of yours, gets no token and cannot read a file.

1. In **Settings**, under **Static mirrors**, add the base URL where you will serve the folder, then save. It is `https`, has a host name and not an address, ends with `/`, has no pins, and cannot share a host and port with the endpoint or a relay mirror. Examples: `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<folder>/` for a repository on a code host, `https://s3.<region>.amazonaws.com/<bucket>/<folder>/` for a bucket addressed by path.
2. Within a few minutes the panel writes the first round. The section then shows one folder for each address, with the number of files, their size and the time of the round. A device is in the folder once it has made one successful request to the endpoint or a relay mirror after you saved. So an app picks the new address up at its next refresh, and the mirror helps it from the round after that.
3. Copy the folder to the host after every round. The section shows ready commands to paste, with your folder's path in them. The folder `current` is a link the panel switches in one step when a round is complete, so a copy never takes half of one. Use a tool that also deletes what the folder no longer holds, since old names must go:

```
# a server of your own
rsync -rt --delete '/var/lib/veilway-panel/static/<folder>/current/' 'user@host:/var/www/mirror/<folder>/'

# a bucket (rclone sync deletes what the folder no longer holds)
rclone sync '/var/lib/veilway-panel/static/<folder>/current/' 'remote:<bucket>/<folder>/'

# a repository on a code host
rsync -rt --delete '/var/lib/veilway-panel/static/<folder>/current/' '<clone>/<folder>/' && git -C '<clone>' add -A && git -C '<clone>' commit -m publish && git -C '<clone>' push
```

   Run it from a timer a little more often than the panel's **Publish every** setting (1 to 12 hours, 6 by default). **Download as zip** (it asks for your password and code again) gives the current round as a file, for a host you can only upload to by hand.
4. If you can, set the host to send `Cache-Control: max-age=600` or less. A cache that holds a file longer only makes an app's copy older, and the app's serial check refuses an older document and goes on to the next place.

**Choosing a host.** A censor sees only the host name in the TLS handshake. A name that only you use (your own domain, `name.github.io`, a bucket with its own host name) can be blocked without blocking anyone else. Blocking costs the censor something only for a host name that many unrelated sites share, with your folder in the path where TLS hides it. The panel warns about every address whose host is not on its list of shared names (the raw file service of the big code hosts, path-style storage endpoints, `jsdelivr`). The warning reads "Only you use this host name. A censor that learns it can block it without blocking anything else." Do not use the endpoint's host name.

**What every round does.** It writes a new, complete directory, then switches `current` to it. It rewrites every file with a fresh salt, changed or not, so the host sees every file change every round and learns nothing about which documents changed. A file belongs to one week, and its name changes at the week's end. A week's files exist from a day before it starts to a day after it ends, so an app whose clock is off by less than a day still finds its file. For the same reason the panel needs a synchronized clock, and a banner on every page says so while the system reports it as not synchronized. The folder also holds decoy files of random bytes, 32 to 64 or more for a large folder, which come and go. Every file in a folder, decoys included, has the same size. The size grows at once when a document needs it and shrinks only after eight rounds in a row in which the smaller size would have held. The panel never shows which files are real.

**What the host learns.** It sees the file names (they change every week and differ on every address), one size for all of them, how many there are, when each round is written, and the address and time of each fetch. It cannot read a file or tell which account a file belongs to. It may keep every version of every file, as a code host keeps every commit, and anyone can list a public host. A later leak of one device's storage opens that device's old files, which is why the files carry no usage numbers. A file that is missing, old or changed is only a failure of that mirror for the app, never a sign the account is off. Only a signed refusal says that.

A file exists only for a device that has confirmed. A reset of a link, a removed device or a deleted user takes the files away in the next round, not at once. A user who is switched off or expired gets a signed refusal in the file instead of a document.

### Relays

A relay is a plain forwarder on another address that passes bytes to this node unchanged, such as nginx `stream`, an iptables DNAT rule, HAProxy, realm or gost, or for `fronted` a content delivery network. TLS, the proofs and WireGuard run from the app to the node, so the relay reads nothing and cannot pass for the node: the app still checks the node's certificate, pins and keys. Use one when users' networks block or slow down the node's own address and a small server on another address gets through. To send users on to a second node with the exit there, see the [entry node guide](../../guides/entry-node/).

A TCP-only tunnel between servers, such as a `wss` tunnel tool, can carry `tls` and `ws` but never `udp` or `udp-obfs`. For `ws` behind a web server, point the tunnel at the web server's HTTPS port.

Add relays under **Relays** in the settings. Enter:

- a name
- the relay's IP address or host name (a host name, such as a content delivery network's, is looked up like the node address)
- the transports and inbounds it carries
- a port for each transport where the relay listens on another port than the node

Each enabled relay adds its address to those transports in every profile, after the node's own address, or before it with **Try before this node's address**. Apps start with the first two addresses of a transport and remember the one that works on each network. You can add up to 15 relays, so every transport stays within the 16 addresses a profile may list. The preview under the list shows what each profile will carry. Save, then publish again on **Profiles**. Apps pick it up at their next refresh.

**Ports per inbound.** If a relay carries two or more inbounds with the same transport type (two with `tls`, say), it shows one port field for each inbound and type, so it can listen on a different port for each. The per-type port stays as the fallback, and with no port at all the relay uses the node's own port. A relay that carries one inbound of a type has the one field for that type.

**Who gets this relay** on each relay limits it to chosen groups and accounts, so a leaked relay address exposes only the accounts it was for. A relay with neither reaches everyone. An account gets its own relays, those of its groups and those for everyone, and its page lists them. When a transport would list more than 16 addresses, the cap keeps the account's own relays first, then its group's, then everyone's. The preview names what it leaves out. Deleting an account removes it from every audience.

What goes through what:

- `udp` and `udp-obfs` need a UDP forward. A content delivery network carries no UDP.
- `tls` and `ws` go through any TCP forward. A forwarder that ends TLS itself fails, because the app checks the node's certificate.
- `fronted` goes through a content delivery network. Enter the address of its edge. The app keeps the front name it already checks.
- A relay that carries `udp` or `udp-obfs` and a TLS transport on one address makes apps rate that TLS transport Detectable. Give them two relays to keep the rating.

The node sees every user who comes through a relay at the relay's address, so its limits per source count them together. Raise `replay.per_source` (see [the config reference](../../reference/config/)) for a busy relay.

In the examples, the node is at `192.0.2.10` and the relay listens on the node's own ports. nginx `stream` for `tls` on TCP port 443:

```
stream {
    server {
        listen 443;
        proxy_pass 192.0.2.10:443;
    }
}
```

nginx `stream` for `udp-obfs` on UDP port 51821. The long timeout keeps a quiet session's mapping:

```
stream {
    server {
        listen 51821 udp;
        proxy_pass 192.0.2.10:51821;
        proxy_timeout 10m;
    }
}
```

iptables DNAT forwards in the kernel and suits UDP best. Run it as root on the relay, with forwarding on:

```
sysctl -w net.ipv4.ip_forward=1
iptables -t nat -A PREROUTING -p udp --dport 51821 -j DNAT --to-destination 192.0.2.10:51821
iptables -t nat -A POSTROUTING -p udp -d 192.0.2.10 --dport 51821 -j MASQUERADE
```

Use `-p tcp` in both rules for a TCP transport. These rules are gone after a reboot unless you save them, for example with `iptables-save`.

### Install a relay with the script

On a Debian or Ubuntu server, the installer sets up the forwarding for you. Run it as root on the relay, with the node's IPv4 address and one `--transport` for each transport the relay carries, written as `name:port`:

```
sudo bash veilway.sh install relay 192.0.2.10 --transport tls:443 --transport udp:51820
```

The transports are `tls` and `ws` (TCP), and `udp` and `udp-obfs` (UDP). The port is the one the relay listens on, and the node uses the same port. For another node port, add it after a second colon: `--transport tls:443:8443` listens on 443 and forwards to the node's 8443. Without `--transport`, the script asks which transports to use.

The limits apply to each source address. `--rate 50` allows 50 new connections a second, and `--conns 256` allows 256 TCP connections at once. Both are optional.

The script installs nftables, turns on IP forwarding, enables the nftables service, and writes one table of its own, `veilway_relay`, to `/etc/nftables.d/veilway-relay.nft`. It adds one line to `/etc/nftables.conf` so the service loads the table at boot, and touches no other table. It refuses a node address that is loopback, multicast or reserved, private with no route on this server, or this server's own, and a port something on this server already listens on. At the end it prints a box with what to enter in the panel. Add `--dry-run` to see every step without changing anything.

To remove the relay, run `sudo bash veilway.sh uninstall relay`. It deletes the table and its files and undoes what the install added: the nftables package if the install installed it, the service if the install enabled it, and IP forwarding back to its old value. Stopping `nftables.service` clears every nftables table, this one included, so stop it only on purpose.

### Published profiles

**Published profiles** holds what the subscription serves, as a form or as a JSON list of up to 64 objects. **Publish profiles** on the **Profiles** page writes it for you. A profile here cannot name a device, because the panel adds each user's device to it.

## Gateway keys

Every subscription request is sealed to a gateway key, so the network and the servers in the middle cannot read it. The panel makes two keys at its first start, the active and the next. The rules are in the [subscription format](../../protocol/subscription-format/).

Links carry the active key. Every signed document lists the active key, then the next, so apps hold the next key long before you need it.

### Where the keys live

- `gateway.keys` holds the active key and the retired keys (private halves), plus the next key's public half and its id.
- `gateway.next` holds the next key's private half. The panel writes it once, for you to move off the server and keep offline. While the panel still finds that file on the host, it warns on the **Gateway keys** page and in the log, because a next key left on the server is taken together with the active one.

Both files have mode `600` and sit outside the database. Their paths are the `gateway` and `gateway_next` config fields. The panel's backup holds `gateway.keys` and never the next key's private half, so back `gateway.next` up apart from the server.

To move the next key off a server set up by the install script, copy it to your own computer and keep that copy offline (a USB stick or a password manager). Then delete it on the server, which clears the warning:

```sh
scp root@your-server:/var/lib/veilway-panel/gateway.next .
ssh root@your-server rm /var/lib/veilway-panel/gateway.next
```

### The page

**Settings** > **Gateway keys** shows:

- The active key: its id and fingerprint.
- The next key: its id, and whether its file is still on the host.
- The retired keys: when each one is destroyed, and how many accounts sent a request under it in the last 30 days.
- How many accounts have no device yet.
- Failure counters: size, key, open, request, window, replay, source and full.
- A clock warning, when the system reports its clock as not synchronized.

### Switch keys on a schedule

1. Choose **Load next key**.
2. Paste the next key's private half, or leave the field empty to read `gateway.next`.
3. The panel makes that key active and makes a new next key. It writes the new next key's private half to `gateway.next` and shows it once. Move it off the server.

The old key stays as a retired key for the number of days in **Keep a retired key**, from 30 to 365, 120 by default, then is destroyed. Old links keep working while it is kept. After that, a first import from an old link fails, and the link must be shown again.

The page adds a notice when the active key is older than 180 days. Switch then.

### A stolen key

Choose **Key stolen** and load the next key as above. The panel destroys every key it holds at once, the retired ones too, since whoever took the file took them all. Apps fall back to the next key.

If the thief could have recordings of requests (a request passed a content delivery network, a proxy that ends TLS, a relay mirror or a plain http path), every recorded request opens, and the switch cannot undo that.

The panel lists the accounts that sent a request under any of the destroyed keys. Its one action is **Reset tokens of affected accounts**. It shows the count first, as a dry run, then gives new links. Use the switch alone only for a theft that you know came with no recordings.

### A lost key

If the panel has accounts but no readable active key, the endpoint answers every request as an unknown path. The page and every page banner say so, and the log says so every hour at error level. The panel never makes keys by itself.

- With the next key in hand, load it. Apps follow by their fallback.
- If you kept the private half of the key that was active, choose **Load a key I kept**, paste it and give the number the panel showed for it. It becomes the active key, a new next key is made, and the links that hold it work again. The panel asks you to confirm and writes the action to the audit log. This works only while no key file is on the server, so repair or move aside a file that cannot be used first. The panel never writes new keys over it.
- Without a key, choose **Make new gateway keys**. Old links stop working for first imports. Apps learn the new key only from a newer document on a static mirror, or from a link shown again. Tokens and devices stay valid.

### Clock and replays

The panel needs a synchronized clock (NTP). It acts on a request only when the request's time is within 300 seconds of its own clock, judged by the highest clock value seen since start, and logs a warning if the clock steps back. It warns on every page while the system reports its clock as not synchronized.

The memory of seen requests is kept in RAM only and holds at most 200,000. A request that opens is recorded before its token is looked at, so that anyone who knows a gateway key cannot fill it. When it is full, the panel answers new requests as an unknown path until some expire (a request is forgotten after at most ten minutes), counts them as **full** and logs a warning at most once a minute. The endpoint counts its sources in a limiter of its own, and an IPv6 source by its /48, so a flood on the endpoint cannot lock an admin out. After a restart the panel refuses any request time before the start, so a device whose clock runs behind gets nothing for at most 300 seconds.

### Plain http and relay mirrors

A relay mirror forwards the sealed bytes and sees no token. The hop from the mirror to the panel must be `https`. To a request with a valid mirror header, the panel answers anything it would answer as an unknown path with status 599. The mirror passes on only a 200 of one of the five answer sizes.

What each party sees:

| Who | Sees | Does not see |
|---|---|---|
| The network, on a `https` endpoint | The host name, the times, and sizes | The path, the request, the answer |
| The network, on a plain `http` endpoint | The host, path, headers, key id, times and exact sizes | The token, the device key, the document |
| A web server or CDN that ends TLS | Addresses, path, key id, sizes, whether the answer was sealed | The token, the device key, the document |
| A relay mirror | The same, and it forwards the sealed bytes | The same |
| The panel | Everything | Nothing |

## Endpoints and moves

An endpoint is a public address that apps use to reach the panel. You can have up to 16.

### Add an endpoint

Go to **Settings** > **Endpoints**. Each endpoint has:

- A **name**: `a-z`, `0-9`, `-` and `_`.
- A **URL**: `https://host/path`, or `http://host/path` for a plain endpoint.
- **Pins** (optional): one or two SHA-256 SPKI pins in standard base64, for `https` only. They are required when the host is an IP address, which means a self-signed certificate.

One endpoint is the default. The first you add becomes the default by itself. With more than one, pick it under **Default endpoint**, below the list. Each endpoint needs its own host and port.

Each endpoint has its own path on the panel: `sub_path`, a slash and the endpoint's name. Your web server maps each endpoint's public host and path to that panel path, for example `https://sub.example.org/s` to `http://127.0.0.1:8480/sub/main`. The panel tells endpoints apart by that path alone and never reads the `Host` header, which anyone on the way can write. A request to a path under `sub_path` that no endpoint has is answered as an unknown path. The bare `sub_path` reaches no named endpoint. It answers (a panel with no named endpoint is served there), and its documents list no pins. A document lists the pins of the endpoint the request reached.

The pins of an endpoint can change only in a way that keeps one of the current pins, because an app accepts a new list only when it holds one of them. The panel refuses a change that keeps none. Loading the standby key keeps it. Each entry of the mirrors list is read by the rules apps use: an entry with the host and port of an endpoint has that endpoint's kind of check and, when pinned, one of its pins. The panel refuses at save any setting that apps would refuse in a signed document.

### Plain http

A plain `http` endpoint shows this warning: "The network can tell that you use this app, now and later in its records."

The exchange stays secret, but hiding is lost. Use it where there is no domain or the TLS handshake gets blocked. Its link form is `veilway://sub-plain/`.

### Which endpoint a user gets

The panel picks the first match:

1. The user's own endpoint.
2. The endpoint of the first group of the user that has one.
3. The default endpoint.

Set an endpoint on the user page, in the add-user form and under **Endpoint per group**.

### Move users to another endpoint

Set an endpoint on a user, a group or a selection of users. To move many at once, use **Move to endpoint**. It first shows a dry run: how many users move and how many stay.

After a move, the users' documents carry a signed `main_endpoint`. What happens next:

- The panel keeps answering on the old endpoint, so old links keep working there.
- The first document asks the app to move. The user confirms once in the app.
- Documents at the new endpoint are signed fresh, with a higher serial.

The **Endpoints** section shows how many moved accounts still refresh on the old endpoint. When that is none, you can retire it. You cannot remove an endpoint that users still use.

A link shown again carries the user's current endpoint and the active gateway key.

## Node

Five pages show what the node runs: **Inbounds**, **Exits and routing** (with the tabs **Exits**, **Routing** and **Outbounds**), **DNS and logs**, **Profiles** and **Links**.

Every change goes through a review. **Edit** or **Remove** opens **Review changes**, and nothing reaches the node until you choose **Apply to the node**. The review shows:

- what is added, changed and removed, and which inbounds restart. A restart drops and reconnects every device on that inbound.
- how many users can no longer connect.
- warnings from the node.
- problems the node would refuse. Fix them and review again.

If the config changed since you opened the page, the review says so. Reload the config and make the change again. **Undo my edits** discards the changes you have not applied. Each section also has a JSON view of the whole section.

### Inbounds

An inbound is a tunnel that devices connect to, with the transports it is reached on. **Inbounds** lists the node's own inbounds and the Xray add-on's together. **Show** filters by type.

After you add an inbound or change its transports, ports or addresses, choose **Publish profiles** on **Profiles**. Apps learn about the change only from a published profile, at their next refresh.

- **Veilway** is WireGuard with the control channel. The obfuscated transports need it.
- **Plain WireGuard** is for stock WireGuard apps. Its handshake is easy to spot. A device whose key the panel made can get a WireGuard file for it, see [The user page](#the-user-page).

**Switching an inbound or a transport off.** The **On** column of the list has a switch for each inbound, and the inbound's form has **Inbound is on**. A transport has **Transport is on** in its own part of the form. Off is `enabled: false` in the config. It stays in the config and keeps its address, and the review checks it like any other, but the node does not listen on it. The list shows **Off** next to an inbound that is off. When you apply:

- the sessions on a transport that is off end, and the inbound's other transports keep working.
- the devices of an inbound that is off cannot connect through it, and their open flows end.
- the Xray inbounds are not affected. They have no switch.

Devices learn of the change only at the next publish. An inbound that is off gets no profile, and the profile published before is taken down. A transport that is off is left out of its inbound's profile. After you apply a switch, the page reminds you to publish, with a button to **Profiles**. The profile there says **This inbound is switched off on the node** or **This transport is switched off on the node**, and says to switch it on and publish again.

Each inbound has a private key. **Generate** next to the field makes one in the browser, or run `veilway genkey` on the node and paste the private half. The panel makes the public half for the inbound's profile. The same goes for the transport key of `tls`, `ws` and `fronted` transports: **Generate** makes one, and the panel puts its public half in the profile when the inbound is applied. The form also has gateway addresses, one per line, and an MTU. The default MTU is `1420`, or `1390` with `udp-obfs`.

The transports are:

| Transport | What it is |
|---|---|
| Plain WireGuard over UDP (`udp`) | WireGuard as it is, over UDP |
| UDP in Veilway's own envelope (`udp-obfs`) | UDP with Veilway's own envelope around it |
| TLS the node ends itself (`tls`) | The node ends the TLS connection itself |
| WebSocket behind your web server (`ws`) | A WebSocket that your web server forwards to the node |
| HTTP requests through a CDN (`fronted`) | HTTP requests that a CDN forwards to the node |
| WebSocket over plain HTTP (`ws-plain`) | A WebSocket over plain HTTP that your web server forwards to the node, with no TLS. The weakest transport. |
| A real site's handshake, borrowed (alpha) (`faketls`) | The node holds no certificate and relays everything that is not a user to a real site you name. Alpha. See [Borrowed-site mode](#borrowed-site-mode-alpha). |

**`ws-plain`** is for networks where TLS to your server is blocked or slowed and plain HTTP passes. The form warns when you pick it: the network can see this server's name, and can tell that people use this app, and when and how much, but not what they send. It has a key and a cookie of its own. **Generate** makes the key. The panel puts its public half in the profile and rotates the key every 7 days at most (see [Transport keys](#transport-keys)). The token travels in the cookie named under the inbound's transport key section, so pick a name your own site never sets. Its path may not be the path of a `tls`, `ws` or `fronted` transport of any inbound, and it may not share a listener with a transport that is not `ws-plain`. The panel refuses both. For the host name and port apps use, see [Profiles](#profiles).

The `tls`, `ws` and `fronted` transports need more than the form holds: their certificate, decoy origin, trusted proxies and transport keys. Set those in the JSON view.

**Web server lines.** A `ws`, `fronted` or `fronted-shaped` transport of a Veilway inbound sits behind your web server, which must send the transport's path to the node's listener. Once the path and listen address are valid, the transport shows **Web server lines**: the Caddy block (`handle <path>*` with `reverse_proxy` to the listener, never `handle_path`, and `header_down -Server` so the path's answers carry one `Server` field like every other page) and the nginx `location` block (plain HTTP to the listener, the `Upgrade` and `Connection` headers, `X-Forwarded-For`, and for `fronted` no buffering), each with a copy button. Paste one into the site file the installer wrote, `/etc/caddy/conf.d/veilway-panel.caddy` inside the site block or `/etc/nginx/conf.d/veilway-panel.conf` inside the server block, and reload the web server. The box warns when the listen address is not loopback (the listener should not be reachable from the internet) and when the trusted proxies lack a loopback address, since the web server connects from `127.0.0.1`. The installer also serves its plain site on `127.0.0.1:8080`, the default decoy origin.

### Borrowed-site mode (alpha)

:::danger[Alpha, rated Detectable]
Borrowed-site mode (`faketls`) is new. Only the project has reviewed it, nobody outside has, and it has not run against real sites. The node holds no certificate. It relays every connection that is not one of your users to a real site that you name, from the node's address, and that site has not agreed to it. Do not rely on it. For the steps from nothing to a working connection, see the [Borrowed-site mode guide](../../guides/borrowed-site/). The design is on the [protocol page](../../protocol/borrowed-site/).
:::

It is a transport of a **Veilway** inbound, on the **Inbounds** page. Set a transport's type to **A real site's handshake, borrowed (alpha)**. The form then shows a warning, **Alpha, unreviewed, rated Detectable**, and these fields:

- **Listens on**: the address and port the node takes connections on. It needs an address and port of its own, shared with no other transport, and cannot sit behind a web server, a CDN or `trusted_proxies`. The panel refuses a shared address.
- **Site name**: the real site to borrow, as a lowercase DNS name such as `www.example.com`. Apps send it as the server name, and the node uses it when it connects to the site.
- **Extra names**: up to 4 more names that apps may send. Leave it empty when the site name is enough.
- **Site port**: the site's port. Empty means 443.
- **Site address**: an address and port to connect to instead of looking the name up, such as `192.0.2.10:443`. Empty looks the name up at every start and reload. The panel refuses an address this node listens on, since every stranger's connection would come back to the node.
- **Transport key, private half**: **Pick one** makes a key, or paste one of 44 characters. It must belong to this transport alone and differ from every other transport key of the node. The panel keeps its public half when you apply, and the key is not shown again. When you edit the transport later, the field shows a marker that keeps the current key.
- **I know the site has not agreed to this, and I answer for using its name**: required. The node does not run the transport without it.
- **Strangers sent to the site at once** (256) and **New connections to the site a second** (16): limits that keep the node from loading the site. When the second one is spent, users are still served and only a stranger that needs a connection is closed.

Choose **Review changes**, then **Apply to the node**, and open the listener's TCP port in the server's firewall.

**Choosing a site.** The project suggests none, because a list of sites that work is a list of sites to watch. A good site:

- speaks TLS 1.3 and is reachable from the node's address without a challenge, a block or a rate limit,
- is reachable from your users' networks and is not blocked there,
- is popular and stable, so visits from an odd address are not remarkable and its handshake rarely changes,
- is hosted in the same network as the node, or as near as you can get, since the node's address is not the site's,
- is not your own domain. For a site you own, `tls` or `ws` is the better choice.

The panel only checks that names, ports and addresses are well formed and never connects to the site. Check from the node yourself, for example with `openssl s_client -connect www.example.com:443 -tls1_3 -servername www.example.com`. At start the node probes the site 8 times, then once every 6 hours, and logs what it finds.

**The profile.** The transport gets a profile of its own on **Profiles**, named like `main (borrowed site, alpha)` with an **Alpha** mark. An app that does not know the transport refuses the whole profile that holds it, so the panel never mixes it with other transports' profiles. The profile is ready when it has:

- the inbound's public key, as for any profile,
- the transport's public key, which the panel holds only if it saw the key in full. If the profile says it has none, pick a new key in the transport's form and apply,
- an address apps can dial: the **Node address** under **Settings**, the profile's **Addresses**, or a listener bound to a public IP address. Each takes the listener's port. More addresses, such as a forwarder's, go in the override `faketls_addresses`, a list of IP addresses.

A transport the panel cannot emit is listed under **Left out of this profile**, with the reason. A profile with no transport ready is not published. A relay never carries `faketls`, and **Relays only** leaves it out. Choose **Publish profiles** when it shows **Ready**, and again after you change the site.

**What users must do.** Apps dial this transport only after the user turns on **Alpha transports** in the app's settings (on the command line, `veilway connect --alpha`). The app shows a warning each time the user turns it on, and the user has to accept it. Until then the app shows that the connection can only be made in a way that is switched off. See the [guide](../../guides/borrowed-site/#5-what-users-do).

**What the network can still see.** This mode is alpha, rated Detectable, with no outside review. The node's address is not one of the site's, and one lookup of the name shows that. The round-trip time and TCP behavior are the node's, not the site's. The site can change its handshake at any time, and sees short connections from the node's address for every stranger and every user. A connection that carries the tunnel is one long connection with traffic in both directions. Anyone who holds a subscription knows the address, the name and the key. The full list is under "What remains detectable" on the [protocol page](../../protocol/borrowed-site/).

### Xray inbounds

If the Xray add-on is installed (`sudo bash veilway.sh addon xray install`, see the [Xray add-on](../xray/)), the **Xray add-on** section of the **Inbounds** page shows its release and the inbounds made here, with an **Add Xray inbound** button. Without the add-on, the section says so and shows the install command. Choose VLESS, Trojan or Shadowsocks, and a port. For VLESS and Trojan, also give the certificate and key files on the node and a decoy web server. Every current and later user gets a credential for the inbound. **Host in links** is the host name the links carry. Empty uses the node's first public address. Shadowsocks uses its port for UDP as well, so open both. You can edit an Xray inbound later: the port, listen address, certificate files, decoy, host, and for Shadowsocks a new server key. Users keep their credentials, but their links change when the port, host or server key does. Each user's links are on the user page.

An Xray inbound answers on the server's own address, next to the profiles you serve. Anyone who finds it can tell the address is a proxy server, so the panel caps the profiles on that address at Detectable in the subscriptions, and the review says so before you apply. Since v0.2.4 the cap covers only profiles that share an address with an Xray inbound. An inbound that listens on every address (the default) caps them all. One that listens on a separate IP address of the server, with a host name of its own, leaves profiles on other addresses as they are. A name the panel cannot resolve, or that resolves to the Xray address, counts as shared.

### Proxy inbounds (SOCKS5 and HTTP)

A proxy inbound lets other software use the node as a plain proxy: a browser, a script, or an app that takes a SOCKS5 or HTTP proxy. It is not a tunnel and has no profile. People log in with an account name and a proxy password. What they send goes through the same rules, exits, quota and counters as that account's tunnel traffic. It needs v0.2.17 or later on the node and the panel.

:::danger[Unsafe: nothing is encrypted]
SOCKS5 and HTTP carry the password and the traffic in the clear. Anyone on the network path can read both, and a censor that finds the port can tell what it is and block it. The **Inbounds** page rates a proxy inbound **Unsafe**. The setup to use is a **Listen on** address on loopback, `127.0.0.1:1080`, that people reach through a tunnel or a TLS front you run. The [proxy guide](../../guides/proxy-inbound/) does it with an SSH tunnel.
:::

**Add an inbound.** On **Inbounds** choose **Add inbound** and pick **SOCKS5 proxy**, **HTTP proxy** or **SOCKS5 and HTTP on one port**. The last answers both kinds of client on the same port. Then fill in:

- **Tag**, as for any inbound.
- **Listen on**: the TCP address and port clients connect to, such as `127.0.0.1:1080`. Loopback is the only address outsiders cannot reach.
- **UDP through the proxy** (SOCKS5 and mixed): lets SOCKS5 clients send UDP, for DNS, calls and games. Turn it off to carry TCP only.
- **Allow UDP for clients behind NAT**: shown when UDP is on and the address is not loopback. A client behind a NAT does not know the port it sends from, so it asks for port 0 and, without this switch, gets no UDP. With it on, the first datagram from the client's address takes the UDP association, so someone who shares the client's public address could send first and take it. Leave it off unless the clients are behind a NAT.
- **Who may log in**: **Every account with a proxy login**, or **Only chosen accounts and groups**, where you tick **Accounts** and **Groups**. The form says **Nobody can log in yet** while no account it admits has a proxy login.
- **Advanced: how much this inbound holds**: **Connections in all** (1024), **Connections per source** (64, a source is one IPv4 address or one IPv6 /64) and **Not yet logged in** (256). Empty fields keep the default shown in them.

**Addresses.** A loopback address needs nothing more. A private address (such as `10.x`, `192.168.x`, `100.64.x`) shows **A private address is not a promise**: on a cloud host it may be forwarded to a public address, and a local network has other machines. Any other address, the wildcard `0.0.0.0` included, is **Public address**. The form shows **Anyone can reach this address** and will not go on until you tick **I understand that traffic and passwords cross the network in the clear**. A public inbound keeps a **Public address** mark in the list. The panel refuses an address another listener of the node uses. Review and apply like any other inbound.

**Who may log in.** A proxy login belongs to an account. An account logs in with its own name as the user name and its proxy password, and only if the inbound admits it. A disabled, expired or over-quota account is refused as everywhere else. An account may have a proxy login and no devices, for people who only use proxies. The tunnel profiles are not touched: a proxy inbound never appears in **Profiles**.

**The account's Proxy login.** The **Proxy login** section of the account's page is separate from the subscription link and the device keys.

- **Make a proxy login** makes a password of 32 letters and digits and shows it at once. It needs your password again, and your code when two-step sign-in is on. The panel keeps it sealed with the keys in `panel.keys` and pushes it to the node.
- **Show login** opens it again after you confirm your password. The panel lists the **User name** and **Password**, and for every proxy inbound that admits the account a line to copy, as `socks5://` and `http://` addresses with the login in them, one per inbound and kind. For a wildcard address it uses the **Node address** from **Settings**, or a placeholder until you set one. A line for a loopback inbound works only from the node itself. **Hide** closes it.
- **Make a new password** replaces it. The old password stops working at once and the account's proxy connections are cut.
- **Remove** takes the login away. Its connections end, and the account cannot log in to any proxy inbound until you make a new login. Removing the account does the same.

No API token can make or show a proxy login. The audit log records that one was made, shown or removed, never the password.

**Counters.** The inbound's row on **Inbounds** shows how many connections are open, how much it carried, and how many logins were refused, for example `3 open, 1.2 GB, 0 logins refused`. A count of UDP packets from the wrong port appears next to it when a client behind a NAT is being refused. That is the sign to turn on **Allow UDP for clients behind NAT** or move the client to TCP. The bytes are in **Traffic** under the inbound's tag as well.

**What the node does for you.** A source that fails 10 logins to one name in a minute is refused that name for the rest of the minute, and each wrong guess makes the next refusal for that name slower. Connections that never log in are closed after 10 seconds. A change to the inbound, or to who it admits, ends the connections it no longer admits within a second. Details: [Proxy inbounds](../../reference/config/#proxy-inbounds-socks5-http-mixed) in the config reference.

### Outbounds

The **Outbounds** tab of **Exits and routing** lists how the node dials out.

- **Direct** dials from the node's own address.
- **SOCKS5 proxy** dials through a proxy you run or rent. Give its address and, if it has them, a username and password.
- **Xray server** (from v0.2.18) dials through a VLESS, VMess, Trojan or Shadowsocks server you rent, run by the Xray add-on. See [Xray servers](#xray-servers).

A Direct outbound has two optional fields. **Source address** is a local IP of the server its traffic leaves from. Since v0.2.8, **Network interface** is the name of a network interface of the server, such as `eth1`. Traffic of an outbound with an interface leaves through it whatever the routing table says. Needs Linux or macOS. If an interface is missing when the node starts, the log shows a warning, and that outbound's flows fail until it is there.

### Xray servers

An **Xray server** outbound lets an exit leave through a server of another provider that speaks VLESS, VMess, Trojan or Shadowsocks, so you can use a rented server as an exit without a second Veilway node. The [Xray outbound guide](../../guides/xray-outbound/) walks through it. Choose **Add outbound**, set **Type** to **Xray server**, and pick **How to add it**:

- **Paste a link** takes a `vless://`, `vmess://`, `trojan://` or `ss://` link in **Share link**. The node reads it once and keeps the fields, never the link. If it refuses the link, the panel says why in plain words: a stream type that is not supported, header obfuscation, security settings, certificate checks switched off or a certificate pinned, an encryption setting, a flow, a VMess `alterId`, a cipher not on the list, a key that does not fit its cipher, a Shadowsocks plugin or incomplete Reality settings.
- **Fill in the fields** gives the form: **Protocol**, **Proxy address** (host and port) and the credential, which is **User ID** for VLESS and VMess and **Password** for Trojan and Shadowsocks, plus **Cipher** for VMess and **Method** for Shadowsocks. Then **Transport** (TCP, WebSocket, gRPC, HTTPUpgrade or XHTTP) with its **Path**, **Host header**, **Service name**, **Authority** or **XHTTP mode**, and **Security** (**None**, **TLS** or **Reality**) with **Server name (SNI)**, **Browser fingerprint**, **ALPN**, or for Reality **Borrowed site**, **Public key** and **Short ID**. **Flow** offers Vision, for TCP with TLS or Reality. **Allow a private address** is off by default, and loopback and link-local addresses are always refused. Before you review, the form says what the node would refuse: VLESS and Trojan need TLS or Reality, a path has no `?`, a short Shadowsocks password, Reality does not run over WebSocket or HTTPUpgrade.

The credential is never shown again after saving. Leave it as it is to keep the saved one. The node looks up a **Proxy address** that is a name, never Xray, in plain UDP DNS. Write an IP address when the provider's name must stay hidden.

The panel warns that **The provider sees what this exit carries**. When the add-on is not installed, it also warns **The Xray add-on is not installed**. You can still save the outbound, but every exit that uses it stays down until the add-on is on the node (a link opens how to install it). Adding, changing or removing an Xray outbound restarts Xray, so users of Xray inbounds are cut off for a moment and connect again with their next try. Xray outbounds work on Linux nodes only.

The **State** column of the list says **Carrying**, **Down** with the node's reason underneath, or **Not reported yet**. It refreshes every 10 seconds. Every exit that uses a down outbound is down too, and nothing goes around it.

On an exit through an Xray server, the **UDP** choice under **Traffic the outbound cannot carry** offers only **Refuse** and **Drop silently**. The form says that the outbound carries UDP itself, and while the server is down the flow ends. The node checks the rest. The details and limits are under [`xray` outbounds](../../reference/config/#xray-outbounds) in the config reference.

### Exits

The **Exits** tab lists where a user's traffic leaves. Users pick among the exits their routing allows. Each exit has a name that users see, and a two-letter country code such as `DE`. It leaves through one of these:

- **An outbound**: each flow is dialed again through an outbound.
- **The kernel**: packets go to a TUN device and the kernel forwards them. Linux only. The default interface is `veilway0`.
- **Nothing, blocked**: everything sent to this exit is dropped.
- **Another node**: traffic goes on through a node link.

**Load.** Switch on **Report load to apps** in an exit's form (from v0.2.18) and apps show users how busy the exit is: **Not busy**, **Busy** or **Very busy**. Pick **Measure by**: **Open connections** (flows open on the exit for all users together) or **Throughput** (up and down together in Mbit/s, averaged over 30 seconds). Then set **Busy from** and **Very busy from**, whole numbers up to 1,000,000, the second above the first. A new setting starts at 50 and 200 connections. It is off by default, and a blocked exit has no load. Apps show nothing for an exit that does not report it. The node looks every 10 seconds, changes a level only after the new one held for two looks, and tells a device a change at most once a minute, so what apps see is coarse and a little late on purpose. The exit's line in the list shows the level apps have now, or **load not measured yet**.

### Routing

Rules are checked from the top. The first rule that matches decides. Traffic that no rule matches goes to the default exit.

**Exits Automatic may switch to** lists the exits a device on **Automatic** leaves through while its own exit is not working, such as a SOCKS5 exit whose proxy stopped answering. The device takes the first ticked exit that works and that the user may use, and goes back once its own exit works again. With none ticked, devices stay on their exit. Leave it empty on an entry node, so that nothing goes round a link that is down. It is `routing.fallback` in the config.

A fresh node keeps users apart. Its first rule, `isolate-users`, refuses traffic to `tunnel:users`, the tunnel addresses of every device, so no device reaches another device, even one of the same user. Remove that rule, or put a rule above it that allows `tunnel:users` for a group, only when users should reach each other, for example for games on a shared network. See [Traffic between users](../../reference/config/#traffic-between-users).

Each rule has conditions, and every condition you add must hold for the rule to match. The conditions are: user, group, inbound, **Transport**, node link, destination network, domain, protocol, port, ICMP type and ICMP code. A domain covers its subdomains.

**Transport** holds a rule to the kind of session a flow started on: `udp`, `udp-obfs`, `tls`, `ws`, `ws-plain`, `fronted`, `fronted-shaped`, `faketls`, `socks5` or `http`. The list offers the transports your inbounds have. **Show every transport, including those no inbound has** lists the rest, and the config check warns about such an entry, since it never matches. A flow keeps the transport it began on, so a device that moves to another transport keeps its old flows where they began, and its new flows follow the rule. A proxy inbound's tag is also a choice under **Inbound**, so a rule can cover one proxy inbound alone. Traffic of the Xray add-on has no transport and no inbound, so rules with either never match it. See [Transport](../../reference/config/#transport).

A rule then sends traffic to one of these:

- **This exit**: pick one of the node's exits, whatever the user picked. If that exit is deleted later, the review lists the rule and the node refuses the change until the rule points somewhere else.
- **The exit the user picked**, within the exits that user is allowed.
- **Nowhere, silently**: the traffic is dropped with no answer.
- **Nowhere, refused**: the device is told it cannot connect, so apps give up at once.

Each rule has a name, made from what the rule does until you type your own. To change the order, drag a rule by its handle, use the arrow buttons, or press Space on the handle and move it with the arrow keys. The new order goes through the review like any other change.

You can turn a rule off. It stays in the list and is skipped. For a home network that a phone should reach through the node, see [Home network](../home-network/).

### Profiles

The **Profiles** page has one profile for each Veilway inbound, made from the node's config. Apps get these profiles through their subscription once you publish them. The panel lists what a profile still lacks, most often an address apps reach it at. **Addresses** on a profile lists the IP addresses or host names apps reach that inbound at, separated by commas, for an inbound on its own IP address or behind its own domain. Each transport adds its own port. When it is empty, apps reach an inbound that listens on a public IP address there, and any other at the **Node address** under **Settings**. A `ws` or `fronted-shaped` transport is the exception for the port: it sits behind your web server, which ends TLS and passes the path to the node's plain HTTP listener, so apps connect to the web server's port. That is 443 unless you set **Web server port** on the profile. Before v0.2.13 apps were given the node's listener port, where they could not connect. The panel fills in the inbound's public key and the transport's public key when the inbound is applied with its private keys. An inbound added before v0.2.7 still asks for it: enter its private key again on **Inbounds** and apply, or paste the public half that `veilway genkey` printed. Each profile also has **Overrides**, a JSON object of fields that replace the derived ones. It cannot hold `id` or `device`. Choose **Publish profiles** when all are ready. Apps pick up the change at their next refresh.

**Certificate pin.** For a `tls` transport that makes its own certificate (`self_signed`), apps trust it through its pin. From v0.2.18 the panel asks the node for the pin and puts it into every `tls` candidate of the profile that has none. The profile shows **Certificate pin from the node:** with the pin, or **Certificate pin from an override:** when your own **Overrides** carry pins, which win. Without a pin it says apps check the certificate through its chain. The pin is the hash of the node's key, which the node keeps when it renews the certificate, so the pin changes only when the node makes a new key, such as after you remove the key file on purpose. Then the profile shows **The certificate pin changed since you published**. The published profiles still carry the old pin, so devices that hold it cannot connect over `tls` until they refresh, while other transports keep working. Publish again to send the new pin.

**Plain HTTP host name** and **Plain HTTP port** appear on a profile whose inbound has a `ws-plain` transport. The host name is the name of your web server for plain HTTP. The network sees it, so it must differ from every name the other transports of any profile use. Without it the `ws-plain` transport is not offered, and the profile says why. The port is where apps connect, 80 when empty. The node's config holds neither. They are overrides of the profile, as the web server port is.

**Relays only: do not give apps this node's address** is a switch on each profile. When it is on, apps get only the addresses of the enabled relays that carry that inbound, never the node's own. A transport that none of the relays reaching that user carries is left out of the user's profile. `faketls` and `ws-plain` are always left out, since a relay cannot sit in front of them. A user whom no relay reaches gets no profile for that inbound. Xray links are not affected. The page warns you when the switch is on and no enabled relay carries the inbound. Publish the profiles again after you change it.

### Node links

The **Links** page lists the node's links. A node link joins this node to another node, so users here can leave from there, or users there can leave from here. To keep users connected when international links are cut, with one server inside the country and one abroad, follow [Set up an entry node](../../guides/entry-node/). The **Links** page has a **Guided setup** with three starts: **Set up as entry node**, **Set up as exit for an entry node** and **Reverse tunnel**. Each walks through the direction, codes and fingerprints, then adds the exit that leaves through the link (on the entry) or picks what the link may use (on the exit), all as one reviewed change. By hand, the two operators pair the nodes in four steps:

1. One operator chooses **Make an offer**, picks the inbound the link connects to, the direction, the transports and the tunnel addresses, and chooses how long the offer stays open. They send the offer code to the other operator. The offer holds no secret, but send it over a channel you trust.
2. The other operator chooses **Paste an offer** and reads it. The panel shows where their node would connect before anything is answered. They accept and send back an answer code.
3. The first operator chooses **Paste the answer**, and takes it.
4. Both operators call each other and **compare fingerprints**. Each reads their own eight groups aloud and types the other side's groups. If a code changed on the way, the groups will not match. Confirm the pairing only when they match.

In the offer, each transport of the inbound's profile has a checkbox with its port, path and TLS name and a short note on how it looks to the network (from v0.2.19). Uncheck the ones the link should not use, and keep at least one. A link can use `udp`, `udp-obfs`, `tls` and `ws`, but not Encrypted Client Hello or a self-signed certificate, so those show why they cannot be picked. Between countries, `tls` is usually the safest choice: UDP is often throttled or dropped. **Edit as JSON** changes the list by hand.

The two directions are:

- **Users there leave here.** This node is the exit, and the other node dials in.
- **Users here leave there.** This node is the entry, and the other node dials in. Use it when this node cannot be reached from the other one.

The tunnel addresses must come from a network that no inbound pool on either node uses. A private address works only when both nodes share that network. A WebSocket transport runs through the other operator's web server, which can see the timing of the traffic.

A link is shown as **Up**, **Connecting**, **Unreachable**, **Refused** or **Ended**. **Drop the pairing** removes a pairing that is still waiting.

**Manage** on a link changes it after pairing. **Link on** turns it off without losing its keys: it neither dials nor answers until you turn it on again. On the node that is the exit you also set:

- where the link's traffic leaves when no rule names an exit
- which exits it may use
- whether rules may reach private networks through it
- how many connections it may hold at once
- a quota and its period

On both sides you can set an expiry and the MTU. **Remove** asks you to confirm with the other node's name and then goes through the review. The other node keeps its half until its operator removes it there, and linking again needs a new pairing.

### Several servers

One panel can manage more than one server. A remote node joins **This server** through a managed [node link](#node-links), and the panel reaches its control API through that link. To set one up, follow [Add a second server](../../guides/second-server/). The **Servers** page lists each server with its state, last contact, users, pool use and traffic. **Add a server** starts the pairing in one of two directions.

| Field | What it does |
|---|---|
| **Name** | The name shown in the panel, and in a user's profile names when the user has more than one server. |
| **Position** | A lower number is listed first. |
| **Address pool** | The IPv4 range of the devices at this server. Change it only while no device has an address in it. |
| **Count this server's usage** | Off leaves this server's traffic out of the user's total. |
| **Fastest usage growth** | The most a server's usage may grow per second. The default is 1.25 GB/s. A larger jump is clipped and logged. |

On a user's page, **Servers this user may use** is **Every server** or **Only these servers**, with the servers you pick. Usage is shown for each server.

**Remove server** asks the node to empty itself and drop the link, then removes the link here. It asks for your password and code again. Choose **The server is gone** instead when the server was seized or is gone. The panel then removes the link without asking the node.

### Tunnels

A tunnel forwards one TCP or UDP port of this node through a [node link](#node-links) to one address on the far node, such as a server at home with no open port of its own. Nobody signs in: whoever reaches the port reaches the target. The **Tunnels** card on the **Links** page lists them below the links. A tunnel needs a link first, and an exit that leaves through it, since those are the only exits its **Exit** field offers.

Two presets under **Guided setup** start a tunnel with its protocol already set:

- **Forward a port to a home server** makes a TCP tunnel, for web, SSH, databases and most other services.
- **Forward a UDP port to a home server** makes a UDP tunnel, for games, VoIP and DNS.

To add a tunnel without a preset, choose **Add a tunnel** on the card. The form has these fields:

- **Name**: 1 to 64 lowercase letters, digits, dashes or underscores. The counters show it.
- **Exit**: the exit that leaves through the link.
- **Protocol**: TCP or UDP. The presets set it for you.
- **Listen on**: the address and port of this node that people connect to, such as `203.0.113.5:8443`. An IPv6 address goes in brackets.
- **Target**: the address and port the far node connects to, such as `192.168.1.10:8080`.
- **Allowed sources**: one address or network per line, such as `203.0.113.0/24`. Only these may connect. Empty means anyone who reaches the port.
- **At most at once**: connections at once, or sessions for UDP. Empty means 256. One source holds at most 16.
- **Tunnel on**: off keeps the tunnel in the list without opening the port.

Some rules apply:

- A UDP tunnel on an address that is not loopback needs allowed sources, and the panel does not save it without them. A source address can be forged, so the sources decide who gets answers, and the target must check its own clients.
- A TCP tunnel on an address that is not loopback, with no allowed sources, shows a warning, because anyone who reaches the port can connect.
- A target on a private network, such as `192.168.1.10`, is reached only when the far node's operator turns on **Let rules reach private networks** for that link, under **Manage**. Without it the far node refuses the connection, and this node cannot change that.
- Every change goes through the review. A node holds at most 64 tunnels, and all tunnels together at most 16,384 connections.

Each card shows its status and counters, refreshed every 10 seconds. The status is **Listening** while the port is open, **Not running** when it is not, and **Off** when the tunnel is switched off.

- **Exit** is the exit the tunnel leaves through. **Open now** is how many connections or sessions are open, out of its limit.
- **Opened** counts the connections or sessions made since the node started.
- **Refused** counts the refusals and gives the reason for each: source not listed, limit reached, too many from one source, too fast from one source, link down, or no free port.
- **Sent to the target** and **Sent back** are the bytes in each direction.

How a tunnel carries traffic, and its limits, are in the [Tunnels section of node links](../../protocol/node-links/#tunnels).

### Notices

The **Dashboard** has two lists of notices. They look alike and reach users differently.

**Notices to users** holds up to four short notices, each an information or a warning. Connected apps show them within seconds, in the language you write them in. Apps that cannot connect never see them, because they travel on the control channel. The text is one line of up to 280 bytes (a Persian letter takes two). The editor counts the bytes as you type and shows the notice the way apps show it. Changes go through the same review as the rest of the node's config.

**Notices in subscriptions** (from v0.2.18) holds up to four notices that go into every signed subscription document. Apps keep them from their last refresh and show them even when they cannot connect, so this is how you reach users whose connection is blocked. Add a notice with **Add notice**, give it a severity and text, and choose **Save notices**.

- **Other languages** under each notice adds up to 8 translations, each with a **Language tag** such as `fa`, `de`, `pt-BR` or `zh-Hans` and its text. An app shows the text for its own language and the main text for everyone else. The list shows **Also in** the tags a notice has.
- **The text** follows the same rules as a notice to users: one line of 1 to 280 bytes, with no invisible characters. The panel refuses a text the apps' own display rules would change, so apps show what you wrote.
- **There is nothing to publish.** The notices are a panel setting, and every refresh is signed with what is saved. Apps get a change at their next refresh. Users who only reach a static mirror see it at the mirror's next round, see [Static mirrors](#static-mirrors). It does not go through the node's review.
- **A text in both lists is shown once.** An app that is connected and has a notice from its subscription with the same text as one from the tunnel shows it once.

### DNS and logs

The **DNS and logs** page holds three parts, each applied on its own through the review.

- **DNS**: the resolvers the node asks for every tunnel, one to four, tried in order. **Answer every DNS question** answers DNS that an app sends to any server on port 53 at the node, so it cannot slip around these resolvers. **Resolvers for some users** sends the users, groups or inbounds a set names to their own resolvers. A set that names a user wins over one that names their group, which wins over one that names the inbound. Sets need **Answer every DNS question** on.
- **Node log**: how much the node writes to its log. **Log where users go** lets log lines name the sites and DNS names users reach. Anyone who can read the server's logs then learns where each user went, so turn it on only while you look for a problem.
- **Replay protection**: how many accepted proofs the obfuscated transports remember, and how many one source may bring. The number remembered takes effect after a node restart. The limits per source change at once.

## Traffic

The **Traffic** page shows the speed now, the number of users online, and what each user, inbound, exit and outbound carried. Pick a period: day, week, month or year. Pick a name in the table to chart its average speed.

The panel checks the node every 10 seconds. If the node does not answer, the page shows the last figures it sent, and the usage history has a gap until the node answers again. Each exit and outbound also shows whether its interface or link is up, and whether it carries UDP.

## API tokens

Tokens let other software call the admin API. Each token has one scope:

| Scope | What it can do |
|---|---|
| Read only | Read users, usage and settings. It changes nothing. |
| Users | Manage users, devices and links. |
| Full | Everything an API token may do. |

You can set an expiry, and a list of allowed source addresses, one address or network per line. Leave the list empty to allow any address. The panel shows the token once and keeps only a hash of it. Send it as a Bearer token.

**Revoke** stops the token at once. This cannot be undone. A token never reaches admin logins, signing keys, other tokens, or the routes that need a full admin session.

## Account

The **Account** page has six tabs.

- **Sessions** lists the browsers signed in to your account. You can end any session. This browser is marked.
- **Password and code** changes your password, or makes a new key for your authenticator app. Changing the password ends every other session. A new key stops the old one from working and ends every other session too.
- **Admins** lists everyone who can sign in. **Add admin** takes a name (3 to 32 characters of a to z, 0 to 9, dot, dash and underscore) and a password of 12 to 256 characters, then shows the new admin's authenticator key once. Hand over both in person or over a channel you trust. **Reset** gives an admin a new password and a new authenticator key, shown once, and ends their sessions. **Remove** ends their sessions and API tokens, and their audit log lines stay. You cannot remove yourself or the last admin. Each asks for your password and code again, and no API token can do them.
- **Audit log** lists logins and every change made in the panel or through a token. The log never holds a link, token or key.
- **Backup and restore** is described under [Backups and secrets](#backups-and-secrets).
- **Display** sets the appearance (system, dark or light), the language, and the layout direction: automatic (follows the language), left to right, or right to left, kept in this browser. In Persian, date fields use the Solar Hijri calendar, such as `1405/02/15`.

## The admin API

The admin API sits under `{prefix}/api`. Its description is at `{prefix}/api/openapi.json`. It always matches the running code, because one route table builds both the router and that file.

A browser uses its session and sends a CSRF token with every change. A script uses an API token in a Bearer header:

```
curl -H "Authorization: Bearer <token>" https://panel.example.com/3f9c0a7e21b84d65/api/users
```

Each operation in the file says what it needs, in its `x-access` field:

- `read`, `users` and `full` are the token scopes above.
- `session` and `session-reauth` need a logged-in admin. A token never reaches them.
- `public` needs nothing.

## Backups and secrets

The panel keeps five files apart, each readable only by its owner:

- The database holds no key.
- `panel.keys` holds the keys for sealed secrets.
- `signing.keys` holds the subscription signing keys.
- `gateway.keys` holds the gateway keys. The panel's backup holds this file.
- `gateway.next` holds the next gateway key, until you move it off the server.

Back up `panel.keys` as well as the database. Without `panel.keys`, the subscription endpoint answers like an unknown path, and no secret can be opened. The install script's [backup](../../getting-started/) holds the whole panel data folder, so it has these files, and `gateway.next` too while that file is still on the server. Keep the archive private. The panel's own backup never holds `gateway.next`, see [Gateway keys](#gateway-keys).

Passwords are hashed with Argon2id. Admin sign-in asks for a code as well as the password.

### Backup and restore from the panel

On **Account**, **Backup and restore** makes one `.vwbackup` file with a consistent copy of the database, `panel.keys`, `signing.keys` and `gateway.keys`. The next gateway key's private half is not in it. You choose a passphrase of at least 12 characters, and the file is encrypted with it (Argon2id and ChaCha20-Poly1305). Both actions ask you to confirm your password and code again, and both are written to the audit log. No API token can use them.

The file holds every user's secrets and the panel's keys, so keep it private. A lost passphrase cannot be recovered, and the file is useless without it.

To restore, pick the file and enter its passphrase. The panel then:

1. checks the file before it changes anything
2. saves the current database and keys in a `pre-restore-<time>` folder next to the database
3. swaps the files in
4. restarts

The panel stops with a failure code so the service manager (the install script sets `Restart=on-failure`) starts it again on the restored files. Every session ends and every API token is revoked, so you sign in again with an admin from the backup. The panel refuses a backup from a newer panel. When the gateway keys on the server are not the ones in the backup, the panel restores the backup's and says so before you go on, and links made under a key the backup lacks stop opening. The file it replaces is in the `pre-restore-<time>` folder.

### Updating the panel

The panel checks GitHub for a newer published release (not a draft or a prerelease) of the panel and of the node, at start and every 6 hours. Set `update_check` to `false` in `panel.json` to turn this off. It compares the node's release with the version the node on the same server reports. When either is newer, a banner shows the versions with links to their release notes, and **Update panel**, **Update node** or **Update both** as they apply. Each button needs a recent re-authentication and is audited, and no API token can use it. Updating the node restarts it, which drops every live tunnel for a moment, and the panel says so before it asks.

The panel never updates itself. It writes the word `panel`, `node` or `both` to a file in `/var/lib/veilway-panel-update/`. A root service started by a systemd path unit deletes the file and runs the script's `panel-update-request` command, which does what `veilway.sh update <word> --yes` does and checks the release signatures before it installs. Nothing in the file is used except that word. Servers installed before v0.2.2 have an installer that only knows `panel`. Run `curl -fsSL https://raw.githubusercontent.com/veilway-project/veilway/main/scripts/veilway.sh | sudo bash -s update` on them once.

**Check for updates**, next to **Restart node** and **Restart panel** on **Links**, asks GitHub now instead of waiting for the next check, at most once a minute. It refreshes the update notice and says whether anything is newer. It is the API route `POST /update/check`.

**Restart node** and **Restart panel**, on this node's card on **Links**, go the same way. The panel writes `restart-node` or `restart-panel`, and the script runs `veilway.sh restart`. They ask for your password again and are kept in the audit log. A node restart drops every connected device for a moment. Config changes never need one, since the node applies them as they are made. The script of v0.2.9 or later does the restart. An older one ignores the request, and its next update installs one that does.
