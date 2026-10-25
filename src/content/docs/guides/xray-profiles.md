---
title: Xray profiles on Linux
description: Connect to vless, vmess, trojan and shadowsocks links of other apps through the Veilway client on Linux, with the Xray-core add-on installed on request. What is not protected compared with a Veilway profile.
---

Some providers give out links for other apps: `vless://`, `vmess://`, `trojan://` and `ss://`. The Veilway client connects to them by running Xray-core, an official program Veilway does not write, next to the tunnel. Veilway runs one release that the app pins.

:::caution[Desktop only, and new]
In v0.2.11-alpha, the desktop app connects to these links on Linux, macOS and Windows. Paste a link or list into the window, or use the command line. The macOS and Windows parts are compiled and tested on CI only, not on a real Mac or PC. The Android app cannot connect to them yet. These profiles show "TCP and UDP only".
:::

For the server side, see [Xray add-on](../../manuals/xray/). The design is in [Xray in the desktop apps](../../protocol/xray-client/).

## Which links connect

| Part | Accepted |
|---|---|
| Protocol | VLESS, VMess, Trojan and Shadowsocks |
| Transport | Plain TCP with no header, WebSocket, or gRPC in `gun` mode |
| Security | TLS or Reality. VLESS and Trojan without encryption are refused. Certificate checks are always on, and `allowInsecure` and pinned certificates are refused. |
| Ciphers | Shadowsocks: the 2022 and AEAD ciphers on the list. No plugins. VMess: `auto`, `aes-128-gcm` or `chacha20-poly1305`, with alterId 0. |

The client refuses a link that does not fit, with a short code such as `profile_refused.security` that shows where it failed. Only TCP and UDP pass. Ping and other protocols do not.

## Install the add-on on request

Xray-core is not part of the client. The first time you connect a link, if the add-on is missing or does not match the app, the client asks:

> Install and connect?

Before you answer, the client says what it will do: download Xray-core version `v26.10.21` from `github.com/XTLS/Xray-core`, at most 64 MiB, and check it against a fingerprint built into the app. Xray runs with limited rights and carries only this profile's traffic.

- **No**: nothing is downloaded, and the connection does not start.
- **Yes**: the client checks the archive against its pinned SHA-256 before opening it, takes out only the one `xray` file under a size cap, and checks that file again before every start.

The add-on lives in the client's own folder, which only root can open. Xray runs as its own system user, `veilway-xray`, which the client creates on first use with no login shell. If GitHub is blocked, set `VEILWAY_MIRRORS` to `https://` mirror addresses separated by spaces. The client tries them after GitHub and still checks the archive against the pin.

The app never downloads an Xray release it does not pin, so a new Xray release needs a new app.

## Connect

The client must run as root, because the tunnel and the firewall need it. Put the links in a file only you can read:

```
chmod 600 links.txt
sudo veilway connect ./links.txt
sudo veilway connect ./links.txt --profile 2
```

- The file can hold one link or a list. `--profile` picks a link by number, from 1.
- Use a path that does not start with `~`, because `sudo` can change the home folder.
- A link on the command line is refused with `legacy_link_on_command_line`, because every user can read the command line.
- A file that group or others can read is refused with `legacy_file_open`. Run `chmod 600` on it.
- A file owned by someone other than root or the user who ran `sudo` is refused with `legacy_file_owner`.

Pasted links are used for this run only and not kept.

If the add-on does not match the app, the client says `xray_mismatch` and does not start it. Other codes: `xray_missing`, `xray_start_failed`, `xray_port_taken` (another program holds the port Xray needs) and `server_not_answering`.

## What is not protected

An Xray profile is weaker than a Veilway profile. The client says so in plain words:

- **A link is not signed.** Nothing checks that it came from your provider, and someone on the way can change it.
- **There is no control channel.** There is no exit choice, no usage numbers, no notices from the provider and no MTU discovery.
- **Names are resolved by public resolvers.** Queries go through the server to 1.1.1.1 and 9.9.9.9, not to your provider. The server's name is resolved before the kill switch goes up, so a hostile local resolver can give a wrong address, though TLS or Reality with the profile's name fails for a wrong host.
- **Nothing passes while Xray restarts.** The kill switch stays up, but flows reset until Xray is back.
- **Xray is a third-party program.** A flaw in it is a flaw on this computer. Limited rights reduce the harm, not remove it.
- **None of the Veilway transport features apply**, including borrowed-site mode, the `fronted` shapes and the control channel. The app caps the profile's rating at the legacy cap.

If you need the protection of a Veilway profile, ask your provider for a Veilway subscription link.
