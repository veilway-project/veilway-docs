---
title: App privacy policy
description: What the Veilway apps keep on your device and what they send, and to whom.
---

This policy covers the Veilway apps for Windows, Linux and Android, and the `veilway` command-line client. The Veilway project makes the software. It does not run a VPN service, and it does not run the servers your app connects to.

## Your provider is separate

The app connects you to a service run by a provider: whoever gave you the subscription. That provider sees what any VPN operator can see, such as the address you connect from, when you connect and how much data you use. Their own terms and privacy policy cover that. If your provider has published them, the app shows both before your first connection and asks you to accept them. It asks again whenever the provider changes either one.

## What the apps never do

- No analytics, telemetry, crash reports or advertising.
- No account with the Veilway project. Nothing you do in the app is sent to the project.
- No tracking of the sites you visit. Your traffic goes through the tunnel to your provider's servers and is never sent anywhere else.

## What the apps send, and to whom

- **To your provider.** When you add a subscription, the app asks you before it contacts the provider's address for the first time. After that it fetches updates to the subscription from that address and from any backup addresses you allowed. While you are connected, your traffic goes to the provider's servers.
- **To GitHub, for updates.** The desktop app checks for a new version when it starts and every six hours, unless you turn off automatic updates in Settings. The Android app does the same check. Both read the latest release of the Veilway repository on GitHub. GitHub sees your IP address and that a Veilway app asked, as with any download. Nothing about you or your subscriptions is in the request.
- **Links you open.** Your provider's links and this page open in your system's browser, never inside the app. The site you open sees what any website sees.

## What stays on your device

- Your subscriptions and the keys made for them, stored encrypted with the system's key store: DPAPI on Windows, the desktop's keyring or a file only root can read on Linux, the Android Keystore on Android.
- Your settings, and your answers to the app's questions: which addresses it may contact, which terms you accepted, which connection you chose.
- The log. It is kept in memory only, so it is gone when the app closes, and it leaves the device only if you copy it yourself.

When you remove a subscription, the app deletes it with its keys. Uninstalling the app deletes the rest.

## Sharing

The app shares a subscription only when you ask it to: as a link, a QR code or a sealed file with a password that you choose. Anyone you give it to can use it.

## Changes

Changes to this policy are made in the open, in the [docs repository](https://github.com/veilway-project/veilway-docs), and are listed in its history.
