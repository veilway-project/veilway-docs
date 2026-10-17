---
title: Shapes of fronted
description: How the fronted transport can carry its requests in other HTTP shapes, with polled answers or one Server-Sent Events stream, and how an operator picks a shape and a client follows it.
---

:::caution[Draft, not built]
This page is a draft specification for version 0.2.0. Nothing on it is built, in the node, the client or the panel. It has not been reviewed by anyone outside the project, and it has not been run behind a real CDN. It changes no existing page: the `fronted` transport of [Transports](../transports/) stays exactly as written there and is called the classic form here. Every number is a judgement call, and none has a measurement behind it.
:::

The classic `fronted` transport has one shape: a `POST` with the data in the body, answered with the data in the body, one request after another. That is one pattern that a CDN, or someone who reads its logs, can learn. This page lets an operator choose another shape for each transport: which method carries the data upstream, where in the request the data goes, and whether the node answers each request or writes to one long Server-Sent Events stream. The tunnel inside is unchanged. The proof, the replay rule, the session keys, the chunks and the padding are those of [Transports](../transports/), and this page only changes how chunks ride in HTTP. Read that page first, in particular "The stream proof", "Framing" and "`fronted`".

A shape is not a promise of cover. It moves the pattern, and a pattern that is used by many installations is a signature again. "What shapes do not hide" says what is left.

## What a shape is

A shape has an upstream half (`up`) and a downstream half (`down`). It is a JSON object in the profile and in the node's config, and the two must say the same thing. A transport that has a shape has the type `fronted-shaped`.

| Member | Where | Values | Meaning |
|---|---|---|---|
| `up.method` | required | `GET`, `POST`, `PUT`, `PATCH`, or a custom method | The method of every request of the session. |
| `up.in` | required | `body`, `query`, `path` or `header` | Where the data of a request goes. |
| `up.name` | required with `header` | 1 to 32 characters from `A-Z a-z 0-9 -` | The name of the one header field that carries the data. Refused: `Host`, `Content-Length`, `Content-Type`, `Transfer-Encoding`, `Connection`, `Upgrade`, `Accept`, `Range`, `Expect`, `TE`, `Trailer` and any name that starts with `Sec-` or `Proxy-`. |
| `up.limit` | optional | integer, see below | The most that one request carries, as bytes of body, of request target, or of header value. |
| `up.inflight` | optional | 1 to 4 | Requests of the session that may be in flight at once, not counting the stream. Default 1 with `poll`, 2 with `sse`. |
| `up.gather` | optional | `[low, high]` in milliseconds, 0 to 250 | The time the client waits to collect datagrams into one request. Default `[10, 60]`. |
| `down.mode` | required | `poll` or `sse` | Whether answers carry the downstream data, or one stream does. |
| `down.gather` | optional, `sse` | `[low, high]` in milliseconds, 0 to 250 | The time the node waits to collect datagrams into one event. Default `[0, 20]`. |
| `down.life` | optional, `sse` | `[low, high]` in seconds, 30 to 3,600 | The range the client draws a stream's length from. Default `[120, 900]`. |
| `down.fallback` | optional, `sse` | boolean | Whether the client may fall back to polling. Default `true`. |

A custom method is 3 to 16 characters from `A-Z`. `CONNECT`, `TRACE`, `HEAD` and `OPTIONS` are refused, because web servers and CDNs treat them specially. `DELETE` and the others are custom methods.

**Which combinations are valid.** Anything else refuses the transport.

| Method | `in` | Notes |
|---|---|---|
| `GET` | `query`, `path`, `header` | Never a body. A `GET` with a body is refused: many CDNs drop it. |
| `POST`, `PUT`, `PATCH` | `body` | Content type `application/octet-stream`, as in the classic form. |
| Custom | `body`, `query`, `path`, `header` | With `body` it has a body. With another `in` it has none. |

Further rules: `up.inflight` is 1 when `down.mode` is `poll`. `up.limit` is 1,024 to 8,000 for `query` and `path` (default 4,000), 1,024 to 4,096 for `header` (default 3,000), and 1,024 to 65,536 for `body` (default 65,536). A range `[low, high]` has `low` at most `high`. An unknown member or value refuses the transport, and a profile whose transports are all refused is refused.

**A transport without a shape is the classic form,** and a transport with a shape never is, also when its members equal the classic values (`POST`, `body`, `poll`). The two number their chunks differently (see "Numbering").

**Why a new type.** A client ignores a member it does not know, so a `shape` on a `fronted` transport would be ignored by an older client, which would speak the classic form to a node that expects another. A transport of an unknown `type` is refused with its profile, and that is the safe failure. A provider that serves older clients puts the shaped transports in a profile of its own, as for `ws-plain`. The proof label is `"fronted-shaped"`, so no key or token of one form can be used in the other.

### Presets

A preset is a name in the panel. The profile and the config always carry the full object, and a client knows no presets.

| Preset | Shape |
|---|---|
| `classic` | No shape. The `fronted` type, not this page. |
| `post-stream` | `POST` in `body`, `sse` down. The shape of many streaming API calls. |
| `get-stream` | `GET` in `query`, `sse` down. |
| `put-poll` | `PUT` in `body`, `poll` down. |
| `get-poll` | `GET` in `query`, `poll` down. |

The panel draws the free members (`gather`, `life`, `limit`, and the header name) at random inside their ranges when it makes a shape, so that not every installation has the same values.

