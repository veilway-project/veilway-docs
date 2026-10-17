---
title: HTTP/2 on the stream transports
description: How the client offers and speaks HTTP/2 on tls, ws and fronted, WebSocket over HTTP/2, what the node must answer, and what stays visible.
---

:::caution[Not built, designed here]
This page is a design for version 0.2.0. Nothing on it runs. Today the node offers `http/1.1` only, the client offers `http/1.1` only, and `fronted` is an HTTP/1.1 client. Every value that says it comes from Chrome is a draft taken from published descriptions of recent Chrome versions, and it is replaced by a dated capture of Chrome 155 before the client sends it. Nobody outside the project has reviewed the design. Every transport stays rated Detectable, and `tls` stays capped.
:::

The client's TLS hello is shaped like Chrome's, but the requests inside it are HTTP/1.1, where Chrome offers `h2` first. This page adds HTTP/2 (RFC 9113) to the stream transports of [Transports](../transports/): ALPN `h2` in the hello, Chrome's frames and fields, WebSocket over HTTP/2 (RFC 8441) where the server allows it, and `fronted` requests as HTTP/2 streams. It also says what the node must answer when it ends TLS, and what changes behind a web server or a CDN. Read [Transports](../transports/) first for the proof, the chunk, the decoy handoff and the proxy path. Nothing here changes the proof, the chunk, the keys or the replay rule. Statements about how browsers, web servers and CDNs behave are not made on this page as facts. They are drafts, and they are listed under "Still to measure".

## Where HTTP/2 applies

| Transport | Who speaks HTTP/2 to the client | What the node speaks | Status of this design |
|---|---|---|---|
| `tls` | The node | HTTP/2 to the client, HTTP/1.1 (or `h2c`) to the decoy origin | Designed. Off by default on the node. |
| `ws` | The operator's web server or the CDN | HTTP/1.1, unchanged | Designed for the client. No node change. |
| `fronted` | The CDN or the operator's web server | HTTP/1.1, unchanged | Designed for the client. No node change. |
| `udp`, `udp-obfs` | Not applicable | Not applicable | |

The node's `ws` and `fronted` listeners stay HTTP/1.1 listeners for trusted proxies. A front that speaks HTTP/2 to the client turns its requests into HTTP/1.1 for the node, as it does for any site behind it (see "The proxy path"). The node has no `h2c` listener in this version.

## Numbers that are judgement calls

These numbers were chosen, not derived, and none has a measurement behind it. They add to the tables on [Transports](../transports/). Values taken from Chrome are in "Chrome's HTTP/2" and are not repeated here.

| Name | Value | Used by |
|---|---|---|
| ALPN on a connection that may carry fetch-type requests | `h2`, `http/1.1`, with ALPS | client, `fronted`, and `tls`, `ws` in mode `full` |
| ALPN on a connection made for a WebSocket | `http/1.1` alone | client, `tls`, `ws` |
| Wait for the server's first SETTINGS frame | 10 s after the TLS handshake | client |
| A candidate that lacks extended CONNECT, or answered `421` | remembered for 1 hour, then tried again | client |
| Request body on HTTP/2 | whole chunks, up to the lesser of 65,536 bytes and the stream window the server announced | `fronted` client |
| New connection before the stream id passes | 2^30 | `fronted` client |
| Node `SETTINGS_MAX_CONCURRENT_STREAMS` | 100 | `tls` node |
| Node `SETTINGS_MAX_HEADER_LIST_SIZE` | 65,536 | `tls` node |
| Node `SETTINGS_HEADER_TABLE_SIZE` | 4,096, and the node's own encoder table is never larger | `tls` node |
| Node `SETTINGS_INITIAL_WINDOW_SIZE` and connection window, until a stream has proved to be a user's | 65,535 and 65,535, the defaults of RFC 9113 (section 6.9.2). The node sends no `INITIAL_WINDOW_SIZE` and no connection WINDOW_UPDATE. | `tls` node |
| The same, once a stream has proved to be a user's | 6,291,456 and 15,728,640, which is about 250 Mbit/s at 200 ms. Sent then, by a second SETTINGS frame and a connection WINDOW_UPDATE. | `tls` node |
| Header block (HEADERS and its CONTINUATION frames) | at most 65,536 bytes on the wire, at most 10 s to arrive | `tls` node |
| Decoded header list | at most 65,536 bytes, each field counted as name + value + 32 (RFC 9113, section 6.5.2) | `tls` node |
| First HEADERS frame after the preface | at most 10 s | `tls` node |
| Streams opened on one connection | at most 200 in 10 s | `tls` node |
| Upstream connections to the decoy per client connection | 6 for a connection that has not proved a user. 1 for the strangers' streams on a connection that has. | `tls` node |
| Upstream connections to the decoy per direct source | 16 in all, over at most 4 relayed HTTP/2 connections | `tls` node |
| Answer bytes held for a stranger | 262,144 per stream, 1,048,576 per connection, 67,108,864 per listener | `tls` node |
| A stranger's stream whose peer window stays zero | reset with CANCEL after 30 s | `tls` node |
| Streams that ended before their answer was complete, whoever reset them | 100 in 30 s on one connection, then GOAWAY with ENHANCE_YOUR_CALM and close | `tls` node |
| Frames that carry nothing: DATA of length 0 without END_STREAM, HEADERS with no fields, PRIORITY, unknown types, and on a connection that is not a session's, WINDOW_UPDATE | 1,000 in 10 s on one connection, then GOAWAY with ENHANCE_YOUR_CALM and close | `tls` node |
| PING and SETTINGS frames not yet answered | at most 100 | `tls` node |
| Connection with no open stream | closed after 300 s | `tls` node |
| Node SETTINGS_MAX_FRAME_SIZE | 16,384, which is the default and is not sent | `tls` node |

