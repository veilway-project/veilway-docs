---
title: Offline bundle
description: One signed file that carries an app update, a provider's sealed subscription documents and a provider notice over any one-way channel, how the app checks and imports it, and what it refuses.
---

:::note[Built in v0.2.0]
The bundle reader and writer, `veilway bundle make` and `inspect`, and the review screens of the desktop and Android apps are built and reviewed. Not built yet: the panel button and the release job that makes the project's two bundles.
:::

A bundle is a file that an app can apply without a network: an update of the app, new subscription documents, a notice from a provider, or all three. It travels by any channel that moves bytes one way, such as a USB stick, Bluetooth, a shared folder or satellite datacasting. Read [Subscription format](../subscription-format/) first, in particular "The signed document", "Static mirrors" and "Import". This page reuses their rules and does not restate them. A section name in quotes is a section of that page unless this page has a section of that name.

Four rules shape the page:

- **The file is hostile until its signature is checked.** Nothing in it is parsed or allocated for, and no more than its first 65,621 bytes are written to disk, before the signature on its manifest has been verified under a key the app already holds.
- **The file is not trusted for what it says about itself.** The signature on the manifest says who put the file together and that nobody changed it. It gives the signer no power over any part. Each part is judged by its own key, the one the app already uses for that kind of thing.
- **A bundle changes nothing without a yes.** The app lists what it would apply and applies only what the user accepts. Opening a file can do nothing else than bring the user to that list.
- **A bundle never makes the app talk.** Importing one sends no request, enrolls no device and takes no device place.

## Numbers that are judgement calls

Every range written "a to b" is inclusive at both ends. None of these numbers has a measurement behind it.

| Name | Value |
|---|---|
| Whole file | at most 1,073,741,824 bytes (1 GiB) |
| Bytes the app keeps before the signature has verified | at most 65,621 (21 + 65,536 + 64) |
| Manifest | at most 65,536 bytes |
| Parts in a bundle | 1 to 32 |
| An app part | at most 268,435,456 bytes (256 MiB) for a desktop, 209,715,200 bytes (200 MiB) for Android, as its online update allows |
| App parts in a bundle | at most 1 per platform |
| A pack part | at most 536,870,912 bytes (512 MiB) |
| Files in a pack | 1 to 65,536 |
| A notice part | at most 8,192 bytes, and at most 8 in a bundle |
| Packs in a bundle | at most 8 |
| A pack part | also at most 8 + `n` × (16 + `size`) bytes, which for the largest file size means about 492 files |
| `version` of an app part | at most 64 bytes |
| Periods named by a pack | 1 or 2, consecutive |
| JSON nesting depth in the manifest | at most 8 |
| JSON values in the manifest | at most 2,000 |
| A signature string of an app part | at most 1,024 bytes (a release signature is about 400) |
| Lifetime of a notice (`expires_at` minus `issued_at`) | at most 90 days |
| Clock tolerance for `issued_at` of a notice, and for `created_at` | 300 s into the future, as for a document |
| Age limit of a signed refusal inside a pack file | 1 day, as for a static file |
| Decoys in a pack | at least the larger of 32 and `R` / 4, rounded up, and at most the larger of 64 and `R` / 2, rounded up, where `R` is the number of real files over all periods |
| A bundle counts as old | 90 days after `created_at`. The app says so and refuses nothing for it. |
| Opens of a pack file in one import | at most 2 per stored subscription and pack |
| Free space the app needs before it copies a file | the size of the file, and again the size of an app part before that part is handed to an installer |
| Bundle copies kept in the app's storage | 1, deleted when the review ends, at the next start and before another is copied |
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

The signature is Ed25519 (RFC 8032, the strict rule of the subscription page) over `"veilway v1 bundle manifest" || version || kid || be32(m) || manifest`, where `version` is the byte at offset 8. The label, the format version, the key id and the length are inside it so that the manifest cannot be moved to another key, another length, another format version or another use. The magic is the only byte string of the 21-byte head that the signature does not cover, and a changed magic is a file the app does not read.