## Numbers that are judgement calls

Added to the tables of [Transports](../transports/). Ranges are inclusive, and a time drawn from a range is drawn in whole milliseconds.

| Name | Value | Used by |
|---|---|---|
| Chunks in one request or answer | at most 4,095 data chunks, numbered 0 to 4,094. Index 4,095 is reserved for the late answer and is used for nothing else. | shaped |
| Largest chunk number | 4,294,967,295 times 4,096 plus 4,095, which is 2^44 - 1 | shaped |
| Late answer | one chunk of 80 bytes: a plaintext of 64 zero bytes, sealed at index 4,095 | shaped node |
| Request number window | 64 below the highest accepted number and 64 above, so 129 numbers are tracked | shaped node |
| Requests in flight | 1 to 4 and one stream, per session | shaped |
| Request target | at most 4,000 bytes by default, at most 8,000. The node reads a request line of up to 8,192 bytes on a shaped transport whose `up.limit` is above 4,000. | `query`, `path` |
| Header value | at most 3,000 bytes by default, at most 4,096 | `header` |
| Segment of a path | the client draws each uniformly from 8 to 64 characters, the last 1 to 64. The node accepts 1 to 64 characters for every segment. | `path` |
| Data of a request, decoded | at most 65,536 bytes. The node checks the encoded length against this before it allocates anything. | shaped node |
| Upstream gather | `[10, 60]` ms unless the profile sets it | shaped client |
| Downstream gather | `[0, 20]` ms unless the profile sets it | `sse` node |
| Event | one sealed chunk, at most 21,356 characters of base64 | `sse` |
| Events in one stream | at most 4,095, numbered 0 to 4,094 | `sse` |
| Line of a stream | at most 21,362 bytes before the line ending, which is `data: ` and an event. The client checks this before it grows a buffer. | `sse` client |
| Chunked coding of a stream | a chunk-size line of at most 18 bytes, no extension, no trailer, and a chunk of at most 65,536 bytes | `sse` client |
| Unsent bytes of a stream | at most 65,536 on the node. A datagram that does not fit is dropped like one that overflows the queue. | `sse` node |
| Stream requests accepted | burst 4, then 1 a second, per session. A request beyond it takes the unauthenticated path. | `sse` node |
| Heartbeat comment | after a silence drawn uniformly from 10 to 25 s, 8 to 40 characters | `sse` node |
| Stream length | drawn uniformly from the profile's `life`, 120 to 900 s unless set. The node ends a stream at 3,600 s. | `sse` |
| Overlap of two streams | the next stream is requested 0 to 3 s before the length of the old one is up, and the old one ends when the new one has answered or after 5 s | `sse` client |
| Wait for the first event | 5 s from the opening request | `sse` client |
| Stream with no byte | the client ends it after 60 s | `sse` client |
| Idle keepalive request | after a send silence drawn uniformly from 20 to 40 s, or the profile's keepalive range | `sse` client |
| Streams that end early | 3 in a row that lasted under 10 s each end the stream attempt | `sse` client |
| Retry of a stream after a fallback | 1 hour on that network, with the candidate that failed | `sse` client |
| Connections to one host | at most 1 + `up.inflight`, which is at most 5, below the 6 a browser keeps | shaped client |
| Size of a polled answer | at most 65,536 bytes of frames. Data that does not fit waits in the queue for the next answer. | `poll` node |
| Stored answers | the last 4 accepted requests of a session, in 65,536 bytes in all. An answer that would not fit alone is not stored. | shaped node |
| Repeats answered | burst 16, then 8 a second, per session. A repeat beyond it takes the unauthenticated path. | shaped node |
| Downstream queue | 128 datagrams of at most 1,600 bytes, drop on overflow | shaped node |
| Shaped sessions | 256 per listen address, counted among the 1,024 `fronted` sessions. Validation warns above 256. | shaped node |
| Memory of one shaped session | at most 603,136 bytes: 4 requests of 65,536 being read, the queue of 204,800, unsent stream bytes of 65,536, stored answers of 65,536 and the 129 tracked numbers at 5,120. Heads are not counted, they belong to the pools. | shaped node |
| Proxy connections | three times the shaped `sse` sessions, where the classic form uses twice the sessions | `sse` listener |

## Numbering

The classic form numbers chunks in one run across all requests of a session, so a request that is lost or arrives late stops every request behind it: the next chunk does not open at the expected number. A shape that allows more than one request in flight cannot work that way.

In a shaped session the number of a chunk is `n` times 4,096 plus `i`, in both directions. `n` is the request number: 0 for the opening request, then 1, 2 and so on, one more for every new request, at most 4,294,967,295. `i` is the index of the chunk inside the request or the answer, from 0 to 4,094. Index 4,095 is reserved for the late answer and no other chunk is ever sealed at it. The nonce is the layout of the transport page, with this number as the counter. The largest number is 4,294,967,295 times 4,096 plus 4,095, which is 2^44 - 1, far below the 2^60 at which a session closes. A request that would need more than 4,095 chunks is split.

What this gives:

- A request opens by itself. A request that was lost, or that arrives before the one before it, does not stop the others.
- A chunk is bound to its request. An answer to request `n` opens only at the numbers of `n`. An old answer that a cache serves again, or a stored copy of another request's answer, does not open as the answer the client waits for, and is refused.
- The node needs no buffer to put requests in order. It passes each request's datagrams to WireGuard as soon as the request is accepted. WireGuard's own replay window tolerates the reordering that results, and what it cannot tolerate is lost, which the inner TCP connections repair. **There is no second retransmission layer.** The transport never resends a datagram and never asks for one. This is the rule of "Stream transports and TCP inside TCP", unchanged.
- Number reuse is the one danger, because two plaintexts under one key and nonce end the secrecy of both. A sender seals a chunk once, at its number, and every repeat of that request or answer is those same stored bytes, never a new sealing. A stream request is never repeated (see "The stream"). The late answer is defined byte for byte: one chunk whose plaintext is 64 zero bytes, which is a padding-only chunk, sealed under `k_s2c` at index 4,095 of the request's `n`. Sealing it again gives the same 80 bytes, so any number of late answers for one `n` are the same bytes.
- Each number belongs to one meaning. In a direction, index 0 to 4,094 of an `n` holds the answer or the events of that `n` once, and index 4,095 holds the late answer. A client refuses a chunk at index 4,095 whose plaintext is not those 64 zero bytes, and refuses a second answer for an `n` that carries other chunks at indexes already used.

The sender fixes the bytes of a request when it first builds it, and keeps them until the request is answered or given up. It never builds a different request under the same `n`, also when the data it had for it was meanwhile sent in another request. The node fixes the bytes of an answer when it first builds it, and the stored answer is that sealed text.

## Upstream

A request is sent when the client has something to send and no more than `up.inflight` requests are in flight, after the gather time. The client draws the gather time from `up.gather` for each request, and a datagram that arrives within it joins the request. A request is never sent only to wait: with `sse` an idle session sends one padding-only request after the idle keepalive silence, and with `poll` the polling waits of the classic form apply, unchanged. The rule "a client never polls faster than the first wait" stays, and a profile cannot lower it.

The data of a request is a list of sealed chunks, in the framing of a classic `fronted` body: for each chunk its 2 byte length (16 to 16,016) and then the sealed chunk. A request holds at least one chunk, so that every request is authenticated, and a request with nothing to carry holds one padding-only chunk.

### Where the data goes

| `in` | Target | Where the data is | Limit |
|---|---|---|---|
| `body` | `<path>?<sid>.<n>`, or `<path>?<token>` for the opening request | The body, with `Content-Length` | `up.limit` bytes, at most 65,536 |
| `query` | `<path>?<sid>.<n>.<data>`, or `<path>?<token>.<data>` | `<data>` in the query | The whole target is at most `up.limit` bytes |
| `path` | `<path>/<sid>.<n>/<data>`, or `<path>/<token>/<data>` | `<data>` cut into segments | The whole target is at most `up.limit` bytes, and the slashes count |
| `header` | `<path>?<sid>.<n>`, or `<path>?<token>` | The value of the field named `up.name` | `up.limit` bytes of value |

`<data>` is the list of framed chunks as base64url without padding, in its one canonical form (the unused bits of the last character are zero). `<sid>`, `<n>` and `<token>` are as in "`fronted`", and a `.` cannot occur in any of them, so the parts are told apart by the dots. In `path` the data is cut at random into segments of 8 to 64 characters, joined by `/`, and the node removes the slashes before it decodes. In `header` the value is `<data>` alone.

**One request has one encoding.** Cutting a path into segments gives many targets for the same bytes, so the node never compares targets. It reads a target strictly, and refuses what is not canonical:

- `<n>` is decimal with no sign and no leading zero, at most 10 digits, at most 4,294,967,295. In `<sid>.<n>` the `n` is 1 or more, and 0 is only the opening request.
- The query is exactly the form in the table: no other parameter, no `&`, `=`, `+` or `%`. The node does no percent-decoding anywhere, so no byte has two spellings.
- In `path` every segment has 1 to 64 characters from the base64url alphabet. An empty segment, a leading or trailing slash, a `.` or `..` segment and a segment over 64 are refused. The first segment after the transport's path is `<sid>.<n>` or `<token>` and holds no data.
- In `header` there is exactly one field of that name, and its value has no space at either end and no character outside the alphabet.
- The data has no padding character, no character of the standard alphabet (`+`, `/` inside a segment), and its last character has zero unused bits. Its decoded length is checked against 65,536 bytes from the encoded length, before anything is allocated.

The repeat test of "The node's state machine" runs on the decoded bytes, their length and their SHA-256, and never on the target. Two targets that decode to the same bytes are therefore the same data, and a request with an accepted `n` and other decoded bytes is not a repeat.

At the default limits the data of one request is about 5,900 bytes of frames in `query` or `path` (4,000 bytes of target less the path, `sid`, `n` and separators, times three quarters) and about 2,200 bytes in `header` (3,000 bytes of value times three quarters). A full-size inner packet is about 1,450 bytes. The sizes are derived and not measured. Without a body, data is therefore split over more requests, and the cost is real: at 4 requests in flight and 100 ms to the CDN, `query` carries about 1.8 Mbit/s upstream at the default limit, and `body` at 2 in flight about 10 Mbit/s. This is a transport of last resort, and a shape that is meant to look ordinary is slower than one that does not.

### The request's other fields

The fields are those of the classic `fronted` request (Chrome's `fetch` from a page of the same host, in Chrome's order, see "Client TLS and HTTP fingerprint"), with these differences:

- The method is the shape's.
- A request with a body has `Content-Type: application/octet-stream` and `Content-Length`. A request without a body has neither, as Chrome's `GET` has neither.
- A request that asks for a stream has `Accept: text/event-stream` and `Cache-Control: no-cache`, as `EventSource` and a `fetch` that streams send. Every other request has the `Accept` of a `fetch`.
- Which fields Chrome's `fetch` sends for each of these, and in which order, is to be taken from a capture, as the classic form's were. This page does not claim them.

### The head, and what the node reads

A shaped transport reads a request line of up to 4,096 bytes, or 8,192 when `up.limit` is above 4,000. The head of a user stays at 16,384 bytes. The head is decided before any data is read, as in step 1 of the classic state machine.

## Downstream

### Polled

`down.mode` `poll` is the classic answer: `200`, `Content-Type: application/octet-stream`, a `Content-Length`, and a body of framed chunks, given as soon as the node has downstream data for the session and otherwise after the 250 ms hold. The answer holds at most 65,536 bytes of frames and at most 4,095 chunks, and the rest waits in the queue. The answer's chunks are numbered with the request's `n`, from index 0. One request is in flight (`up.inflight` is 1), and the polling waits are the classic ones.

### The stream

`down.mode` `sse` has the node write to one long answer, as soon as a datagram is there, instead of answering every request with data.

**The stream request.** It is an ordinary request of the shape, with `Accept: text/event-stream`. It carries data like any other request, so that it is authenticated like one, and it takes the next number `n`. The opening request is a stream request too: its answer is the first stream. A client has at most one stream request waiting for its answer, plus the live stream.

**The answer.** The node answers a stream request with status `200` and these fields:

| Field | Value |
|---|---|
| `Content-Type` | `text/event-stream` |
| `Cache-Control` | `no-cache` |
| `X-Accel-Buffering` | `no` |
| `Transfer-Encoding` | `chunked` |

and no other field of its own. `X-Accel-Buffering` is what nginx reads to stop buffering a response, and a real event stream behind nginx often sends it. The classic rule that an answer with `Transfer-Encoding` is refused is lifted for one case only. The client reads the chunked coding when the request it answers asked for a stream (it sent `Accept: text/event-stream`) and the head of the answer is `200` with `Content-Type: text/event-stream` and exactly `Transfer-Encoding: chunked` and no `Content-Length`. In any other case, an answer with `Transfer-Encoding` is refused as before, and a stream request answered with another content type, with a `Content-Length` or with a content coding is a stream that did not start (see "When the stream does not work"). The client decides this from the head, before it reads any body. The web server in front must not hold the answer back (see "What shapes ask of the web server").

For the opening request, the node sends nothing, not even the head, until the session is established, as in the classic form. For a later stream request the session is established, and the node sends the head at once.

**Events.** Each event is one line `data: ` followed by one sealed chunk in standard base64 with padding, and an empty line. The chunk holds the node's datagrams that were waiting, up to the chunk limit, collected over a time drawn from `down.gather` when the queue was empty. Its number is `n` times 4,096 plus the index of the event in this stream, from 0. Base64 costs a third more bytes than the classic body. A stream ends after 4,095 events, numbered 0 to 4,094, so that index 4,095 stays the late answer's, and the client then needs a new one.

```
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: <base64 of one sealed chunk>

: <8 to 40 characters>

data: <base64 of one sealed chunk>
```

(Fields other than the content type are left out above.)

**Heartbeats.** After a silence drawn uniformly from 10 to 25 s the node writes a comment line, a colon, a space and 8 to 40 characters from `a-z 0-9`, and an empty line. A heartbeat is not sealed and holds nothing. It keeps the CDN from ending an idle stream, and it is a sign of life that a comment gives a client.

**How the client reads a stream.** It reads the chunked coding and then lines, with fixed limits that it checks before it grows any buffer: a chunk-size line of at most 18 bytes with no extension, a chunk of at most 65,536 bytes, no trailer, and a line of at most 21,362 bytes before its ending. A line ends with LF or CRLF, because a front may rewrite endings. An event is the line `data: ` and 24 to 21,356 characters of standard base64 with padding, in its canonical form, and an empty line. A client decodes it, checks the sealed length (16 to 16,016 bytes) and opens it at `n` times 4,096 plus the index of the event, which it counts itself and not from anything on the wire. A comment line is ignored. A line over the limit, any other line, an event that does not decode or open, and a stream with more than 4,095 events end the stream and count as a stream that did not work. A line is never joined with the next across more than the limit, and an event with more than one `data:` line is refused.

**Which answer carries data.** If the session has a live stream, all downstream data goes to the stream, and the answer to every other request is `200` with a `Content-Length` and one padding-only chunk at index 0, given at once without the hold. That answer is sealed once and stored like any other, so a repeat of the request gets the same chunk and never data that was not in the first answer. If it has none, the answer to the next request carries the data, with the hold, as in the polled form. A stream that has just ended and a stream not yet answered both leave the session without a stream, and the data waits in the queue (128 datagrams, drop on overflow) for the next request. The stream's unsent bytes are capped as well, and a datagram that does not fit is dropped. No datagram is written twice. A datagram that went into a stream and was held back or lost on the way is lost, and the inner connections repair it.

**A newer stream replaces the older.** When the node accepts a new stream request of a session and writes its head, it ends the older stream by completing its chunked body. That is how a client changes streams without a gap.