The node's connection and stream windows follow one rule: a window must hold at least the rate times the round trip time of the tunnel, or the window and not the path sets the speed. The window is paid for in memory only when a reader falls behind, because credit is returned as bytes are read (see "Flow control and the datagrams").

## Modes

A candidate in a profile has an `http2` member. A node's `tls` transport has an `http2` member too.

| Member | Value | Meaning |
|---|---|---|
| Candidate `http2` | `off` | `http/1.1` alone everywhere, as today |
| | `fetch` (default) | `fronted` offers `h2` and `http/1.1` and speaks what the server picks. `tls` and `ws` are as today: the WebSocket connection offers `http/1.1` alone and upgrades with HTTP/1.1. |
| | `full` | As `fetch`, and `tls` and `ws` first try WebSocket over HTTP/2 (see "WebSocket over HTTP/2") |
| Node `http2` on a `tls` transport | `off` (default) | `http/1.1` alone, as today |
| | `on` | The node offers `h2` and `http/1.1` and answers both |

The default of `fetch` follows what Chrome does. A `fetch()` from a page goes over HTTP/2 when the server picks it. A page's `WebSocket` opens its own connection with `http/1.1` alone, unless an HTTP/2 connection to the same host is already open and has announced extended CONNECT. A tunnel client has no page load before it, so a new connection whose first stream is an extended CONNECT is a shape that Chrome does not often make. That is why `full` is not the default. See "Open questions".

## The hello and ALPN

The hello is made as "Client TLS and HTTP fingerprint" says, with these changes.

1. On a connection that may carry fetch-type requests, ALPN is `h2` then `http/1.1`, the order Chrome uses, and the hello carries ALPS (`application_settings`) for `h2`. The extension is sent exactly when `h2` is in the list, as Chrome does. Its content is Chrome's, from the capture.
2. On a connection made for a WebSocket the list is `http/1.1` alone and there is no ALPS, as today.
3. The hello of a given connection is one or the other. A client never sends the first and then speaks WebSocket over HTTP/1.1 on it.
4. If the server picks `http/1.1` from the first list, the client speaks HTTP/1.1 on that connection with the header fields it sends today. If it picks `h2`, the client speaks HTTP/2 as below. If it picks nothing or anything else, the attempt ends.
5. RFC 9113 requires TLS 1.2 or later, SNI, and a denylist of cipher suites (its appendix A). Chrome's suites are not on that list, and the client offers Chrome's suites, so nothing changes. The rules about TLS 1.3 on a pinned candidate are unchanged.
6. No TLS session is resumed, as today.

## Chrome's HTTP/2

Everything in this section is fixed in the client release from a capture of Chrome 155 on the platform the build runs on, and is never taken from a profile, a subscription or the control channel. The values shown are drafts. A column says what is still to be confirmed.

**The first frames of a connection,** after the 24 byte connection preface (RFC 9113, section 3.4):

| Frame | Draft value | To capture |
|---|---|---|
| SETTINGS | `HEADER_TABLE_SIZE` (1) 65,536, `ENABLE_PUSH` (2) 0, `INITIAL_WINDOW_SIZE` (4) 6,291,456, `MAX_HEADER_LIST_SIZE` (6) 262,144, in this order | The set, the order, and whether `MAX_CONCURRENT_STREAMS` is present |
| WINDOW_UPDATE on stream 0 | increment 15,663,105, which makes the connection window 15,728,640 | The value |
| The next frame | HEADERS of the first request, with no PING and no PRIORITY frame in between | Whether anything sits between |
| SETTINGS ACK | Sent when the server's SETTINGS arrive, in the same write as the next frame that is due | The exact timing |

**A request,** for the `fronted` POST and, in mode `full`, for the extended CONNECT:

| Rule | Value |
|---|---|
| Pseudo-header order | `:method`, `:authority`, `:scheme`, `:path`. For extended CONNECT `:protocol` is added, and its place is to be captured from a Chrome that opens a WebSocket on a reused HTTP/2 connection. |
| `:authority` | The candidate's `host`, with the port of `address` when it is not 443. No `Host` field is sent. |
| `:scheme` | `https` |
| Field names | Lowercase. The fields are those of "The header fields" on [Transports](../transports/), in the order of the HTTP/2 capture, which is not the HTTP/1.1 order. `Connection`, `Upgrade`, `Sec-WebSocket-Key` and `Keep-Alive` are never sent on HTTP/2. |
| `content-length` | Present on a `fronted` POST, as on HTTP/1.1. The node's rules about it are unchanged. |
| `cookie` | Never sent |
| `priority` | The RFC 9218 field, with the value and in the place the capture shows for a `fetch()` of this purpose |
| Priority in HEADERS | The PRIORITY flag, weight and dependency exactly as the capture shows, or none if it shows none. RFC 9113 deprecates the old priority signals (section 5.3) and the client sends nothing the capture does not. |
| HPACK | Indexing choices as the capture shows. The `:path` that holds a token is encoded as Chrome encodes a path, which indexes it. |
| Padding | No DATA padding and no HEADERS padding |
| Push | `ENABLE_PUSH` is 0. A PUSH_PROMISE from the server is a connection error (RFC 9113, section 8.4). |

**The rest of the connection.**

1. The client answers every PING with an ACK, as RFC 9113 requires (section 6.7), and sends PINGs of its own only if the capture shows Chrome doing so on an idle connection, at the capture's cadence.
2. The client returns window credit as Chrome does, in the sizes and at the thresholds of the capture, and never holds credit back (see "Flow control and the datagrams").
3. It closes a connection it is finished with by GOAWAY with NO_ERROR, then `close_notify`, then TCP, in this order.
4. It treats GOAWAY from the server as RFC 9113 says (section 6.8): streams above the last stream id were not processed, and are sent again on a new connection, under the rule "Identical `fronted` request resent on a new connection".
5. `Alt-Svc` is read and ignored. See "What stays detectable".

