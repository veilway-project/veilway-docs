---
title: Panel manual
description: Running a Veilway node from the web panel.
---

:::note[Part of the alpha]
The panel ships in the alpha, `v0.1.0-alpha`, from the [panel release page](https://github.com/veilway-project/veilway-panel/releases). It has been built and reviewed, but it has not yet been run against a real node. [The alpha release](../../alpha/) lists its limits.
:::

The panel is the admin side of a node. It runs on the node's host and changes users and settings through the node's control socket. Operators use it in a browser, or call its [admin API](#the-admin-api) from scripts.

## Before you start

Install the node and the panel with the [install guide](../../getting-started/). The panel listens on `127.0.0.1` only, so a web server with TLS must serve it, and that web server must be on the same host.

## The panel's config

The panel reads `panel.json` when it starts, so restart it after you edit the file with `sudo bash veilway.sh restart panel`. Unknown fields stop the panel from starting.

| Field | Default | What it does |
|---|---|---|
| `listen` | `127.0.0.1:8480` | The address the panel listens on. Must be a loopback address, because the panel has no TLS of its own. |
| `prefix` | `/panel` | The admin path. Random at install. No trailing slash. Letters, digits, `-`, `_`, `.` and `/` only. |
| `sub_path` | `/sub` | The path of the subscription endpoint. Must differ from `prefix`, and must not sit inside it or the other way round. |
| `database` | `panel.db` | The SQLite database. It holds no keys. |
| `keys` | `panel.keys` | The keys for sealed secrets. Mode `600`. Kept apart from the database. |
| `signing` | `signing.keys` | The subscription signing keys. Mode `600`. |
| `node_socket` | `/run/veilway/control.sock` | The node's control socket. |
| `allowed_hosts` | `[]` | Host names the admin pages answer to. Empty accepts any host, which is safe only behind a web server that checks it. |
| `trusted_proxies` | `[]` | Addresses whose `X-Forwarded-For` the panel believes. Put your web server's address here. Required unless `direct` is `true`. |
| `not_found` | a plain 404 page | The status, headers and body of the answer for every path the panel does not serve. Copy your web server's 404 into it. |
| `secure_cookies` | `true` | Keep `true`. Turn it off only for tests, or for plain HTTP on localhost. |
| `direct` | `false` | Set `true` only when no proxy is in front of the panel. |
| `two_step` | `"on"` | `"off"` turns the authenticator code off. Any other value keeps it on. See [Two-step sign-in off](#two-step-sign-in-off). |

The panel refuses to start if `listen` is not a loopback address, if `prefix` and `sub_path` do not meet the rules above, or if `trusted_proxies` is empty and `direct` is not `true`.

### Two-step sign-in off

Only for tutorials and demos. With this on, anyone who learns an admin's password gets into the panel, and the panel can then reach your node and every user's links. Never use it on a panel that holds real users.

Add this line to `panel.json`, then restart the panel with `sudo bash veilway.sh restart panel`:

```json
"two_step": "off"
```

Sign-in, first setup, adding an admin and re-authentication then ask for the password only. Everything else stays: passwords of 12 characters or more, sessions, CSRF checks, API tokens and the audit log. Sign-in is stricter in this mode: a source gets 5 tries in 15 minutes, and an account that is waiting after wrong tries refuses even the right password until the wait ends. Because of that, someone who keeps guessing can keep the admin waiting for up to 15 minutes at a time.

The switch is read from `panel.json` only. No page or API route of the panel can change it, so whoever can write that file already owns the panel. While it is off, every page shows a red banner, the login page says so, the panel logs a warning at every start, and the audit log records `panel.two_step` with `off` or `on` whenever the value differs from the last start.

To turn it on again, remove the line (or set it to `"on"`) and restart. Authenticator keys of existing admins are kept and work again. An admin who has none must set one up at their next sign-in before any other page works.

## First login

1. Open `https://your-domain/<prefix>/`. The admin path is the `prefix` value.
2. On the setup page, enter the one-time setup token, a username, and a password of 12 characters or more. Enter the password again, then choose **Make admin account**. The token is printed in the panel's log when it first starts, and the install script prints it too.
3. The next page shows a TOTP key and a QR code for your authenticator app. The key is shown once. Add it to the app, then choose **I added it, go to login**. Without the key you cannot log in.
4. Log in with your username, your password and the 6-digit code from the app. Login is rate limited, so after several wrong tries you must wait a few minutes.
5. Before you add users, go to **Subscriptions** and set the endpoint URL and the device address pool. Then go to **Node** and check the profiles.

The same setup can be done by script. Send the token, a username and a password to `{prefix}/api/setup`. The answer holds the TOTP secret, shown once.

Some changes ask for your password and code again. The confirmation holds for five minutes.

## Users and devices

The **Users** page lists every user. You can search by name, group or note, and filter by enabled or disabled. Select one or more users to enable, disable, reset usage, delete, or change them in bulk: add or remove a group, set the quota, set the expiry, set the device limit, or set the exits to all exits or a chosen set. A default exit the new set leaves out is cleared.

### Add a user

Fill in the form:

- **Name**: lowercase letters, digits, dot, dash and underscore. Clients show it.
- **Groups**: separate with commas. Routing rules and DNS sets can name a group.
- **Quota** and **Count starts over**: leave the quota empty for no limit. Pick never, every day, every week or every month for the reset. The reset needs a quota.
- **Expires on**: leave empty for no expiry.
- **Device limit**: `0` means the node's own limit of 16.
- **Note**: only admins see it.
- **Enabled**: a disabled user cannot connect, and their devices stay.
- **Exits**: **All exits**, or **Only these** with the exits you tick. The user's app lists only these exits. Routing rules can still send their traffic to a specific exit. **Default exit** is where their devices leave when they pick none, among those exits. **Node default** leaves it to the node's routing default.

When the user is saved, the panel shows the subscription link. It is shown once. See below.

### The user page

- **Usage** shows what counts toward the quota, since when, and the total sent and received. **Reset usage** starts the quota count over. A user who was cut off for going over the quota can connect again. You can also set the total back to zero.
- **Subscription link** holds the link and its QR code. The panel keeps no copy, so the link can be shown only when it is made or reset. Anyone with the link can enroll a device, so send it like a password. **Reset link** makes a new link and stops the old one at once. You choose whether devices enrolled with the old link are removed too.
- **Devices** lists each device, whether it is waiting for the app to confirm, enrolled, and when it was last seen. A device either makes its own key, which never leaves the device, or uses a key the panel made. **Remove device** stops it from connecting at once.
- **Add a device with a panel key** lets the panel make the private key and export it as a signed file. This is weaker than enrolling from the device, so use it only for a device that cannot open the link.
- **Exits** sets which exits the user's app lists, with each exit's country and whether it is up. If an exit the user was limited to is deleted from the node, it shows as **Removed from the node**, and **Save exits** drops it from the user's list. A default exit that the node no longer has, or that the user may no longer use, is cleared the next time the panel updates the node.
- **Delete user** stops the user's devices and links at once. This cannot be undone.

The **Users** list shows each user's exits as **All exits** or a count.

## Subscriptions

The **Subscriptions** page sets what every user's link points to, and how the documents are signed. It has four tabs.

### Endpoint

- **Provider name** is shown next to the subscription in apps.
- **Endpoint URL** is the public `https` address that your web server forwards to the panel's subscription path.
- **Certificate pins** are needed only for an endpoint whose certificate is not from a certificate authority. Give up to two SHA-256 pins, one per line, in base64.
- **Apps check for changes every** sets the refresh interval, in minutes. **Documents stay valid for** sets how many days a signed document can be used.
- **Show links once** means the panel never keeps a copy of a link. A link is shown when it is made or reset, and never again.
- **Device limit for new users** and **Device address pool** set the defaults for new users. The pool is an IPv4 network from `/16` to `/30`, and each device gets one address from it.
- **Answer to everything else** shows the 404 your web server gives. The endpoint answers every request without a valid token that way.

### Signing keys

Every document is signed. To change keys without cutting users off:

1. Choose **Add a new key**. Both keys sign from then on.
2. Wait until every app has fetched a document that lists both keys, which takes at least one update interval.
3. Choose **Retire the older key**.

A retired key is kept for 365 days, so that it can sign refusals. An app that never fetched the new key refuses the next document and needs its link again, so do not retire the old key too early.

### Mirrors

A mirror is another address for the same subscription. Apps try the mirrors when the endpoint is blocked. You can add up to four. A mirror that has no certificate from an authority needs its own pins, one per line.

### Profiles

The profiles tab takes extra profiles as a JSON list of up to 64 objects. A profile here cannot name a device, because the panel adds each user's device to it.

## Node

The **Node** page shows what the node runs. It has six tabs: inbounds, outbounds, exits, routing, profiles and node links.

Every change goes through a review before it reaches the node. Choose **Edit** or **Remove**, and the panel opens **Review changes**. Nothing is sent to the node until you choose **Apply to the node**. The review shows:

- what is added, changed and removed, and which inbounds restart. A restart drops and reconnects every device on that inbound.
- how many users can no longer connect.
- warnings from the node.
- problems the node would refuse. Fix them and review again.

If the config changed since you opened the page, the review says so. Reload the config and make the change again. **Undo my edits** discards the changes you have not applied. Each section also has a JSON view of the whole section.

### Inbounds

An inbound is a tunnel that devices connect to, with the transports it is reached on.

- **Veilway** is WireGuard with the control channel. The obfuscated transports need it.
- **Plain WireGuard** is for stock WireGuard apps. Its handshake is easy to spot.

Each inbound has a private key, which you make on the node with `veilway genkey`. The panel asks for the private half when you add it. It also has gateway addresses, one per line, and an MTU. The default MTU is `1420`, or `1390` with `udp-obfs`.

The transports are:

| Transport | What it is |
|---|---|
| Plain WireGuard over UDP (`udp`) | WireGuard as it is, over UDP |
| UDP in Veilway's own envelope (`udp-obfs`) | UDP with Veilway's own envelope around it |
| TLS the node ends itself (`tls`) | The node ends the TLS connection itself |
| WebSocket behind your web server (`ws`) | A WebSocket that your web server forwards to the node |
| HTTP requests through a CDN (`fronted`) | HTTP requests that a CDN forwards to the node |

The `tls`, `ws` and `fronted` transports need more than the form holds: their certificate, decoy origin, trusted proxies and transport keys. Set those in the JSON view.

### Outbounds

An outbound is how the node dials out. **Direct** dials from the node's own address. **SOCKS5 proxy** dials through a proxy you run or rent. For a SOCKS5 proxy, give its address and, if it has them, a username and password. A source address is optional.

### Exits

An exit is where a user's traffic leaves. Users pick among the exits their routing allows. Each exit has a name that users see, and a two-letter country code such as `DE`. It leaves through one of these:

- **An outbound**: each flow is dialed again through an outbound.
- **The kernel**: packets go to a TUN device and the kernel forwards them. This is Linux only. The default interface is `veilway0`.
- **Nothing, blocked**: everything sent to this exit is dropped.
- **Another node**: traffic goes on through a node link.

### Routing

Rules are checked from the top. The first rule that matches decides. Traffic that no rule matches goes to the default exit.

Each rule has conditions, and every condition you add must hold for the rule to match. The conditions are: user, group, inbound, node link, destination network, domain, protocol, port, ICMP type and ICMP code. A domain covers its subdomains.

A rule then sends traffic to one of these:

- **A specific exit**: pick one of the node's exits, whatever the user picked. If that exit is deleted later, the review lists the rule and the node refuses the change until the rule points somewhere else.
- **The exit the user picked**, within the exits that user is allowed.
- **Nowhere, silently**: the traffic is dropped with no answer.
- **Nowhere, refused**: the device is told it cannot connect, so apps give up at once.

Each rule has a name, made from what the rule does until you type your own. To change the order, drag a rule by its handle, use the arrow buttons, or press Space on the handle and move it with the arrow keys; the new order goes through the review like any other change.

A rule can be turned off. It stays in the list and is skipped. For a home network that a phone should reach through the node, see [Home network](../home-network/).

### Profiles

The profiles tab has one profile for each Veilway inbound, made from the node's config. Apps get these profiles through their subscription once you publish them. A profile is ready when it has what it needs. The panel lists what is still missing for each one: the inbound's public key, the transport's public key for `tls` and `ws`, and the node's public address, which you set under **Subscriptions**. Choose **Publish profiles** when all are ready. Apps pick up the change at their next refresh.

### Node links

A node link joins this node to another node, so users here can leave from there, or users there can leave from here. The two operators pair the nodes in four steps:

1. One operator chooses **Make an offer**. They pick the inbound the link connects to, the direction, the transports, and the tunnel addresses. They choose how long the offer stays open, then send the offer code to the other operator. The offer holds no secret, but send it over a channel you trust.
2. The other operator chooses **Paste an offer**, and reads it. The panel shows where their node would connect before anything is answered. They accept, and send back an answer code.
3. The first operator chooses **Paste the answer**, and takes it.
4. Both operators call each other and **compare fingerprints**. Each reads their own eight groups aloud and types the other side's groups. If a code changed on the way, the groups will not match. Confirm the pairing only when they match.

The two directions are:

- **Users there leave here.** This node is the exit, and the other node dials in.
- **Users here leave there.** This node is the entry, and the other node dials in. Use it when this node cannot be reached from the other one.

The tunnel addresses must come from a network that no inbound pool on either node uses. A private address works only when both nodes share that network. If a transport is WebSocket, it runs through the other operator's web server, which can see the timing of the traffic.

A link is shown as **Up**, **Connecting**, **Unreachable**, **Refused** or **Ended**. **Drop the pairing** removes it.

**Manage** on a link changes it after pairing. **Link on** turns it off without losing its keys: it neither dials nor answers until you turn it on again. On the node that is the exit you also set where the link's traffic leaves when no rule names an exit, which exits it may use, whether rules may reach private networks through it, how many connections it may hold at once, a quota and its period. On both sides you can set an expiry and the MTU. **Remove** asks you to confirm with the other node's name and then goes through the review. The other node keeps its half until its operator removes it there, and linking again needs a new pairing.

### Notices

**Notices to users** on the dashboard holds up to four short notices, each an information or a warning. Connected apps show them within seconds, in the language you write them in. The text is one line of up to 280 bytes; a Persian letter takes two. The editor counts the bytes as you type and shows the notice the way apps show it. Changes go through the same review as the rest of the node's config.

### DNS and logs

The **DNS and logs** page holds three parts, each applied on its own through the review.

- **DNS**: the resolvers the node asks for every tunnel, one to four, tried in order. **Answer every DNS question** answers DNS that an app sends to any server on port 53 at the node, so it cannot slip around these resolvers. **Resolvers for some users** sends the users, groups or inbounds a set names to their own resolvers. A set that names a user wins over one that names their group, which wins over one that names the inbound. Sets need **Answer every DNS question** on.
- **Node log**: how much the node writes to its log. **Log where users go** lets log lines name the sites and DNS names users reach. Anyone who can read the server's logs then learns where each user went, so turn it on only while you look for a problem.
- **Replay protection**: how many accepted proofs the obfuscated transports remember, and how many one source may bring. The number remembered takes effect after a node restart; the limits per source change at once.

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

You can set an expiry, and a list of allowed source addresses, one address or network per line. Leave the list empty to allow any address. The panel shows the token once, and keeps only a hash of it. Send it as a Bearer token.

**Revoke** stops the token at once. This cannot be undone. A token never reaches admin logins, signing keys, other tokens, or the routes that need a full admin session.

## Account

The **Account** page has five tabs.

- **Sessions** lists the browsers signed in to your account. You can end any session. This browser is marked.
- **Password and code** changes your password, or makes a new key for your authenticator app. Changing the password ends every other session. A new key stops the old one from working and ends every other session too.
- **Audit log** lists logins and every change made in the panel or through a token. The log never holds a link, token or key.
- **Backup and restore** is described under [Backups and secrets](#backups-and-secrets).
- **Display** sets the appearance (system, dark or light) and the language. In Persian, date fields use the Solar Hijri calendar, such as `1405/02/15`.

## The admin API

The admin API sits under `{prefix}/api`. Its description is at `{prefix}/api/openapi.json`, and it always matches the running code, because one route table builds both the router and that file.

A browser uses its session and sends a CSRF token with every change. A script uses an API token in a Bearer header:

```
curl -H "Authorization: Bearer <token>" https://panel.example.com/p-0123456789abcdef/api/users
```

Each operation in the file says what it needs, in its `x-access` field:

- `read`, `users` and `full` are the token scopes above.
- `session` and `session-reauth` need a logged-in admin. A token never reaches them.
- `public` needs nothing.

## Backups and secrets

The panel keeps three files apart, each readable only by its owner:

- The database holds no key.
- `panel.keys` holds the keys for sealed secrets.
- `signing.keys` holds the subscription signing keys.

Back up `panel.keys` as well as the database. Without `panel.keys`, the subscription endpoint answers like an unknown path, and no secret can be opened. The install script's [backup](../../getting-started/) includes all of these files, so keep the archive private.

Passwords are hashed with Argon2id. Admin sign-in asks for a code as well as the password.

### Backup and restore from the panel

On **Account**, **Backup and restore** makes one `.vwbackup` file with a consistent copy of the database, `panel.keys` and `signing.keys`. You choose a passphrase of at least 12 characters, and the file is encrypted with it (Argon2id and ChaCha20-Poly1305). Both actions ask you to confirm your password and code again, and both are written to the audit log. No API token can use them.

The file holds every user's secrets and the panel's keys. Keep it private. A lost passphrase cannot be recovered, and without it the file is useless.

To restore, pick the file and enter its passphrase. The panel checks the file before it changes anything, saves the current database and keys in a `pre-restore-<time>` folder next to the database, swaps the files in, and restarts. The panel stops with a failure code so that the service manager (the install script sets `Restart=on-failure`) starts it again on the restored files. Every session ends, so you sign in again with an admin from the backup. A backup from a newer panel is refused.

### Updating the panel

The panel checks GitHub for a newer release at start and every 6 hours (set `update_check` to `false` in `panel.json` to turn this off). When one exists, a banner shows "Veilway Panel <version> is available" with a link to the release notes and an **Update** button. The button needs a recent re-authentication and is audited, and no API token can use it.

The panel never updates itself. It writes the word `panel` to a file in `/var/lib/veilway-panel-update/`, and a root service started by a systemd path unit deletes the file and runs `veilway.sh update panel --yes`, which checks the release signature before it installs. Nothing in the file is used except that word. Servers installed before this feature need `sudo bash veilway.sh update panel` once to get the service.

