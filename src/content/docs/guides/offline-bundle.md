---
title: Offline bundles
description: Make a bundle file for people who cannot reach the internet, check it with veilway bundle inspect, and review it in the Veilway apps.
---

A bundle is one signed file. It can carry an app update, new subscription documents, a notice from a provider, or a mix of these. Move it on a USB stick, over Bluetooth or in a shared folder. Opening it does not connect the app to the internet.

:::note
The [offline bundle specification](../../protocol/offline-bundle/) describes the file format. Nobody outside the project has reviewed it yet.
:::

## What a bundle carries

| Part | What it is | Who must have signed it |
|---|---|---|
| App update | The file the online update installs, for one platform | The Veilway release key |
| Pack | Sealed subscription documents for the devices of one provider | The provider's signing key |
| Notice | A short message from a provider, at most 8,192 bytes | The provider's signing key |

A bundle can hold any mix of these, with at most one app update per platform. A file can be up to 1 GiB.

The apps check the signature on the whole file first. Then they check each part with the key for its kind. A bundle signed by a key the app does not hold is refused.

## Make a bundle

You need a signing key file. It holds 32 random bytes in base64, and only its owner can read it. Set the mode with `chmod 600 signing.key`.

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

The command prints the file name, its size, the number of parts and the fingerprint of the signer.

Sign each part with the key the apps trust for its kind. An app update needs the release key. Documents and notices need the provider's key. The apps refuse a bundle signed by any other key.

## Check a bundle

Run `inspect` before you give a bundle to anyone:

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

The exit status is `0` when the file verifies and `1` when it is refused. `inspect` only reads the file. It changes nothing and does not use the network.

## What users see in the apps

The desktop and Android apps share one review screen.

1. On the screen where you add a subscription, choose **Open a bundle**. The desktop picker shows `.vwbundle` files. The Android picker shows all files. The apps do not open a bundle when you tap it in a file manager.
2. The app copies the file (up to 1 GiB) into its own folder and checks it. Nothing is applied yet. If the file fails, the app says it was not signed by a key it trusts, or that it is damaged.
3. The review screen, **Review this bundle**, shows the fingerprint, who signed it and the date it was made. It says "Signed by the Veilway release key." or "Signed by" the provider's name, with a reminder that the app cannot check who the provider is. A banner warns if the bundle is more than 90 days old or dated in the future.
4. Each kind of part has a section:
   - **App update**: an **Install** button when the update is newer and made for this device. Otherwise the app says it is for another device or not newer, and skips it.
   - **Subscriptions**: a newer document shows its serial number and the date it is valid until. **Update** applies it. It takes effect at the next connect.
   - **Notices**: **Mark as read** hides the notice.
   - **Left out**: each unused part, with the reason. This lists damaged parts, bad app signatures, documents that do not parse, and notices for a subscription you do not hold.
5. Installing an app update asks **Install this update?** On the desktop, a running connection stops first, then the app restarts into the new version. On Android, the system installer asks you to confirm.
6. **Close the bundle** removes the app's copy.

Nothing changes until you press a button. If a bundle has nothing for this device, the app says so.

## Related

- [Offline bundle specification](../../protocol/offline-bundle/): the file layout and every check.
- [Subscription format](../../protocol/subscription-format/): the documents a pack carries.
