---
title: Xray in the desktop apps
description: How the Linux, macOS and Windows apps connect to VLESS, VMess, Trojan and Shadowsocks profiles through a pinned Xray-core that runs as a supervised child process, how the binary is fetched and checked, how traffic and names reach it, and what the app says is not protected.
---

:::caution[Built, not yet run against a real Xray on every system]
Built in v0.2.0 for Linux, macOS and Windows and reviewed: the pinned install, the supervisor, the loopback SOCKS5 hop, the checks on links, and on each system the way Xray's own traffic is kept out of the tunnel. macOS and Windows are compiled and unit-tested on CI only. The desktop window does not import legacy links yet, and the gate script has not run against a real Xray.
:::

Some providers sell only links of other apps: `vless://`, `vmess://`, `trojan://` and `ss://`. The desktop apps can connect to them by running Xray-core, an official binary the project does not write, next to the engine. This page decides how. Read "Native and legacy" of the subscription page first: this page uses its reader, its "unsigned" marking and its rating cap, and does not restate them.

Five rules shape the page:

- **The binary is the project's pin, not the network's word.** Xray runs only if its bytes match a SHA-256 shipped inside the signed app release, checked again before every start.
- **The engine keeps the tunnel.** The TUN device, routes, resolver pinning and kill switch stay the platform layer's. Xray sees no packets, only SOCKS5 connections from the engine on loopback.
- **Nothing from a link is a config.** The Xray document is built from typed, validated fields. No link or subscription text is copied into it as JSON, a path or a URL.
- **Nothing leaves outside the tunnel but Xray's own connection to its server.** A crash of Xray stops traffic. It never lets traffic out.
- **Nothing is fetched without a yes.** The install, and an update of it, each ask first and name what they download.

## Numbers that are judgement calls

None of these numbers has a measurement behind it.

| Name | Value |
|---|---|
| Archive download | at most 64 MiB, 10 s to connect, 300 s in all |
| Executable inside the archive | at most 128 MiB inflated, from exactly one archive entry |
| Open TCP flows through Xray | at most 1,024 |
| Open UDP flows through Xray | at most 256, idle for 60 s ends one (10 s for a flow to port 53) |
| A TCP flow with one side closed | ends after 60 s |
| SOCKS5 handshake with Xray | 10 s |
| Restart wait | 1 s, doubling to 60 s. A run of 60 s or more resets it. |
| Local liveness check | every 10 s |
| "Server not answering" | 8 flows in a row failed over at least 30 s with none carried |
| Log kept for the window | the last 64 KiB, lines cut at 512 bytes |
| Tunnel MTU | 1400 |

## Which profiles can connect

A legacy profile is an `Entry` of the legacy reader. Importing needs no add-on. Connecting needs the add-on and a profile that passes this table. A profile that fails stays in the list, is marked with the reason, and cannot be connected.

