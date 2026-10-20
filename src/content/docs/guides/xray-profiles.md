---
title: Xray profiles on Linux
description: Connect to vless, vmess, trojan and shadowsocks links of other apps through the Veilway client on Linux, with the Xray-core add-on installed on request. What is not protected compared with a Veilway profile.
---

Some providers give out links for other apps: `vless://`, `vmess://`, `trojan://` and `ss://`. The Veilway client can connect to them by running Xray-core next to the tunnel. Xray-core is an official program that Veilway does not write. Veilway runs one release of it that the app has pinned.

:::caution[Desktop only, and new]
In v0.2.6-alpha, the desktop app connects to these links on Linux, macOS and Windows. Paste a link or a list into the window, or use the command line. The macOS and Windows parts are compiled and tested on CI only, not on a real Mac or PC. The Android app does not connect to them yet. Profiles from these links show "TCP and UDP only".
:::

For the server side, see [Xray add-on](../../manuals/xray/). The design is in [Xray in the desktop apps](../../protocol/xray-client/).

## Which links connect

| Part | Accepted |
|---|---|
| Protocol | VLESS, VMess, Trojan and Shadowsocks |
| Transport | Plain TCP with no header, WebSocket, or gRPC in `gun` mode |
| Security | TLS or Reality. VLESS and Trojan without encryption are refused. Certificate checks are always on, and `allowInsecure` and pinned certificates are refused. |
| Ciphers | Shadowsocks: the 2022 and AEAD ciphers on the list. No plugins. VMess: `auto`, `aes-128-gcm` or `chacha20-poly1305`, with alterId 0. |

A link that does not fit is refused with a short code, such as `profile_refused.security`. The code shows where the link failed.

Only TCP and UDP pass. Ping and other protocols do not.

## Install the add-on on request

Xray-core is not part of the Veilway client. The first time you connect a link, and the add-on is missing or does not match this app, the client asks:

> Install and connect?

Before you answer, the client says what it will do: it downloads Xray-core version `v26.3.27` from `github.com/XTLS/Xray-core`, at most 64 MiB, and checks it against a fingerprint built into the app. It runs with limited rights and only carries this profile's traffic.

- **No**: nothing is downloaded, and the connection does not start.
- **Yes**: the archive is checked against its pinned SHA-256 before it is opened. Only the one `xray` file is taken out of it, under a size cap. The file is checked again before every start.

The add-on is kept in the client's own folder, which only root can open. Xray runs as its own system user, `veilway-xray`, which the client creates on first use with no login shell. If GitHub is blocked, set `VEILWAY_MIRRORS` to a list of `https://` mirror addresses, separated by spaces. Those are tried after GitHub, and the archive is still checked against the pin.

The app never downloads an Xray release it does not pin. A new release needs a new app.

## Connect

The client must run as root, because the tunnel and the firewall need it. Put the links in a file that only you can read:

```
chmod 600 links.txt
sudo veilway connect ./links.txt
sudo veilway connect ./links.txt --profile 2
```

- The file can hold one link or a list. `--profile` picks the link by its number, counted from 1.
- Use a path that does not start with `~`, because `sudo` may change the home folder.
- A link on the command line is refused with `legacy_link_on_command_line`, because every user of the computer can read a command line.
- A file that group or others can read is refused with `legacy_file_open`. Run `chmod 600` on it.
- A file owned by someone other than root or the user who ran `sudo` is refused with `legacy_file_owner`.

Pasted links are used for this run only. The client does not keep them.

If the add-on does not match the app, the client says `xray_mismatch` and does not start it. The other codes you may see are `xray_missing`, `xray_start_failed`, `xray_port_taken` (another user holds the port Xray needs) and `server_not_answering`.

## What is not protected

A Xray profile is weaker than a Veilway profile. The client shows these points in plain words:

- **A link is not signed.** Nothing checks that it came from your provider, and a link on the way can be changed.
- **There is no control channel.** No exit choice, no usage numbers, no notices from the provider and no MTU discovery.
- **Names are resolved by public resolvers.** Queries go through the server to 1.1.1.1 and 9.9.9.9, not to your provider. The server's name is resolved before the kill switch goes up, so a hostile local resolver can give a wrong address. TLS or Reality with the profile's name fails for a wrong host.
- **Nothing passes while Xray restarts.** The kill switch stays up, but flows reset until Xray is back.
- **Xray is a third-party program.** A flaw in it is a flaw on this computer. Limited rights reduce the harm but do not remove it.
- **None of the Veilway transport features apply.** That covers the borrowed-site mode, the `fronted` shapes and the control channel. The rating is the legacy cap that the app shows on the profile.

If you need the protection of a Veilway profile, ask your provider for a Veilway subscription link.
