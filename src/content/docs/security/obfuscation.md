---
title: Obfuscation layer status
description: What the Veilway obfuscation layer is for, what it does not do, and what has and has not been tested or reviewed.
---

:::danger[Experimental, not externally reviewed]
The obfuscation layer is built and ships in the alpha. It is experimental, and nobody outside the project has examined it. Every transport is rated Detectable: a network that looks closely can tell Veilway from ordinary traffic. If being noticed would put you at risk, do not rely on this layer.
:::

This page is for readers who want to know what to expect, in plain words. The exact formats are on [Transports](../../protocol/transports/) and [Control channel](../../protocol/control-channel/), and the terms are on [Protocol overview](../../protocol/overview/).

## Two different things: encryption and obfuscation

**Encryption** keeps what you send unreadable. In Veilway that is WireGuard, a published and widely examined design, used unchanged. It does not depend on anything on this page.

**Obfuscation** tries to keep the connection from being recognized as a VPN and blocked. That is the layer this page is about. It is new, it is built by this project from standard parts, and nobody outside the project has reviewed it.

If the obfuscation fails, your traffic is still encrypted. What you lose is the cover: someone watching the network may be able to tell that you use Veilway, or that a server is a Veilway node.

## What the obfuscation is for

It tries to do three things:

1. Remove the fixed bytes and exact packet sizes by which WireGuard is recognized.
2. Make a server answer everyone who is not a user either with nothing, or with the pages of the operator's own web site.
3. Give the app several ways to reach a server, so that blocking one address or one name is not the end.

## What it does not do

- **It does not make anything undetectable or unblockable.** The most this project will ever be able to say is: these named tests, on this date, did not tell a transport apart from ordinary traffic.
- **It does not hide how much you send, when, or in which direction.** A long connection that carries a lot of data to one address is visible on every transport.
- **It does not hide your address** from the network, from the server, or from a content delivery network (CDN) in between.
- **It does not hide you from the server's operator.** The operator sees your address, your account, every site you reach and every name you look up. Veilway is a VPN, not an anonymity network.
- **It does not help on a network that only allows what it recognizes**, that blocks a whole CDN, or that blocks the server's address when there is no other way in.
- **It does not protect a device or a server that someone else controls.**

## Who it is designed against

In brief, from the [threat model](../threat-model/): the section on a censor with deep packet inspection and active probing. The design assumes someone who can:

- see every packet between you and the server, with its size and timing, and keep records;
- connect to the server like any stranger, send it anything, and replay what real apps sent;
- drop, delay and block connections;
- download the app and get a subscription, as any user can;
- in some cases, read inside the outer TLS layer: a CDN always can, and so can whoever controls a certificate authority your device trusts.

It is not designed against someone who watches both your connection and the server's far side and matches them by timing.

## What exists today

Six transports are built, on the node and in the client: `udp`, `udp-obfs`, `tls`, `ws`, `ws-plain` and `fronted`. All are rated Detectable. The [alpha page](../../alpha/) says how far each has been tested.

- `udp` is plain WireGuard. It is recognized by its first bytes and its packet sizes.
- `udp-obfs`, `tls`, `ws`, `ws-plain` and `fronted` are the obfuscated ones. Each carries WireGuard inside Veilway's own framing, with a proof that you are a user, a replay memory, and limits per device and per source.
- On a plain `wireguard` inbound, `ws` is the older format. It puts WireGuard inside a WebSocket inside TLS, and that is not obfuscation: the server answers any stranger in a way that identifies it, and WireGuard's packet sizes show through.

Not built: the frame appearance of `ws-plain`, `faketls`, `quic`, Encrypted Client Hello and built-in certificate issuance.

Designed and not built, each on a page of its own and none reviewed from outside: [HTTP/2](../../protocol/http2/) on the stream transports, [other shapes of `fronted`](../../protocol/fronted-shapes/), and [borrowed-site mode](../../protocol/borrowed-site/) (`faketls`). Borrowed-site mode ships as alpha when it is built: off by default, labeled alpha in the panel and the apps, with a warning that it is new and unreviewed. Nothing in the tables below counts them.

## Four classes of transport

The app sorts transports into four classes, and never moves to a lower one without asking you:

- **Cover** (`tls`, `ws`, `fronted`, and the designed `fronted-shaped` and `faketls`): the connection is shaped like something ordinary, TLS to a web site.
- **No cover** (`udp-obfs`): WireGuard's bytes are hidden, and the result looks like nothing in particular.
- **Exposed** (`ws-plain`): WireGuard's bytes are hidden, and the connection is plain HTTP. The network can see the server's name and can tell that you use this app, and when and how much, now and later in its records. It cannot see what you send. If the server's key for this transport ever leaks, anyone who kept records of the network can tie all of your connections over it together, back to the key's last change. It is not built.
- **Plain** (`udp`, and `ws` on a plain `wireguard` inbound): nothing is hidden.

