---
title: Android app
description: Installing the Veilway Android app from the alpha release, connecting, and the kill switch.
---

The Android app is part of the [alpha](../../alpha/). It is an arm64 build, so it runs on a 64-bit ARM phone. It shows the same screens as the [desktop app](../client/), and its connection runs inside the app with a system VPN.

## Install the APK

1. Open the [alpha release page](https://github.com/veilway-project/veilway/releases) on the phone and download the arm64 APK. Its name ends in `-arm64.apk`.
2. Open the file. Android asks you to allow installs from this source the first time. Allow it for your browser or file manager only, then go back and continue.

## Add a subscription

Your operator gives you a subscription link, or a subscription file. Open the app and go to the import screen. Paste the link, or choose the file, and follow the app's steps to add it.

Camera scanning of a QR code is not in the Android app yet. Neither is opening a link from another app. Paste the link instead.

## Connect

1. Tap **Connect**. Android shows its VPN permission dialog the first time. Allow it, because the VPN cannot start without it.
2. On Android 13 and later, the app asks for permission to show notifications. You can say no. The connection still runs, and only its notification is hidden.
3. When the app asks whether to connect to a private address, answer yes only if the node is on your own network. The app asks once for each such connection.

If the connection drops, the app tries again a few times with longer pauses. When it gives up, it says so, and you can connect again.

## The kill switch

While the app runs, it keeps the VPN interface up and blocks all traffic when the connection drops. The block stays while the app reconnects and after it gives up. The notification says **No connection. Internet blocked until the VPN is back**, and then **Internet blocked until you reconnect**. Only **Disconnect** lifts it.

That covers only the time the app is running. If the app is killed, crashes, or has not started yet, nothing blocks traffic. For a full kill switch, use Android's own setting:

1. Open **Settings**, then **Network**, then **VPN**.
2. Tap the gear next to **Veilway**.
3. Turn on **Always-on VPN**, then turn on **Block connections without VPN**.

The Veilway settings screen has a button that opens this page for you. Android keeps these two switches out of the app's reach on purpose, so only you can change them.

With Always-on VPN on, Android starts Veilway at boot and after a crash, and blocks the internet while Veilway is not connected. Some phone makers stop apps from starting at boot. If the connection does not come back after a restart, exclude Veilway from battery optimization in the phone's settings.

## What is not checked yet

- The Android app has not been run on a real phone yet. Blocking while it reconnects, and the Always-on setup above, are not tested on a phone.
- With **Let apps reach devices on this network** on, and Always-on VPN with **Block connections without VPN** on, Android may also block local devices. Your printer and router may be unreachable while connected. This is not tried yet.

For the home network, see [Home network](../home-network/).