**A stream request is never repeated.** A repeat of an accepted stream request (the same `n`) would write different events under the same chunk numbers. The node therefore remembers for every number of its window whether it was a stream request, and decides that before it matches the request against a repeat or a stored answer. A second request with a number that was a stream request is answered as a stranger is (the unauthenticated path), whatever its data, and it never gets the stored answer or the late answer and never opens a second stream under it. A client whose stream request failed makes a new one with a new `n`, and never resends the old bytes. A CDN that retries a stream request can only cost its stream.

### The length of a stream

A stream with a fixed length is a signature, and one with no end is cut by someone else. The client draws the length of each stream uniformly from `down.life` and requests the next stream 0 to 3 s before it is up. The old stream ends when the new one has answered, or after 5 s. The node ends a stream by itself at 3,600 s and at 4,095 events. A stream that ends before its length is a lost stream, handled below.

### When the stream does not work

A CDN may hold an answer until it is complete, or until it has a buffer full. The client decides, with these rules:

1. **First event.** The opening request's stream must answer with its head and first event within 5 s of the client sending it. The first event is the node's WireGuard reply, so it comes within a round trip of the handshake. If there is nothing, the client ends the stream's connection and goes on with `poll` for this session.
2. **A stream that dies.** A stream that ends, resets, has no byte for 60 s or breaks a reading limit above is replaced by a new stream request at once, with a new `n`. If 3 streams in a row last under 10 s each, the client stops asking for streams for this session and polls.
3. **The fallback is polling.** The client sends ordinary requests with padding-only chunks at the polling waits of the classic form. The node, which has no live stream, puts the data in the answers. No message tells it, and none is needed: the live stream decides where data goes.
4. **The fallback expires.** With `down.fallback` `true`, the client remembers that streams failed on this candidate and this network, and asks for a stream again after 1 hour. The mark and its expiry are logged at info. Nothing is latched for good. With `false` the client does not poll: the session is lost, and the usual reconnect rules apply.
5. **Polling while the stream is held.** A client that falls back has nothing to tell the CDN's held answer. It ends the connection, and the node finds the stream gone at its next write.

Datagrams written into a stream that a CDN holds are lost when the client ends it. For the opening request that is the WireGuard handshake reply, and WireGuard sends the initiation again. This costs a few seconds once and is not repaired by the transport.

## The node's state machine

The nine steps of "`fronted`" apply, with these changes for a shaped transport. A request that fails any step takes the unauthenticated path, and a live session it named is left as it was.

| Step | Change |
|---|---|
| 1. The head | The method is the shape's. For `body`: exactly one `Content-Length`, 18 to `up.limit`, no `Transfer-Encoding`. The buffer for the body grows with the bytes that arrive and is never sized from `Content-Length`. For the others: no body, so no `Content-Length` other than 0, no `Transfer-Encoding`, and for `header` exactly one field of that name, at most `up.limit` bytes. The request line is at most 4,096 bytes, or 8,192. |
| 2. The target | One of the forms in "Where the data goes", read strictly as "One request has one encoding" says. A target or value that is not canonical is refused here, before anything is decoded or allocated. For `path` the node removes the transport's `path` as a prefix, so a path that is a prefix of another transport's path on the same listener is refused by validation. |
| 3. Opening | The proof is verified and spent as before. The data is read as for a later request, with `n` 0. A stream request opens the stream. |
| 4. Later | `sid` known. `n` is not more than 64 below the highest accepted number, and not more than 64 above it. If `n` was accepted as a stream request, the request takes the unauthenticated path here, whatever its data, before any repeat test. At most 4 requests of the session are in flight besides a stream, and a request in flight is one whose chunks have opened and whose answer has not been sent. A request over the limit takes the unauthenticated path and is not queued. |
| 5. The data | Read whole within 10 s before anything of it is used. For `body` it is the body, and for the others it is the data decoded from the target or value. A request with more than 4,095 chunks, a frame length outside 16 to 16,016, or a frame that runs past the data is refused here, before any chunk is opened. Then the repeat test of step 8 is run on the decoded bytes. |
| 6. The chunks | Not run for a repeat. Every chunk must open under `k_c2s` at `n` times 4,096, then one more for each. If any does not, nothing is processed, and the session is as it was. |
| 7. Invalid | As in the classic form. |
| 8. A repeat | A request with an `n` that was accepted, was not a stream request, and has the same length and SHA-256 of its decoded data, within the window. It is recognized before any chunk is opened, as in the classic form. It gets the stored answer if the node still has it (the last 4 accepted requests, in 65,536 bytes in all), and otherwise the late answer: `200`, a `Content-Length` of 80 and the one chunk of "Numbering" at index 4,095. A repeat that arrives while the first answer is still held gets the late answer at once, and the held answer is unchanged. A repeat is not activity and is counted against its rate. A request with an accepted `n` and other decoded data takes the unauthenticated path and changes nothing. |
| 9. The answer | As in "Which answer carries data". |

The node keeps per session the highest accepted `n`, and for each of the 129 numbers of the window whether it was accepted, whether it was a stream request, and the length and SHA-256 of its data. That is about 5 KiB, and it is counted in the memory of a session in the table of numbers. Nothing is kept for a number outside the window.

A request is activity when its chunks have opened. A shaped `sse` session has a live stream, which is not itself activity: the keepalive request is. The session idle time stays at 60 s.