The magic, not the extension, says what a file is. The extension is `.vwbundle` and the media type is `application/vnd.veilway.bundle`.

**What is checked, in order.** The first failure ends it, and nothing is kept:

1. The source is copied into storage the app owns, through a stream that stops at the cap. The app does not read a file in a shared folder twice, so the file cannot change between the check and the use. The stream is not written beyond its first 21 bytes until step 1 has passed, and not beyond its first 85 + `m` bytes until step 5 has.
2. The first 9 bytes are the magic and a version. A version other than `1` is refused. A version above it says that the app needs an update to read the file.
3. `m` is at least 2 and at most 65,536, and the source holds at least 85 + `m` bytes. A source that ends earlier is refused.
4. `kid` is the key id of a key the app holds as a signer: the key of its own online update, or a signing key held for a stored subscription. An unknown `kid` refuses the file with "this file was not signed by a key this app knows". More than one held key may have the same `kid`, and each is tried. `kid` only picks a key: the key is never taken from the file.
5. The signature verifies under that key. A failure is "the file is damaged or was changed". A file that fails here has cost 85 + `m` bytes of disk, one hash and one verification, and the rest of the stream is dropped unread.
6. The manifest is strict JSON within the parsing limits, with no duplicate member names. Members and part kinds that this version does not list are treated as "Versioning" of the subscription page says, and as this page says in "The manifest".
7. The rest of the stream is copied. The sizes of the parts must add up to the length of the rest exactly, and the sum is made with overflow checked, before any part is looked at. A file with a byte too many or too few is refused.
8. `v` and `critical` pass "Versioning". Every member passes its own rule below.

Only then does the app look at a part. Each part's SHA-256 was computed while the stream was copied, and it is compared with the manifest's before anything inside the part is parsed, opened or run. A part whose hash differs is dropped and the others are not affected.

## The manifest

| Member | Type | Rule |
|---|---|---|
| `v` | integer | 1 |
| `critical` | list of strings | As in the subscription format. A name the app does not know refuses the file. No name is defined yet. |
| `bundle_id` | string | 32 lowercase hexadecimal characters, 16 random bytes made for this bundle |
| `created_at` | integer, Unix seconds | When the signer made the file. Shown to the user and used to say that a bundle is old. A value more than 300 s ahead of the clock is shown as "dated in the future". Never used to accept or refuse a part. |
| `parts` | list of 1 to 32 | Objects below, in the order of the bytes |

Every part has `kind`, `size` (an integer from 1 to the cap of its kind) and `sha256` (the hash of its bytes, base64url without padding, 43 characters). By kind:

| `kind` | Members |
|---|---|
| `app` | `platform`: one of `"android-arm64"`, `"windows-x86_64"`, `"macos-aarch64"`, `"macos-x86_64"`, `"linux-x86_64"`, `"linux-aarch64"`. `version`: a strict semantic version. `name`: the release asset's file name, at most 128 bytes. `signature`: the text of the release signature of this file, as the online update fetches it, at most 1,024 bytes. |
| `pack` | `periods`: a list of 1 or 2 integers, consecutive, the period numbers `e` of "Periods and clocks" whose files the pack holds |
| `notice` | None |

Version 1 ignores a manifest member it does not list, as a payload does, and counts it in the parsing limits. A part of a `kind` it does not know is listed as skipped, its bytes still count in the length sum, and a `critical` name is how a future signer says that skipping it is unsafe. At most one `app` part is allowed for a platform, and a second is a refusal of the file.

A `name` is display text. For Android it must be exactly the trusted comment's file name. For a desktop it must equal the `file:` field of the signature's trusted comment, and the extension must be one the app's own platform installs (`.exe` for Windows, `.AppImage`, `.deb` or `.rpm` for Linux, `.tar.gz` for macOS). It is never used as a path: the app chooses its own file names. The app lists and installs only the part whose `platform` is its own, so a part labeled for another platform is never handed to an installer.