A class says what a transport tries to do. It does not say that it succeeds.

## Known limits, transport by transport

| Transport | What it does | What someone watching can still tell |
|---|---|---|
| `udp` | Nothing. It is plain WireGuard. | That it is WireGuard. |
| `udp-obfs` | Makes every byte look random and varies packet sizes. The server stays silent to strangers. | That it is random-looking UDP to a port that answers nobody, which is unusual in itself. It imitates no known protocol, and a network that blocks or slows unknown UDP stops it. It stays rated Detectable. |
| `tls` | Real TLS to a name the operator owns, ended by the node. Strangers get the operator's web site. | A long, busy connection to that name. The TLS handshake that answers is the node's own and does not match the web site behind it, which a stranger can check without any secret. For that reason it is rated Detectable whatever its tests show. The name is published when its certificate is issued. A client that offers only HTTP/2 gets a fatal alert from the node, where many web servers would answer. Offering HTTP/2 from the node is designed and not built, and it would widen what a probe can tell, because the node's own HTTP/2 code would answer a stranger and not the web site. |
| `ws` | The same, behind the operator's ordinary web server or a CDN, so the TLS that answers is that server's. | A long, busy WebSocket connection. Behind a CDN, the CDN sees your address and the shape of the traffic. It has been tested behind nginx and HAProxy, not behind a real CDN. |
| `fronted` | Sends data as many small web requests through a CDN, for networks where nothing else works. | Steady polling of one CDN host for as long as you are connected. It is slow, and it speaks HTTP/1.1 only, where a browser would offer HTTP/2 first. HTTP/2 is designed and not built. The CDN sees your address, and the CDN can end it. It has not been run behind a real CDN. |
| `fronted-shaped` (designed, not built) | The same polling through a CDN, with a method, a place for the data and a downstream form that the operator picks. Data can ride in the query, the path or a header, and answers can come as one long event stream. | Everything `fronted` shows. In addition, the shape is shared by every installation that picks it, and a stream of base64 events, a random header or a long random path is not what a browser sends. Data in a URL is kept in the CDN's logs. It is slower than `fronted`, and a pattern used by many installations is a signature again. |
| `faketls` (designed, not built) | The server holds no certificate. A client proves itself inside its first TLS message, and everyone else is relayed byte for byte to a real site that the operator borrows, so a prober sees that site's own certificate. | The server's address is not the site's, and the path to it is not the site's path. A censor that records a user's hello can read it with the server's key and link a device within an hour. The server's answer to a user is made by the node and can only be made close to the site's. A site that changes its behavior makes the copy wrong. A holder of a subscription can tell the node from the site. Rated Detectable until its tests pass. |

Limits that every obfuscated transport shares:

- **The first moments of a connection have a fixed order.** Padding changes the sizes, not the order.
- **Regular small exchanges remain.** WireGuard renews its keys every minute or two, and an idle tunnel sends a small packet and gets one back. Their sizes and times are varied, and they still happen.
- **Large transfers show a steady packet size.**
- **What the apps inside the tunnel do shows through as a pattern of sizes.** Published research has recognized tunnels by the TLS handshakes of the apps inside them. Nothing here defends against that.
- **The app's own TLS has to look like a browser's, and browsers change.** The app's hello is built on BoringSSL and set up to match Chrome 155. A copy that was right for one browser release becomes rare, and so recognizable, when that release ages. Some details still differ: no TLS session is resumed, the requests inside it are HTTP/1.1 where Chrome offers HTTP/2 first (designed, not built), and the fetch of a pinned subscription page sends a hello that no browser sends.
- **Switching between transports is visible.** An app that tries one way in, then another, then a third, shows a pattern. An app that sends random-looking UDP to an address and then opens a TLS connection to the same address has pointed at that address.
- **A stranger's answer comes through the node.** It arrives a little later than it would from the web site itself, and that can be measured.

## What others learn when something leaks

| Who | What they learn | What they do not learn |
|---|---|---|
| Someone with a copy of your subscription | Every server address and name in it, and that those servers are Veilway nodes. They can block them and connect as you. On `udp-obfs` they can also pick your connections out of recorded traffic. | What you sent. Which connections belong to which other user. |
| Someone with any subscription for the same server | On `udp-obfs`: that two connection openings within about two minutes came from one device, without knowing whose. | Anything else about you. |
| Someone who gets a server's WireGuard key | On plain `udp` and legacy `ws`: which device started each recorded connection. | What was sent. |
| Someone who takes over a server | Everything that passes through it from then on: addresses, sites, names, timing, and anything not encrypted by the site or app itself. | What passed before, if they did not record it. Your device's private key, unless the provider keeps a copy of it on that server, which depends on how the provider issues keys. |
| A CDN in the path | Your address, that a long session exists, and its sizes and timing. | That it is WireGuard, from the bytes alone. Which user you are. |
| Someone who later gets a server's transport key and old web server logs | That several logged connections came from the same device. | What was sent. |

