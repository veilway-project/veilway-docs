---
title: Offline bundle
description: One signed file that carries an app update, a provider's sealed subscription documents and a provider notice over any one-way channel, how the app checks and imports it, and what it refuses.
---

:::caution[Draft]
This page is a draft specification. Nothing on it is built: there is no bundle reader in the client, no `veilway bundle` command and no panel button. It reuses parts that are built or drafted on other pages (the signed envelope, the sealed static files, the app updater's signature checks). No one outside the project has reviewed it. Do not rely on any property described here.
:::

A bundle is a file that an app can apply without a network: an update of the app, new subscription documents, a notice from a provider, or all three. It travels by any channel that moves bytes one way, such as a USB stick, Bluetooth, a shared folder or satellite datacasting. Read [Subscription format](../subscription-format/) first, in particular "The signed document", "Static mirrors" and "Import". This page reuses their rules and does not restate them.

Four rules shape the page:

- **The file is hostile until its signature is checked.** Nothing in it is parsed, allocated for or written to disk before the signature on its manifest has been verified under a key the app already holds.
- **The file is not trusted for what it says about itself.** The signature on the manifest says who put the file together and that nobody changed it. It gives the signer no power over any part. Each part is judged by its own key, the one the app already uses for that kind of thing.
- **A bundle changes nothing without a yes.** The app lists what it would apply and applies only what the user accepts. Opening a file can do nothing else than bring the user to that list.
- **A bundle never makes the app talk.** Importing one sends no request, enrolls no device and takes no device place.

## Numbers that are judgement calls

Every range written "a to b" is inclusive at both ends. None of these numbers has a measurement behind it.

| Name | Value |
|---|---|
| Whole file | at most 1,073,741,824 bytes (1 GiB) |
| Manifest | at most 65,536 bytes |
| Parts in a bundle | 1 to 32 |
| An app part | at most 268,435,456 bytes (256 MiB) |
| A pack part | at most 536,870,912 bytes (512 MiB) |
| Files in a pack | 1 to 65,536 |
| A notice part | at most 8,192 bytes |
| Packs in a bundle | at most 8 |
| Periods named by a pack | 1 or 2, consecutive |
| JSON nesting depth in the manifest | at most 8 |
| JSON values in the manifest | at most 2,000 |
| A signature string of an app part | at most 1,024 bytes |
| Lifetime of a notice (`expires_at` minus `issued_at`) | at most 90 days |
| Clock tolerance for `issued_at` of a notice | 300 s into the future, as for a document |
| A bundle counts as old | 90 days after `created_at`. The app says so and refuses nothing for it. |
| Opens of a pack file in one import | at most 2 per stored subscription and pack |
| Free space the app needs before it reads parts | the size of the parts the user chose, plus the size of the largest of them |
| Bundles remembered by id, for display | the last 32 |

The file cap holds a build for every platform. It is not a promise that every channel carries it: a satellite channel may carry only a pack and a notice.

## What a bundle carries

| Part | What it is | Judged by |
|---|---|---|
| `app` | The update of the app for one platform, exactly the file the online update installs, with its signature | The key the online update of that app trusts |
| `pack` | Sealed static files, for many devices of one provider, found by the lookup of static mirrors | The provider's signing key, inside each file, as for any document |
| `notice` | A short signed message from a provider to its users | The provider's signing key |

A bundle may hold any mix. A provider may carry the project's app update next to its own pack, and the project may carry nothing of any provider's. A part the app has no use for (another platform, a pack with no file for this device, a notice of a provider it does not hold) is listed as skipped and costs nothing.

A bundle never adds a subscription. A sealed file can be opened only with the token and the device secret the app already holds, so a device that has never enrolled has no file in any pack. A first import goes by a link, a code or a whole document, as before.

## The file

All numbers are big-endian. The notation is the transports page's: a label in double quotes is its ASCII bytes followed by one zero byte, and `||` joins byte strings.

| Offset | Length | Content |
|---|---|---|
| 0 | 8 | The magic, `VWBUNDLE` in ASCII |
| 8 | 1 | The format version, `1` |
| 9 | 8 | `kid`, the key id of the signer: the first 8 bytes of the SHA-256 of the signer's public key |
| 17 | 4 | `m`, the length of the manifest in bytes |
| 21 | `m` | The manifest, a JSON object |
| 21 + `m` | 64 | The signature |
| 85 + `m` | the rest | The parts, one after the other, in the manifest's order, with nothing between them |

The signature is Ed25519 (RFC 8032, the strict rule of the subscription page) over `"veilway v1 bundle manifest" || kid || be32(m) || manifest`. The label, the key id and the length are inside it so that the manifest cannot be moved to another key, another length or another use.

The magic, not the extension, says what a file is. The extension is `.vwbundle` and the media type is `application/vnd.veilway.bundle`.

**What is checked, in order.** The first failure ends it, and nothing is stored:

1. The file is within its cap, at least 85 bytes, and begins with the magic. A version other than `1` is refused. A version above it says that the app needs an update to read the file.
2. `m` is at least 2 and at most 65,536, and the file holds at least 85 + `m` bytes.
3. `kid` is the key id of a key the app holds as a signer: a release key built into the app, or a signing key held for a stored subscription. An unknown `kid` refuses the file with "this file was not signed by a key this app knows". Nothing has been parsed.
4. The signature verifies under that key. A failure is "the file is damaged or was changed".
5. The manifest is strict JSON within the parsing limits, with no duplicate member names and no member its table does not list in version 1 unless "Versioning" says it is ignorable.
6. The sizes of the parts add up to the length of the rest of the file exactly. A file with a byte too many or too few is refused.
7. `v` and `critical` pass "Versioning". Every member passes its own rule below.

Only then does the app look at a part. A part is read from the file in a stream into the app's own temporary storage, never into memory whole, and its SHA-256 is compared with the manifest's before anything inside it is parsed, opened or run. A part whose hash differs is dropped and the others are not affected.

The file is first copied into storage the app owns, through a stream that stops at the cap. The app does not read a file in a shared folder twice, so that the file cannot change between the check and the use.

## The manifest

| Member | Type | Rule |
|---|---|---|
| `v` | integer | 1 |
| `critical` | list of strings | As in the subscription format. A name the app does not know refuses the file. No name is defined yet. |
| `bundle_id` | string | 32 lowercase hexadecimal characters, 16 random bytes made for this bundle |
| `created_at` | integer, Unix seconds | When the signer made the file. Shown to the user and used to say that a bundle is old. Never used to accept or refuse a part. |
| `parts` | list of 1 to 32 | Objects below, in the order of the bytes |

Every part has `kind`, `size` (an integer from 1 to the cap of its kind) and `sha256` (the hash of its bytes, base64url without padding, 43 characters). By kind:

| `kind` | Members |
|---|---|
| `app` | `platform`: one of `"android-arm64"`, `"windows-x86_64"`, `"macos-aarch64"`, `"macos-x86_64"`, `"linux-x86_64"`, `"linux-aarch64"`. `version`: a strict semantic version. `name`: the release asset's file name, at most 128 bytes. `signature`: the text of the release signature of this file, as the online update fetches it, at most 1,024 bytes. |
| `pack` | `periods`: a list of 1 or 2 integers, consecutive, the period numbers `e` of "Periods and clocks" whose files the pack holds |
| `notice` | None |

A `name` is display text and is compared with the signature's trusted comment. It is never used as a path: the app chooses its own file names.

## Who signs what

| What | Key | How it is checked |
|---|---|---|
| The manifest | The signer: a release key built into the app, or a signing key held for a stored subscription | Ed25519 over the label, `kid`, length and manifest. This is the gate. It gives no part any authority. |
| An `app` part for Android | The release key the Android app holds as `PUBKEY` | The release signature (minisign) over the file's bytes. Its trusted comment must name exactly this release tag and this file name, as the online update requires. Android then checks the APK's own signing certificate against the installed app, a second guard that does not depend on this page. |
| An `app` part for a desktop | The updater key in the desktop app's configuration | The updater's signature over the artifact's bytes, by the check the online update runs. |
| A file of a `pack` | The provider's signing key | The envelope inside the file, through "What is checked, in order", "Identity", "Keys held for a subscription" and "Rollback and expiry" of the subscription page. |
| A `notice` | The provider's signing key | A signed envelope, below. |

Both kinds of key can sign in one bundle, and the signer of the manifest need not be the key of any part. A provider can pack the project's signed update next to its own files and sign the manifest itself. The app then trusts the update because the release key signed the update, and the provider's files because the provider signed them. It trusts nothing else in the file, and no member of the manifest names a key, a URL or a command.

**A notice** is a compact JWS as in "Envelope", with the header

```
{"alg":"EdDSA","typ":"veilway-bundle-notice+jws","kid":"<kid>"}
```

and a payload with `v`, `critical`, `serial` (an integer, 1 to 9007199254740991), `issued_at`, `expires_at` and `notices`, a list of at most 4 whose members are `severity` and `text`, held to the rules of "Provider content". A notice has no URL, no logo and no card, so nothing in it can be opened or fetched. It is checked against the signing keys of stored subscriptions, and shown in the provider area of every subscription held under that key, marked as coming from a file.

## Freshness and rollback

A bundle is a way to carry things, not a source of truth, so it can never make the app older.

| Part | Rule |
|---|---|
| `app` | The version is taken from signed data and is strictly greater than the running version. The manifest's `version` is checked against the version read from the verified artifact before it installs, and where the signature's trusted comment names a version it must be the same. A version that is equal or lower is listed as "already installed or older" and cannot be selected. This is the rule threat model invariant 34 asks of the online update. The bundle does not wait for that fix. |
| `pack` file | The document goes through "Rollback and expiry" as if the endpoint had answered: a serial not above the stored one is refused, the same bytes again change nothing, an expired document is refused, `issued_at` more than 300 s ahead of the clock is refused. A signed refusal is read and acted on like any other. |
| `notice` | The `serial` must be above the last bundle notice serial seen for that key. It is dropped when the clock is at or past `expires_at`. |
| The bundle itself | `created_at` is shown. A bundle older than 90 days is marked "old" and the app says that a newer one may exist. It is not refused: an old bundle can still carry a version the device does not have. |

A document applied from a bundle is the newest one the app holds, so a later refresh from the network is judged against its serial. A bundle cannot lower any serial, any version or any notice counter, so an old bundle passed around again does nothing except fail these checks.

## Importing

Ways in: a file picker, the system's share sheet or "open with" on a `.vwbundle` file, and a path given on the command line to `veilway` on a desktop. A deep link, a QR code and the clipboard cannot carry a bundle. Like every import, opening a file can bring the user to the review and do nothing else.

**Review.** After the checks of "The file" and after each part's hash, the app shows:

- the bundle's id as a fingerprint (the first 16 bytes of the SHA-256 of the manifest, as 8 groups of 4 hexadecimal digits), its date, and "old" when it is;
- who signed the manifest: "Veilway release" for a release key, or the provider's name (marked as the provider's own claim) with the key's fingerprint;
- each `app` part: platform, the version against the running one, and whether it can be installed. A part for another platform is listed as skipped.
- each subscription for which a file was found: the provider, the new serial and expiry, and "newer than the one you hold" or "nothing newer";
- each notice, with its text, as the provider's;
- how much space the chosen parts need.