## Who signs what

| What | Key | How it is checked |
|---|---|---|
| The manifest | The signer: the key of the app's own online update (see below), or a signing key held for a stored subscription | Ed25519 over the label, version, `kid`, length and manifest. This is the gate. It gives no part any authority. |
| An `app` part for Android | The minisign release key the Android app holds as `PUBKEY` | The release signature over the file's bytes, by the check its online update runs: the trusted comment must be exactly `veilway <tag> veilway-android-arm64.apk`, and `version` must be that tag without a leading `v`. Android then checks the APK's own signing certificate against the installed app, a second guard that does not depend on this page. |
| An `app` part for a desktop | The updater key in the desktop app's configuration | The updater plugin's own check of the artifact's bytes and its signature, including the version in the signature's trusted comment, as "Installing an app part on a desktop" says. |
| A file of a `pack` | The provider's signing key | The envelope inside the file, through "What is checked, in order", "Identity", "Keys held for a subscription" and "Rollback and expiry" of the subscription page. |
| A `notice` | The provider's signing key | A signed envelope, below. |

**Two keys sign the project's releases, and they are not the same.** The desktop app holds only the updater key (Tauri's, in `tauri.conf.json`). The Android app holds only the minisign release key. The release job signs every asset with the release key as well, but no desktop app holds it. So the project makes two bundles for a release, one for each family, and each is signed by the key that family's app holds. A bundle that mixes the families is signed by a provider. The signer of a manifest need not be the key of any part, and the app never takes a manifest signature as a signature of an `app` part.

Both kinds of key can sign in one bundle. A provider can pack the project's signed update next to its own files and sign the manifest itself. The app then trusts the update because the update key signed it, and the provider's files because the provider signed them. It trusts nothing else in the file, and no member of the manifest names a key, a URL or a command.

### Installing an app part on a desktop

The updater plugin at the locked version (2.14.0 in `apps/desktop/src-tauri/Cargo.lock`) can install from bytes the app already holds, without a download. `Updater::restore_update` takes a manifest as JSON and returns an `Update` without any request. `Update::install(bytes)` then verifies the bytes against that update's signature and the configured public key, and installs them. So the app builds the JSON `{"version": ..., "platforms": {"<target>": {"url": "https://invalid/", "signature": ...}}}` from the verified manifest, with the base64 of the part's signature text, calls `restore_update`, and gives the bytes of the part to `install`. The URL is a placeholder and is never fetched.

Three things about it:

- **The signed version is forced.** `restore_update` always sets `require_signed_version`, so the artifact's signature must carry a `version:` field in its trusted comment and it must equal the manifest's `version`. A signature without one is refused. The release job must sign with the version recorded.
- **The comparison is the plugin's own.** `restore_update` returns nothing when the version is not above the running one. This page's rule (strictly greater, from signed data) is therefore checked twice.
- **The bytes are held in memory whole,** as the online download does. This is why the cap of a desktop part is 256 MiB. The app reads the part from its own copy, computes its hash again against the manifest while reading, and only then calls `install`. Windows leaves the app after launching the installer, and the other systems need a relaunch, as with the online update.

Plugin versions before 2.12 have no `restore_update`. The threat model (5.8, G16) names 2.11.0, but the lock file holds 2.14.0: the entry is out of date on the version, and the online path is still open, since `requireSignedVersion` is not set in `tauri.conf.json` and defaults to false. Setting it is a one-line fix for G16 and also what this page needs for the same rule on both paths.

### Installing an app part on Android

Android's update is the app's own code (`apps/android/src-tauri/src/update.rs`), not the plugin: updater plugins do not run on mobile. It reads the release list, downloads the APK, checks the minisign signature and the trusted comment against the tag with `verify`, and hands the file's path to the Kotlin plugin, which starts Android's installer. A bundle uses the same `verify` and the same hand-off, on the part's copy in the app's own folder. The version is the tag in the comment, compared with the same strict semantic version rules, and only a strictly newer one counts. The installer prompt is the user's yes.

