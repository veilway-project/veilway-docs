---
title: Getting started
description: Installing the Veilway alpha's node and panel with the install script, or with Docker.
---

This page installs the alpha, `v0.1.0-alpha`. Its files come from the [core release page](https://github.com/veilway-project/veilway/releases) and the [panel release page](https://github.com/veilway-project/veilway-panel/releases). For what the alpha includes and where it is still limited, read [the alpha release](../alpha/) first.

## What you need

- A Linux server with systemd, on x86_64 or aarch64, that you can reach from the internet on the ports you choose.
- Root access (`sudo`) and `curl`. The script installs `minisign` from your package manager if it is missing.
- For the panel: a domain name and a web server with a TLS certificate in front of it.

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
| 0 | Quit | |

### Commands

| Command | What it does |
|---|---|
| `install node\|panel\|both\|mirror [--version vX.Y.Z]` | Installs the chosen parts from the latest release, or from the tag you give. `mirror` installs a relay mirror of the subscription endpoint, see [Relay mirrors](../manuals/panel/#relay-mirrors). |
| `update [node\|panel\|mirror\|both]` | Installs the latest release, or the tag you give, and restarts the service. The panel's **Update** button runs this for the panel, see [Updating the panel](../manuals/panel/#updating-the-panel). |
| `status` | Shows the state of each service, its version, and the config and state folders. Does not need root. |
| `logs [node\|panel\|mirror]` | Follows the last 100 journal lines of the service. |
| `restart [node\|panel\|mirror\|both]` | Restarts the service. A node restart drops every live tunnel for a moment. |
| `check` | Runs `veilway check` on the node's config. |
| `doctor` | Runs `veilway doctor` on the node with the service's own paths. It only reads. |
| `backup [file]` | Writes a `tar.gz` of the config, the node's usage state, the panel's data and the mirror's config. The archive holds keys, and `gateway.next` too while it is still on the server, so keep it private. |
| `restore <file>` | Restores a backup after you confirm. It saves the current files first. |
| `panel-prefix [/path]` | Moves the admin pages to a new path, random when none is given. It prints the lines to change in your web server, and puts the old path back if the panel does not start. |
| `addon xray [install\|remove\|status]` | Installs, removes or shows the Xray add-on. `install` is the default. It downloads one pinned release of the official Xray-core, refuses it unless its SHA-256 matches the one built into the script, and puts the `xray` executable in `/usr/local/lib/veilway/addons/xray`, owned by root. Xray then runs as its own user, `veilway-xray`, and the node starts it when its config has an Xray inbound. See [Xray add-on](../manuals/xray/). |
| `uninstall` | Removes the binaries and units. It asks before it deletes the config and data. Backups stay. |
| `version` | Prints the script, node and panel versions. |

Flags:

- `--dry-run` prints what the command would do and changes nothing.
- `--yes` (or `-y`) answers every question with its default.
- `--version <tag>` picks a release tag instead of the latest.

Environment:

- `NO_COLOR` turns off colors.
- `VEILWAY_PANEL_PORT` sets the panel's port. The default is `8480`.

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
sudo journalctl -u veilway-panel | grep 'Setup token'
```

The panel prints the token only while no admin account exists. Keep it private.

### Put a web server in front

The panel has no TLS of its own, so a web server must serve it over HTTPS. The examples use `panel.example.com`, the admin path `/3f9c0a7e21b84d65` and the subscription path `/sub`. Use your own domain and your own admin path.

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

Then open `https://panel.example.com/3f9c0a7e21b84d65/`, enter the setup token with a username and a password, accept the [operator terms](../legal/operator-terms/), and follow the [panel manual](../manuals/panel/). Set the panel's `not_found` to your web server's own 404 page, so a stranger cannot tell the subscription path from any other missing path.

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
