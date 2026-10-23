---
title: Offline bundles
description: Make a bundle file for people who cannot reach the internet, check it with veilway bundle inspect, and review it in the Veilway apps.
---

A bundle is one signed file that can carry an app update, new subscription documents, a provider's notice, or a mix. Move it by USB stick, Bluetooth or shared folder. Opening it does not connect the app to the internet.

:::note
The [offline bundle specification](../../protocol/offline-bundle/) describes the file format. No one outside the project has reviewed it.
:::

## What a bundle carries

| Part | What it is | Who must have signed it |
|---|---|---|
| App update | The file the online update installs, for one platform | The Veilway release key |
| Pack | Sealed subscription documents for the devices of one provider | The provider's signing key |
| Notice | A short message from a provider, at most 8,192 bytes | The provider's signing key |

A bundle can hold any mix, with at most one app update per platform, up to 1 GiB. Apps check the whole file's signature first, then each part with the key for its kind. A bundle signed by a key the app does not hold is refused.

## Make a bundle

You need a signing key file: 32 random bytes in base64, readable only by its owner (`chmod 600 signing.key`).

```
veilway bundle make --key signing.key --out update.vwbundle \
  --app linux-x86_64=./Veilway.AppImage:./Veilway.AppImage.sig
```

| Flag | Meaning |
|---|---|
| `--key FILE` | The signing key file. Required. Mode 600. |
| `--out FILE` | The bundle to write. Required. Use the `.vwbundle` extension. |
| `--app PLATFORM=ARTIFACT:SIGNATURE` | An app update. The platform is one of `linux-x86_64`, `linux-aarch64`, `windows-x86_64`, `macos-aarch64`, `macos-x86_64` or `android-arm64`. The version and file name come from the signature, which must check under the release key. Repeat for more platforms. |
| `--pack PERIODS=FILE` | A pack of sealed documents with its periods, such as `2871,2872=pack.bin`. Needs `--bundle-id`. Repeat for more packs. |
| `--notice FILE` | A signed notice. Repeat for more notices. |
| `--bundle-id ID` | The bundle's id: 32 lowercase hex digits. Required with `--pack`, because a pack is sealed for one id. Without packs, a random id is drawn. |

The command prints the file name, size, number of parts and the signer's fingerprint.

Sign each part with the key apps trust for its kind: the release key for an app update, the provider's key for documents and notices. Apps refuse any other key.

## Check a bundle

Run `inspect` before you hand a bundle out:

```
veilway bundle inspect update.vwbundle
veilway bundle inspect provider.vwbundle --key <provider public key, base64>
```

`--key` adds a provider's public key to the keys the release signature is checked with. Repeat it for more providers.

The output has four kinds of lines:

- The bundle id, when it was created, and its age: `current`, `old` (more than 90 days) or `dated in the future` (more than 5 minutes ahead of this computer's clock).
- Who signed it: a Veilway release key, or a provider key with its fingerprint.
- One line per part, marked `intact` or `damaged, dropped`. An app update whose signature does not check is also marked as dropped.
- For a refused file, a single `refused:` line with the reason. Nothing else is printed.

The exit status is `0` when the file verifies and `1` when it is refused. `inspect` only reads the file and does not use the network.

## What users see in the apps

The desktop and Android apps share one review screen.

1. On the screen where you add a subscription, choose **Open a bundle**. The desktop picker shows `.vwbundle` files. The Android picker shows all files. The apps do not open a bundle when you tap it in a file manager.
2. The app copies the file (up to 1 GiB) into its own folder and checks it. Nothing is applied yet. A failing file is reported as not signed by a trusted key, or damaged.
3. **Review this bundle** shows the fingerprint, signer and creation date. It says "Signed by the Veilway release key." or "Signed by" the provider's name, with a reminder that the app cannot check who the provider is. A banner warns if the bundle is more than 90 days old or dated in the future.
4. Each kind of part has a section:
   - **App update**: an **Install** button when the update is newer and made for this device. Otherwise the app says it is for another device or not newer, and skips it.
   - **Subscriptions**: a newer document shows its serial number and valid-until date. **Update** applies it at the next connect.
   - **Notices**: **Mark as read** hides the notice.
   - **Left out**: each unused part, with the reason. This lists damaged parts, bad app signatures, documents that do not parse, and notices for a subscription you do not hold.
5. Installing an app update asks **Install this update?** On the desktop, a running connection stops first, then the app restarts into the new version. On Android, the system installer asks you to confirm.
6. **Close the bundle** removes the app's copy.

Nothing changes until you press a button. A bundle with nothing for this device says so.

## Related

- [Offline bundle specification](../../protocol/offline-bundle/): the file layout and every check.
- [Subscription format](../../protocol/subscription-format/): the documents a pack carries.