**A notice** is a compact JWS as in "Envelope", with the header

```
{"alg":"EdDSA","typ":"veilway-bundle-notice+jws","kid":"<kid>"}
```

and a payload with `v`, `critical`, `issued_at`, `expires_at` and `notices`, a list of at most 4 whose members are `severity` and `text`, held to the rules of "Provider content". There is no serial: a counter in a notice could be set to its largest value by a stolen key and would then refuse every later notice of that key for good. A notice has no URL, no logo and no card, so nothing in it can be opened or fetched. It is checked against the signing keys of stored subscriptions, and shown in the provider area of every subscription held under that key, marked as coming from a file.

## Freshness and rollback

A bundle is a way to carry things, not a source of truth, so it can never make the app older.

| Part | Rule |
|---|---|
| `app` | The version is taken from signed data (the trusted comment of the verified signature) and is strictly greater than the running version. The manifest's `version` must be the same as the signed one, and a signature that names none is refused. A version that is equal or lower is listed as "already installed or older" and cannot be selected. This is the rule threat model invariant 34 asks of the online update. The bundle does not wait for that fix. |
| `pack` file | The document goes through "Rollback and expiry" as if the endpoint had answered: a serial not above the stored one is refused, the same bytes again change nothing, an expired document is refused, `issued_at` more than 300 s ahead of the clock is refused. A signed refusal (`"disabled"`, `"expired"`) is read and acted on like any other, but it keeps its age limit of a day, so a refusal in a bundle that has travelled longer is dropped and the document is not changed. |
| `notice` | `issued_at` must be above the `issued_at` of the last bundle notice accepted for that key, and not more than 300 s ahead of the clock. It is dropped when the clock is at or past `expires_at`. A stolen key can move the stored `issued_at` at most 300 s past the clock, so the real provider's next notice is refused for at most 5 minutes. |
| The bundle itself | `created_at` is shown. A bundle older than 90 days is marked "old" and the app says that a newer one may exist. It is not refused: an old bundle can still carry a version the device does not have. |

A document applied from a bundle is the newest one the app holds, so a later refresh from the network is judged against its serial. A bundle cannot lower any serial, any version or any notice counter, so an old bundle passed around again does nothing except fail these checks.

## Importing

Ways in: a file picker, the system's share sheet or "open with" on a `.vwbundle` file, and a path given on the command line to `veilway` on a desktop. A deep link, a QR code and the clipboard cannot carry a bundle. Like every import, opening a file can bring the user to the review and do nothing else.

**Review.** After the checks of "The file" and each part's hash, and with nothing but the bundle's own copy written, the app shows:

- the bundle's id as a fingerprint (the first 16 bytes of the SHA-256 of the manifest, as 8 groups of 4 hexadecimal digits), its date, and "old" when it is;
- who signed the manifest: "Veilway release" for a release key, or the provider's name (marked as the provider's own claim) with the key's fingerprint;
- each `app` part: platform, the version against the running one, and whether it can be installed. A part for another platform is listed as skipped.
- each subscription for which a file was found: the provider, the new serial and expiry, and "newer than the one you hold" or "nothing newer";
- each notice, with its text, as the provider's;
- how much space an app part needs, if it is chosen.

Each item has its own choice. Nothing is chosen for the user. Leaving the review deletes the bundle's copy. The user's yes is one action per item, and none of them connects the tunnel.

**Applying.** A document is stored as a refresh would store it, and takes effect for a profile at its next connect. If it asks for what a refresh would ask the user about (a move of the main endpoint, a new static mirror or refresh URL to confirm), the app asks after applying, with the same screens, and nothing is contacted before the answer. An app part is installed by the platform's own step after one more confirmation: Android's installer prompt, or the desktop updater's restart. The app does not install while a tunnel is being set up. A notice is stored and shown.