## The client

1. It reads the shape from the transport of the profile and builds every request from it. It does not look at the node's answers to learn a shape.
2. It opens a session with an opening request that is a stream request when `down.mode` is `sse`. It sends the WireGuard handshake initiation in the first request, as before.
3. It keeps at most `up.inflight` requests in flight, and splits what it has over more requests when it does not fit.
4. For a request that is not a stream request and whose connection failed, it resends the identical bytes on a new connection, up to 3 times in 10 s, as in the classic form. It never changes a request under the same `n`. A stream request is never resent: it is replaced by a new stream request with a new `n`. An opening request is not resent either, because its proof is spent and a repeat is refused as a replay, as in the classic form.
5. It opens a new session before `n` would pass 4,000,000,000, and never reuses a number of a session in any way.
6. It applies the stream rules above, and logs a flip to polling and back at info.
7. A request that gets no valid answer within 10 s, or an answer other than `200` with something it can open, makes the session lost, as in the classic form. A late answer is a valid answer.

## Padding and timing

Every shape uses the padding of "Padding" in [Transports](../transports/): wide padding on the first 16 chunks of each direction and on handshake and control chunks, normal padding on the rest, the session base, and the lone keepalive delay. What the shapes add:

| Shape part | Padding | Jitter |
|---|---|---|
| Upstream `body` | The padding of the chunks. A request with nothing to carry holds one padding-only chunk. | The gather time per request, from `up.gather`. |
| Upstream `query`, `path`, `header` | The same, and the data is base64url, so the length of the target or value shows the number of bytes. The path segments are cut at random lengths. | The same. |
| Downstream `poll` | The padding of the chunks. | The 250 ms hold, and the poll wait multiplied by a number drawn from 0.75 to 1.25, as in the classic form. |
| Downstream `sse` | The padding of the chunks. A heartbeat is 8 to 40 random characters. | The gather time per event, from `down.gather`, applied when the queue was empty so that a packet that arrives alone is not sent at the instant it arrives. Heartbeats after 10 to 25 s. |
| Streams | The length of a stream is drawn from `down.life`. | The next stream is requested 0 to 3 s early. |
| Idle | `sse` has one keepalive request after a silence of 20 to 40 s, and `poll` the classic waits. | Each interval is drawn, not fixed. |

Gather times add latency to every request and event: at most 250 ms in the profile's range, about 35 ms and 10 ms at the defaults. What this achieves and does not achieve is the same as for the classic padding. It removes exact sizes and exact intervals, and it keeps the ranges, which are a shape of their own.

## Choosing a shape

**The operator** picks a shape for each `fronted-shaped` transport in the panel, from a preset or from the members, and may list several transports, each with its own path and shape, in one inbound. The panel writes the same object to the node's config and to the signed profile. The profile is where a client reads it, and the config is where the node reads it. The node cannot see the profile, so a difference between the two is not found by the node: its requests do not parse and are answered by the decoy origin, and the client sees refusals. Validation on the node refuses a shape that breaks the rules above, and `veilway doctor` prints the shape each transport uses.

**The client follows it** by reading `shape` from the transport. It does not negotiate, does not try other shapes of the same transport, and does not learn anything from the node's answers. To offer a shape and a fallback, the operator lists two transports. Transport fallback orders them as for any list (see "Transport fallback"): they are the same class, so the consent rules do not apply between them. A client that cannot use a transport because its shape is refused skips it and says so.

**The panel check.** Before the panel puts a shaped transport in a profile, the operator may run a check against the operator's real CDN and node. It is a real session, not a probe: the panel makes a device of its own for the inbound, with a name that says it is the panel's, no rules, the one exit just described, and opens a session on the candidate with the shape, as a client would. It uses ICMP echo as the traffic: echo requests make upstream data of chosen sizes, and echo replies make downstream data, at known times. The node does not answer an echo to its own gateway address, which it refuses like any other packet for the gateway except DNS and the control channel. The check therefore pings an address outside the tunnel pools that the gate allows (a documentation address such as 192.0.2.1), and the check device needs an exit of the `netstack` kind with `unsupported.icmp_echo` at `local`, which is the default. The node then answers the echo itself, and sends nothing out. The check reports each of these as pass or fail with what it saw:

| Check | How | If it fails |
|---|---|---|
| The method passes | The opening request arrives at the node with the shape's method. | The shape is not offered. Custom methods and `GET` with a body are the likely failures. |
| The data survives | Requests at a quarter, half and the full `up.limit` arrive byte for byte. The panel finds the largest target or value that passes and offers to write it as `up.limit`. | A lower `up.limit` is offered. |
| Nothing is cached | Several `GET`s with different `n` reach the node. The same request twice is not answered from the CDN's memory. | The shape is not offered for `GET`. A path with a static extension is a likely cause. |
| Requests are not joined or held | Requests in flight at once reach the node at once, up to `up.inflight`. | A lower `up.inflight` is offered. |
| The stream is not buffered | For `sse` the panel sends echoes 1 s apart for 30 s. Replies must reach the panel one by one, within the gather time and one round trip of when they were sent, and not in bursts. | The shape falls back to `poll`, or the web server's buffering is named as the cause. |
| The stream lives | The stream is kept for as long as the longest `down.life`. The panel reports how long it lived and offers a `life` below that. | A lower `down.life` is offered. |
| The answer is not changed | A `Transfer-Encoding` or `Content-Length` that the front added or removed, and a content coding, are found. | The shape is not offered. |

