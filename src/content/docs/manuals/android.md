---
title: Android app
description: Installing the Veilway Android app from the alpha release, connecting, and the kill switch.
---

The Android app is part of the [alpha](../../alpha/). It is an arm64 build, so it needs a 64-bit ARM phone. It shows the same screens as the [desktop app](../client/) and connects through a system VPN.

## Install the APK

1. On the phone, open the [alpha release page](https://github.com/veilway-project/veilway/releases) and download the APK ending in `-arm64.apk`.
2. Open the file. The first time, Android asks you to allow installs from this source. Allow it for your browser or file manager only, then continue.

## Add a subscription

Your operator gives you a subscription link, file, or QR picture. On the import screen, paste the link or choose the file or picture, then follow the app's steps. A password-locked file (sealed, ending in `.vwsealed`) asks for the password first. The [client manual](../client/#add-a-subscription) describes the steps.

To scan a QR code, press **Scan with the camera**. From v0.2.20 this opens the phone's camera app: take one photo of the code. Veilway reads it on the phone, then deletes the photo. Nothing is sent. The code goes on as a pasted link does. Without a camera you can still use a link, a file or a picture, including a screenshot of the code.

The app does not open a link from another app yet, so paste it.

To give a subscription to another device, press **Share** on its row. The app can show the link, show a QR code, or save a sealed file. It shares the link only, never this phone's keys. **Send** hands the link to another app.

## Connect

1. Tap **Connect**. The first time, Android shows its VPN permission dialog. Allow it. The VPN cannot start without it.
2. On Android 13 and later, the app asks for permission to show notifications. You can say no. The connection still runs, without its notification.
3. When the app asks whether to connect to a private address, answer yes only if the node is on your own network (it asks once per such connection).

If the connection drops, the app retries a few times with longer pauses, then says it gave up. You can connect again.

## The kill switch

While the app runs, it keeps the VPN interface up and blocks all traffic when the connection drops, through reconnects and after it gives up. The notification says **No connection. Internet blocked until the VPN is back**, then **Internet blocked until you reconnect**. Only **Disconnect** lifts it.

This covers only while the app is running. If the app is killed, crashes, or has not started yet, nothing blocks traffic. For a full kill switch, use Android's own setting:

1. Open **Settings**, then **Network**, then **VPN**.
2. Tap the gear next to **Veilway**.
3. Turn on **Always-on VPN**, then turn on **Block connections without VPN**.

The Veilway settings screen has a button that opens this page. Android keeps these two switches out of the app's reach on purpose.

With Always-on VPN on, Android starts Veilway at boot and after a crash, and blocks the internet while Veilway is not connected. Some phone makers stop apps from starting at boot. If the connection does not come back after a restart, exclude Veilway from battery optimization in the phone's settings.

## Updates

The app checks for a new version when it opens. Turn that off with **Check for updates when the app opens** in **Settings**, or press **Check for updates** any time. A new version shows a banner, **Version {version} is ready**. **Install and restart** downloads the APK from the project's releases, checks its signature and release tag, then hands it to Android's installer, which asks you to confirm.

The first time, Android may ask you to allow Veilway to install apps. The app opens that screen. Allow it, come back, and press the button again. The connection stops right before the install and comes back afterward if it was on. Android refuses an update signed with a different key than the installed app.

## What is not checked yet

- Used on a real phone (Android 14) with a demo node. Blocking while it reconnects, and the Always-on setup above, have not been tried on a phone.
- With **Let apps reach devices on this network** and Always-on VPN with **Block connections without VPN** both on, Android may also block local devices, so your printer and router may be unreachable. Not tried yet.

For the home network, see [Home network](../home-network/).