## WebSocket over HTTP/2

Used by `tls` and `ws` in mode `full`. RFC 8441 defines the extended CONNECT method: a client sends it only after the server has announced `SETTINGS_ENABLE_CONNECT_PROTOCOL` with value 1 (code 0x8).

The client:

1. Opens a connection with the fetch-type hello and completes TLS.
2. Waits up to 10 s for the server's SETTINGS frame. Without it, or when it holds no `SETTINGS_ENABLE_CONNECT_PROTOCOL` of 1, the client has no HTTP/2 WebSocket here. It sends GOAWAY with NO_ERROR, closes the connection, remembers that this candidate has none for 1 hour, and opens a new connection with the WebSocket hello (`http/1.1` alone) for the HTTP/1.1 upgrade of "WebSocket session". That is also what Chrome does when no HTTP/2 connection to the host can carry a WebSocket. After the hour the client tries again. The mark and its end are logged at info, so that nothing latches.
3. Otherwise sends the open request:

| Field | Value |
|---|---|
| `:method` | `CONNECT` |
| `:protocol` | `websocket` |
| `:scheme` | `https` |
| `:authority` | The candidate's `host` |
| `:path` | `<path>?<token>`, the stream proof of "The stream proof" |
| `sec-websocket-version` | `13` |
| `origin`, `user-agent` and the rest | As for the HTTP/1.1 upgrade, in the HTTP/2 order |

There is no `Sec-WebSocket-Key` and there is no `Sec-WebSocket-Accept` (RFC 8441, section 5). The client offers `permessage-deflate` as it does on HTTP/1.1, and ends the attempt if the answer takes up any extension.

4. Reads the answer. The answer is a HEADERS frame with `:status` 200 on that stream, and the same `Set-Cookie` and `upgrade_headers` fields the HTTP/1.1 answer carries, in lowercase. The client ignores the cookie and stores nothing, as before. Any other status is handled as a refusal under "Refusals and clocks" on [Transports](../transports/), except `421` (see below). A `RST_STREAM` before an answer is an unauthenticated end and counts as unreachable, because anyone on the path can cause it.
5. Sends its first chunk, which opens the session as on HTTP/1.1.

After the answer, the stream is the WebSocket session of [Transports](../transports/) with these differences:

- WebSocket frames are carried in DATA frames of the stream (RFC 8441, section 5). The frame layout, the client's masking, the limits (a message above 16,016 bytes, a text message or a fragmented message ends the session), the absence of pings and the counter nonce are unchanged.
- A chunk is written as one WebSocket message in one DATA frame whenever the peer's frame size allows it. The chunk limit of 16,000 bytes plus the largest WebSocket header of 8 bytes is 16,008, which fits the default maximum frame size of 16,384. A peer that announces a smaller frame size gets the message in several DATA frames.
- Closing: the sender writes a Close frame with status 1000 and no reason, as on HTTP/1.1, then END_STREAM. It waits up to 5 s for the peer's Close frame and the peer's END_STREAM, then sends RST_STREAM with NO_ERROR if the stream is still open. The client then closes the connection as in "Chrome's HTTP/2", item 3. The same close is used for every cause.
- A `RST_STREAM` or GOAWAY with the connection still alive, or a closed connection, without the node's Close frame, is the end of the session. Only a Close frame that arrived inside the stream, or a GOAWAY with NO_ERROR, counts as the node saying so, for the rules on authenticated closes.

**A front that answers `421`.** RFC 9113 (section 9.1.2) lets a server answer `421 Misdirected Request` when a request's `:authority` does not match the connection. A candidate with a different `sni` and `host` can meet it, because the front may refuse on HTTP/2 what it accepts on HTTP/1.1. A `421` to an open request is not a refusal and not a block. The client closes the connection, remembers for 1 hour that this candidate does not carry its host over HTTP/2, and opens a new connection with `http/1.1` alone. Every attempt after a fallback carries a fresh token. A token is never sent twice, because the replay rule would refuse it.

## `fronted` over HTTP/2

A `fronted` request is an HTTP/2 stream. The request, the body, the state machine of the node and the chunk numbering are those of [Transports](../transports/).

| Part | HTTP/1.1 | HTTP/2 |
|---|---|---|
| Target | `POST <path>?<token>` or `POST <path>?<sid>.<n>` | The same `<path>?...` in `:path`, with `:method` `POST` |
| Body | `Content-Length` and the sealed chunks | `content-length` and the sealed chunks in DATA frames, END_STREAM on the last |
| Response | Status line, `Content-Type`, `Content-Length` | `:status` 200, `content-type`, `content-length` as the front passes them, then DATA with END_STREAM |
| A response that ends | The body is `Content-Length` bytes | The body ends at END_STREAM. A front may drop `content-length`, and the client then relies on the length prefixes of the chunks and on END_STREAM. A `content-length` that is present must match, or the response is malformed (RFC 9113, section 8.1.1). |
| Re-chunking | A `Transfer-Encoding` answer is refused | A `transfer-encoding` field is malformed on HTTP/2 (RFC 9113, section 8.2.2) and is refused. A `content-encoding` is refused as before. |
| Connection | Reused while the front allows | One HTTP/2 connection carries the session's requests one after another, still one in flight |

Rules:

1. **One request in flight per session** is unchanged. HTTP/2 could multiplex, and the client does not use that, because the node's request number rule and the stored response are built for one at a time.
2. **The body is cut to the window.** A body of 65,536 bytes is one byte more than the default stream window of 65,535 (RFC 9113, section 6.9.2). A client that sent it whole would wait a round trip for a WINDOW_UPDATE on its last byte. The client therefore fills a body with whole chunks up to the lesser of 65,536 bytes and the stream window the server announced. The node reads bodies of 18 to 65,536 bytes as before.
3. **A request that gets no response in 10 s** drops the session as on HTTP/1.1: the client sends RST_STREAM with CANCEL, then closes the connection, because a front that stalled one stream may have stalled all of them.
4. **GOAWAY from the front.** A CDN closes HTTP/2 connections after a number of requests or a time. Requests above the last stream id were not processed and are sent again as identical bytes on a new connection, up to 3 times inside 10 s. Requests at or below it are not sent again as new ones. An opening request that a front repeats on its own is refused as a replay, as on HTTP/1.1.
5. **Stream ids.** A client's ids are odd and rise by 2. The client opens a new connection before the next id would pass 2^30. The session does not depend on the connection, because the `sid` names it.
6. **Candidates race** as "Choosing a candidate" says: up to 2 connections, each with the same datagram. Each is an HTTP/2 connection with its own preface.
7. **A `421`** is handled as in the section above, with the same fallback.

The polling rhythm does not change, and neither does the idle time of 60 s, since an accepted request is still the activity. The change is that one connection now carries many sequential requests of near-equal size, which is also what a page that polls does.

## Where the proof goes

The proof is the same HPKE message in the same token. Only its carrier differs. `aad` is empty and `info` is built with the same label, `"tls"`, `"ws"` or `"fronted"`, as before, whatever the HTTP version.

| Case | Request | Where the token is | Who reads the target |
|---|---|---|---|
| `tls`, HTTP/1.1 | `GET` upgrade | request target, `<path>?<token>` | the node, at the end of the request line |
| `tls`, HTTP/2 | extended CONNECT | `:path`, `<path>?<token>` | the node, at the end of the header block |
| `ws`, HTTP/1.1 | `GET` upgrade | request target | the node, from the web server |
| `ws`, HTTP/2 to the front | extended CONNECT | `:path` at the front, then the request target the front makes | the front, then the node |
| `fronted`, HTTP/2 to the front | `POST` | `:path`, then the request target the front makes | the front, then the node |

A front must carry the whole `:path` with its query to the node. A front that drops the query ends the transport, as on HTTP/1.1.

On HTTP/2 the client sends the token on a stream and does not set `Sec-WebSocket-Key`. The binder, the exporter contexts, the replay rule and the session keys do not use any HTTP value, so a token made for `tls` over HTTP/1.1 verifies the same on HTTP/2. A node does not care which version a token came by, and a token from one connection cannot be replayed on another, as the replay cache holds `enc`.

## The node: `tls`

When the node ends TLS and `http2` is `on`, it offers `h2` and `http/1.1`, prefers `h2` when a client offers both, and answers whichever the client picks. A client that offers `http/1.1` alone gets what it gets today. A client that offers `h2` alone no longer gets a fatal alert.

### Why the node speaks HTTP/2 itself

On HTTP/1.1 the node relays a stranger's bytes to the decoy origin unchanged, and no HTTP implementation sits in between. That cannot hold on HTTP/2:

- The decision for HTTP/2 needs the decoded request, and decoding HPACK needs the connection's whole header state.
- The decoy origin is an `http://` URL and may speak HTTP/1.1 only, which is the common case. A relay of HTTP/2 bytes to it fails.
- The node's own SETTINGS must be sent before the client's first request, as RFC 9113 requires, so the node says things before it knows who the peer is.

So on HTTP/2 the node is an HTTP/2 server toward the peer and a gateway to the origin. This ends the rule that the node writes no byte of its own and changes none, for this version only and on this listener only. It is the largest cost of this page.

### Accept state machine on HTTP/2

For a connection where TLS chose `h2`:

