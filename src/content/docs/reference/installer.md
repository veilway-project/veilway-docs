---
title: Installer reference
description: Every command, flag and setting of the veilway.sh installer, and where its files go.
---

Everything the `veilway.sh` installer can do. To install for the first time, read [Getting started](../../getting-started/) or the [Quick start](../../quick-start/) instead.

## The menu

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

## Commands

| Command | What it does |
|---|---|
| `install node\|panel\|both\|mirror [--version vX.Y.Z]` | Installs the chosen parts from the latest release or the tag you give. `mirror` installs a relay mirror of the subscription endpoint. See [Relay mirrors](../../manuals/panel/#relay-mirrors). |
| `install panel\|both --domain <name> [--web caddy\|nginx]` | Also sets up a web server with HTTPS for that domain, and a plain site for every other path. See [Put a web server in front](../../getting-started/#put-a-web-server-in-front). |
| `install panel\|both --no-two-step` | A fresh install of the panel asks whether to ask for an authenticator code at sign-in, and the answer is yes unless you say no. This flag says no without asking. Not recommended: with it off, the admin password alone opens the panel. From v0.3.4. |
| `update [node\|panel\|mirror\|both]` | Installs the latest release or the tag you give, and restarts the service. It also replaces the saved installer, `/usr/local/sbin/veilway.sh`, with the signed one of the same release, never an older one. The panel's update buttons run it. See [Updating the panel](../../manuals/panel/#updating-the-panel). |
| `status` | Shows each service's state and version, and the config and state folders. Needs no root. With root it also shows the panel's admin pages address, subscription path and admin usernames. |
| `logs [node\|panel\|mirror]` | Follows the last 100 journal lines of the service. |
| `restart [node\|panel\|mirror\|both]` | Restarts the service. A node restart drops every live tunnel for a moment. |
| `check` | Runs `veilway check` on the node's config. |
| `doctor` | Runs `veilway doctor` on the node with the service's own paths. It only reads. |
| `backup [file]` | Writes a `tar.gz` of the config, the node's usage state, the panel's data and the mirror's config. It holds keys, and `gateway.next` while that is still on the server, so keep it private. |
| `restore <file>` | Restores a backup after you confirm. It saves the current files first. |
| `panel-prefix [/path]` | Moves the admin pages to a new path, random if none is given. It prints the lines to change in your web server, and restores the old path if the panel does not start. |
| `admin [list\|reset <username>]` | `list` shows the admin usernames. `reset` is for a lockout: it asks twice for a new password of 12 characters or more, gives it to that admin and signs them out everywhere. Their authenticator key and API tokens stay. Needs panel v0.2.5 or later. |
| `addon xray [install\|remove\|status]` | Installs, removes or shows the Xray add-on. `install` is the default. It downloads one pinned release of the official Xray-core and refuses it unless its SHA-256 matches the one built into the script. The `xray` executable goes in `/usr/local/lib/veilway/addons/xray`, owned by root. Xray runs as its own user, `veilway-xray`, and the node starts it when its config has an Xray inbound. See [Xray add-on](../../manuals/xray/). |
| `mirror-sync <folder> [--version vX.Y.Z]` | Copies a node and panel release, with signatures and the signed `latest` pointers, into a folder laid out like GitHub's, checking every file first. Serve the folder or carry it on a USB stick. See [Installing from a mirror](../../getting-started/#installing-from-a-mirror). Needs no root. |
| `uninstall` | Removes the binaries, the units and the installer itself. It asks before deleting the config and data. Backups stay. A web server setup stays until `uninstall web`, which needs the installer. |
| `uninstall web` | Undoes what `--domain` set up: the site file, the plain site if you did not edit it, the panel's `not_found`, and the packages the script installed. |
| `version` | Prints the script, node and panel versions. |

Flags:

- `--dry-run` prints what the command would do and changes nothing.
- `--yes` (or `-y`) answers every question with its default.
- `--version <tag>` picks a release tag instead of the latest.
- `--allow-downgrade` lets `--version` name a tag older than the installed one. Without it the script refuses, and it warns when you use it.
- `--mirror <url>` installs from a mirror (repeat it for several). See [Installing from a mirror](../../getting-started/#installing-from-a-mirror). `--mirror-only` never falls back to GitHub.
- `--domain <name>` and `--web caddy|nginx` set up a web server for the panel. `caddy` is the default.

Environment:

- `NO_COLOR` turns off colors.
- `VEILWAY_PANEL_PORT` sets the panel's port. The default is `8480`.
- `VEILWAY_MIRRORS` lists mirror addresses separated by spaces. They are tried after any `--mirror`.

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