A pass means that the CDN passed these requests from where the panel is, on the day of the check. It does not mean the shape is hard to recognize, that a network the users are on will pass it, or that the CDN will go on passing it. The check is run again after any change of the CDN's settings and by the operator on a schedule of their own, and the panel shows the date of the last pass beside the shape. The panel does not run the check without being asked.

## What shapes ask of the web server and the CDN

All of "What `fronted` asks of the CDN" applies. In addition:

- **Prefix.** For `path` the web server hands the node every path under the transport's `path`, not only that one: in nginx a `location` with a trailing slash, not an exact match. The origin must serve nothing under it.
- **No buffering of a stream.** For `sse` the web server must not buffer the answer: in nginx `proxy_buffering off` for the path, a `proxy_read_timeout` above the longest stream, and `proxy_http_version 1.1`. The node's `X-Accel-Buffering` covers the first only for nginx. The CDN must pass `text/event-stream` as it is written. Some CDNs buffer unless told not to, and the check finds that.
- **No cache.** For `GET` the CDN must not cache the path. A rule that sends the path to no cache is the operator's to set, and the check shows whether it is needed.
- **Connections.** A shaped client keeps up to 5 connections to the host, one of them held open for the stream. The web server's keep-alive and connection limits must allow that for every session, and the node's proxy connection pool is three times the sessions for this reason.
- **Terms.** A held stream per user is steadier use than polling and may be treated as streaming, which some terms limit. The operator must read them again for this shape.

## What shapes do not hide

- The CDN sees the same things as in the classic form: the client's address, the path, the session id on every request, and all sizes and timing. For `query` and `path` it sees every upstream byte in the URL, and URLs are logged more often and kept longer than bodies. The bytes are sealed, and the tunnel inside is WireGuard's, but the log holds a record of every request.
- A stream of base64 events, steady in the downstream direction, is not what an event stream usually looks like. Ordinary streams carry text of varying size, often JSON, with long gaps. A body of random bytes in a `POST` is not what an ordinary API carries either.
- The idle rhythm: a heartbeat at 10 to 25 s and a keepalive request at 20 to 40 s are ranges that every installation shares unless a profile changes them.
- A header, a query or a path of random base64url, of a length that changes with the data, is not what a browser sends to a site.
- The late answer is always 80 bytes, a fixed size that no honest answer has. It appears only for a repeat whose stored answer is gone.
- Everything the classic form does not hide.

A shape that is used by many users is known after a while. The panel's randomized members and the choice of shape are the only defence, and neither has been measured.

## Security considerations

- **Authentication is by chunks, as before.** A stream request, a repeat and every other request is judged by whether its chunks open under `k_c2s` at the numbers of its `n`. A stranger who learns a `sid` and an `n` can neither open a stream, nor disturb a session, nor use up its numbers: a request that does not open changes nothing.
- **Number reuse is excluded by rule.** A number is used for one request or answer. A stream request is never repeated and is told apart before any repeat test, a repeated request gets the same stored bytes or the late answer, the late answer is fixed byte for byte at an index no other chunk uses, no stream goes past index 4,094, and the sender never builds a second request under an `n`. A client that did would send two plaintexts under one key and nonce, which ends the secrecy of both chunks. The code must have a test that builds every request twice and compares.
- **A request number window bounds memory and replay.** The node keeps 64 numbers below the highest. A request older than that is refused, which is a lost request and not a session loss.
- **One encoding per request.** The repeat test compares decoded bytes and the node accepts one spelling of a target only, so a path cut in another way, a percent-escape, a leading zero in `n` or a padded base64 string cannot make a copy of a request look new, or a new request look like a copy.
- **Memory is bounded per session, per device and per node.** A shaped session holds at most 603,136 bytes, a device with 2 sessions about 1.2 MB, and a node at its 256 shaped sessions about 147 MiB, against 64 MiB for the classic form. The figures are in the table of numbers. Buffers grow with the bytes that arrive and are never sized from a length the peer wrote, so a stranger who claims a body of 65,536 bytes holds what he sent and for 10 s, counted among his source's 16 requests. A queue, a stream's unsent bytes, the stored answers and the tracked numbers each have a cap, and an overflow drops data instead of growing.
- **Repeats and stream requests are rate limited.** A repeat costs a hash of up to 65,536 bytes, and a stream request replaces a stream. Each has an allowance per session, and what is beyond it takes the unauthenticated path, which a real client does not reach.
- **A parser checks its limits before it allocates.** The head and the target, the frame lengths and count, the encoded length of the data, the chunked coding and the lines of a stream all have a limit that is checked before the buffer is grown. A client reads an event stream only after a head that asked for it.
- **A cache or a replaying front cannot feed the client an old answer.** Chunks are bound to their request's number, so an answer served for another request does not open. A front that serves a stored answer for the same request gets the same bytes, which is correct.
- **`GET` can be cached or collapsed by a CDN.** The node's `no-cache` and the unique `n` in every target help, and neither is a guarantee: a path with a static extension is cached by default on some CDNs. The check tests it, and the operator is told. A cached answer does not open for any other request.
- **Data in the URL is logged.** Every request target is in the logs of the CDN and the web server. The sealed bytes are useless without the session keys, and the keys come from the HPKE exchange to the node transport key. A holder of that private key and of the logs can open the chunks and read the WireGuard packets inside, and WireGuard stays closed to them. The metadata the page lists is there anyway. An operator who is worried about logs uses `body`.
- **A WAF may read a URL.** Random base64url in a query or a path can match a rule meant for attacks, and the front may block the request, or the client. The check finds this for the paths it uses. It cannot find a rule that fires on a particular byte string a month later.
- **A stream holds resources.** Each `sse` session holds a connection for its stream. Only a request that opens can start one, so a stranger holds none. A user with 2 sessions holds 2, and the proxy pool is sized for it.
- **Timing of the stream.** The node writes when a datagram is there, after the gather time. That makes the time of a downstream event follow the time of an upstream packet, and an observer who sees both can match them. The gather time blurs this by tens of milliseconds and no more. The classic hold does the same.
- **The shape in the profile is a choice the provider makes for the user.** A client does not choose a shape and does not check that a shape is wise. A provider that signs a shape with a custom method makes the client send that method to the CDN. The values are checked as the rules say, so a profile cannot make a client send a method the rules refuse or a request larger than the limits.
- **Every shared default is a signature.** The defaults of the gather times, the lengths and the heartbeats are the same everywhere unless the panel changes them. They are fixed so that they can be measured.
- **No failure is latched.** The fallback to polling has an expiry and a log line. A refused shape, a failed check and a stream that cannot start all end, and none of them stops the client from trying the next transport.
- **Every new parser needs a fuzz target** in the same change: the target of each placement, the data in a header, the path segments, the canonical decoder of the data, the event reader of the client, and the chunked answer reader.