A subscription is a secret. Anyone who has it can see where your servers are.

## Considerations for other parties

Some of these techniques lean on people who did not ask to be involved. The specification sets limits for their sake, and operators carry the responsibility.

**The decoy web site.** A server answers strangers with a real web site.

- It is the operator's own site, on the operator's own name and certificate. Nothing ships with a default.
- Version 1 has no option to point a decoy at someone else's site. Doing so would send that site traffic it did not ask for, from the server's address, and show its pages under another name. The one design that does it is `faketls`, below, and it is not built.
- The server passes strangers to that one site only. It cannot be used as an open relay, and it never sends a stranger more than the site answered.

**Content delivery networks.**

- A tunnel through a CDN is steady traffic through a service that may limit it or forbid it. Operators must read the CDN's terms. The CDN can close the account.
- The app polls no faster than a fixed floor, tries only a few fronts per hour, and waits instead of trying other fronts when a server refuses it, so that a restart or a used-up quota does not turn into load on the CDN.
- "Domain fronting" in the classic sense shows the network a name that belongs to someone else on the same CDN. Most CDNs forbid it, several have switched it off, and if it is noticed the owner of that name may be the one who is blocked. The app and the panel never set this up by themselves.

**Borrowing another site's TLS (`faketls`).** This transport relays strangers to a third-party site so that the server appears to be that site. It is designed on its own page and not built. It puts every probe, every stranger's connection and an early connection for each user's handshake on a site whose owner has not agreed, from the server's address and under that site's name. The site learns when users connect and how many strangers come, though not who a user is. If it is noticed, the site may be blocked or its owner questioned, and it may break the site's terms or the law where the operator is. The project decided to ship it as alpha, with these limits: the operator always chooses the site, none is suggested or shipped, the config refuses a site until the operator has acknowledged what this means, connections to the site are capped per source, in total and per second, and the panel and the apps label it new and unreviewed. [Borrowed-site mode](../../protocol/borrowed-site/) has the rest, in "The third party".

## How a profile is rated

The core computes a rating for each profile from the settings that are actually in force, and a provider cannot raise it. The rating is a word for operators: the panel and these pages use it. The app does not show it, because a label scares some users and makes others too sure of themselves. The app shows only the connection's name, and for an Unsafe profile a plain warning and one explicit tap before it connects.

- **Unsafe**: certificate checking is switched off, or there is no encryption.
- **Detectable**: encrypted, and recognizable. A censor can see that this is a tunnel and can block it, without reading what is inside.
- A `tls` profile whose certificate is self-signed and pinned in the signed subscription is not Unsafe: the pin is a check, and a stricter one than a public authority's. It is Detectable, and a self-signed certificate is one more thing a censor can notice.
- **A higher rating** exists in the code under the name "Protected": a censor that watches the connection would see what looks like an ordinary site. No native profile gets it.

What a higher rating would need, all of it:

1. The transport is `ws` or `fronted`. `udp`, `ws` on a plain `wireguard` inbound and `udp-obfs` are always Detectable, and so is `tls`.
2. This release has recorded, published results for the transport: the probe test, the length and timing measurement including the first records of a connection, the comparison of the app's TLS with the browser it copies, and a comparison of the server's TLS with ordinary web servers.
3. No weaker service shares the server's address: no datagram transport, no legacy transport, no plain `wireguard` inbound, no panel, no subscription endpoint.
4. You did not agree to a lower class for the connection in use.

Who checks point 3: the app checks it itself for everything it can see, which is every transport and address in your own subscription. It cannot see what else a provider runs on an address. For that it depends on the provider declaring it, and a provider can stay silent. A provider can lower a rating. It can never raise one.

Even then the rating would mean "passed the project's own tests on the release date". It would not mean "cannot be detected". The word "Protected" invites that reading, and whether to keep it is an open question below.

## What is new and unreviewed