1. **TLS and the connection.** The handshake deadline of "TLS handshake deadline" applies. The node sends its SETTINGS at once, with the default windows, and no connection WINDOW_UPDATE, because a stranger is owed no more than RFC 9113 gives every peer. It reads the client's preface and frames. A connection whose first HEADERS has not arrived 10 s after the handshake is closed with GOAWAY and NO_ERROR. A client that does not send the 24 byte preface, or sends HTTP/1.1 after choosing `h2`, gets a GOAWAY with PROTOCOL_ERROR and is closed.
2. **The node's SETTINGS.** `MAX_CONCURRENT_STREAMS`, `MAX_HEADER_LIST_SIZE` and `HEADER_TABLE_SIZE` are those in the table of numbers, and they are the same for everyone. The windows are the defaults for everyone until a user has proved itself (item 5). `SETTINGS_ENABLE_CONNECT_PROTOCOL` is sent with value 1 exactly when a `tls` transport of this listener is configured for WebSocket over HTTP/2, and it is therefore visible to everyone, strangers included. A listener that does not offer WebSocket over HTTP/2 does not send it.
3. **Pools.** A connection is undecided until its first stream has been evaluated. It is then moved to the relayed pool if that stream was a stranger's, or becomes a session when it was a user's. The undecided and relayed pools, their limits and their displacement rules are those of "Pools and what happens when one is full", with one change: a relayed HTTP/2 connection counts in the relayed pool once for each upstream connection it holds open, and once when it holds none. A direct source may hold at most 4 relayed HTTP/2 connections and 16 upstream connections over them. Over either, the source's connection that has been idle longest is closed. A displaced HTTP/2 connection is closed with GOAWAY NO_ERROR. A connection with no stream for 300 s is closed the same way.
4. **Evaluate every stream, at the end of its header block.** The node reads the header block whole, within 10 s and 65,536 bytes, and decodes it. The decoded list is held to 65,536 bytes of name + value + 32 per field. Past that the node goes on decoding, so that the HPACK state stays in step, but stores nothing more, and then resets the stream with REFUSED_STREAM. It runs steps 1 to 4 of "Verifying" for every stream whose method is `CONNECT` with a `:protocol` of `websocket`, with dummy inputs where a field is missing or malformed, and its target never compared with the configured path before the end. Only such a stream, with a head of at most 16,384 bytes and exactly the fields "WebSocket session" requires apart from the key, can be a user's. Everything else is a stranger's stream. Because the header block arrives whole, the byte-by-byte timing of the HTTP/1.1 request line does not exist here.
5. **A user.** The stream is the session's. The decoy is not contacted for it. The node answers with `:status` 200 and the fields of "WebSocket session" in lowercase, then continues as "WebSocket over HTTP/2" says. The node then sends its larger SETTINGS and connection WINDOW_UPDATE of the table of numbers, which only a user's connection ever sees. Other streams on the same connection are served as a stranger's, with 1 upstream connection at a time, so that a prober who holds a user's connection cannot use it to hold the decoy. A prober with a valid profile therefore sees the decoy site on the connection that carries its tunnel.
6. **A stranger's stream.** The node first checks the stream (items a to c), then makes an HTTP/1.1 request to the decoy origin on an upstream connection of its own for this stream alone, from at most 6 upstream connections per client connection (1 on a connection that has proved a user, and 16 per direct source). A stream that has to wait for one waits, up to the decoy connect timeout of 5 s, and is then reset with REFUSED_STREAM. The upstream connection is used for this one request and closed after the answer, and the request says `Connection: close`. It is never reused, so that no leftover byte of one request can be read as the start of another (RFC 9112, section 9.6). The origin sees one request per connection, which a front also does.
   - **a. The stream is well formed, or it is reset with PROTOCOL_ERROR** (RFC 9113, sections 8.1.2 and 8.3.1). Exactly one each of `:method`, `:scheme` and `:path`, no unknown pseudo-header, no response pseudo-header (`:status`), none after a regular field, and `:authority` present. `:method` is a token (RFC 9110, section 5.6.2). A plain `CONNECT` (without `:protocol`) is never translated and is reset. `:authority` is `host` or `host:port` with no userinfo and no blank. At most one `host` field, and when there is one it equals `:authority`. Field names hold the characters of a token and no uppercase letter. No value holds a NUL, CR or LF. Connection-specific fields are refused: `connection`, `keep-alive`, `proxy-connection`, `transfer-encoding`, `upgrade`, and `te` with any value other than `trailers` (RFC 9113, section 8.2.2). A `:path` is as in "Security considerations".
   - **b. The body has a length the node trusts.** The node never copies the client's framing. When the client sent one `content-length`, the node checks it as a number, writes `Content-Length` with it, and counts the DATA bytes. A stream with more bytes than that, or one that ends with fewer, is reset with PROTOCOL_ERROR (RFC 9113, section 8.1.1), and the upstream connection is closed. When there is no `content-length` and no body, nothing is written. When there is no `content-length` and there is a body, the node writes `Transfer-Encoding: chunked` and its own chunk sizes. Request trailers are read, counted against the header limit, and dropped. They are never sent upstream.
   - **c. Credit follows the upstream.** The node returns window to a stranger's stream only after the bytes were written to the upstream connection, and the stream and the connection windows are the defaults (65,535 each) for a stranger. So a slow origin slows the peer, and the node holds at most one window of request bytes per stream.
   - The request is:
   - the method, with the target taken from `:path`, as `METHOD SP target SP HTTP/1.1`;
   - `Host` from `:authority`, and no other `Host`;
   - every other regular field that passed item a, with names as the client sent them (lowercase), `cookie` fields joined with `; ` as RFC 9113 section 8.2.3 says, and the framing of item b;
   - no `:scheme`, and for an extended CONNECT with a `:protocol` other than `websocket`, a reset;
   - for a stranger's extended CONNECT with `websocket`, an HTTP/1.1 upgrade request with a `Sec-WebSocket-Key` the node draws at random, as RFC 8441 section 5 allows a gateway to do. The origin's `101` becomes a `200` on the stream. This is the one stranger's stream that stays open after the answer, and it is closed when either side closes.
   - With `decoy.proxy_protocol`, the PROXY header of the upstream connection carries the peer's address.
   - **Streams that end early still hold their place.** A stream that the peer resets, or that the node resets, keeps its place among the concurrent streams and its upstream slot until its upstream connection has closed. The node closes that connection at once, so the place is held for no longer than that. Every such stream counts toward the streams that ended before their answer, whoever reset them (this is the abuse of CVE-2025-8671, where the peer causes the node's own resets), and toward the streams opened per interval.
7. **The answer back.** The origin's status becomes `:status`. Its fields go back as the origin sent them, with names lowercased and the fields RFC 9113 forbids on HTTP/2 (`Connection`, `Keep-Alive`, `Proxy-Connection`, `Transfer-Encoding`, `Upgrade`) left out. A chunked body is sent as DATA frames, and END_STREAM follows the last byte. The node adds no field. **The answer is read at the peer's pace.** The node reads from the upstream connection only while the stream's window and the connection's window have room, and holds at most the answer bytes of the table of numbers per stream, per connection and per listener. When the window is shut, the upstream connection is not read, and TCP carries the pressure back to the origin. A stranger's stream whose window stays zero for 30 s is reset with CANCEL, and its upstream connection is closed. Past the per-listener bound new streams are reset with REFUSED_STREAM. `Date` and `Server` are the origin's.
8. **The origin cannot be reached.** The stream is reset with CANCEL and counted as `decoy_down`, with the warn line at most once a minute. On HTTP/1.1 this closes the connection. On HTTP/2 the connection stays, and that is a difference.
9. **Errors on the connection.** A frame the node cannot accept ends the connection with GOAWAY and the error code RFC 9113 prescribes. These frames are the node's own, composed by its library, and are the one place where a stranger is told something by the node and not by the origin.

### Where the node's frames differ from the origin's

The origin is an ordinary web server. The node's HTTP/2 server is a library. The two differ in everything a probe can reach that does not come from the origin's content:

| Probe | What the node does | What a real server might do |
|---|---|---|
| The server's SETTINGS | The values in the table of numbers | Its own, which differ by product and version |
| Malformed frames, a bad preface, an oversized header block | The library's error codes and the timing of its GOAWAY | The product's |
| A burst of streams above `MAX_CONCURRENT_STREAMS` | The refusals of the library | The product's |
| A request with a header field the origin would answer in its own way (a very long URI, a bad `Host`) | The origin's answer, if the request is well formed on HTTP/2 and the node can pass it on, and the library's reset if not | The origin's |
| Upstream behavior the HTTP/2 client can see: an early `408`, an answer before the upload ends, `Connection: close` | The node resets or ends the stream and keeps the connection, where a real HTTP/2 server would close only the stream too | Close only the stream |
| Many streams at once | At most 6 run against the origin at a time, and the rest wait. Each runs on its own connection to the origin, closed after the answer. | A real HTTP/2 server runs up to its own limit |
| `Alt-Svc`, `Server` and other header fields | Passed from the origin as sent | The same |
| ALPN | `h2` is chosen even when the origin itself would answer HTTP/1.1 only | |

A prober that has learned how common servers answer these can tell the node from them. None of it needs a secret. It is the HTTP/2 form of the fact that `tls` is capped: the node's own protocol stack answers, not the origin's. The HTTP/1.1 differential test of "Errors and decoy behavior" is extended to HTTP/2 before the mode is rated, and its list of what it does not cover grows by what is in this table.

### Relaying whole instead

An alternative keeps the old rule. The node would relay the HTTP/2 connection to an origin that speaks `h2c` with prior knowledge (RFC 9113, section 3.3), byte for byte, from the connection preface on. It would have to send SETTINGS before the decision, so it would copy the greeting the origin sends (its SETTINGS and any WINDOW_UPDATE), learned at start and on reload as the upgrade headers are, send that copy to every peer at once, and drop the same frames when the origin sends them on the relayed connection. A change in the origin's greeting between the learning and the relay would show. It is not in this version. See "Open questions".

## The proxy path

Behind a web server or a CDN the node sees what the front sends it. The front has three jobs that the node does not do.

| Job | What it means for the client | What it means for the node |
|---|---|---|
| Ending TLS and ALPN | The front's `h2` choice, SETTINGS and window sizes are the front's, and they are not Chrome's. Only the client's side is made to match Chrome. | Nothing |
| Extended CONNECT | If the front announces `SETTINGS_ENABLE_CONNECT_PROTOCOL`, it turns the client's CONNECT into whatever it sends upstream. If it does not, the client falls back as above. | Nothing, when the front turns it into an HTTP/1.1 upgrade |
| Streams | A `fronted` POST arrives as an HTTP/1.1 request | Nothing |

Rules:

1. **The node stays HTTP/1.1 on `ws` and `fronted`.** The web server in front must speak HTTP/1.1 to the node and must append the source address as before. A front that is configured to speak `h2c` or HTTP/2 to its upstream does not reach a node listener. Doing that for the listener would need the gateway of the section above, and it is not offered. The node counts requests it receives that start with the HTTP/2 preface, and `veilway doctor` reports them.
2. **A front that cannot do extended CONNECT.** Some web servers do not announce it. Then mode `full` falls back to the HTTP/1.1 WebSocket on a new connection, after one connection that read a SETTINGS frame and was closed. A front that does announce it must turn the CONNECT into an upgrade the node accepts: `GET`, `Upgrade: websocket`, `Connection: Upgrade`, `Sec-WebSocket-Version: 13` and a `Sec-WebSocket-Key` the front makes, with the whole request target. The node's rule that a `ws` request is eligible only with a strictly valid head is unchanged, so a front that forwards the CONNECT as it is, or drops the key, ends the transport. `veilway doctor` makes the test request over HTTP/1.1 only and cannot see this. See "Open questions".
3. **The upgrade answer.** The node's `101` and its `upgrade_headers` pass through the front, which sends `:status` 200 to the client. The default `upgrade_headers` of a `ws` listener is empty, so the fields on the answer are the front's own.
4. **Header names and order.** The front writes the HTTP/1.1 head. Its field names, their case and their order are the front's. The node ignores all of them except the request line and the fields it requires.
5. **Forwarded address.** The rule about `client_address_header` is unchanged.
6. **A CDN's own limits** on streams, request counts and connection lifetime apply, and the rules under "`fronted` over HTTP/2" answer them.

## Flow control and the datagrams

HTTP/2 puts two windows between a sender and a receiver, one per stream and one for the connection (RFC 9113, section 5.2). The tunnel is one stream and carries WireGuard datagrams that the sender may never hold back for a window. These rules join the two.

1. **Credit is returned as bytes are read.** A receiver gives window back for each chunk it has read from the stream into the session, at the thresholds of the sender's profile (the capture for the client, the library's for the node), and never later because the session is busy. A window that closed because a reader was slow would turn loss into delay, which is the opposite of "Drop, do not queue". The cost is that the receiver always reads at the rate the sender sends. On the node this holds for a user's stream. A stranger's stream is credited when its bytes have gone upstream, as "Accept state machine on HTTP/2" says, because the origin is not the node's to hurry.
2. **A sender that finds the window shut queues, then drops.** The send queue of 256 datagrams is unchanged. When the stream's send window is zero, datagrams wait in that queue and the oldest are dropped and counted when it is full. The window is not a second queue.
3. **A shut window is a stall.** A send window that stays at zero for 10 s with datagrams waiting ends the session, by the client liveness limit that already holds for streams.
4. **The tunnel's stream shares the connection window** with any other stream on the connection. On `tls` those are a prober's own decoy streams. They can slow the tunnel only for the same peer. On `fronted` the connection window is shared with whatever the front multiplexes, which the client does not control.
5. **Frames and records.** One chunk is one WebSocket message in one DATA frame, so a chunk's size is visible after TLS ends only as a frame length. The frame header adds 9 bytes. The client-to-node cost of a chunk holding one full packet is 32 + 2 + 16 + 8 (WebSocket header) + 9 (frame header) + 22 (TLS record) = 89 bytes, and the node-to-client cost is 32 + 2 + 16 + 4 + 9 + 22 = 85. A full-size inner packet then fits one TCP segment when `mtu` is at most 1448 - 89 = 1359 over IPv4 and 1428 - 89 = 1339 over IPv6, where HTTP/1.1 allowed 1368 and 1348. This is before a WINDOW_UPDATE or another frame that shares the record.
6. **A WINDOW_UPDATE is an extra small record** that HTTP/1.1 does not have. On a busy tunnel each direction gets them at a rhythm set by the windows and the credit thresholds. They are small records going the other way, and are a part of what a browser's HTTP/2 connection shows too.
7. **The window and a full body.** For `fronted` see "`fronted` over HTTP/2", rule 2. The node's own `fronted` response is bounded by the front's window to the client, which the client sets large (6,291,456).
8. **No DATA padding.** HTTP/2 has its own padding (RFC 9113, section 6.1) and the tunnel does not use it. Padding stays inside the chunk.