Tests this page calls for: every request built twice gives the same bytes. A request out of order and a request twice, a request 65 below and 65 above the window, and a repeat with other data. A stream request repeated, also with a stored answer or a late answer that could match, and a stream that is cut at event 4,095 so that the late answer's index is never used by an event. A late answer, sealed twice, gives the same 80 bytes. The same data in a path cut two ways, with a percent-escape, with a leading zero in `n`, with padded base64, with an empty or an over-long segment, and with a last character whose unused bits are not zero. The largest `n` gives a chunk number of 2^44 - 1. A request with 4,096 chunks, a body claimed at 65,536 bytes that never arrives, and a line of a stream one byte over its limit. Memory of a session at the worst case in the table. An answer to another request's number. Each valid and invalid combination of method and `in`. A target and a header value at the limit and one byte over. A path cut at the shortest and longest segments. A client whose stream gets no first event, one whose stream ends early three times, and one whose fallback has expired. An `sse` answer cut at every byte of the chunked coding. A custom method and a header name from the refused list. A transport of the type `fronted-shaped` in a client that does not know it.

## Open questions

| Question | Default |
|---|---|
| Should the type be `fronted-shaped` with a new proof label, or `fronted` with a member that an older client must not ignore? | `fronted-shaped`. A fourth never-ignored rule in the subscription format would let one name serve both, but cannot protect clients that already shipped. |
| Does the node need to put requests back in order? WireGuard's replay window tolerates mild reordering and the inner TCP repairs the rest. | No hold. A short hold of about 50 ms, as bonded connections propose, is to be measured against a CDN that reorders. |
| Is ICMP echo to a documentation address, answered by the node, a good enough load for the panel check? It tests sizes and timing of datagrams, not of an inner TCP flow, and depends on the check device's exit answering echo itself. | Yes for version 0.2.0. The code has been read: echo to the gateway address is refused, and echo to another allowed address is answered by the node when the exit's `icmp_echo` is `local`. An operator who set it to anything else cannot run the check on that exit. |
| Is a base64 stream of events recognized faster than polling? The classic polling has a known rhythm. A stream has a steadier connection and no rhythm, and an unusual body. | Unmeasured. Both are rated Detectable. The length and timing test of the transports page must include a stream. |
| Can the late answer be abused? It is one fixed chunk at index 4,095 of a number, sent to any repeat whose stored answer is gone. | It reveals nothing a repeat does not, and it opens only for the client. A reviewer should check it. |
| How wide a window of request numbers, and how many in flight? 64 and 4 are guesses. | As written. A CDN that retries a lot or reorders would need a wider window. |
| Should a client try a `GET` that a CDN may cache with a cache-busting query? | No. `n` in every target is the buster, and the check refuses a shape that is cached. |
| Should the stream's first event deadline be shorter than 5 s? A buffering CDN costs the user that long once per network per hour. | 5 s. Shorter risks calling a slow handshake a buffering CDN. |
| Does the panel's check, from the panel's host, say anything about the users' networks? | No. It says what the CDN allows. The client's own fallback is the only check at the user's end. |
| HTTP/2 (version 0.2.0, item 2) would carry the requests and the stream of a session as streams of one connection, and make a held stream the norm. | Shapes are defined per request and need no change. The mapping to HTTP/2 waits for that page, and the limit of 5 connections goes away with it. |
| A custom method, a `GET` that Chrome's `fetch` would not send with these fields, and a header named by the operator: do any of them make the request more recognizable than the classic `POST`? | Unknown. They are offered because the owner asked for them. The presets use `GET`, `POST` and `PUT` only. |
| Should the preset list, or the ranges, differ per user so that no shape is shared by all of a provider's users? | Per transport at least. Per user is a panel feature for later, since the profile is already one document per device. |