| Part | Built from | Follows | Reviewed by anyone outside |
|---|---|---|---|
| Proof of being a user, on `tls`, `ws` and `fronted` | HPKE (RFC 9180), HMAC-SHA-256 | Oblivious HTTP's use of HPKE, and the pre-shared key binder of TLS 1.3 | No |
| Framing with padding | ChaCha20-Poly1305 | TLS 1.3 record padding | No |
| `udp-obfs` envelope | HKDF-SHA-256, HMAC-SHA-256, ChaCha20-Poly1305 | Shadowsocks AEAD and Shadowsocks 2022, with a mask in the shape of QUIC header protection | No |
| Replay protection | A time window, a table, a floor and a stored limit | Shadowsocks 2022 | No |
| Handing strangers to a decoy site | An existing HTTP implementation | Trojan | No |
| HTTP/2 on the stream transports (designed, not built) | An HTTP/2 implementation on the node and on the client | RFC 9113 and RFC 8441, with values from a capture of Chrome | No. The node would be an HTTP/2 server to strangers and a gateway to the web site, which no earlier part of the design has been. |
| Shapes of `fronted` (designed, not built) | The `fronted` framing with a new chunk numbering and a Server-Sent Events reader | RFC 9110 and the HTML living standard for event streams | No |
| `faketls` (designed, not built) | A proof sealed in the ClientHello, a purpose-built TLS 1.3 handshake on the node, and a relay to a third-party site | RFC 9180 for the key agreement, RFC 8446 for the handshake. REALITY in Xray is prior art for the idea, and its code was not read. | No. The proof, the node's handshake and the copy of a site's flights are new constructions with no analysis behind them. |
| Control channel sign-in | HMAC-SHA-256 | Textbook challenge and response | No |

No cryptographic primitive is new, and none is implemented in this project. The combinations are new. Following a published design does not mean inheriting its analysis.

## What has been tested and reviewed

Tested:

- The node's listeners and the client library are tested against each other, and the client engine against a real node (`udp-obfs`, `tls`, `ws` and `fronted`).
- A stranger's request gets what the decoy origin gives. This is compared byte for byte, including how the connection ends and when, for `tls` against one web server on the same machine, and for `ws` and `fronted` through a front written for the test and through real nginx with nginx and then HAProxy as the origin, in Docker.
- The parsers that read network input (proofs, request lines, chunks, `fronted` bodies, the replay file, the client's frame and answer readers) have fuzz targets, which are run by hand.
- The client's TLS hello is checked against a capture of Chrome 155 by its JA4 value.

Not done:

- Probe tests and length and timing captures on real networks.
- A comparison of the node's TLS handshake on `tls` with ordinary web servers.
- A run behind a real CDN, or in front of any web server product other than nginx and HAProxy.

| Review | Status |
|---|---|
| Review by the project's own developers | Done during development |
| Review by anyone outside the project | Not done |

Before any transport is described as more than Detectable, the results of the tests the threat model defines are published for that release.

## Advice

For users:

- Assume that someone watching your network can tell you are using a VPN-like tool. Choose what you do accordingly.
- Keep your subscription private. Do not post it or share a screenshot of it.
- Keep your device's clock right. The app refuses to guess when it is wrong.
- Prefer a profile on a name the provider owns. The app does not label profiles; if it warns that a profile is unsafe, take that seriously.
- When the app asks whether it may use a lower class of transport, the honest answer to "is this easier to recognize?" is yes.

For operators:

- Use your own name and certificate, with an ordinary web server and real content in front, and the node behind it on a loopback address (`ws`). Behind a CDN, keep that web server between the CDN and the node. That is the first choice, ahead of every fronting technique and ahead of `tls`.
- Put datagram transports and cover transports on different addresses. Do not put a plain `wireguard` inbound, a legacy `ws` transport, a panel or a subscription endpoint on an address that carries a cover transport. The weakest service on an address identifies it.
- Give each node its own keys. Never copy an inbound's keys to a second node.
- Rotate the node's transport key on a schedule and destroy the old one. Keep request queries out of your web server's logs.
- A certificate from a public authority is logged publicly within hours, and with it the name. A fresh name that hosts only a decoy is easy to find.
- Give different users different parts of a front list, so one copied subscription does not block every front.
- Keep the server's clock right, let it write its replay file, and never restore that file from a backup.

## Open questions

| Question | Default today |
|---|---|
| Should "Protected" be renamed, or the rating split into "encrypted" and "hard to recognize"? | Undecided. No native profile gets a rating above Detectable, so the question does not block anything. |
| Should `faketls` be built? | Yes, as alpha: off by default, labeled new and unreviewed, and rated Detectable until its tests pass. It is designed, not built. Whether it should ever lose the alpha label depends on an outside review. |
| How does the app learn that a weaker service shares a server's address? | It computes what it can from its own subscription. Beyond that, through a cap in the signed profile that can only lower the rating, which depends on a provider that tells the truth. |
| How much later does a stranger's answer arrive through the node? | Not measured. |
