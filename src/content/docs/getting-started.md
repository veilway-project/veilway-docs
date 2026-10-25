---
title: Getting started
description: Installing the Veilway alpha's node and panel with the install script, or with Docker.
---

This page installs the alpha, `v0.3.4-alpha`. Files come from the [core release page](https://github.com/veilway-project/veilway/releases) and the [panel release page](https://github.com/veilway-project/veilway-panel/releases). Read [the alpha release](../alpha/) first for what it includes and its limits.

## What you need

- A Linux server with systemd, x86_64 or aarch64, reachable from the internet on the ports you choose.
- Root access (`sudo`) and `curl`. The script installs `minisign` from your package manager if missing.
- For the panel: a domain name that points at the server. The script can set up the web server and certificate (see [Put a web server in front](#put-a-web-server-in-front)), or bring your own.

## Install with the script

The script is the recommended way. It installs the node, the panel or both, and checks every download first.

The one-line install:

```
curl -fsSL https://raw.githubusercontent.com/veilway-project/veilway/main/scripts/veilway.sh | sudo bash
```

For the menu or a command, download the file first:

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
- The release's example config, and a starting config if the node has none.

### The menu

Run the script with no arguments:

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
| `install node\|panel\|both\|mirror [--version vX.Y.Z]` | Installs the chosen parts from the latest release or the tag you give. `mirror` installs a relay mirror of the subscription endpoint. See [Relay mirrors](../manuals/panel/#relay-mirrors). |
| `install panel\|both --domain <name> [--web caddy\|nginx]` | Also sets up a web server with HTTPS for that domain, and a plain site for every other path. See [Put a web server in front](#put-a-web-server-in-front). |
| `install panel\|both --no-two-step` | A fresh install of the panel asks whether to ask for an authenticator code at sign-in, and the answer is yes unless you say no. This flag says no without asking. Not recommended: with it off, the admin password alone opens the panel. From v0.3.4. |
| `update [node\|panel\|mirror\|both]` | Installs the latest release or the tag you give, and restarts the service. It also replaces the saved installer, `/usr/local/sbin/veilway.sh`, with the signed one of the same release, never an older one. The panel's update buttons run it. See [Updating the panel](../manuals/panel/#updating-the-panel). |
| `status` | Shows each service's state and version, and the config and state folders. Needs no root. With root it also shows the panel's admin pages address, subscription path and admin usernames. |
| `logs [node\|panel\|mirror]` | Follows the last 100 journal lines of the service. |
| `restart [node\|panel\|mirror\|both]` | Restarts the service. A node restart drops every live tunnel for a moment. |
| `check` | Runs `veilway check` on the node's config. |
| `doctor` | Runs `veilway doctor` on the node with the service's own paths. It only reads. |
| `backup [file]` | Writes a `tar.gz` of the config, the node's usage state, the panel's data and the mirror's config. It holds keys, and `gateway.next` while that is still on the server, so keep it private. |
| `restore <file>` | Restores a backup after you confirm. It saves the current files first. |
| `panel-prefix [/path]` | Moves the admin pages to a new path, random if none is given. It prints the lines to change in your web server, and restores the old path if the panel does not start. |
| `admin [list\|reset <username>]` | `list` shows the admin usernames. `reset` is for a lockout: it asks twice for a new password of 12 characters or more, gives it to that admin and signs them out everywhere. Their authenticator key and API tokens stay. Needs panel v0.2.5 or later. |
| `addon xray [install\|remove\|status]` | Installs, removes or shows the Xray add-on. `install` is the default. It downloads one pinned release of the official Xray-core and refuses it unless its SHA-256 matches the one built into the script. The `xray` executable goes in `/usr/local/lib/veilway/addons/xray`, owned by root. Xray runs as its own user, `veilway-xray`, and the node starts it when its config has an Xray inbound. See [Xray add-on](../manuals/xray/). |
| `mirror-sync <folder> [--version vX.Y.Z]` | Copies a node and panel release, with signatures and the signed `latest` pointers, into a folder laid out like GitHub's, checking every file first. Serve the folder or carry it on a USB stick. See [Installing from a mirror](#installing-from-a-mirror). Needs no root. |
| `uninstall` | Removes the binaries, the units and the installer itself. It asks before deleting the config and data. Backups stay. A web server setup stays until `uninstall web`, which needs the installer. |
| `uninstall web` | Undoes what `--domain` set up: the site file, the plain site if you did not edit it, the panel's `not_found`, and the packages the script installed. |
| `version` | Prints the script, node and panel versions. |

Flags:

- `--dry-run` prints what the command would do and changes nothing.
- `--yes` (or `-y`) answers every question with its default.
- `--version <tag>` picks a release tag instead of the latest.
- `--allow-downgrade` lets `--version` name a tag older than the installed one. Without it the script refuses, and it warns when you use it.
- `--mirror <url>` installs from a mirror (repeat it for several). See [Installing from a mirror](#installing-from-a-mirror). `--mirror-only` never falls back to GitHub.
- `--domain <name>` and `--web caddy|nginx` set up a web server for the panel. `caddy` is the default.

Environment:

- `NO_COLOR` turns off colors.
- `VEILWAY_PANEL_PORT` sets the panel's port. The default is `8480`.
- `VEILWAY_MIRRORS` lists mirror addresses separated by spaces. They are tried after any `--mirror`.

### Checked downloads

Every download comes with a minisign signature. The script checks it against a public key built into the script and stops if it fails. The signature's trusted comment must read `veilway <tag> <asset>` for the node and `veilway-panel <tag> <asset>` for the panel, so one file's signature cannot vouch for another. Nothing installs without the check.

If your package manager has no `minisign` (Ubuntu 22.04, Debian 11), the script installs the author's minisign 0.11 release to `/usr/local/bin` and checks it against a SHA-256 pinned in the script first.

## Set up the node

A fresh `install node` writes `/etc/veilway/node/config.json` if missing, owned by `veilway`, mode `0600`. The starting config has:

- one exit named `This server`, which leaves through the node's own connection
- no inbound, so no device can connect yet
- no users
- two routing rules: one refuses traffic between users, and one refuses private addresses.

The script runs `veilway check` and starts the node only if it passes. If not, the node stays stopped and the script says why.

With no inbound the node does nothing yet. Add one in the panel under **Inbounds**. **Generate** next to the inbound's private key makes a key, and the panel fills in the public half. [First inbound and user](../guides/first-user/) goes from first sign-in to a user's link. The [panel manual](../manuals/panel/) covers the rest.

To check the config any time, run `sudo bash veilway.sh check`.

## Set up the panel

`install panel` writes `/etc/veilway/panel.json` once and never changes an existing file. The panel listens on `127.0.0.1:8480` only, its cookies are secure, and its admin path is random, such as `/3f9c0a7e21b84d65`. To move the admin pages later, run `sudo bash veilway.sh panel-prefix [/new-path]`.

The install ends by printing the admin path and a one-time setup token. To read the token again, run:

```
sudo journalctl -u veilway-panel -o cat | grep 'Setup token' | tail -n 1
```

The panel prints a token only while no admin account exists. Each start before that, including a restart or reinstall, prints a new one and the earlier ones stop working. Use the last, and keep it private.

### Put a web server in front

The panel has no TLS, so a web server must serve it over HTTPS. Let the script do it, or do it by hand.

#### The automatic way

Point a domain name at the server (an A record, and an AAAA record if the server has IPv6), then add `--domain`:

```
sudo bash veilway.sh install panel --domain panel.example.com
```

`install both` takes it too. Without `--domain`, a script in a terminal asks whether you want a web server, and for the domain. With `--yes` it never asks.

`--https-port <port>` puts the HTTPS site on a port other than 443, for example `--https-port 8443`. The panel is then at `https://panel.example.com:8443/<prefix>/`. Port 80 must stay reachable either way, because the certificate is checked over it. A node TCP transport on that port moves to 8443 (8444 if you chose 8443), as for port 443 below. A re-run without the flag keeps the earlier port.

What it does, on Debian and Ubuntu:

1. **Installs Caddy** from the system packages if they are version 2.6 or newer, otherwise from Caddy's own apt repository with its signing key. `--web nginx` installs nginx and certbot (`python3-certbot-nginx`) instead.
2. **Writes the site as its own file.** For Caddy that is `/etc/caddy/conf.d/veilway-panel.caddy`, plus one added line, `import /etc/caddy/conf.d/*.caddy`, at the end of `/etc/caddy/Caddyfile`. An existing Caddyfile is otherwise kept, after a copy to `/var/backups/veilway`. For nginx the file is `/etc/nginx/conf.d/veilway-panel.conf`.
3. **Forwards the panel's two paths** to `127.0.0.1:8480`: the admin prefix and the subscription path, both read from `panel.json`.
4. **Serves a plain site everywhere else**: one ordinary page in `/var/www/veilway-site`, with no Veilway name or text. From v0.3.3 the script draws the page for each server (topic, text, dates, type and colors), so a search for one page does not find every Veilway server. A page of your own hides the server best: edit or replace it freely. The script never overwrites an edited page. `update` draws a new page in place of the one every install shared before v0.3.3, only if you never edited it. The same site is also served over plain HTTP on `127.0.0.1:8080` (this machine only, in the same site file). That is the default decoy origin of a node's `tls`, `ws` and `fronted` transports, so a stranger who reaches the node gets the same page. If something else holds that port, the script says so and skips it. `VEILWAY_DECOY_PORT=<port>` picks another port.

This site file does not forward a `ws` or `fronted` transport yet. Add its path to the file. The panel shows the exact Caddy and nginx lines under the transport (see [Web server lines](../manuals/panel/)). Reload the web server afterward.
5. **Sets the panel's `not_found` to the web server's own 404 answer**, so a stranger cannot tell the panel's paths from any other missing page.
6. **Gets a certificate.** Caddy gets and renews it by itself. For nginx, certbot gets it once and its timer renews it. Both need the domain to point at this server and port 80 to be reachable. If certbot fails, the script says so and the site answers on http only until you run `sudo certbot --nginx -d panel.example.com`.

If a web server already runs, or something else holds port 80 or 443, the script explains and stops before changing anything. It never stops or replaces a server it did not install. If Caddy (or nginx, with `--web nginx`) already runs, the script asks before adding its one file and import line. `--yes` answers yes.

**Port 443 and the node.** A node with a `tls` transport on port 443 holds the port the web server needs. The script takes the safe choice: the web server takes 443, and the node's TCP transports on 443 move to 8443. It asks first (`--yes` answers yes), backs up the node's config, checks the changed config, restarts the node, and restores the old config if anything fails. **Profiles that name port 443 stop working until you publish them again in the panel.** Keeping 443 on the node with the web server behind it is not built: the node cannot read the web server's certificate files, because its sandbox and their owner both forbid it. To keep the node on 443, skip `--domain` and put the web server on another port or host by hand.

`sudo bash veilway.sh uninstall web` undoes it: the site file, the import line, the plain site if unchanged, the panel's `not_found`, and the packages the script installed. The node's moved transports stay on 8443.

For a web server setup made before v0.2.15, `sudo bash veilway.sh update` adds the decoy site on `127.0.0.1:8080` in its own file: `/etc/caddy/conf.d/veilway-decoy.caddy` with Caddy, `/etc/nginx/conf.d/veilway-decoy.conf` with nginx. `uninstall web` removes it too.

#### By hand

The examples use `panel.example.com`, the admin path `/3f9c0a7e21b84d65` and the subscription path `/sub`. Use your own domain and admin path.

For nginx, the script prints this block with your admin path filled in:

```
location ~ ^(/3f9c0a7e21b84d65|/sub)(/|$) {
    proxy_pass http://127.0.0.1:8480;
    client_max_body_size 100m;
    proxy_set_header Host $http_host;
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

Then open `https://panel.example.com/3f9c0a7e21b84d65/`, enter the setup token with a username and password, accept the [operator terms](../legal/operator-terms/), and follow the [panel manual](../manuals/panel/). With the manual web server setup, set the panel's `not_found` to your web server's own 404 page, so a stranger cannot tell the subscription path from any other missing path.

## Without a domain

If you have no domain name, the script can serve the subscriptions on the server's IP address:

```
sudo bash veilway.sh install panel --no-domain
```

It asks for the web server (nginx by default), the port (443 if it is free) and the server's public IP address. `--https-port` and `--ip` set the last two without a question. `--yes` takes the defaults. On a cloud server behind NAT, the address it finds is a private one: give the public one with `--ip`. A private address given with `--ip` is used as it is, for a server used only on your home network.

The script makes a self-signed certificate for that IP. The admin pages stay on `127.0.0.1` and are not on the internet. The web server serves only the subscription path, `/sub`. Every other path answers 404.

To open the admin pages, make an SSH tunnel from your computer:

```
ssh -L 8480:127.0.0.1:8480 root@<server-ip>
```

Then open `http://localhost:8480/<admin path>/`. The script prints the exact command and address at the end.

The self-signed certificate is safe for your users. The apps check it by its pin, a hash of its public key, not by a name. The script prints the pin. Add the endpoint under **Settings** > **Endpoints** with the URL `https://<server-ip>:<port>/sub/main` and that pin.

Do not open the admin pages in a browser over the self-signed certificate. The browser warns about it, and the admin pages are meant only for the tunnel.

## Installing from a mirror

A mirror is a copy of the release files on a reachable server, for networks that block GitHub. Anyone can [host one](../guides/release-mirror/). You need not trust it: the installer checks every file against the script's built-in key, whichever mirror it came from.

```
sudo bash veilway.sh install node --mirror https://mirror.example.org
```

- `--mirror <url>` can be repeated. Mirrors are tried in order for each download, with GitHub last. `--mirror-only` never falls back to GitHub. Without `--mirror`, `VEILWAY_MIRRORS` (addresses separated by spaces) does the same.
- Only `https://` addresses work. `http://` is accepted for `127.0.0.1`, `localhost` and `[::1]`, for tests.
- The layout is GitHub's: `<mirror>/<owner>/<repo>/releases/download/<tag>/<file>`.
- If a mirror is down, blocked or serves a file that fails its signature, the script warns and tries the next.
- Without `--version`, the newest tag comes from a signed pointer file, `latest-veilway.txt` (`latest-veilway-panel.txt` for the panel), read from the mirrors first, then from GitHub's `releases/latest/download/` address. A pointer older than the installed version is refused, so a stale mirror cannot roll you back. An older tag needs `--version <tag> --allow-downgrade`.
- Releases from before the pointer existed have none. The script then asks GitHub for the latest release, unless you gave `--mirror-only`. In that case use `--version`.
- The Xray add-on and the example config still come from GitHub.

### Get the script from a mirror

The mirror also holds the signed installer. Check it by hand before you run it. This needs `minisign` (`apt install minisign`):

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

`mirror-sync` makes the same layout on a machine that can reach GitHub (or another mirror), for a web server or USB stick:

```
bash veilway.sh mirror-sync ./veilway-mirror
bash veilway.sh mirror-sync ./veilway-mirror --version v0.3.4-alpha
```

It downloads the node's and panel's files with signatures and pointers, verifies each before storing it, and puts `veilway.sh` at the top. It keeps a newer pointer already there. It does not write the browsable `index.html` that [`veilway-release-mirror`](../guides/release-mirror/) writes.

## Install with Docker

Docker is an alternative. The images are on GitHub Container Registry, for linux/amd64 and linux/arm64:

- `ghcr.io/veilway-project/veilway`, the node
- `ghcr.io/veilway-project/veilway-panel`, the panel

Each `v*` release tag publishes both images with a version tag and `latest`.

The core repository's `deploy/compose` folder runs the node and panel together, with a shared volume for the node's control socket. Its README has the full steps, including the commands that copy the configs into the volumes. In short:

1. Write the node config from `config.example.json`. The `ws` transport listens on port 8443 in the container, and Compose publishes host port 443 to it.
2. Make the keys with `docker compose run --rm --no-deps --entrypoint veilway node genkey`.
3. Copy the node and panel configs into their volumes, owned by uid `65532`, which the images run as.
4. Write `panel.json` with a random `prefix` and `listen` set to `127.0.0.1:8480`.
5. Start the stack with `docker compose up -d` and check it with `docker compose ps`. The panel shows as `healthy` once port 8480 accepts connections.

The panel uses host networking, because it listens on loopback only and the host cannot reach a container's loopback. Put a web server with TLS in front of it, as above.

### Docker notes

- `docker compose down -v` deletes the volumes, which hold the keys and usage state. Keep them when you stop the stack.
- Only an `l3` exit needs more rights: root with `NET_ADMIN` and the TUN device. Add these under `node` in `docker-compose.yml`:

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
