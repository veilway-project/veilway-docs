---
title: Getting started
description: Installing the Veilway alpha's node and panel with the install script, or with Docker.
---

This page installs the alpha, `v0.2.5-alpha`. Its files come from the [core release page](https://github.com/veilway-project/veilway/releases) and the [panel release page](https://github.com/veilway-project/veilway-panel/releases). For what the alpha includes and where it is still limited, read [the alpha release](../alpha/) first.

## What you need

- A Linux server with systemd, on x86_64 or aarch64, that you can reach from the internet on the ports you choose.
- Root access (`sudo`) and `curl`. The script installs `minisign` from your package manager if it is missing.
- For the panel: a domain name that points at the server. The script can set up the web server and its certificate for you (see [Put a web server in front](#put-a-web-server-in-front)), or you can bring your own.

## Install with the script

The script is the recommended way to install. It installs the node, the panel or both, and it checks every download before it installs it.

The one-line install:

```
curl -fsSL https://raw.githubusercontent.com/veilway-project/veilway/main/scripts/veilway.sh | sudo bash
```

To get the menu, or to pass a command, download the file first:

```
curl -fsSL -o veilway.sh https://raw.githubusercontent.com/veilway-project/veilway/main/scripts/veilway.sh
sudo bash veilway.sh
```

Choose `1` (Install), then `node`, `panel` or `both`. The default is `both`. To skip the menu, run `sudo bash veilway.sh install both`.

### What the install puts on the server

- The node, `/usr/local/bin/veilway`, and its service, `veilway.service`.
- The panel, `/usr/local/bin/veilway-panel`, and its service, `veilway-panel.service`.
- Two system users with no login shell: `veilway` for the node and `veilway-panel` for the panel.
- The config folder `/etc/veilway`, and the data folders `/var/lib/veilway` and `/var/lib/veilway-panel`.
- A copy of the example config from the release, and, if the node has no config yet, a starting config.

### The menu

Run the script with no arguments to get this menu:

| Key | Action | Command |
|---|---|---|
| 1 | Install | `install node\|panel\|both` |
| 2 | Update | `update` (both) |
| 3 | Status | `status` |
| 4 | Logs | `logs node` or `logs panel` |
| 5 | Restart | `restart` (both) |
| 6 | Check | `check` |
| 7 | Doctor | `doctor` |
| 8 | Backup | `backup` |
| 9 | Restore | `restore <file>` |
| 10 | Uninstall | `uninstall` |
| 11 | Add-ons | `addon xray status`, then asks whether to install or remove it |
| 12 | Admins | `admin list`, then asks for a username to give a new password |
| 0 | Quit | |

### Commands

| Command | What it does |
|---|---|
| `install node\|panel\|both\|mirror [--version vX.Y.Z]` | Installs the chosen parts from the latest release, or from the tag you give. `mirror` installs a relay mirror of the subscription endpoint, see [Relay mirrors](../manuals/panel/#relay-mirrors). |
| `install panel\|both --domain <name> [--web caddy\|nginx]` | Also sets up a web server with HTTPS for that domain, and a plain site for every path that is not the panel's. See [Put a web server in front](#put-a-web-server-in-front). |
| `update [node\|panel\|mirror\|both]` | Installs the latest release, or the tag you give, and restarts the service. It also replaces the saved installer, `/usr/local/sbin/veilway.sh`, with the signed one of the same release, never with an older one. The panel's update buttons run this for the panel, the node or both, see [Updating the panel](../manuals/panel/#updating-the-panel). |
| `status` | Shows the state of each service, its version, and the config and state folders. Does not need root. With root it also shows the panel's admin pages address, its subscription path and the admin usernames. |
| `logs [node\|panel\|mirror]` | Follows the last 100 journal lines of the service. |
| `restart [node\|panel\|mirror\|both]` | Restarts the service. A node restart drops every live tunnel for a moment. |
| `check` | Runs `veilway check` on the node's config. |
| `doctor` | Runs `veilway doctor` on the node with the service's own paths. It only reads. |
| `backup [file]` | Writes a `tar.gz` of the config, the node's usage state, the panel's data and the mirror's config. The archive holds keys, and `gateway.next` too while it is still on the server, so keep it private. |
| `restore <file>` | Restores a backup after you confirm. It saves the current files first. |
| `panel-prefix [/path]` | Moves the admin pages to a new path, random when none is given. It prints the lines to change in your web server, and puts the old path back if the panel does not start. |
| `admin [list\|reset <username>]` | `list` shows the panel's admin usernames. `reset` asks twice for a new password of 12 characters or more and gives it to that admin, for when you are locked out. It signs the admin out everywhere and keeps their authenticator key and API tokens. Needs panel v0.2.5 or later. |
| `addon xray [install\|remove\|status]` | Installs, removes or shows the Xray add-on. `install` is the default. It downloads one pinned release of the official Xray-core, refuses it unless its SHA-256 matches the one built into the script, and puts the `xray` executable in `/usr/local/lib/veilway/addons/xray`, owned by root. Xray then runs as its own user, `veilway-xray`, and the node starts it when its config has an Xray inbound. See [Xray add-on](../manuals/xray/). |
| `mirror-sync <folder> [--version vX.Y.Z]` | Copies a release of the node and of the panel, with their signatures and the signed `latest` pointers, into a folder laid out as GitHub does. Every file is checked first. Serve the folder, or carry it on a USB stick. See [Installing from a mirror](#installing-from-a-mirror). Needs no root. |
| `uninstall` | Removes the binaries, the units and the installer itself. It asks before it deletes the config and data. Backups stay, and so does a web server setup until `uninstall web`, with the installer it needs for that. |
| `uninstall web` | Takes back what `--domain` set up: the site file, the plain site if you did not edit it, the panel's `not_found`, and the packages the script installed. |
| `version` | Prints the script, node and panel versions. |

Flags:

- `--dry-run` prints what the command would do and changes nothing.
- `--yes` (or `-y`) answers every question with its default.
- `--version <tag>` picks a release tag instead of the latest.
- `--allow-downgrade` lets `--version` name a tag older than the installed one. Without it the script refuses, and it warns when you use it.
- `--mirror <url>` installs from a mirror (repeat it for several), see [Installing from a mirror](#installing-from-a-mirror). `--mirror-only` never falls back to GitHub.
- `--domain <name>` and `--web caddy|nginx` set up a web server for the panel. `caddy` is the default.

Environment:

- `NO_COLOR` turns off colors.
- `VEILWAY_PANEL_PORT` sets the panel's port. The default is `8480`.
- `VEILWAY_MIRRORS` lists mirror addresses separated by spaces, tried after any `--mirror`.

### Checked downloads

Every download comes with a minisign signature. The script checks it against a public key built into the script, and it stops if the check fails. The signature's trusted comment must read `veilway <tag> <asset>` for the node and `veilway-panel <tag> <asset>` for the panel, so a signature for one file cannot be used for another. Nothing is installed without that check.

If your package manager has no `minisign`, install it from [minisign.org](https://jedisct1.github.io/minisign/) and run the script again.

## Set up the node

A fresh `install node` writes `/etc/veilway/node/config.json` if the file does not exist. It is owned by `veilway` and its mode is `0600`. The starting config has:

- one exit named `This server`, which leaves through the node's own connection,
- no inbound, so no device can connect yet,
- no users,
- two routing rules: one refuses traffic between users, and one refuses private addresses.

The script checks the config with `veilway check`, and it starts the node only if the check passes. If the check fails, the node is left stopped and the script says why.

A node with no inbound does nothing useful yet. Add one in the panel: open **Node**, then **Inbounds**. The panel asks for the inbound's private key, which you make on the node with `veilway genkey`. The [panel manual](../manuals/panel/) describes the rest, including users, subscriptions and publishing profiles.

To check the config at any time, run `sudo bash veilway.sh check`.

## Set up the panel

`install panel` writes `/etc/veilway/panel.json` once. An existing file is never changed. The panel listens on `127.0.0.1:8480` only, its cookies are marked secure, and its admin path is random, such as `/3f9c0a7e21b84d65`. To move the admin pages later, run `sudo bash veilway.sh panel-prefix [/new-path]`.

The script prints the admin path and a one-time setup token at the end of the install. To read the token again, run:

```
sudo journalctl -u veilway-panel -o cat | grep 'Setup token' | tail -n 1
```

The panel prints the token only while no admin account exists. Every start of the panel before that, a restart or a reinstall included, prints a new token, and the earlier ones stop working: use the last one. Keep it private.

### Put a web server in front

The panel has no TLS of its own, so a web server must serve it over HTTPS. There are two ways: let the script do it, or do it by hand.

#### The automatic way

Point a domain name at the server (an A record, and an AAAA record if the server has IPv6), then add `--domain`:

```
sudo bash veilway.sh install panel --domain panel.example.com
```

`install both` takes it too. Without `--domain`, a script that runs in a terminal asks whether you want a web server, and for the domain. With `--yes` it never asks.

`--https-port <port>` puts the HTTPS site on a port other than 443, for example `--https-port 8443`. The panel is then at `https://panel.example.com:8443/<prefix>/`. Port 80 must stay reachable either way, because the certificate is checked over it. A node TCP transport that listens on that port moves to 8443 (to 8444 when you chose 8443), as described for port 443 below. A re-run without the flag keeps the port it was set up with.

What it does, on Debian and Ubuntu:

1. **Installs Caddy**, from the system packages if they are version 2.6 or newer, otherwise from Caddy's own apt repository with its signing key. `--web nginx` installs nginx and certbot (`python3-certbot-nginx`) instead.
2. **Writes the site as a file of its own.** For Caddy that is `/etc/caddy/conf.d/veilway-panel.caddy`, and the script adds one line, `import /etc/caddy/conf.d/*.caddy`, to the end of `/etc/caddy/Caddyfile`. A Caddyfile you already have is kept as it is, and a copy goes to `/var/backups/veilway` first. For nginx the file is `/etc/nginx/conf.d/veilway-panel.conf`.
3. **Forwards the panel's two paths**, the admin prefix and the subscription path, which it reads from `panel.json`, to the panel on `127.0.0.1:8480`.
4. **Serves a plain site everywhere else**: one ordinary page in `/var/www/veilway-site`, with no Veilway name or text. It is yours to edit or replace, and the script never overwrites it.
5. **Sets the panel's `not_found` to the web server's own 404 answer**, so a stranger cannot tell the panel's paths from any other missing page.
6. **Gets a certificate.** Caddy does it by itself, and renews it. For nginx, certbot does it once and its timer renews it. Both need the domain to point at this server and port 80 to be reachable. If certbot fails, the script says so and the site answers on http only until you run `sudo certbot --nginx -d panel.example.com`.

If a web server already runs on the server, or something else holds port 80 or 443, the script explains and stops before it changes anything. It never stops or replaces a server it did not install. If Caddy (or nginx, with `--web nginx`) already runs, it asks before it adds its one file and import line, and `--yes` answers yes.

**Port 443 and the node.** A node with a `tls` transport on port 443 holds the port the web server needs. The script's choice is the safe one: the web server takes 443 and the node's TCP transports on 443 move to 8443. The script asks first (`--yes` answers yes), backs up the node's config, checks the changed config, restarts the node, and restores the old config if anything fails. **Profiles that name port 443 stop working until you publish them again in the panel.** The other design, the node keeping 443 and the web server behind it, was not built: the node could not read the web server's certificate files, because its sandbox and their owner both forbid it. To keep the node on 443, do not use `--domain`: put the web server on another port or host by hand.

`sudo bash veilway.sh uninstall web` takes it back: the site file, the import line, the plain site if it is unchanged, the panel's `not_found`, and the packages the script installed. The node's moved transports stay on 8443.

#### By hand

The examples use `panel.example.com`, the admin path `/3f9c0a7e21b84d65` and the subscription path `/sub`. Use your own domain and your own admin path.

For nginx, the script prints this block with your admin path filled in:

```
location ~ ^(/3f9c0a7e21b84d65|/sub)(/|$) {
    proxy_pass http://127.0.0.1:8480;
    client_max_body_size 100m;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

For Caddy, use:

```
panel.example.com {
    handle /3f9c0a7e21b84d65/* {
        reverse_proxy 127.0.0.1:8480
    }
    handle /sub/* {
        reverse_proxy 127.0.0.1:8480
    }
}
```

Then open `https://panel.example.com/3f9c0a7e21b84d65/`, enter the setup token with a username and a password, accept the [operator terms](../legal/operator-terms/), and follow the [panel manual](../manuals/panel/). With the manual way, set the panel's `not_found` to your web server's own 404 page, so a stranger cannot tell the subscription path from any other missing path.

## Installing from a mirror

A mirror is a copy of the release files on a server people can reach, for networks that block GitHub. Anyone can run one ([host a release mirror](../guides/release-mirror/)), and you do not have to trust it: the installer checks every file against the key built into the script, whichever mirror it came from.

```
sudo bash veilway.sh install node --mirror https://mirror.example.org
```

- `--mirror <url>` can be repeated. The mirrors are tried in order for each download, and GitHub is the last resort. `--mirror-only` never falls back to GitHub. Without `--mirror`, `VEILWAY_MIRRORS` (addresses separated by spaces) does the same.
- Only `https://` addresses work. `http://` is accepted for `127.0.0.1`, `localhost` and `[::1]`, for tests.
- The layout is GitHub's: `<mirror>/<owner>/<repo>/releases/download/<tag>/<file>`.
- A mirror that is down, blocked or gives a file that fails its signature is passed over with a warning, and the next one is tried.
- Without `--version`, the newest tag comes from a signed pointer file, `latest-veilway.txt` (`latest-veilway-panel.txt` for the panel), read from the mirrors first and from GitHub's `releases/latest/download/` address after. The script refuses a pointer older than what is installed, so a stale mirror cannot roll you back. A tag older than the installed one needs `--version <tag> --allow-downgrade`.
- Releases from before the pointer existed have none. The script then asks GitHub for the latest release, unless you gave `--mirror-only`: use `--version` there.
- The Xray add-on and the example config still come from GitHub.

### Get the script from a mirror

The installer itself is on the mirror too, signed. Fetch it and check it by hand before you run it. This needs `minisign` (`apt install minisign`):

```
curl -fsSLO https://mirror.example.org/veilway.sh
curl -fsSLO https://mirror.example.org/veilway.sh.minisig
minisign -V -m veilway.sh -x veilway.sh.minisig -P RWQiodKlFCiJ3bkZD3ojKV7AYyTYf3F5x/XY8upWvpSFTVm3O2cNRbrV
```

The output must say `Signature and comment signature verified` and a `Trusted comment:` of `veilway <tag> veilway.sh`. Only then run it:

```
sudo bash veilway.sh install both --mirror https://mirror.example.org
```

Do not pipe a script from a mirror straight into `bash`: check it first.

### Make a folder to serve or carry

`mirror-sync` makes the same layout from a machine that can reach GitHub (or another mirror), for a web server or a USB stick:

```
bash veilway.sh mirror-sync ./veilway-mirror
bash veilway.sh mirror-sync ./veilway-mirror --version v0.2.5-alpha
```

It downloads the node's and the panel's files with their signatures and the pointers, verifies each one before it stores it, and puts `veilway.sh` at the top of the folder. It keeps a newer pointer that is already there. It does not write the browsable `index.html` that [`veilway-release-mirror`](../guides/release-mirror/) writes.

## Install with Docker

Docker is an alternative to the script. The alpha's images are on GitHub Container Registry, for linux/amd64 and linux/arm64:

- `ghcr.io/veilway-project/veilway`, the node
- `ghcr.io/veilway-project/veilway-panel`, the panel

Each `v*` release tag publishes both images with a version tag and `latest`.

The core repository's `deploy/compose` folder runs the node and the panel together, with a shared volume for the node's control socket. Its README has the full steps, including the exact commands that copy the config and the panel config into the volumes. In short:

1. Write the node config from `config.example.json`. The `ws` transport listens on port 8443 in the container, and Compose publishes host port 443 to it.
2. Make the keys with `docker compose run --rm --no-deps --entrypoint veilway node genkey`.
3. Copy the node config and the panel config into their volumes, and set the owner to uid `65532`, which the images run as.
4. Write `panel.json` with a random `prefix` and `listen` set to `127.0.0.1:8480`.
5. Start the stack and check it with `docker compose up -d` and `docker compose ps`. The panel shows as `healthy` once port 8480 accepts connections.

The panel uses host networking. It listens on loopback only, and a container's loopback cannot be reached from the host, so host networking is how the host reaches it. Put a web server with TLS in front of it, as described above.

### Docker notes

- `docker compose down -v` deletes the volumes, which hold the keys and the usage state. Keep the volumes when you stop the stack.
- Only an `l3` exit needs more rights. It needs the node to run as root with `NET_ADMIN` and the TUN device. Add these lines under `node` in `docker-compose.yml`:

  ```yaml
      user: "0"
      cap_add: [NET_ADMIN]
      devices: ["/dev/net/tun"]
  ```

  Exits that use `netstack` need none of this.
- Each WireGuard UDP port in the config needs its own line under `ports` on the node.

## Where files live

| Path | What it holds |
|---|---|
| `/usr/local/bin/veilway` | The node binary |
| `/usr/local/bin/veilway-panel` | The panel binary |
| `/etc/veilway/node/config.json` | The node's config. Owner `veilway`, mode `0600` |
| `/etc/veilway/config.example.json` | The example config from the release |
| `/etc/veilway/panel.json` | The panel's config |
| `/var/lib/veilway/veilway-state.json` | The node's usage state |
| `/var/lib/veilway/veilway-replay` | The node's replay memory |
| `/var/lib/veilway-panel/panel.db` | The panel's database |
| `/var/lib/veilway-panel/panel.keys` | The panel's keys for sealed secrets |
| `/var/lib/veilway-panel/signing.keys` | The subscription signing keys |
| `/var/lib/veilway-panel/gateway.keys` | The gateway keys that open subscription requests |
| `/var/lib/veilway-panel/gateway.next` | The next gateway key's private half, until you move it off the server |
| `/etc/veilway-mirror/mirror.json` | A relay mirror's config, if you installed one |
| `/usr/local/lib/veilway/addons/xray` | The Xray add-on, if you installed it |
| `/run/veilway/control.sock` | The node's control socket, group `veilway` |
| `/etc/systemd/system/veilway.service` | The node's unit |
| `/etc/systemd/system/veilway-panel.service` | The panel's unit |
| `/var/backups/veilway` | Backups, and copies the script makes before it overwrites a file |

The installed versions are kept in `/var/lib/veilway/node.version` and `/var/lib/veilway-panel/panel.version`.

## Next

- [The alpha release](../alpha/): what is in the alpha and what is still limited.
- [Client manual](../manuals/client/): the desktop app for Linux, macOS and Windows.
- [Android app](../manuals/android/): installing and using the Android app.
- [Home network](../manuals/home-network/): reaching devices on your home network through your node.
- [Set up an entry node](../guides/entry-node/): keeping users connected when international links are cut, with a second server abroad.
