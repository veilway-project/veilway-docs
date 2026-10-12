---
title: Protocol overview
description: The layers of the Veilway protocol and what each one is responsible for.
---

:::caution[Not written yet]
This page is a stub. The specification is not written and nothing here is normative yet.
:::

This page will describe the protocol as three layers:

- the tunnel, which is WireGuard and is described as such
- the transport, which carries WireGuard datagrams across the network
- the control channel, a small authenticated API inside the tunnel

It will also state the versioning rules and which parts are stable.