## What stays detectable

All of "What `tls` and `ws` do not hide" and "What `fronted` does not hide" still holds. HTTP/2 adds and changes the following.

- **A connection that starts with an extended CONNECT.** A browser page's connection starts with a request for a page. Whether a client that opens its first stream as CONNECT is told from a browser depends on how often browsers do that, which has not been measured. Mode `full` is off by default for this reason.
- **The `SETTINGS_ENABLE_CONNECT_PROTOCOL` of the node.** Sent before the node knows the peer, so every visitor sees it. Many web servers do not send it. A node that offers WebSocket over HTTP/2 is distinguishable from one that does not by this field alone.
- **The node's HTTP/2 library,** as the table "Where the node's frames differ from the origin's" lists. On `tls` it adds to the cap. It is the main reason that mode `on` stays off by default.
- **A fallback sequence.** A connection that reads a SETTINGS frame and is closed at once, followed by a new connection with a different hello, is a pattern. It happens once an hour per candidate at most.
- **Frame sizes.** After TLS ends, a front or an HTTP/2-aware observer sees DATA frame lengths equal to chunk lengths plus 8 or 4 bytes. A passive observer sees only record lengths, as on HTTP/1.1.
- **No HTTP/3.** A Chrome that has seen `Alt-Svc` with `h3` from a site tries QUIC on later connections. The client does not speak HTTP/3 and ignores `Alt-Svc`. Against a CDN that advertises `h3`, a client that keeps using TCP is unlike the browser. See [Transports](../transports/) for `quic`.
- **A hello and frames that are right for one release.** The values here are fixed per client release. When Chrome changes its SETTINGS, its window sizes or its header order, a release that still has the old ones becomes rare.
- **Polling over one connection.** `fronted` now shows one long HTTP/2 connection with many sequential POSTs of near-equal size, at a steady rhythm, and not many short connections. A page that long-polls looks the same, and the rhythm still is a signal.
- **The window rhythm.** Window credit comes at thresholds that depend on traffic, and the tunnel's traffic is not a page's.
- **The idle connection.** The tunnel's idle keepalive and echo are unchanged, and neither side sends HTTP/2 PINGs for liveness. A browser's connection may, on a schedule that is to be captured.

