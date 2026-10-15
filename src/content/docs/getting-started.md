---
title: Getting started
description: Installing a Veilway node and panel with the install script, or with Docker.
---

:::caution[No release yet]
Nothing here is released. The script and the Docker images download release files that do not exist yet, so these steps fail until the first release is published. They describe the install as planned.
:::

## What you need

- A Linux server with systemd, on x86_64 or aarch64.
- Root access (`sudo`) and `curl`. The script installs `minisign` from your package manager if it is missing.
- For the panel: a domain name and a web server with a TLS certificate in front of it.

## Install with the script

The script is the recommended way to install. It can install the node, the panel or both, and it checks every download before installing it.

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
| `install node\|panel\|both [--version vX.Y.Z]` | Installs the chosen parts from the latest release, or from the tag you give. |
| `update [node\|panel\|both]` | Installs the latest release, or the tag you give, and restarts the service. |
| `status` | Shows the state of each service, its version, and the config and state folders. Does not need root. |
| `logs [node\|panel]` | Follows the last 100 journal lines of the service. |
| `restart [node\|panel\|both]` | Restarts the service. A node restart drops every live tunnel for a moment. |
| `check` | Runs `veilway check` on the node's config. |
| `doctor` | Runs `veilway doctor` on the node with the service's own paths. It only reads. |
| `backup [file]` | Writes a `tar.gz` of the config, the node's usage state and the panel's data. The archive holds keys, so keep it private. |
| `restore <file>` | Restores a backup after you confirm. It saves the current files first. |
| `uninstall` | Removes the binaries and units. It asks before it deletes the config and data. Backups stay. |
| `version` | Prints the script, node and panel versions. |

Flags:

- `--dry-run` prints what the command would do and changes nothing.
- `--yes` (or `-y`) answers every question with its default.
- `--version <tag>` picks a release tag instead of the latest.

Environment:

- `NO_COLOR` turns off colors.
- `VEILWAY_PANEL_PORT` sets the panel's port. The default is `8480`.
- `VEILWAY_PANEL_PUBKEY` replaces the public key that panel downloads are checked with. Leave it unset.

### Checked downloads

Every download comes with a signature file. The script checks it with minisign, against a public key built into the script. The signature's trusted comment must read `veilway <tag> <asset>`. If the signature or the comment does not match, the script stops and installs nothing.

If your package manager has no `minisign`, install it from [minisign.org](https://jedisct1.github.io/minisign/) and run the script again.

## Set up the node

After `install node` on a new server, the node is enabled but not started, because it has no config yet. The script prints these steps.

1. Make the keys with `veilway genkey`, and put them in the config as the [config reference](../reference/config/) describes.
2. Copy `/etc/veilway/config.example.json` to `/etc/veilway/config.json` and edit it.
3. Run `sudo bash veilway.sh install node` again. It checks the config, and it starts the node only if the check passes. The script then sets the config's owner to `veilway` and its mode to `0600`.

To check the config first, run `sudo bash veilway.sh check`.

## Set up the panel

`install panel` writes `/etc/veilway/panel.json` once. An existing file is never changed. The panel listens on `127.0.0.1:8480` only, and its admin path is random, such as `/p-0123456789abcdef`.

The script prints the admin path and a one-time setup token at the end of the install. To read the token again, run:

```
sudo journalctl -u veilway-panel | grep 'Setup token'
```

The panel prints the token only while no admin account exists. Keep it private.

### Put a web server in front

The panel has no TLS of its own, so a web server must serve it over HTTPS. The examples use `panel.example.com`, the admin path `/p-0123456789abcdef` and the subscription path `/sub`. Use your own domain and your own admin path.

For nginx, the script prints this block:

```
location ~ ^(/p-0123456789abcdef|/sub)(/|$) {
    proxy_pass http://127.0.0.1:8480;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

For Caddy, use:

```
panel.example.com {
    handle /p-0123456789abcdef/* {
        reverse_proxy 127.0.0.1:8480
    }
    handle /sub/* {
        reverse_proxy 127.0.0.1:8480
    }
}
```

Then open `https://panel.example.com/p-0123456789abcdef/` and follow the [panel manual](../manuals/panel/). Set the panel's `not_found` to your web server's own 404 page, so a stranger cannot tell the subscription path from any other missing path.

## Where files live

| Path | What it holds |
|---|---|
| `/usr/local/bin/veilway` | The node binary |
| `/usr/local/bin/veilway-panel` | The panel binary |
| `/etc/veilway/config.json` | The node's config. Owner `veilway`, mode `0600` |
| `/etc/veilway/config.example.json` | The example config from the release |
| `/etc/veilway/panel.json` | The panel's config |
| `/var/lib/veilway/veilway-state.json` | The node's usage state |
| `/var/lib/veilway/veilway-replay` | The node's replay memory |
| `/var/lib/veilway-panel/panel.db` | The panel's database |
| `/var/lib/veilway-panel/panel.keys` | The panel's keys for sealed secrets |
| `/var/lib/veilway-panel/signing.keys` | The subscription signing keys |
| `/run/veilway/control.sock` | The node's control socket, group `veilway` |
| `/etc/systemd/system/veilway.service` | The node's unit |
| `/etc/systemd/system/veilway-panel.service` | The panel's unit |
| `/var/backups/veilway` | Backups, and copies the script makes before it overwrites a file |

The script creates two system users with no login shell: `veilway` for the node and `veilway-panel` for the panel. The installed versions are kept in `/var/lib/veilway/node.version` and `/var/lib/veilway-panel/panel.version`.

## Install with Docker

Docker is an alternative to the script. The images are on GitHub Container Registry:

- `ghcr.io/veilway-project/veilway`, the node
- `ghcr.io/veilway-project/veilway-panel`, the panel

Both are built for linux/amd64 and linux/arm64. Each `v*` release tag publishes them with a version tag and `latest`. **No release is published yet, so these images do not exist yet.**

The core repository's `deploy/compose` folder runs the node and the panel together. Its README has the full steps. In short:

1. Write `config.json` from `config.example.json`. The `ws` transport listens on port 8443 in the container, and Compose publishes host port 443 to it.
2. Make the keys:

   ```
   docker compose run --rm --no-deps --entrypoint veilway node genkey
   ```

3. Copy the config and the panel config into their volumes, and set the owner to uid `65532`, which the images run as. The README has the exact commands.
4. Write `panel.json`, with a random `prefix` and `listen` set to `127.0.0.1:8480`.
5. Start the stack and check it:

   ```
   docker compose up -d
   docker compose ps
   ```

   The panel shows as `healthy` once port 8480 accepts connections.

The panel uses host networking. It listens on loopback only, and a container's loopback cannot be reached from the host, so host networking is how the host reaches it. Put a web server with TLS in front of it, as described above.

### Notes

- `docker compose down -v` deletes the volumes, which hold the keys and the usage state. Keep the volumes when you stop the stack.
- Only an `l3` exit needs more rights. It needs the node to run as root with `NET_ADMIN` and the TUN device. Add these lines under `node` in `docker-compose.yml`:

  ```yaml
      user: "0"
      cap_add: [NET_ADMIN]
      devices: ["/dev/net/tun"]
  ```

  Exits that use `netstack` need none of this.
- Each WireGuard UDP port in the config needs its own line under `ports` on the node.
- To build the node image from source, run `docker build` in the core repository. The panel's Dockerfile clones the core and the design system at the refs given in `VEILWAY_REF` and `VEILWAY_UI_REF`.

## Next

Connecting a client is not covered here yet, because no client is released. The [client manual](../manuals/client/) says where each client stands.
