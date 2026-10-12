---
title: Transports
description: How tunnel datagrams are framed and carried over each transport.
---

:::caution[Not written yet]
This page is a stub. No transport is specified here yet.
:::

This page will specify:

- the framing shared by all transports, including length and padding
- each transport (plain UDP, obfuscated UDP, TLS, WebSocket and others) and its status
- how a server responds to peers that do not authenticate
- fronting options for TLS-based transports
- known limits, such as the cost of carrying IP packets inside a TCP stream