Each item has its own choice. Nothing is chosen for the user. The user's yes is one action per item, and none of them connects the tunnel.

**Applying.** A document is stored as a refresh would store it, and takes effect for a profile at its next connect. If it asks for what a refresh would ask the user about (a move of the main endpoint, a new static mirror or refresh URL to confirm), the app asks after applying, with the same screens, and nothing is contacted before the answer. An app part is installed by the platform's own step after one more confirmation: Android's installer prompt, or the desktop updater's restart. The app does not install while a tunnel is being set up. A notice is stored and shown.

**A file that fails.** A bundle that fails a check is refused as a whole at the stage where it failed, the app keeps what it holds, and it tells the user in one line what failed. A part that fails after the manifest was accepted (a hash, a signature, a file that does not open) is dropped alone and named.

## Making a bundle

The core binary gets a command, and the panel a button that uses the same code (`veilway-proto` has the writer and the reader).

```
veilway bundle make --key signing.key --out update.vwbundle \
  [--app PLATFORM=ARTIFACT:SIGNATURE ...] [--pack pack.bin ...] [--notice notice.jws ...]
veilway bundle inspect FILE
```

`make` takes parts that already exist and signed, writes the manifest, signs it with the key file (mode 600, refused otherwise), and puts the parts in. It does not sign an app artifact and does not make a notice: the release signature is made by the release job, and a notice is signed by the provider's key. `inspect` runs every check of "The file" and prints what the app would list. It needs no key for a release bundle, which uses the keys built into the binary, and takes `--key` for a provider's. It is read-only.