**A file that fails.** A bundle that fails a check is refused as a whole at the stage where it failed, the app keeps what it holds, and it tells the user in one line what failed. A part that fails after the manifest was accepted (a hash, a signature, a file that does not open) is dropped alone and named.

## Making a bundle

The core binary gets a command, and the panel a button that uses the same code (`veilway-proto` has the writer and the reader).

```
veilway bundle make --key signing.key --out update.vwbundle \
  [--app PLATFORM=ARTIFACT:SIGNATURE ...] [--pack pack.bin ...] [--notice notice.jws ...]
veilway bundle inspect FILE
```

`make` takes parts that already exist and signed, writes the manifest, signs it with the key file (mode 600, refused otherwise), and puts the parts in. A pack is built by the panel, not by `make`, since only the panel can seal files for devices. It does not sign an app artifact and does not make a notice: the release signature is made by the release job, and a notice is signed by the provider's key. `inspect` runs every check of "The file" and prints what the app would list. It needs no key for a release bundle, which uses the keys built into the binary, and takes `--key` for a provider's. It is read-only.

**The project** makes two bundles at each release, one per family as above, from the assets it already signs (`.minisig` files and updater `.sig` files), and publishes them next to the release, so that a mirror can carry them like any asset. The manifest signature is raw Ed25519, and the tools the project has make it one way: `tauri signer sign` and `minisign -S -l` both sign the bytes of a file directly, so the release job writes the bytes to be signed to a file, signs it, takes the 64 signature bytes out of the signature file, and deletes that file. The signature file is never published: its trusted comment is not under this page's label, and an outsider who held it could offer the manifest's bytes to an updater as an artifact. The ordinary `minisign -S` signs a hash of the file, so it is not used for this. The release job also signs nothing whose first bytes an outsider can choose, which is what keeps a signature of a file from being a manifest signature.

**A provider's panel** has "Make bundle" on its static mirror page. It builds a pack from the documents the next publishing round would write (without `usage`, signed as for static files), adds a notice if the operator types one, can add the project's update files the operator uploads, and signs the manifest with the signing key. If the signing key is offline, the button exports the parts and the operator signs with `veilway bundle make` on the machine that holds it.

## Broadcast

One bundle can go to everyone, and each device takes only its own file. A `pack` is built to make that work while revealing nothing about other users.

| Offset | Length | Content |
|---|---|---|
| 0 | 4 | `n`, the number of files |
| 4 | 4 | `size`, one of the five sizes of a static file |
| 8 | 16 × `n` | The ids, strictly ascending as byte strings |
| 8 + 16 × `n` | `n` × `size` | The files, in the order of the ids |

The pack is exactly 8 + `n` × (16 + `size`) bytes, and a part of any other length is refused. Before the index is used, the app checks `n` (1 to 65,536), that `size` is one of the five sizes, the length, and that the ids are strictly ascending, which is one pass over at most 1 MiB of ids. Every file in it is a static file as "The file" of the subscription page defines it: a salt, the sealed plaintext, a tag, with the same size throughout. The ids are `mirror_id` as "Keys of a static mirror" derives it, with one difference: `base_url` is the 6 bytes `bundle` followed by the 16 bytes of `bundle_id`, 22 bytes in all. No real base URL equals that, since those begin with `https://` and end with `/`. Every other part of the derivation, the keys and the sealing is unchanged. The panel needs no new key and stores nothing new, and the device needs no clock and no network: its token, device secret, device key and the manifest are all it uses.

**Why `bundle_id` is in the id.** The associated data of a file is its `mirror_id`, so a file made for one bundle does not open in another. And a device's id for a period differs in every bundle, so two bundles of one provider cannot be compared to find which devices came, stayed or left. Without it, the ids of one period would be the same in every bundle, and anyone with two packs could read the provider's churn off them.

