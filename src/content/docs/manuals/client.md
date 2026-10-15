---
title: Client manual
description: Installing and using the Veilway desktop app.
---

:::caution[Not released]
The desktop app is built, but no release is published, so there is no installer to download yet. It has not run on a real machine. The Linux layer is tested in Docker. The Windows and macOS layers build and pass their unit tests on CI runners, but they have never connected on a real Windows PC or Mac. Steps may change before the first release. The Android app is still being built and is not covered here.
:::

This manual covers the Veilway desktop app for Linux, Windows and macOS. The app connects this computer to a Veilway node, using a subscription from your provider.

## Install

### Linux

The Linux builds are a `.deb` package for Debian and Ubuntu, and an `.rpm` package for Fedora and other RPM systems. Install it with your package manager, for example `sudo apt install ./<file>.deb`.

The app asks for administrator rights through polkit, so polkit must be present (the `pkexec` program). The kill switch uses `nft`, from nftables. If either is missing, install it first.

### Windows

The Windows installer is per machine. It installs the app for every user of the computer, and it needs an administrator to run. The installer puts `wintun.dll` next to the program. The tunnel uses it to create its network adapter.

### macOS

The macOS build is an app in a `.dmg` disk image. Open the image and move Veilway to the Applications folder.

## Administrator rights

Connecting changes things that only an administrator can change: routes, DNS settings, the network adapter and the kill switch. So the app starts a helper with administrator rights. The window itself runs without them.

- Linux: the polkit prompt asks for your password.
- macOS: the administrator password prompt.
- Windows: the User Account Control prompt.

The app asks once per session, not on every connection. The helper holds the keys and tokens. The window never does.

### When the window closes

Closing the window hides Veilway in the system tray. The tunnel stays up. Click the tray icon to open the window again.

The tray menu has two items:

- **Open Veilway** shows the window.
- **Quit** disconnects first, so the tunnel comes down, the routes and DNS are restored, and the kill switch is lifted. Then the app and the helper close.

If the app is killed instead, the helper and the tunnel keep running. The helper exits on its own only when no window has connected for two minutes and no tunnel is running.

## Add a subscription

Your provider gives you a subscription in one of three ways: a link, a file, or a QR picture. A subscription holds one or more connections, and the provider's own messages about them.

To add one, use one of these:

- Paste the link into **Subscription link** and press **Continue**.
- Press **Open a file** and choose the file from your provider.
- Press **Open a QR picture** and choose the picture (PNG, JPEG, GIF, BMP or WebP). You can also copy the picture and paste it with Ctrl+V.

Nothing is sent anywhere until you agree. **Cancel** stops at any step and adds nothing.

### Step 1: where the connections come from

The app asks one of two questions:

- **"Contact {host}?"** The connections are fetched from that server. The server sees this computer's address. Nothing has been sent yet. The button says **Contact {host}**.
- **"Read this subscription?"** The connections are inside the link or the file, so nothing is fetched from anywhere. The button says **Read it**.

If the link names the server's certificate, the screen says so. A stand-in server is then refused.

### Step 2: keep it or not

The screen asks **"Keep this subscription from {provider}?"** The provider's name is what the provider says about itself. Check the **provider key** on the screen against the key your provider gave you. The key is a short code that identifies the subscription. If they do not match, press **Don't keep**.

The screen also lists the connections and their exits. It may show one of these notes:

- This replaces the subscription you already have from this provider.
- The update address has changed. Keep it only if your provider told you about this change.
- Some connections were left out, because this app cannot use them.

Press **Keep subscription** to save it. The app confirms with a short message.

## Connect

The **Connection** screen has one large switch. Press it to connect, and press it again to disconnect. If you have more than one connection and you are not connected, a **Connection** list lets you pick one. The app remembers your pick.

The heading shows the state:

| Heading | What it means |
|---|---|
| Not connected | No tunnel is running. |
| Connecting | The app is opening a session with the server. |
| Connected | The session is open. The line under the heading names the exit you go through. |
| Reconnecting | The session was lost, and the app is opening another one. |
| Stopped | The server ended the tunnel on purpose. The app does not try again by itself, unless the screen shows a time for the next try. |
| Could not connect | The app cannot go on alone. Read the message below the heading and act on it. |

Under the heading, the app may show a reason. This table explains each one.

| Reason | What it means | What to do |
|---|---|---|
| The server's certificate does not match | The certificate is not the one this connection expects. The network may be interfering. | Try another network, or refresh the subscription. |
| This computer's date and time are outside the certificate's period | The clock on this computer is wrong for the server's certificate. | Check the date and time. |
| The server answered but did not accept the connection | The server refused the connection. | Check the clock and your data allowance, or try again later. |
| This computer's clock is wrong | Connections need a correct clock. | Check the date and time. |
| The server cannot be reached on this network | The app is trying another way. | Wait. |
| The server did not answer | The server may be down, or the network may be blocking it. | Try again later. |
| This computer has no working network connection | The computer is offline. | Check the network. |
| Many addresses were tried in the last hour | The app is waiting before it tries more. | Wait. |
| The connection to the server was lost | The app is reconnecting. | Wait. |
| Nothing in this connection can be used as it stands | Every way in the connection is unusable right now. | Refresh the subscription, or choose another connection. |
| This network cannot carry this way of connecting | The app is trying another way. | Wait. |
| Your data allowance is used up | The connection comes back when the next period starts. | Wait, or ask your provider. |
| Your account has expired | The provider's account is over. | Contact your provider. |
| Your provider switched the account off or removed it | The provider has ended the account. | Contact your provider. |
| The server is stopping | The server is shutting down. | Wait. The app reconnects shortly. |
| The server's details could not be verified | Exits, usage and notices are hidden. The connection stays up. | Nothing, unless the message stays. |
| The server's details are not available right now | Exits, usage and notices are hidden. The connection stays up. | Nothing, unless the message stays. |
| This app is too old for this connection | The app needs an update. | Update the app. |
| The server is too old for this connection | The server runs an older version. | Contact your provider. |
| This connection's settings are out of date | The provider changed the settings. | Refresh the subscription. |
| This computer's clock and the server's are drifting apart | The two clocks disagree. | Check the date and time. |

Where the screen says **Trying again at {time}**, the app tries again at that time. Where it says the app will not try again by itself, press **Disconnect**, then connect when you are ready.

## Questions the app asks

Some connections need your answer before the first connect. Your answer applies to that connection. **Don't connect** cancels.

| Question | What it means |
|---|---|
| Connect to a private address? | The connection goes to an address that is not on the internet, or to a device on the network you are on right now. That is normal for a server on your own network. The app asks once for each connection, and without your yes it does not connect to such an address. |
| Connect without checking the server? | The connection does not check who it is talking to. Anyone on the network can read and change what you send. The button is red. |
| This subscription expired over 30 days ago | The addresses and keys in it may no longer belong to your provider. Refresh it first if you can. The button is red. |
| Use the connection that looks like ordinary web traffic? | This is the way the provider set up to blend in with normal browsing. |
| Allow a way that does not look like web traffic? | On some networks this may be the only way through. Someone watching the network can tell that something unusual is going on, but not what. |
| Allow a way that is easy to recognize? | On some networks this may be the only way through. Someone watching the network can tell that you use a tunnel. No transport in this version uses this way, so you should not see this question yet. |
| Allow a plain VPN tunnel? | On some networks this may be the only way through. It is easy to recognize, and someone watching the network can tell that you use a VPN. |
| The connection needs your answer | Any other question. The app shows the engine's own words, and the button says **Yes, continue**. |

If the app says **The answer did not reach the connection**, press connect again.

## Exits

If your provider lists exits, the **Exit** row on the **Connection** screen opens **Choose an exit**. Your traffic leaves the provider's network at the exit you pick.