## Security considerations

- **HTTP/2 attacks bear on the node when it ends TLS.** Rapid Reset (CVE-2023-44487), floods of CONTINUATION frames, SETTINGS and PING floods, empty DATA frames, WINDOW_UPDATE floods and a header list that grows without bound all reach a server that ends HTTP/2 (RFC 9113, section 10.5). The node counts and bounds each: the header block size and time, the decoded header list, the first HEADERS, the streams opened per interval, the streams that ended before their answer whoever reset them, the frames that carry nothing, the control frames it has not answered, the streams in flight, the upstream connections they hold and the bytes it buffers. Past a bound it sends GOAWAY (ENHANCE_YOUR_CALM where the peer caused the load) and closes. The library's default limits are not relied on. Counting only the peer's own resets is not enough: a peer can make the node reset its streams (CVE-2025-8671, "MadeYouReset"), so every stream that ends before a complete answer counts, whoever sent the RST_STREAM.
- **A new peer gets the default windows.** A node that offered 6 MiB windows to a stranger would buffer that much for each of the strangers it can hold. The windows are raised after a user's proof only (item 5), and a stranger's stream is credited after its bytes went upstream.
- **A stranger can hold the decoy's connections** through streams. The bounds are 6 upstream connections per client connection (1 on a user's), 16 and 4 relayed connections per direct source, and a relayed HTTP/2 connection counts in the relayed pool once for each upstream connection it holds. The pool's count therefore cannot be kept low by sending many streams on a few connections. A connection that is displaced is closed with GOAWAY NO_ERROR, in the middle of an answer if need be, as on the proxy path.
- **The decision is made on a decoded header block,** with the work of steps 1 to 4 of "Verifying" done for every candidate and dummy inputs where a field is missing. HPACK decoding is done for every header block. A header block that fails to decode is a connection error, since HPACK state is shared, and ends the connection with a GOAWAY of the node's own.
- **The token is in `:path`.** The first request of a connection stores its `:path` in the HPACK dynamic table of whoever ends TLS. Operators keep the query out of the front's logs, as for HTTP/1.1. A front that logs `:path` as a whole logs tokens.
- **Gateway translation is parsing of attacker input.** The node turns HTTP/2 fields into HTTP/1.1 text. A field value that holds a line end, a NUL or a colon in a name is malformed on HTTP/2 (RFC 9113, section 8.2.1) and is reset before anything is written upstream. Field names hold token characters and no uppercase letter (RFC 9113, section 8.2.1). Rules for the request line, the `Host` and the body framing are in "Accept state machine on HTTP/2", item 6. A `:path` that is empty or has a blank, a line end or a control byte is reset. The node never writes a request it built from a field it has not checked, and a request-smuggling case through the translation is the risk to test first.
- **Extended CONNECT to a stranger is a node-made request.** The `Sec-WebSocket-Key` for the origin comes from the node. It carries no meaning.
- **No identifying answer, with one more listed exception.** The exceptions of "Security considerations" on [Transports](../transports/) gain the node's own HTTP/2 frames on a listener with `http2` set to `on`.
- **Proof windows are unchanged.** The replay rule, the floor and the limit do not depend on the HTTP version. A token that a front or a CDN repeats after GOAWAY is refused as a replay, and the client sends a fresh token on every fallback.
- **A latch always expires.** The 1 hour marks for extended CONNECT and `421` are logged when set and when they end. Neither blocks a candidate for anything else.
- **A client's HTTP/2 is also an attack surface.** The client reads frames from a front it does not control. It limits header blocks it reads to 16,384 bytes of decoded fields, ignores unknown frame types and settings as RFC 9113 requires, treats a PUSH_PROMISE as an error, and ends the attempt on a frame it cannot make sense of. Nothing allocates from a length the peer chose.