**Fresh salts.** Every file of a pack is sealed anew, with a salt drawn for this bundle. The panel never copies a file from a static round into a pack. The key of a file comes from the salt and `k_mirror` and the nonce is zero, so a salt used for two plaintexts would reuse a keystream. The documents inside are the ones the endpoint could answer, as for a static file, and a body that was signed once keeps its serial, so no serial is signed twice for two bodies.

**What a device does.** For each stored subscription, for each period named by the pack, it derives its `mirror_id` from its token, device secret and device key, and looks it up in the index by binary search. It does not ask for the neighboring periods' names and does not need to: nothing is sent, so there is no host to tie two periods together. A hit is read, opened by steps 2 and 3 of "How the client opens a file", and the envelope goes into step 4 by the same path as an answer from the endpoint. A miss is not a revocation, as for any static mirror, and not an error. There are at most 2 opens per subscription and pack, and none for a miss.

**Decoys.** A pack holds decoys by the shape of "Decoys" under "Publishing", with one change: a bundle is written once, so there are no births and no deaths. The count is drawn uniformly from the range in the numbers table, over all the real files of all the periods of the pack together, since the index mixes them. A decoy is random bytes of `size` under a random 16-byte id that no real file has. So the count of files gives the number of devices only within a range, and a bundle made for a single device does not look like one: it holds at least 33 files. A decoy is not told from a file by anyone who has no record of what the devices do with the pack, and nobody has one, since nothing is fetched.

**Size.** A pack costs about `size` bytes for each device and each period it names, and every file has the size of the pack's largest envelope. 10,000 devices at the smallest size, one period, is about 94 MB. The cap of a pack part (512 MiB) is the limit in practice: at the smallest size it holds about 56,000 files, and at the largest only about 490. A provider with more devices than fits makes several bundles, which tells a holder which group a device is in, and the maker should know that.

**What a holder learns.** Anyone who holds the bundle learns the signer, the number of files within the decoy range, the periods, and the size. They cannot tell which file is whose, open one without that device's token and secret, or tell a decoy from a file. Someone who holds a device's token and secret can look for that device's file in any pack, and learns nothing by it that the device's own subscription did not give them.

## What each party learns

| Who | Sees | Does not see |
|---|---|---|
| The channel (a stick, a Bluetooth peer, a satellite) | The whole file, so the signer, the date, the parts' kinds and sizes, the app versions, and the pack's period and file count within a range | Any token, device secret or document, or whose file is whose |
| A person who passes the file on | The same | The same |
| The signer | Nothing: the app sends nothing back | Who imported it, or when |
| The app | What it holds, plus the file | Nothing is learned about other users |

## Security considerations

