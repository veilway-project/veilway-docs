---
title: Host a release mirror
description: Keep a copy of Veilway's releases on a server people can reach, so installs and updates work where GitHub is blocked.
---

A release mirror is a folder of Veilway's release files on a web server of yours. People on networks that block GitHub install and update from it instead. Anyone can run one, and nobody has to trust you: every file is signed by the Veilway release key, and the installer and the apps check that signature themselves.

```text
 GitHub  ---- sync (hourly) ---->  mirror folder  ---- web server ---->  users
 (or another mirror)               (checked files)                       (installer, apps)
```

## When to run one

Run a mirror when you know people whose network blocks or throttles GitHub but can reach an address of yours: a small VPS, a cloud bucket, a university or office server. It costs a few gigabytes of disk and almost no CPU. If your users can reach GitHub, you do not need one.

## What a mirror can and cannot do

- **It cannot change anything.** A changed file fails its signature. The signature also names the product, the release tag and the file, so a real file under the wrong name or tag is refused too.
- **It cannot roll anyone back.** The `latest` pointer is signed. The mirror program refuses a pointer older than the one it already holds, and clients refuse one older than what they run.
- **It can go away or be slow.** That is all a bad mirror can do, so clients may know several.
- **It learns who downloads.** Your web server sees which addresses ask for which files, and when. The mirror program keeps no access log. nginx and Caddy keep one by default, so the examples turn it off. A CDN logs on its own terms. Tell your users what you keep.

## Set it up

You need the program, `veilway-release-mirror`, from the [project's repository](https://github.com/veilway-project/veilway-release-mirror). The steps use a Linux server with systemd and a domain name that points at it.

1. Get the program: a release binary for x86_64 or aarch64 Linux, or the Docker image built from the repository's `Dockerfile`. Put the binary at `/usr/local/bin/veilway-release-mirror`.
2. Make a user and a folder: `useradd --system veilway-mirror`, then `install -d -o veilway-mirror /var/lib/veilway-mirror`.
3. Fill the folder once: `sudo -u veilway-mirror veilway-release-mirror sync --out /var/lib/veilway-mirror`. It prints one line per file it stored. It keeps the three newest releases of the node and the panel, plus the one the signed pointer names.
4. Keep it fresh. The repository's `examples/` folder has `veilway-release-mirror-sync.service` and `.timer`, which run the sync every hour. Copy both to `/etc/systemd/system/` and run `systemctl enable --now veilway-release-mirror-sync.timer`.
5. Serve the folder, one of two ways:
   - `veilway-release-mirror serve --dir /var/lib/veilway-mirror --listen 127.0.0.1:8080` (the example `veilway-release-mirror.service` runs it), with nginx or Caddy in front for TLS. The examples are `examples/nginx.conf` and `examples/Caddyfile`.
   - Or let any web server or CDN serve the folder as static files. Serve the files untouched, support ranges for the big ones, and do not serve the `.partial` folder.
6. Open `https://your-domain/` in a browser. The page lists every release and file.

With Docker, the same in three commands: `docker build -t veilway-release-mirror .`, then `docker run --rm -v veilway-mirror:/data veilway-release-mirror sync --out /data` (from a timer), and `docker run -d -p 127.0.0.1:8080:8080 -v veilway-mirror:/data:ro veilway-release-mirror` for the server.

## Mirror a mirror

`sync --from https://other-mirror.example.org` takes files from another mirror instead of GitHub. Repeat `--from` to give several, tried in order for each file. Put `--from github` last to fall back to GitHub itself. A mirror you copy from does not have to be trusted: every file is checked against the key built into the program before it is stored.

If you got a folder on a USB stick, `veilway-release-mirror verify --dir <folder>` checks all of it and lists every file that fails. With plain `minisign`:

```sh
minisign -V -m veilway.sh -x veilway.sh.minisig -P RWQiodKlFCiJ3bkZD3ojKV7AYyTYf3F5x/XY8upWvpSFTVm3O2cNRbrV
```

The line `Trusted comment:` in the output must read `veilway <tag> veilway.sh`, with the tag of the folder you are in.

## How people use your mirror

Give them your address. `veilway.sh` takes `--mirror <url>` and installs and updates from there ([Installing from a mirror](../../getting-started/#installing-from-a-mirror)):

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

The layout is GitHub's, so a mirror's address works as a base address wherever a GitHub release address works.

## Limits

- Files without a `.minisig` are not mirrored. The desktop updater's `latest.json` is one, so desktop apps update from GitHub for now.
- A release that does not carry the signed `latest` pointer yet is mirrored from the GitHub API's list instead, and the mirror then has no pointer of its own. The program says so when it happens.
- Do not run two syncs on one folder at the same time.
- A mirror is only as reachable as its address. If your address is blocked, so is the mirror: use a second one.