**The project** makes a bundle at each release from the assets it already signs (`.minisig` files and updater `.sig` files), signed by the release key, and publishes it next to the release, so that a mirror can carry it like any asset.

**A provider's panel** has "Make bundle" on its static mirror page. It builds a pack from the documents the next publishing round would write (without `usage`, signed as for static files), adds a notice if the operator types one, can add the project's update files the operator uploads, and signs the manifest with the signing key. If the signing key is offline, the button exports the parts and the operator signs with `veilway bundle make` on the machine that holds it.

## Broadcast

One bundle can go to everyone, and each device takes only its own file. A `pack` is built to make that work while revealing nothing about other users.

| Offset | Length | Content |
|---|---|---|
| 0 | 4 | `n`, the number of files |
| 4 | 4 | `size`, one of the five sizes of a static file |
| 8 | 16 × `n` | The ids, strictly ascending as byte strings |
| 8 + 16 × `n` | `n` × `size` | The files, in the order of the ids |

The pack is exactly 8 + `n` × (16 + `size`) bytes. Every file in it is a static file as "The file" defines it: a salt, the sealed plaintext, a tag, with the same size throughout. The ids are `mirror_id` as "Keys of a static mirror" derives it, with one difference: `base_url` is the 6 bytes `bundle`, which no real base URL equals, since those begin with `https://` and end with `/`. Every other part of the derivation, the keys and the sealing is unchanged. The panel needs no new key and stores nothing new.

