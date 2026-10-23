---
title: Host a release mirror
description: Keep a copy of Veilway's releases on a server people can reach, so installs and updates work where GitHub is blocked.
---

A release mirror is a folder of Veilway's release files on your web server, for people on networks that block GitHub to install and update from. Anyone can run one, and nobody has to trust you: the Veilway release key signs every file, and the installer and apps check it themselves.

```text
 GitHub  ---- sync (hourly) ---->  mirror folder  ---- web server ---->  users
 (or another mirror)               (checked files)                       (installer, apps)
```

## When to run one

Run one if people you know cannot reach GitHub (blocked or throttled) but can reach one of your addresses: a small VPS, a cloud bucket, a university or office server. It needs a few gigabytes of disk and almost no CPU. If your users can reach GitHub, you do not need one.

## What a mirror can and cannot do

- **It cannot change anything.** A changed file fails its signature, which also names the product, release tag and file, so a real file under the wrong name or tag is refused.
- **It cannot roll anyone back.** The `latest` pointer is signed. The mirror program refuses a pointer older than its current one, and clients refuse one older than the version they run.
- **It can go away or be slow.** That is all a bad mirror can do, so clients can know several.
- **It learns who downloads.** Your web server sees which addresses ask for which files, and when. The mirror program keeps no access log. nginx and Caddy keep one by default, so the examples turn it off. A CDN logs by its own rules. Tell your users what you keep.

## Set it up

You need the `veilway-release-mirror` program from the [project's repository](https://github.com/veilway-project/veilway-release-mirror), a Linux server with systemd, and a domain name that points at it.

1. Get the program: a release binary for x86_64 or aarch64 Linux, or the Docker image from the repository's `Dockerfile`. Put the binary at `/usr/local/bin/veilway-release-mirror`.
2. Make a user and a folder: `useradd --system veilway-mirror`, then `install -d -o veilway-mirror /var/lib/veilway-mirror`.
3. Fill the folder once: `sudo -u veilway-mirror veilway-release-mirror sync --out /var/lib/veilway-mirror`. It prints one line per stored file and keeps the three newest releases of the node and panel, plus the one the signed pointer names.
4. Keep it fresh. The repository's `examples/` folder has `veilway-release-mirror-sync.service` and `.timer`, which sync hourly. Copy both to `/etc/systemd/system/` and run `systemctl enable --now veilway-release-mirror-sync.timer`.
5. Serve the folder in one of two ways:
   - `veilway-release-mirror serve --dir /var/lib/veilway-mirror --listen 127.0.0.1:8080` (the example `veilway-release-mirror.service` runs it), with nginx or Caddy in front for TLS. See `examples/nginx.conf` and `examples/Caddyfile`.
   - Or serve the folder as static files from any web server or CDN, untouched, with range support for the big files, and without the `.partial` folder.
6. Open `https://your-domain/` in a browser. The page lists every release and file.

With Docker, use three commands: `docker build -t veilway-release-mirror .`, then `docker run --rm -v veilway-mirror:/data veilway-release-mirror sync --out /data` (from a timer), and `docker run -d -p 127.0.0.1:8080:8080 -v veilway-mirror:/data:ro veilway-release-mirror` for the server.

## Mirror a mirror

`sync --from https://other-mirror.example.org` takes files from another mirror instead of GitHub. Repeat `--from` for several, tried in order for each file. Put `--from github` last to fall back to GitHub. You need not trust the source: the program checks every file against its built-in key before storing it.

For a folder from a USB stick, `veilway-release-mirror verify --dir <folder>` checks all of it and lists every file that fails. With plain `minisign`:

```sh
minisign -V -m veilway.sh -x veilway.sh.minisig -P RWQiodKlFCiJ3bkZD3ojKV7AYyTYf3F5x/XY8upWvpSFTVm3O2cNRbrV
```

The `Trusted comment:` line in the output must read `veilway <tag> veilway.sh`, with the tag of your folder.

## How people use your mirror

Give them your address. `veilway.sh` takes `--mirror <url>` to install and update from it ([Installing from a mirror](../../getting-started/#installing-from-a-mirror)):

```sh
curl -fsSL https://your-domain/veilway.sh | sudo bash -s -- --mirror https://your-domain
```

The installer checks every file against its built-in key, wherever it came from. `veilway.sh mirror-sync <folder>` makes the same folder without the mirror program, for a USB stick.

## What is in the folder

```text
veilway-project/veilway/releases/download/<tag>/<file> and <file>.minisig
veilway-project/veilway-panel/releases/download/<tag>/<file> and <file>.minisig
veilway-project/<repo>/releases/latest/download/latest-<repo>.txt and .minisig
latest-veilway.txt, latest-veilway-panel.txt (copies of the two pointers)
veilway.sh and veilway.sh.minisig (the installer of the newest release)
index.html, index.json
```

The layout is GitHub's, so a mirror's address works wherever a GitHub release base address does.

## Limits

- Files without a `.minisig` are not mirrored. The desktop updater's `latest.json` is one, so desktop apps still update from GitHub.
- A release without the signed `latest` pointer is mirrored from the GitHub API's list, and the mirror then has no pointer of its own. The program says so.
- Do not run two syncs on one folder at once.
- If your address is blocked, so is the mirror. Use a second one.
