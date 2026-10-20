---
title: Rust SDK
description: Building a custom client or server on the Veilway Rust crates.
---

:::caution[Not a full guide yet]
There is no minimal client or server example here yet, and the API of these crates is not stable. They are at version `0.2.5`. No crate is confirmed on crates.io, so use them as git or path dependencies.
:::

The crates live in `crates/` of the [repository](https://github.com/veilway-project/veilway):

| Crate | Path | What it does |
|---|---|---|
| `veilway-proto` | `crates/veilway-proto` | Wire formats of the native protocol: keys, chunks, the control channel, subscriptions. Pure code, no IO. |
| `veilway-transport` | `crates/veilway-transport` | The client side of `udp-obfs`, `tls`, `ws` and `fronted`: it opens a session to a node and carries WireGuard datagrams. |
| `veilway-engine` | `crates/veilway-engine` | The client engine without an OS layer: the race of candidates, session carrying, subscription import and status. |
| `veilway-wg` | `crates/veilway-wg` | A multi-peer WireGuard layer over boringtun, with a WebSocket relay. |
| `veilway-core` | `crates/veilway-core` | The node engine: config v1, routing, quotas, userspace TCP/IP exits and the native transports. |
| `veilway-api` | `crates/veilway-api` | The server side of the [control API](../../reference/api/), on a unix socket. It is not a client. |
| `veilway-linux`, `veilway-macos`, `veilway-windows` | `crates/veilway-*` | The client's layer for each OS: TUN device, routes, kill switch and DNS. |

To use one from another project:

```
veilway-proto = {git = "https://github.com/veilway-project/veilway"}
```

`veilway-transport` builds BoringSSL from source, so it needs `cmake` and a C compiler (and NASM and Ninja on Windows). For a client of the control API, see the [TypeScript SDK](../typescript/).
