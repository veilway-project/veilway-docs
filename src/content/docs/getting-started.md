---
title: Getting started
description: Installing the Veilway alpha's node and panel with the install script, or with Docker.
---

This page installs the alpha, `v0.2.17-alpha`. The files come from the [core release page](https://github.com/veilway-project/veilway/releases) and the [panel release page](https://github.com/veilway-project/veilway-panel/releases). Read [the alpha release](../alpha/) first to see what the alpha includes and where it is limited.

## What you need

- A Linux server with systemd, on x86_64 or aarch64, reachable from the internet on the ports you choose.
- Root access (`sudo`) and `curl`. The script installs `minisign` from your package manager if it is missing.
- For the panel: a domain name that points at the server. The script can set up the web server and its certificate (see [Put a web server in front](#put-a-web-server-in-front)), or you can bring your own.

## Install with the script

The script is the recommended way to install. It installs the node, the panel or both, and checks every download before it installs it.

The one-line install:

```
curl -fsSL https://raw.githubusercontent.com/veilway-project/veilway/main/scripts/veilway.sh | sudo bash
```

To get the menu or pass a command, download the file first:

```
curl -fsSL -o veilway.sh https://raw.githubusercontent.com/veilway-project/veilway/main/scripts/veilway.sh
sudo bash veilway.sh
```

Choose `1` (Install), then `node`, `panel` or `both` (the default). To skip the menu, run `sudo bash veilway.sh install both`.

### What the install puts on the server

- The node, `/usr/local/bin/veilway`, and its service, `veilway.service`.
- The panel, `/usr/local/bin/veilway-panel`, and its service, `veilway-panel.service`.
- Two system users with no login shell: `veilway` for the node and `veilway-panel` for the panel.
- The config folder `/etc/veilway`, and the data folders `/var/lib/veilway` and `/var/lib/veilway-panel`.
- A copy of the example config from the release, and a starting config if the node has none yet.

### The menu

Run the script with no arguments for this menu:

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
| `install node\|panel\|both\|mirror [--version vX.Y.Z]` | Installs the chosen parts from the latest release, or from the tag you give. `mirror` installs a relay mirror of the subscription endpoint. See [Relay mirrors](../manuals/panel/#relay-mirrors). |
| `install panel\|both --domain <name> [--web caddy\|nginx]` | Also sets up a web server with HTTPS for that domain, and a plain site for every path that is not the panel's. See [Put a web server in front](#put-a-web-server-in-front). |
| `update [node\|panel\|mirror\|both]` | Installs the latest release, or the tag you give, and restarts the service. It also replaces the saved installer, `/usr/local/sbin/veilway.sh`, with the signed one of the same release, never an older one. The panel's update buttons run this for the panel, the node or both. See [Updating the panel](../manuals/panel/#updating-the-panel). |
| `status` | Shows each service's state and version, and the config and state folders. Does not need root. With root it also shows the panel's admin pages address, its subscription path and the admin usernames. |
| `logs [node\|panel\|mirror]` | Follows the last 100 journal lines of the service. |
| `restart [node\|panel\|mirror\|both]` | Restarts the service. A node restart drops every live tunnel for a moment. |
| `check` | Runs `veilway check` on the node's config. |
| `doctor` | Runs `veilway doctor` on the node with the service's own paths. It only reads. |
| `backup [file]` | Writes a `tar.gz` of the config, the node's usage state, the panel's data and the mirror's config. The archive holds keys, and `gateway.next` while it is still on the server, so keep it private. |
| `restore <file>` | Restores a backup after you confirm. It saves the current files first. |
| `panel-prefix [/path]` | Moves the admin pages to a new path, random if you give none. It prints the lines to change in your web server, and restores the old path if the panel does not start. |
| `admin [list\|reset <username>]` | `list` shows the panel's admin usernames. `reset` is for when you are locked out. It asks twice for a new password of 12 characters or more and gives it to that admin. It signs the admin out everywhere and keeps their authenticator key and API tokens. Needs panel v0.2.5 or later. |
| `addon xray [install\|remove\|status]` | Installs, removes or shows the Xray add-on. `install` is the default. It downloads one pinned release of the official Xray-core and refuses it unless its SHA-256 matches the one built into the script. It puts the `xray` executable in `/usr/local/lib/veilway/addons/xray`, owned by root. Xray runs as its own user, `veilway-xray`, and the node starts it when its config has an Xray inbound. See [Xray add-on](../manuals/xray/). |
| `mirror-sync <folder> [--version vX.Y.Z]` | Copies a release of the node and of the panel, with their signatures and the signed `latest` pointers, into a folder laid out as GitHub lays it out. It checks every file first. Serve the folder, or carry it on a USB stick. See [Installing from a mirror](#installing-from-a-mirror). Needs no root. |
| `uninstall` | Removes the binaries, the units and the installer itself. It asks before it deletes the config and data. Backups stay. A web server setup stays until `uninstall web`, with the installer it needs for that. |
| `uninstall web` | Undoes what `--domain` set up: the site file, the plain site if you did not edit it, the panel's `not_found`, and the packages the script installed. |
| `version` | Prints the script, node and panel versions. |

Flags:

- `--dry-run` prints what the command would do and changes nothing.
- `--yes` (or `-y`) answers every question with its default.
- `--version <tag>` picks a release tag instead of the latest.
- `--allow-downgrade` lets `--version` name a tag older than the installed one. Without it the script refuses. It warns when you use the flag.
- `--mirror <url>` installs from a mirror (repeat it for several). See [Installing from a mirror](#installing-from-a-mirror). `--mirror-only` never falls back to GitHub.
- `--domain <name>` and `--web caddy|nginx` set up a web server for the panel. `caddy` is the default.

Environment:

- `NO_COLOR` turns off colors.
- `VEILWAY_PANEL_PORT` sets the panel's port. The default is `8480`.
- `VEILWAY_MIRRORS` lists mirror addresses separated by spaces. They are tried after any `--mirror`.

### Checked downloads

Every download comes with a minisign signature. The script checks it against a public key built into the script and stops if the check fails. The signature's trusted comment must read `veilway <tag> <asset>` for the node and `veilway-panel <tag> <asset>` for the panel, so a signature for one file cannot be used for another. Nothing is installed without that check.

If your package manager has no `minisign`, install it from [minisign.org](https://jedisct1.github.io/minisign/) and run the script again.

## Set up the node

A fresh `install node` writes `/etc/veilway/node/config.json` if the file does not exist. The owner is `veilway` and the mode is `0600`. The starting config has:

- one exit named `This server`, which leaves through the node's own connection
- no inbound, so no device can connect yet
- no users
- two routing rules: one refuses traffic between users, and one refuses private addresses.

The script checks the config with `veilway check` and starts the node only if the check passes. If the check fails, the node stays stopped and the script says why.

A node with no inbound does nothing useful yet. Add one in the panel under **Inbounds**. The **Generate** button next to the inbound's private key makes a key, and the panel fills in the public half. The guide [First inbound and user](../guides/first-user/) goes from the panel's first sign-in to a user's link, step by step. The [panel manual](../manuals/panel/) describes the rest.

To check the config at any time, run `sudo bash veilway.sh check`.

## Set up the panel

`install panel` writes `/etc/veilway/panel.json` once and never changes an existing file. The panel listens on `127.0.0.1:8480` only, its cookies are marked secure, and its admin path is random, such as `/3f9c0a7e21b84d65`. To move the admin pages later, run `sudo bash veilway.sh panel-prefix [/new-path]`.

At the end of the install, the script prints the admin path and a one-time setup token. To read the token again, run:

```
sudo journalctl -u veilway-panel -o cat | grep 'Setup token' | tail -n 1
```

The panel prints the token only while no admin account exists. Every panel start before that, including a restart or reinstall, prints a new token, and the earlier ones stop working. Use the last one. Keep it private.

### Put a web server in front

The panel has no TLS of its own, so a web server must serve it over HTTPS. Let the script do it, or do it by hand.

#### The automatic way

Point a domain name at the server (an A record, and an AAAA record if the server has IPv6), then add `--domain`:

```
sudo bash veilway.sh install panel --domain panel.example.com
```

`install both` takes it too. Without `--domain`, a script that runs in a terminal asks whether you want a web server, and for the domain. With `--yes` it never asks.

`--https-port <port>` puts the HTTPS site on a port other than 443, for example `--https-port 8443`. The panel is then at `https://panel.example.com:8443/<prefix>/`. Port 80 must stay reachable either way, because the certificate is checked over it. A node TCP transport that listens on that port moves to 8443 (to 8444 if you chose 8443), as described for port 443 below. A re-run without the flag keeps the port it was set up with.

What it does, on Debian and Ubuntu:

1. **Installs Caddy** from the system packages if they are version 2.6 or newer, otherwise from Caddy's own apt repository with its signing key. `--web nginx` installs nginx and certbot (`python3-certbot-nginx`) instead.
2. **Writes the site as its own file.** For Caddy that is `/etc/caddy/conf.d/veilway-panel.caddy`, and the script adds one line, `import /etc/caddy/conf.d/*.caddy`, to the end of `/etc/caddy/Caddyfile`. It keeps an existing Caddyfile as it is, after copying it to `/var/backups/veilway`. For nginx the file is `/etc/nginx/conf.d/veilway-panel.conf`.
3. **Forwards the panel's two paths** to the panel on `127.0.0.1:8480`: the admin prefix and the subscription path, both read from `panel.json`.
4. **Serves a plain site everywhere else**: one ordinary page in `/var/www/veilway-site`, with no Veilway name or text. Edit or replace it as you like. The script never overwrites it. The same site is also served over plain HTTP on `127.0.0.1:8080` (this machine only, in the same site file). That is the default decoy origin of a node's `tls`, `ws` and `fronted` transports, so a stranger who reaches the node gets the same page. If something else holds that port, the script says so and skips it. `VEILWAY_DECOY_PORT=<port>` picks another port.

This site file does not forward a `ws` or `fronted` transport yet. Add its path to the file. The panel shows the exact Caddy and nginx lines under the transport (see [Web server lines](../manuals/panel/)). Reload the web server after you add them.
5. **Sets the panel's `not_found` to the web server's own 404 answer**, so a stranger cannot tell the panel's paths from any other missing page.
6. **Gets a certificate.** Caddy gets and renews it by itself. For nginx, certbot gets it once and its timer renews it. Both need the domain to point at this server and port 80 to be reachable. If certbot fails, the script says so and the site answers on http only until you run `sudo certbot --nginx -d panel.example.com`.

If a web server already runs on the server, or something else holds port 80 or 443, the script explains and stops before it changes anything. It never stops or replaces a server it did not install. If Caddy (or nginx, with `--web nginx`) already runs, the script asks before it adds its one file and import line. `--yes` answers yes.

**Port 443 and the node.** A node with a `tls` transport on port 443 holds the port the web server needs. The script takes the safe choice: the web server takes 443, and the node's TCP transports on 443 move to 8443. The script asks first (`--yes` answers yes), backs up the node's config, checks the changed config, restarts the node, and restores the old config if anything fails. **Profiles that name port 443 stop working until you publish them again in the panel.** The other design, with the node keeping 443 and the web server behind it, is not built. The node could not read the web server's certificate files, because its sandbox and their owner both forbid it. To keep the node on 443, do not use `--domain`. Put the web server on another port or host by hand.

`sudo bash veilway.sh uninstall web` undoes it: the site file, the import line, the plain site if unchanged, the panel's `not_found`, and the packages the script installed. The node's moved transports stay on 8443.

For a web server setup made before v0.2.15, `sudo bash veilway.sh update` adds the decoy site on `127.0.0.1:8080` in its own file: `/etc/caddy/conf.d/veilway-decoy.caddy` with Caddy, `/etc/nginx/conf.d/veilway-decoy.conf` with nginx. `uninstall web` removes that file too.

#### By hand

The examples use `panel.example.com`, the admin path `/3f9c0a7e21b84d65` and the subscription path `/sub`. Replace them with your own domain and admin path.

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

A mirror is a copy of the release files on a server people can reach, for networks that block GitHub. Anyone can run one ([host a release mirror](../guides/release-mirror/)). You do not have to trust it: the installer checks every file against the key built into the script, whichever mirror it came from.

```
sudo bash veilway.sh install node --mirror https://mirror.example.org
```

- `--mirror <url>` can be repeated. The mirrors are tried in order for each download, and GitHub is the last resort. `--mirror-only` never falls back to GitHub. Without `--mirror`, `VEILWAY_MIRRORS` (addresses separated by spaces) does the same.
- Only `https://` addresses work. `http://` is accepted for `127.0.0.1`, `localhost` and `[::1]`, for tests.
- The layout is GitHub's: `<mirror>/<owner>/<repo>/releases/download/<tag>/<file>`.
- If a mirror is down, blocked or serves a file that fails its signature, the script warns and tries the next one.
- Without `--version`, the newest tag comes from a signed pointer file, `latest-veilway.txt` (`latest-veilway-panel.txt` for the panel). The script reads it from the mirrors first, then from GitHub's `releases/latest/download/` address. The script refuses a pointer older than the installed version, so a stale mirror cannot roll you back. A tag older than the installed one needs `--version <tag> --allow-downgrade`.
- Releases from before the pointer existed have none. The script then asks GitHub for the latest release, unless you gave `--mirror-only`. In that case use `--version`.
- The Xray add-on and the example config still come from GitHub.

### Get the script from a mirror

The mirror also holds the signed installer. Fetch it and check it by hand before you run it. This needs `minisign` (`apt install minisign`):

```
curl -fsSLO https://mirror.example.org/veilway.sh
curl -fsSLO https://mirror.example.org/veilway.sh.minisig
minisign -V -m veilway.sh -x veilway.sh.minisig -P RWQiodKlFCiJ3bkZD3ojKV7AYyTYf3F5x/XY8upWvpSFTVm3O2cNRbrV
```

The output must say `Signature and comment signature verified` and show a `Trusted comment:` of `veilway <tag> veilway.sh`. Only then run it:

```
sudo bash veilway.sh install both --mirror https://mirror.example.org
```

Do not pipe a script from a mirror straight into `bash`. Check it first.

### Make a folder to serve or carry

`mirror-sync` makes the same layout on a machine that can reach GitHub (or another mirror), for a web server or a USB stick:

```
bash veilway.sh mirror-sync ./veilway-mirror
bash veilway.sh mirror-sync ./veilway-mirror --version v0.2.17-alpha
```

It downloads the node's and the panel's files with their signatures and the pointers, verifies each file before it stores it, and puts `veilway.sh` at the top of the folder. It keeps a newer pointer that is already there. It does not write the browsable `index.html` that [`veilway-release-mirror`](../guides/release-mirror/) writes.

## Install with Docker

Docker is an alternative to the script. The alpha's images are on GitHub Container Registry, for linux/amd64 and linux/arm64:

- `ghcr.io/veilway-project/veilway`, the node
- `ghcr.io/veilway-project/veilway-panel`, the panel

Each `v*` release tag publishes both images with a version tag and `latest`.

The core repository's `deploy/compose` folder runs the node and the panel together, with a shared volume for the node's control socket. Its README has the full steps, including the exact commands that copy the configs into the volumes. In short:

1. Write the node config from `config.example.json`. The `ws` transport listens on port 8443 in the container, and Compose publishes host port 443 to it.
2. Make the keys with `docker compose run --rm --no-deps --entrypoint veilway node genkey`.
3. Copy the node config and the panel config into their volumes. Set the owner to uid `65532`, which the images run as.
4. Write `panel.json` with a random `prefix` and `listen` set to `127.0.0.1:8480`.
5. Start the stack with `docker compose up -d` and check it with `docker compose ps`. The panel shows as `healthy` once port 8480 accepts connections.

The panel uses host networking. It listens on loopback only, and the host cannot reach a container's loopback, so host networking is how the host reaches it. Put a web server with TLS in front of it, as described above.

### Docker notes

- `docker compose down -v` deletes the volumes, which hold the keys and the usage state. Keep the volumes when you stop the stack.
- Only an `l3` exit needs more rights: the node must run as root with `NET_ADMIN` and the TUN device. Add these lines under `node` in `docker-compose.yml`:

  ```yaml
      user: "0"
      cap_add: [NET_ADMIN]
      devices: ["/dev/net/tun"]
  ```

  `netstack` exits need none of this.
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

The installed versions are in `/var/lib/veilway/node.version` and `/var/lib/veilway-panel/panel.version`.

## Next

- [The alpha release](../alpha/): what the alpha includes and where it is limited.
- [Client manual](../manuals/client/): the desktop app for Linux, macOS and Windows.
- [Android app](../manuals/android/): installing and using the Android app.
- [Home network](../manuals/home-network/): reaching devices on your home network through your node.
- [Set up an entry node](../guides/entry-node/): keep users connected when international links are cut, with a second server abroad.