**What a device does.** For each stored subscription, for each period named by the pack, it derives its `mirror_id` from its token, device secret and device key, and looks it up in the index by binary search. It does not ask for the neighboring periods' names and does not need to: nothing is sent, so there is no host to tie two periods together. A hit is read, opened by steps 2 and 3 of "How the client opens a file", and the envelope goes into step 4 by the same path as an answer from the endpoint. A miss is not a revocation, as for any static mirror, and not an error. There are at most 2 opens per subscription and pack, and none for a miss.

**Decoys.** A pack holds decoys by the rules of "Decoys" for one period of one folder: at least 32 and at least one per 4 real files. A decoy is random bytes under a random id. So the count of files gives the number of devices only within a range, and a bundle made for a single device does not look like one.

**Size.** A pack costs about `size` bytes for each device and each period it names. 10,000 devices at the smallest size is about 94 MB, and the cap of 65,536 files keeps an index small enough to search in memory. A provider with more devices than fits makes several bundles, which tells a holder which group a device is in, and the maker should know that.

**What a holder learns.** Anyone who holds the bundle learns the signer, the number of files within the decoy range, the periods, and the sizes. They cannot tell which file is whose, open one without that device's token and secret, or tell a decoy from a file.

## What each party learns

| Who | Sees | Does not see |
|---|---|---|
| The channel (a stick, a Bluetooth peer, a satellite) | The whole file, so the signer, the date, the parts' kinds and sizes, and the app versions | Any token, device secret or document, or whose file is whose |
| A person who passes the file on | The same | The same |
| The signer | Nothing: the app sends nothing back | Who imported it, or when |
| The app | What it holds, plus the file | Nothing is learned about other users |

## Security considerations