- **A hostile file.** A file that does not verify costs a read of 21 bytes, a read of at most 65,536 bytes of manifest that are not parsed, one hash and one Ed25519 verification, with at most 65,621 bytes written. The rest of the stream is dropped. There is no archive format, no compression, no path, no nested bundle, no URL and no code. Part names never become file names. The app parses nothing in a part before its hash matches.
- **Size and parser exhaustion.** The cap is on the file, on the manifest, on the number of parts, on each kind of part and on JSON depth and values, and every cap is checked before the work it guards. The copy to disk is bounded by the cap and by the free-space check, and it is cut short at the first failed check, so a stream of junk cannot fill the disk past 65,621 bytes. The sum of the sizes is made with overflow checked. A pack's index is read by binary search after one pass over at most 1 MiB of ids, and the length formula is checked first so that `n` and `size` cannot point past the part. The only expensive step is one AEAD open of a file of at most 1,089,437 bytes on a hit, at most 2 per subscription and pack, and at most 8 packs. A bundle full of decoys costs the same as one without, because a miss is a failed search. A desktop app part is held in memory whole, at most 256 MiB, as the online update does.
- **Signature scope.** The signature covers the label, the format version, the key id, the length and every byte of the manifest, and the manifest has the hash of every part and the order and size of them all. So the parts, their order, their kinds and their lengths are all bound, and the file length is bound by the sum. The magic is not covered and changes nothing but whether the file is read. A signature of another key, another length or another version of the format fails to verify.
- **A bundle with a valid signature from the wrong signer.** The signature only gates. A provider key signing a manifest gives the file no power over a part. A key the app does not hold cannot sign a manifest the app will read, so a stranger cannot make a file the app lists at all. A signer who is a provider that the user has trusted can still waste the user's attention with a long list, and can label an old artifact that the update key signed as a new one, which the signed version in the artifact's signature refuses. The review shows who signed and puts the user in charge of each item.
- **Replaying an old bundle.** An old bundle can only carry what the checks already refuse: an app version that is not above the running one, documents with a serial that is not above the stored one, that have expired, or that are refusals older than a day, and a notice with an old `issued_at` or past its expiry. What it can do is keep a device on the newest version the bundle carries instead of the newest version there is, which is the freezing the update path already has (threat model 5.8). The date and the "old" mark are there so the user can see it. A replay never moves a counter back.
- **A bundle that is a tracking token.** A broadcast bundle is the same bytes for everyone, so it identifies no one. A bundle made for one device, or one with a notice or an order of parts that differs per recipient, can be traced back to the recipient if it is later seen elsewhere. The app cannot tell. It shows the bundle's fingerprint so that people can compare, says in its help that a bundle given to one person is a pseudonym of that person, and the panel makes only the broadcast form with decoys. A split of devices over several bundles makes each bundle a group marker, and the maker should know it. Because `bundle_id` is in every file id, two bundles of one provider share no id, so they cannot be matched to find who joined or left. The app writes nothing into the file, reports nothing about it, makes no request because of it, and fetches no URL that it names. It remembers the ids of the last 32 bundles on the device, for display only. A document that the bundle brought is used by the next connect or refresh like any other, and that traffic is the same as it would have been with no bundle.
- **Splicing parts between bundles.** The hash binds each part to the manifest and the signature binds the manifest, so a part cannot be swapped. A real part from another bundle fails its hash. The manifest of one bundle with the parts of another fails the length sum. A pack file lifted into another pack does not open, since the id is in its associated data and the id holds the bundle's. An old signed update combined with a new manifest fails the version rule, whose version is read from the artifact's signature.
- **A mixed-key confusion.** The signature covers a label that no release artifact starts with, so a signature of the same key made for another use cannot be a manifest signature, as long as the release job signs only its own build outputs. A manifest signature cannot be taken as the signature of an artifact, since the signature file is never published and the 64 bytes alone carry no trusted comment. The plugin's check of an artifact also needs the global signature over that comment.
- **An app part is code.** It is the most dangerous thing in a file. It runs only after the update key's signature over the exact bytes verified, the signed version is above the running one, the platform is the app's own, the user said yes, and (on Android) the system accepted the signing certificate. A signer of a manifest cannot make an unsigned artifact install. The bundle adds no key to the update path.
- **What a stolen key gives.** Each row assumes the thief also gets the file to a user, which needs no network position at all.

| Key | What the thief can make with it | What the thief cannot make |
|---|---|---|
| A provider's signing key | A bundle that the apps with that provider will list. Notices (at most 4 of 280 bytes each, no link) shown in the provider's area, marked as coming from a file: a phishing text is possible, and the mark and the plain text are the only defense. Notices can be repeated with a later `issued_at`, but only 300 s ahead of the clock, so the real provider's next notice is blocked for at most 5 minutes. Documents are as the key could already sign them. | A pack file for any device, since sealing needs that device's token and secret. An app part that installs. A pack that opens for a device it was not made for. |
| The project's update key (the Tauri key for desktops, the minisign release key for Android) | Everything the key already could: an update, which is code on every app that holds it (threat model 5.9). A bundle adds one channel to that, one that needs no network position, and removes the need for the GitHub hosts that the Android update demands. | Anything for an app that holds a different key. Anything that the user does not accept in the review and, on Android, that the system's installer accepts. |
| One device's token and secret | That device's own file, in any pack, in any bundle. | Another device's file. |
| The panel's seal keys | Everything a pack can hold, for every device. | See the subscription page's "What each party learns". |