| Part | Allowed | Refused |
|---|---|---|
| Protocol | `vless`, `vmess`, `trojan`, `shadowsocks` | anything else, `socks`, `http` |
| Stream | `tcp` with no header (a link's `headerType` other than `none` is refused), `ws`, `grpc` | `kcp`, `quic`, `h2`, `httpupgrade`, `xhttp`, `splithttp`, and any word not listed |
| Security | `tls`, `reality` | `none` for `vless` and `trojan` (the cap is Unsafe) |
| Certificate checking | on | `allowInsecure` and its spellings. The app has no switch for it. |
| `vless` | `encryption` absent or `none`, `flow` empty or `xtls-rprx-vision` (only with `tcp` and `tls` or `reality`) | any other `encryption` or `flow` |
| `vmess` | `aid` absent or `0`, `scy` one of `auto`, `aes-128-gcm`, `chacha20-poly1305`, security `none` allowed because the cipher encrypts | `aid` above 0, `scy` of `none` or `zero` |
| `shadowsocks` | `aes-128-gcm`, `aes-256-gcm`, `chacha20-ietf-poly1305`, `2022-blake3-aes-128-gcm`, `2022-blake3-aes-256-gcm`, `2022-blake3-chacha20-poly1305` | every other cipher, any `plugin`, a 2022 key that is not base64 of 16 or 32 bytes as the cipher needs |
| `reality` | `pbk` (43 base64url characters, 32 bytes), `sid` (even hex, 0 to 16 characters), `sni` (required), `fp` from the list below | a missing `pbk` or `sni` |
| `tls` | `sni`, `alpn` from `h2` and `http/1.1`, `fp` from the list below | a pin (`pcs`, `pinnedPeerCertSha256`): it is not carried, so a self-signed server fails closed |
| `ws`, `grpc` | `ws`: `path`, `host`. `grpc`: `serviceName` (in a `vmess` link, its `path`), mode `gun` only | a `ws` early-data field, `multiMode` |

The `fp` list is `chrome`, `firefox`, `safari`, `ios`, `android`, `edge` and `randomized`. A link without one gets `chrome`.

**The reader grows.** Today an `Entry` holds the scheme, server, port, credential, cipher, security, `insecure`, `sni`, `network`, `host` and `path`. This item adds `flow`, `fp`, `alpn`, `pbk`, `sid`, `service`, `encryption` and `aid`, each read with a strict grammar by the same rules ("a field that is not on the parser's list is dropped", words in lowercase, 1 to 32 characters of `a-z0-9-`, hosts through `is_host`, no raw text kept). A field that the reader drops never becomes a default that changes what the link meant: a stream word or a `headerType` that is not on the table above refuses the profile, it is not turned into `tcp`. The fuzz target `fuzz_links` covers the new fields in the same change.

**Pasted links.** The subscription page reads legacy links as `https` lists. The desktop apps also take one pasted `vless://`, `vmess://`, `trojan://` or `ss://` link, or a pasted list, with no fetch. It becomes an unsigned subscription of its own entries and is never refreshed. The subscription page gets a sentence for this in the same change.

**Where it is kept.** The credential of an entry goes in the vault with the secrets of other subscriptions. The rest goes in the library file next to them, marked unsigned. The helper holds both, as for native subscriptions.

## The binary

**One release, one pin table.** The app carries the release it runs (the same `RELEASE` as the node add-on) and a table in `veilway-proto`, no IO, with two SHA-256 values for each target it ships for: the archive as the release publishes it (`.dgst`), and the executable inside it. Targets are the release's own: `linux-64`, `linux-arm64-v8a`, `macos-64`, `macos-arm64-v8a`, `windows-64` and, if the app ships for it, `windows-arm64-v8a`. The values are filled in by the builder from the release files and from a build the builder made apart from the app. A test fails the build when `RELEASE`, a Linux executable pin or an archive pin differs from `xray.rs` or `scripts/veilway.sh`, so the node and the apps cannot name two different Xrays. The table is inside the signed app release and nothing else is trusted: not a `.dgst` fetched at install, not a header, not a mirror.

**Install.** Only after the user's yes at connect time (see "What the app shows"). The helper does it, before the kill switch goes in, so the download is an ordinary fetch of the machine and not a request through a tunnel that is about to be built:

1. It downloads `https://github.com/XTLS/Xray-core/releases/download/<release>/Xray-<target>.zip`, or the same layout on the project's release mirrors if that fails. The chain is validated. The host is not trusted, so which host answered does not matter. The stream goes to `<folder>/xray.zip.part`, mode 600, and is hashed as it is written. Over the cap or over the time, it stops and deletes the file.
2. It compares the archive's hash with the pin before opening the archive. A mismatch deletes the file, writes the two values to the log, and installs nothing.
3. It reads the zip's central directory and takes the one entry named exactly `xray` (`xray.exe` on Windows). It inflates it to `xray.new` and stops at the cap. It ignores every other entry, including the geo files, which this config never uses. An entry with a path part, a link or a second entry of that name refuses the archive.
4. It hashes `xray.new`, compares with the executable pin, sets mode 755, syncs and renames it to `xray`. The `.zip` is deleted at every exit.

**Where it is.** `<data>/addons/xray/<release>/xray` in the platform layer's root-only data folder (the one the vault uses). Every folder up to the data folder is owned by root (Administrators or SYSTEM on Windows) and writable by nobody else. On Windows the ACL grants write to Administrators and SYSTEM only. The window never writes there.

**Checked before every start.** The helper opens the file once without following links (`O_NOFOLLOW`, or the handle of a file that is not a reparse point), checks the owner and that no one else can write to it or its folders, hashes that same open file and compares with the pin. A failure refuses the start, logs both values at warning and shows "the Xray add-on does not match this app". Where the system allows it the open file is what runs, so the file that was hashed is the file that runs:

- Linux: executed from `/proc/self/fd/N`, as the node does.
- Windows: the file is opened with sharing that denies writes and deletes, and kept open until Xray has exited.
- macOS: there is no way to execute a descriptor. The path is hashed and then run, and the root-owned folder is what stops a swap. This is a residual risk of root-only reach. The builder sets the immutable flag (`chflags uchg`) on the file as well.

**Update.** The folder is named by the release. When the app's release differs from the installed one, the installed one counts as not installed: the offer is "update the add-on", it asks again, and it deletes the old folder only after the new one has passed step 4. There is no update outside an app release, which is what keeps the pin table inside the signed update. The window between an upstream fix and the app that pins it is not defended (the threat model says so for the node as well).

**Removal.** "Remove the add-on" in the app's settings disconnects a profile that uses it, deletes `<data>/addons/xray` and removes the Linux user below. Removing the app's data folder removes it as well. Legacy profiles stay in the list and ask for the install again.

## How traffic reaches Xray

```
apps -> TUN -> engine -> userspace TCP/IP stack -> SOCKS5 on 127.0.0.1 -> Xray -> its server
```

The platform layer sees the same packet interface as for a native tunnel: whole IP packets in and out of the TUN. The engine gets a second kind of carrier. For a legacy profile it does not run WireGuard. It runs a userspace stack on the vendored `ipstack` that the node already uses, with the TUN's packets as input.

**The tunnel's own addresses.** There is no gateway in a link, so the engine uses `198.18.0.2` for the device and `198.18.0.1` for the gateway and resolver (a `/30`), and `fdfe:7665:6c77::2` and `::1` of that prefix for IPv6. If a network of the device overlaps the range, it takes `198.19.0.0/30`, and if that overlaps too the connect fails with the reason. Routes and resolver are set by the platform layer from these, as for any tunnel.

**TCP.** Each accepted flow opens a SOCKS5 `CONNECT` to the destination IP address with username and password (RFC 1929). The engine never sends a name: the stack sees addresses. A refused or failed connect ends the flow with a reset, an unreachable host with ICMP host unreachable.

**UDP.** Each UDP flow (the 5-tuple) gets its own `UDP ASSOCIATE` with the same login and uses the relay address Xray names, which is on `127.0.0.1`. The association ends with the flow or with its control connection.

**Everything else.** ICMP echo to the gateway address is answered by the stack, so a ping tells the user the tunnel is up. Every other ICMP, and every IP protocol that is not TCP or UDP (ESP, GRE, SCTP and the rest), is dropped by the stack, counted as `unsupported_packets`, and shown in the status. None of it goes anywhere: the default routes still point into the TUN, so a dropped packet cannot find another way. This is what "TCP and UDP only" means. Fragmented packets are reassembled by the stack under a cap of 64 KiB per datagram and 64 in flight, and dropped over it.

**Names.** The system resolver is pinned to the gateway address by the platform layer, as for a native tunnel (NRPT catch-all on Windows, the scoped resolver entry on macOS, `resolvectl` on Linux). The stack takes every query to the gateway address, UDP or TCP, and forwards it through Xray to `1.1.1.1` over UDP, with a TCP fallback through `CONNECT` when the association fails (lesson 6 of the repository). `9.9.9.9` is the second server. The user can change the pair in the settings of the app. A link cannot name a resolver. Names are therefore resolved by a public resolver as seen from the server, not by the provider's. A query to any other address on port 53 is an ordinary UDP flow. Nothing is answered from a cache, there is no fake-address scheme and no sniffing in Xray.

**Xray's own socket.** It must not enter the TUN. The engine already keeps its own transport sockets out through the platform layer's hook, and Xray gets the equivalent:

- macOS and Windows: `sockopt.interface` in the outbound is the physical interface's name. The pinned release's documentation lists it for Linux, macOS and Windows. The platform layer's kill switch allows the server's address, port and protocol, as it does for the engine's own transport.
- Linux: Xray runs as the system user `veilway-xray`, which the helper creates at install (no login, no home). The Linux layer adds to its table a `type route hook output` chain that sets the engine's mark on packets of that user (`meta skuid`), and the existing marked-socket rule of the kill switch allows only the server's address, port and protocol. Xray needs no capability, and `sockopt.mark` is not used because it needs `CAP_NET_ADMIN`.

The server name is resolved once per connect by the helper, before the kill switch goes in. Every address is checked with `payload::dialable` and against the device's own networks. The first usable address goes into the document as an IP literal, and `serverName` carries the name. A restart reuses it. A reconnect resolves again. On a change of the device's networks the supervisor restarts Xray with the new interface name (the settle wait of the engine applies).

The gate decides this section, not the text: if a platform's check shows Xray's socket in the TUN, that platform adds a host route for the server through the physical gateway and ships with it, or does not ship.

## The generated document

The document is built by one function of the engine from a validated profile and three values of the run (the loopback port, the login and the physical interface). It is a fixed template, and the profile's fields fill typed slots. It is passed to Xray on standard input (`run -config stdin:`), never in a file, on a command line or in the environment.

| Part | Content |
|---|---|
| `log` | `access` `none`, `loglevel` `warning`, `maskAddress` `full` |
| `inbounds` | one `socks` inbound on `127.0.0.1` and a port the helper picked, `auth` `password`, one account `veilway` with 24 random bytes in hex, `udp` `true`, `ip` `127.0.0.1`, `sniffing` off |
| `outbounds` | one `vless`, `vmess`, `trojan` or `shadowsocks` outbound with the typed fields, and a `blackhole` tagged `refused` |
| `routing` | `domainStrategy` `AsIs`, one rule that sends the inbound to the outbound. No geo rules, no user rules. |
| absent | `api`, `stats`, `policy`, `dns`, `metrics`, `reverse`, `fakedns`, `observatory`, `mux` |

The mux is off even where a link asks for it: it changes the shape of the traffic and nothing in the item needs it. A test walks the output and fails on any key outside this table, and golden documents for each protocol and stream pin the exact output for a fixed profile. The profile's strings reach the document only as values of the slots they were validated for, and a value is built with the JSON writer, never by joining text.

## Supervision

The supervisor lives in the helper, beside the engine, and follows the node's rules for the same job (`xray.rs`, `RESTART_MIN` and `HEALTHY`).

- **Start.** Check the pin, bind the loopback port, make the login from the system's random source, spawn, write the document to standard input, close it. The stack accepts flows only after the SOCKS handshake with Xray has worked once.
- **Child rights.** Empty environment, working directory at the root of the filesystem, no console window. Linux: `veilway-xray`, `no_new_privs`, a kill signal when the helper ends, no capability. macOS: user `nobody`, a kill when the helper ends (kqueue on the parent). Windows: a restricted token without the administrators' group and without privileges, in a job object that kills it when the helper's handle closes. If the rights cannot be dropped, Xray does not start and the status says so.
- **Liveness.** The child is alive, and every 10 s a local SOCKS handshake with the login succeeds. A dead child, or two handshakes missed, is a failure.
- **Reach.** Xray has no health endpoint, and the app does not send probes to a third party, which would be a fingerprint. The check is the outcome of real flows: 8 in a row failing over at least 30 s with none carried sets "the server is not answering". It does not restart Xray, since a restart does not help, and it clears at the first carried flow.
- **Restart.** After a failure, restart after 1 s, then 2, 4 and so on to 60 s, and after a run of 60 s or more start again from 1 s. There is no count after which it stops: a failure is never latched. The state change is logged at info with the exit code and the wait, and the status counts restarts.
- **While it is down.** The TUN, the routes and the kill switch stay. Open flows are reset, new ones fail at once with a reset, UDP is dropped. Nothing is let out.
- **Logs.** Standard output and error are read into the ring. A line is cut at 512 bytes and passed to the window only after the helper's log filter, which removes the address and port of the server and anything that looks like a credential. The document is never logged.
- **Stop.** Close the stack's flows, close standard input, wait 8 s, then kill the child. The platform layer's stop then runs as it does for a native tunnel, and the kill switch is lifted only by a stop the user asked for.
- **Counters.** Open and failed flows, carried bytes both ways, `unsupported_packets`, dropped UDP flows, restarts, and the time of the last restart. No rating word, no profile text and no address in the status. Reasons are plain words with a stable code: `xray_missing`, `xray_mismatch`, `xray_start_failed`, `xray_restarting`, `server_not_answering`, `profile_refused` with the part that failed.

## What the app shows

**The offer.** Connecting to a legacy profile with no add-on, or with one from another release, shows a dialog before anything is downloaded or changed:

> This profile needs Xray-core, a program made by another project. Veilway can download version `<release>` from github.com/XTLS/Xray-core (about `<size>` MB) and check it against a fingerprint built into this app. It runs on your computer with limited rights and only carries this profile's traffic.

The buttons are "Install and connect" and "Cancel". A Cancel does nothing, and the profile stays in the list. A failed check says which step failed in plain words and leaves nothing installed.

**The profile.** A row and a detail view carry "TCP and UDP only" and "unsigned". The detail view lists, in plain words, what is different from a native profile:

- It is not signed, so whoever is on the way can change the list at every refresh.
- It has no control channel: no exit choice, no usage, no notices from the provider and no MTU discovery.
- Ping and other protocols than TCP and UDP do not work.
- Names are resolved by a public resolver through the server, not by the provider.
- The kill switch holds, but while Xray restarts nothing passes.
- Xray is a third-party program. A flaw in it is a flaw on this computer, mitigated by the limited rights, not removed.
- It has none of the native transports' features (the borrowed site mode, `fronted` shapes, the control channel, rating above the legacy cap).

The rating shown is the legacy cap of the core, with the words the app already uses and no new ones. A profile that is refused shows its reason where the button would be.

## Threats

| Threat | Answer |
|---|---|
| A hostile subscription or link sets fields that become config, paths or flags | Fields are typed and validated by the reader, the profile table above refuses the rest, the document is a fixed template, and Xray gets it on standard input. Nothing is a file name, a URL or a command line. The golden and key-walk tests and `fuzz_links` check it. |
| A link turns on something quieter than it looks (`allowInsecure`, a weak cipher, no TLS) | Refused at connect, with the reason shown. |
| The binary is replaced on disk, or the download is replaced on the way | The pin table is in the signed app. The archive is checked before it is opened, the executable after it is written, and again before every start from the open file. A root-owned folder keeps others out. Only root can swap it, and root already owns the helper. |
| An upstream Xray release is bad, or has a flaw before the app pins a fix | Not defended. The app never fetches an unpinned Xray. |
| Another local user reaches the SOCKS port | Loopback only, and a login that is new for each run and known to the helper and Xray. A process that connects without it is refused. The UDP relay of Xray takes datagrams from any local process, which the node's hop avoids with a `/proc` lookup. Here the same process already reaches the same exit through the TUN, so the relay gives no reach the routes do not give. This is written as a limit. |
| A process of the same user reads the login | It can already drive the helper (see the desktop app's channel). Same trust as `sudo veilway connect`. |
| Xray crashes, hangs or is killed | The TUN and the kill switch stay, flows reset, the supervisor restarts it. The gate checks that nothing reaches the physical interface but Xray's server during it. |
| Xray's socket enters the TUN | A loop, not a leak. The gate checks each platform. |
| Names leak to the local network | The resolver is pinned to the tunnel's gateway. A query goes through Xray. |
| The server's name is changed by the local network at resolve time | The name is resolved before the kill switch, so a hostile resolver can give a wrong address. The checks for dialable addresses apply, and TLS or Reality with the profile's `sni` fails for a wrong host. Plain `vmess` and Shadowsocks have only the key. |
| A flood of flows exhausts the machine | The caps in the table, and the stack's per-flow buffer of 64 KiB. |
| The Xray parser meets data from a server | The server is the provider's, as chosen by the user. The child's limited rights are the answer. |

## Tests and the gate

The builder adds, in the change that adds the code:

- **Unit tests.** The pin table against the node's constants and the script's archive pins. Each row of "Which profiles can connect", accepted and refused. The document builder, golden for each protocol on each stream, and the key walk. The install steps against an archive of the wrong hash, a zip with a path entry, two entries of one name, a zip bomb at the cap, and a file replaced between hash and check. The stack: ICMP echo to the gateway, ICMP elsewhere and ESP dropped and counted, fragments, the flow caps, DNS over UDP and TCP.
- **Fuzz targets.** `fuzz_links` with the new fields, the zip entry reader, the SOCKS5 reply reader, and the stack's packet input (as the node's `ip.rs` has).
- **`scripts/gate-xray-client.sh`**, in Docker containers with the pinned Xray as the server, run by hand and in CI where a runner allows it. For each of VLESS over TLS, VLESS over Reality, VMess, Trojan over `ws`, and Shadowsocks over `tcp`, and once over `grpc`: a TCP fetch from a test web server and a UDP echo, both through the tunnel. A DNS query from a client container reaches the resolver only through Xray. A capture on the physical interface shows only the server's address and port. A ping to the gateway is answered, a ping to the web server is dropped and counted. A `kill -9` of Xray gives a window in which the capture is still clean and flows come back after the restart. A changed byte in the executable, and an archive of another hash, are refused and logged. A process of another user connecting to the SOCKS port without the login is refused. The listening sockets of the Xray process are only the loopback SOCKS port.
- **Windows** runs the gate's client half on the GitHub runner, as the Windows layer's smoke test does. **macOS** has never run on a real Mac. Its unit tests run in CI, its gate is a by-hand list for a real Mac, and the app marks Xray profiles on macOS "not tested" in the offer until that list has passed.

## Out of scope

- Android. Apps cannot run a downloaded binary there, and the item leaves it out of v0.2.0.
- Routing, geo or domain rules inside Xray, a fake-address DNS scheme, `mux`, Xray's own DNS, its stats and API, and per-app rules.
- Transports and options not in the table: `kcp`, `quic`, `h2`, `xhttp`, `httpupgrade`, Shadowsocks plugins, VLESS `encryption`, certificate pins.
- Xray as a server on a desktop. The node's add-on is the server side.
- A command line client for legacy profiles. `veilway connect` keeps refusing them, and the code lives in the engine so a later item can add it.
- Updates of Xray apart from an app release.

## Changes to other pages

The subscription page: pasted legacy links, and "Connecting needs the add-on" now pointing here. The threat model: a section next to 5.12 for the client side, and rows for the legacy link fields reaching the document (invariant 20a, now with a build) and for the binary pin. The Xray manual: a client section. The client manual: the offer and the removal.

## Open questions

- Whether macOS and Windows should create a dedicated account for Xray as Linux does. This page uses `nobody` and a restricted token because they need no new account. It is weaker against a flaw that reads other users' files.
- Whether to keep the public resolver pair as defaults or ask the user on first Xray connect. A resolver chosen by the app is a choice made for the user.
- Whether the Windows `sockopt.interface` option holds under the NRPT and NCSI rules of lesson 3. The gate on the runner decides.