- **A hostile file.** The first thing read is 21 fixed bytes, then at most 65,536 bytes of manifest that are not parsed, then one Ed25519 verification. A file that does not verify under a key the app holds costs those and nothing more. There is no archive format, no compression, no path, no nested bundle, no URL and no code. Part names never become file names. The app parses nothing in a part before its hash matches.
- **Size and parser exhaustion.** The cap is on the file, on the manifest, on the number of parts, on each kind of part and on JSON depth and values, and every cap is checked before the work it guards. Parts stream to disk and are never held whole in memory. A pack's index is read by binary search, so a pack of 65,536 files costs a handful of reads. The only expensive step is one AEAD open of a file of at most 1,089,437 bytes on a hit, and at most 2 per subscription and pack. A file that claims more than the file holds, or fewer, is refused by the sum of the sizes. The free-space check is made before a part is read. A bundle full of decoys costs the same as one without, because a miss is a failed search.
- **A bundle with a valid signature from the wrong signer.** The signature only gates. A provider key or the release key signing a manifest gives the file no power over a part. A key the app does not hold cannot sign a manifest the app will read, so a stranger cannot make a file the app lists at all. A signer who is a provider that the user has trusted can still waste the user's attention with a long list. The review shows who signed and puts the user in charge of each item.
- **Replaying an old bundle.** An old bundle can only carry what the checks already refuse: an app version that is not above the running one, documents with a serial that is not above the stored one or that have expired, and a notice with an old serial or past its expiry. What it can do is keep a device on the newest version the bundle carries instead of the newest version there is, which is the freezing the update path already has (threat model 5.8). The date and the "old" mark are there so the user can see it. A replay never moves a counter back.
- **A bundle that is a tracking token.** A broadcast bundle is the same bytes for everyone, so it identifies no one. A bundle made for one device, or one with a notice or an order of parts that differs per recipient, can be traced back to the recipient if it is later seen elsewhere. The app cannot tell. It shows the bundle's fingerprint so that people can compare, says in its help that a bundle given to one person is a pseudonym of that person, and the panel makes only the broadcast form with decoys. The app writes nothing into the file, reports nothing about it, makes no request because of it, and fetches no URL that it names. It remembers the ids of the last 32 bundles on the device, for display only.
- **Splicing parts between bundles.** The hash binds each part to the manifest and the signature binds the manifest, so a part cannot be swapped. A real part from another bundle fails its hash. The manifest of one bundle with the parts of another fails the length sum. An old signed update combined with a new manifest fails the version rule, whose version is read from the artifact.
- **A mixed-key confusion.** The signature covers a label that nothing else signs, so a signature of the same key made for another use, such as a release signature of a file, cannot be a manifest signature. A manifest signature cannot be a release signature, since the release signature is made over the file's bytes with other framing.
- **An app part is code.** It is the most dangerous thing in a file. It runs only after the release key's signature over the exact bytes verified, the version is above the running one, the user said yes, and (on Android) the system accepted the signing certificate. A signer of a manifest cannot make an unsigned artifact install. The bundle adds no key.
- **A stolen signing key.** A thief who holds a provider's key can make a bundle that the apps with that provider will list, and sign documents as now. The manifest signature adds no power over what that key could already do. A stolen release key is a larger problem than this page: see threat model 5.9.
- **Parsers here need fuzz targets** in the change that writes them: `fuzz_bundle_manifest` (everything before the signature check and the manifest after it), `fuzz_bundle_pack` (the header, the index and the lookup), and the notice's reader through the existing envelope target. The tests this page calls for: a file with one byte changed anywhere, a file one byte short or long, an unknown `kid`, a wrong signature, a manifest with a duplicate member, an app part with a wrong hash, a signature of another tag, an equal or lower version, a pack with unsorted ids or a wrong length, a pack file that does not open, an old serial, an expired document, an old notice serial, and a bundle at the file cap and one byte over.
- **Nothing here is invented cryptography.** SHA-256 for the parts, Ed25519 as published, the existing release signatures, HKDF, and ChaCha20-Poly1305 for the files. The layout, the label and the lookup are policy.

## Open questions

Each is listed with the default this draft takes.

| Question | Default |
|---|---|
| The release key today signs with minisign. Should the manifest be signed with the same key in plain Ed25519, or should the project make a separate bundle key? | The same key, with the label in the signed bytes, so no minisign signature of any file can be a manifest signature. A separate key means another secret in CI and another key in every app. |
| May a bundle bring a first import of a subscription? | No. A first import needs a link, a code or a whole document, so that the user's first yes is about a key. |
| Should an old bundle be refused outright after some age? | No. It is marked old after 90 days. A hard limit would take away the use of a stick found in a drawer, and the version rule already stops a rollback. |
| Can the desktop updater install from bytes it did not download itself? | Not known. The default is to verify the artifact and its signature by the same check and pass the file to the same install step. If the updater has no such entry, the app does its own install step after the same checks. |
| Should a pack be split by group to keep a bundle small? | One pack per provider, and several bundles for providers with more devices than fit. A split labels a group to anyone who holds a part. |
| Should a bundle carry error correction for a lossy one-way channel? | No. The channel's own layer does that. A damaged part is dropped alone by its hash, and the others still apply. |
| Should the project publish bundles for every release, or only on request? | For every release, as a release asset signed like the others. A mirror then carries it with the other assets. |
| Should the app remember which bundles it applied, to say "already applied"? | It remembers the last 32 ids for display only. The serial and version rules are what refuse a repeat. |
| Is a notice enough, or should a provider be able to send a signed new link in a bundle? | A notice only. A link in a bundle is a first import by another route. |
| Has anyone reviewed this text? | Not by anyone outside the project. |