A stolen key cannot be revoked in the apps that hold it. A provider can rotate its key as "Keys held for a subscription" says. The project cannot rotate the update key short of a release that every app takes through the old key, which is threat model 5.9.

- **Bundles are kept for good.** Whoever received a bundle can keep it forever, as a static host keeps every version. A file in a pack opens with `k_mirror`, which is fixed for a token and a device, so whoever later gets a device's token and secret opens that device's file in every bundle they kept. That is why a pack file has no `usage`, as a static file has none, and nothing in a bundle should be more than a static file holds.
- **Parsers here need fuzz targets** in the change that writes them: `fuzz_bundle_manifest` (everything before the signature check and the manifest after it), `fuzz_bundle_pack` (the header, the index and the lookup), and the notice's reader through the existing envelope target. The tests this page calls for: a file with one byte changed anywhere, including the version byte and the magic, a file one byte short or long, an unknown `kid`, a wrong signature, a manifest with a duplicate member, a stream of junk that is cut short at the first failed check with at most 65,621 bytes written, an app part with a wrong hash, a signature of another tag, an equal or lower version, an artifact whose signature names no version, a second `app` part for a platform, a part labeled for another platform, a pack with unsorted ids, a wrong length or an `n` of 0, a pack file that does not open, a pack file moved to another bundle, an old serial, an expired document, a refusal older than a day, an old notice `issued_at`, a notice 301 s ahead, and a bundle at the file cap and one byte over.
- **Nothing here is invented cryptography.** SHA-256 for the parts, Ed25519 as published, the existing release signatures, HKDF, and ChaCha20-Poly1305 for the files. The layout, the label and the lookup are policy.

## Open questions

Each is listed with the default this draft takes. The question whether the desktop updater can install from bytes it did not download is settled above: it can, at plugin 2.14.0 and later, through `restore_update` and `install`.

| Question | Default |
|---|---|
| Should the project use the keys of its online updates for manifests, or make a separate bundle key? | The same keys, one bundle per family, with the label in the signed bytes. A separate key means another secret in CI and another key in every app. |
| Should the online update set `requireSignedVersion` too? | Yes, in the change that builds this page, since the bundle path forces it and the two should agree. It also closes threat model G16. It needs the release job to record the version in every signature, and that is to be checked on a real release. |
| May a bundle bring a first import of a subscription? | No. A first import needs a link, a code or a whole document, so that the user's first yes is about a key. |
| Should an old bundle be refused outright after some age? | No. It is marked old after 90 days. A hard limit would take away the use of a stick found in a drawer, and the version rule already stops a rollback. |
| Should a pack be split by group to keep a bundle small? | One pack per provider, and several bundles for providers with more devices than fit. A split labels a group to anyone who holds a part. |
| Should a bundle carry error correction for a lossy one-way channel? | No. The channel's own layer does that. A damaged part is dropped alone by its hash, and the others still apply. |
| Should the project publish bundles for every release, or only on request? | For every release, as release assets signed like the others. A mirror then carries them with the other assets. |
| Should the app remember which bundles it applied, to say "already applied"? | It remembers the last 32 ids for display only. The serial and version rules are what refuse a repeat. |
| Is a notice enough, or should a provider be able to send a signed new link in a bundle? | A notice only. A link in a bundle is a first import by another route. |
| Should the app offer to pass a received bundle on? | Only as the same file through the system's share sheet, with nothing added and nothing recorded. A file that the app rewrote would be a new tracking token. |
| Does the tool-made raw signature work for both release keys? | Not tried. `tauri signer sign` and `minisign -S -l` are specified to sign the file's bytes directly, and a test with the bundle reader must show that the 64 bytes verify as Ed25519 under each key before this page's design is taken as workable. |
| Has anyone reviewed this text? | Not by anyone outside the project. |