- **Automatic** lets the app use one that works.
- Each exit shows its country and its load: **Not busy**, **Busy**, **Very busy**, or **Load not known**. An exit that does not answer shows **Not answering right now**.

If the app cannot change the exit, it says **The exit could not be changed**.

## Usage

The **Usage** screen shows:

- While connected: the total for this session, what you received, what you sent, and a graph of the speed over the last minute.
- The data allowance, as a bar. Its label is **Today**, **This week**, **This month**, or **Data allowance** when the provider sets no period. Under the bar, **Plan ends** gives the date.

When you are not connected, the screen says **Connect to see live speed and how much data this session used**.

The **Connection** screen shows download and upload speed, and the same allowance bar, while connected. The allowance and the plan date come from your provider's server.

## The provider card

Below the connection, the app can show a card with what the provider posts: notices, numbers such as a stat or a progress bar, links, and support links. The card says **Your provider wrote this, not the app.** The app shows it as it was received, and does not check or change it.

- Notices from the provider also appear as banners titled **From {provider}**.
- A link asks first: **Open {domain}?** Then it opens that site in your browser.
- **Hide provider cards** hides the card. **Show what {provider} posts** brings it back.

## Kill switch

The kill switch is on by default. Its setting says: it blocks all traffic if the connection drops, so nothing leaves outside the tunnel. The change takes effect the next time you connect.

If a connection ends on its own while the kill switch is on, the **Connection** screen says **The connection ended**, and then **The kill switch still blocks all traffic. Disconnect to lift it.** A **Disconnect** button appears.

"Still blocking" means that traffic outside the tunnel is blocked, so the internet may look down. To lift the block, press **Disconnect**. Closing the app does not lift it. **Quit** does, because it disconnects first.

Turning the kill switch off means that when the connection drops, traffic can leave outside the tunnel.

## Start at login

**Start Veilway when I sign in** starts the app when you sign in to your computer. Turn it off to start the app only when you open it yourself.

## Language and theme

In **Settings**, pick **English** or **فارسی**. Persian switches the whole app to Persian, with the layout from right to left.

Under **Theme**, pick **System**, **Dark** or **Light**. System follows your computer's setting.

## Updates

**Check for updates when the app opens** is on by default. Press **Check for updates** at any time. The screen then shows **This is the newest version**, or **Version {version} is ready** with an **Install and restart** button.

Updates come from the project's GitHub releases. Each update is checked against the project's signing key before it is installed. On Windows the update installs without asking questions. No release is published yet, so the check finds nothing for now.

## Log

Press **Show the log** in **Settings**. The log lists what the app recorded. It leaves out paths, file names, keys and secrets. Press **Copy the log** when you report a problem. If the log is empty, connect once, and what happens will show up there.

## Subscriptions

The **Subscriptions** screen lists each subscription with its provider, its logo, its standing, its end date and its number of connections. The standing is one of **Up to date**, **Needs a refresh** or **Out of date**.

- **Refresh** (the icon on the row) gets the provider's current settings. It appears only when the provider allows it.
- **Remove** deletes the subscription, its connections and its keys from this computer. To use it again, you need the link from your provider. You cannot remove a subscription while it is in use, so disconnect first.
- **Send the local network through the VPN** (a checkbox on the row) is off by default. Off, the private and link-local ranges and local multicast stay outside the tunnel, so your printer, your router and the other devices at home stay reachable while you are connected. On, those ranges go through the tunnel like everything else, which is for a provider whose server can reach your home network. The choice is kept for each subscription and applies from the next connect. Everything else still goes through the tunnel and stays blocked when the connection drops. On Windows and macOS, a private range that is not directly on your network still goes through the tunnel when the box is off.

## Known limits

- The app has not run on a real machine yet, and no release is published.
- On Linux, a real desktop with systemd-resolved and a reboot have not been tested.
- On Android, with Always-on VPN and Block connections without VPN, the system may block the local network even when the box is off. The app has not been tried with that on a real phone.
- The Android app is not covered here.