## Still to measure

These items add to "Still to measure" on [Protocol overview](../overview/). Each needs a dated capture, and the values above are corrected where a capture disagrees.

| What to measure | What depends on it |
|---|---|
| Chrome 155's SETTINGS, their order, the connection WINDOW_UPDATE, the ACK timing and any idle PING cadence, on each platform | "Chrome's HTTP/2" |
| Chrome 155's pseudo-header order and field order for a `fetch()` POST on HTTP/2, the `priority` field, the PRIORITY flag, and HPACK indexing | The `fronted` request |
| What Chrome sends for a WebSocket on a reused HTTP/2 connection, and whether it ever opens a new HTTP/2 connection for one | Mode `full` and its default |
| The content of ALPS in Chrome 155 | The hello with `h2` |
| Which common web servers and CDNs announce `SETTINGS_ENABLE_CONNECT_PROTOCOL`, and what they send upstream for an extended CONNECT | The proxy path for `ws`, and the fallback |
| Whether CDNs answer `421` for a `host` that differs from `sni` on HTTP/2 and not on HTTP/1.1 | The fallback of fronting options |
| How common web servers answer malformed HTTP/2 frames, floods and too many streams, and what their SETTINGS are | The node's SETTINGS and the table of differences |
| How common web servers behave on HTTP/2 in front of an HTTP/1.1 upstream: early answers, `Connection: close`, resets | The gateway rules of the node |
| How CDNs end HTTP/2 connections (request count, age) and what they do with unprocessed streams | The `fronted` repeat rules |
| Whether CDNs drop `content-length` on a response they re-frame | The client's body reading |

## Open questions

Each is listed with the default this page takes. The first three are the ones an outside reviewer should check first.

| Question | Default |
|---|---|
| Is a new HTTP/2 connection that opens with an extended CONNECT unlike a browser's, which opens a WebSocket on a connection a page already made? Would a harmless first request to the decoy (a `GET /`) on the same connection before the CONNECT remove the difference, at the cost of one request to the origin? The node already decides per stream, so it would cope. | Mode `full` is off by default. No first request. Both stay open until Chrome's behavior is captured. |
| Should the node be a gateway to the decoy on HTTP/2, which ends the rule that it changes no byte of a stranger's request, or relay the whole connection to an `h2c` origin after copying the origin's greeting? | A gateway. Relaying whole keeps the rule and needs an origin that speaks `h2c` and a greeting that does not change, and it was left out as the harder thing to get right first. |
| Is any node-side HTTP/2 worth it, given that it widens the part of `tls` that a probe can tell from a real server? | Off by default. An operator who wants HTTP/2 without that uses `ws` behind a web server, where the web server's own stack answers. |
| Which HTTP/2 SETTINGS and windows should the node send: a common server's or Chrome's? | The values in the table of numbers, which are a judgement call that follows the windows' size rule. They are corrected after the common servers are measured. |
| Should `fronted` use `full`-style HTTP/2 behavior (`fetch`) by default? | Yes, `fetch` is the default. A `fronted` client that offers `http/1.1` alone is the less browser-like of the two. |
| Should the node have an `h2c` listener for fronts that speak HTTP/2 to their upstream? | No. The front's job is to speak HTTP/1.1 to the node, and a listener that reads HTTP/2 from a front needs the gateway rules and `trusted_proxies` handling for streams. |
| The client's `fronted` body is cut to the server's stream window, which changes the body size from the HTTP/1.1 case when the window is small. Is that size a signal? | Cut to the window. A body size that differs by connection is itself a variation. |
| A front that announces extended CONNECT and forwards the CONNECT upstream unchanged breaks `ws`, and `veilway doctor` cannot see it. Should the client or `doctor` test the path with a real HTTP/2 request? | `doctor` is not extended. The client falls back after a refusal as for any other. |
| Should the client speak HTTP/3 against a CDN that announces it, as Chrome would? | No. HTTP/3 is the `quic` section of [Transports](../transports/). |
| HTTP/2 PING as a liveness signal in place of the idle keepalive | No. Both sides answer PINGs, and the chunk keepalive stays the one definition of "alive". |
| Idle HTTP/2 connection on `fronted` between polls | Kept for the poll wait. Whether a CDN closes it sooner is measured, and a close is handled by the repeat rules. |
| Should a stranger's connection ever get the large windows? | No. A stranger gets the RFC 9113 defaults, so the node holds at most 65,535 bytes of request per connection. A browser-like download from the decoy is slower for a direct visitor than from the origin itself, and that is a measurable difference, listed with the node's other frame differences. |
