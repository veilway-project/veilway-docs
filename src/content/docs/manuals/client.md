---
title: Client manual
description: Installing and using the Veilway desktop app.
---

:::caution[Alpha status]
The desktop app is part of the [alpha](../../alpha/). On Linux, a 70-point check in Docker runs the app's connection against a real node. On Windows, unit tests and a smoke test on a real runner pass, but the app has never connected to a node. On macOS, unit tests pass on a runner, but the app has never run on a real Mac. Expect bugs in routes, the firewall and DNS on both. The Android app has its own [manual](../android/).
:::

The Veilway desktop app (Linux, Windows, macOS) connects this computer to a Veilway node, using a subscription from your provider.

## Install

### Linux

Linux builds are a `.deb` (Debian, Ubuntu) and an `.rpm` (Fedora and other RPM systems). Install with your package manager, for example `sudo apt install ./<file>.deb`.

The app asks for administrator rights through polkit (the `pkexec` program), and the kill switch uses `nft` from nftables. Install either first if it is missing.

### Windows

The Windows installer is per machine: it needs an administrator and installs for every user. It puts `wintun.dll` next to the program, which the tunnel uses to create its network adapter.

### macOS

The alpha has no macOS desktop app yet. It comes after it has run on a real Mac. Until then, use the command-line client from the release page (`veilway connect`, run as root).

## Administrator rights

Connecting changes routes, DNS settings, the network adapter and the kill switch, which need an administrator. So the app starts a helper with administrator rights. The window runs without them.

- Linux: the polkit prompt asks for your password.
- macOS: the administrator password prompt.
- Windows: the User Account Control prompt.

The app asks once per session. The helper holds the keys and tokens. The window never does.

### When the window closes

Closing the window hides Veilway in the system tray, and the tunnel stays up. Click the tray icon to reopen it. The tray menu has two items:

- **Open Veilway** shows the window.
- **Quit** disconnects first: the tunnel comes down, routes and DNS are restored, the kill switch is lifted. Then the app and the helper close.

If the app is killed instead, the helper and tunnel keep running. The helper exits on its own only when no window has connected for two minutes and no tunnel is running.

## Add a subscription

Your provider gives you a subscription as a link, file, or QR picture. It holds one or more connections and the provider's messages about them. To add one:

- Paste the link into **Subscription link** and press **Continue**.
- Press **Open a file** and choose the file. A password-locked file (sealed, ending in `.vwsealed`) asks for the password first. The password only protects the file on its way to you.
- Press **Open a QR picture** and choose a PNG, JPEG, GIF, BMP or WebP picture, or paste a copied one with Ctrl+V.
- Press **Scan with the camera** (from v0.2.18) and hold the QR code up. A window shows the camera and closes by itself when it reads a code. The code goes on as a pasted link does. The camera is on only while that window is open, the picture is read on this computer, and nothing is saved or sent. Windows and macOS ask for permission the first time. If it is blocked, allow the camera for Veilway in the system settings. Linux has no such button because the app cannot turn the camera on there; use a picture of the code.

Nothing is added or sent until you agree. **Cancel** stops at any step.

### Step 1: where the connections come from

The app asks one of two questions:

- **"Contact {host}?"** The connections are fetched from that server, which sees this computer's address. Nothing has been sent yet. The button says **Contact {host}**.
- **"Read this subscription?"** The connections are inside the link or file, so nothing is fetched. The button says **Read it**.

If the link names the server's certificate, the screen says so and a stand-in server is refused. If the link does not use TLS, the screen warns you: the request stays sealed, but the network can tell that you use this app, now and later in its records.

### Step 2: keep it or not

The screen asks **"Keep this subscription from {provider}?"** The provider's name is what it says about itself. Check the **provider key** (a short code that identifies the subscription) against the key your provider gave you. If they do not match, press **Don't keep**.

The screen also lists the connections and their exits, and may show these notes:

- This replaces the subscription you already have from this provider.
- The update address has changed. Keep it only if your provider told you about this change.
- Your provider is moving this subscription to a new address. Keep it only if your provider told you about this move.
- Some connections were left out, because this app cannot use them.

Press **Keep subscription** to save it. The app confirms with a short message.

## Connect

The **Connection** screen has one large switch to connect and disconnect. With more than one connection, a **Connection** list lets you pick one while disconnected. The app remembers your pick.

The heading shows the state:

| Heading | What it means |
|---|---|
| Not connected | No tunnel is running. |
| Connecting | Opening a session with the server. |
| Connected | The session is open. The line below names your exit. |
| Reconnecting | The session was lost. Opening another. |
| Stopped | The server ended the tunnel on purpose. No retry, unless the screen shows a time for the next try. |
| Could not connect | The app cannot go on alone. Read the message below and act on it. |

Under the heading, the app may show a reason:

| Reason | What it means | What to do |
|---|---|---|
| The server's certificate does not match | Not the certificate this connection expects. The network may be interfering. | Try another network, or refresh the subscription. |
| This computer's date and time are outside the certificate's period | This computer's clock is wrong for the certificate. | Check the date and time. |
| The server answered but did not accept the connection | The server refused it. | Check the clock and your data allowance, or try again later. |
| This computer's clock is wrong | Connections need a correct clock. | Check the date and time. |
| The server cannot be reached on this network | The app is trying another way. | Wait. |
| The server did not answer | The server may be down, or the network may be blocking it. | Try again later. |
| This computer has no working network connection | The computer is offline. | Check the network. |
| Many addresses were tried in the last hour | The app is waiting before it tries more. | Wait. |
| The connection to the server was lost | The app is reconnecting. | Wait. |
| Nothing in this connection can be used as it stands | Every way in is unusable right now. | Refresh the subscription, or choose another connection. |
| This network cannot carry this way of connecting | The app is trying another way. | Wait. |
| Your data allowance is used up | It comes back when the next period starts. | Wait, or ask your provider. |
| Your account has expired | The provider's account is over. | Contact your provider. |
| Your provider switched the account off or removed it | The provider has ended the account. | Contact your provider. |
| The server is stopping | The server is shutting down. | Wait. The app reconnects shortly. |
| The server's details could not be verified | Exits, usage and notices are hidden. The connection stays up. | Nothing, unless the message stays. |
| The server's details are not available right now | Exits, usage and notices are hidden. The connection stays up. | Nothing, unless the message stays. |
| This app is too old for this connection | The app needs an update. | Update the app. |
| The server is too old for this connection | The server runs an older version. | Contact your provider. |
| This connection's settings are out of date | The provider changed the settings. | Refresh the subscription. |
| This computer's clock and the server's are drifting apart | The two clocks disagree. | Check the date and time. |

Where the screen says **Trying again at {time}**, the app tries then. Where it says it will not try again by itself, press **Disconnect**, then connect when ready.

### Connection details

While trying a server and while connected, the **Connection** screen has an openable **Connection details** section. It shows the **Server**, **Host name**, **Transport**, **Front** and **TLS server name** of the connection in use. It shows how its **Certificate** is checked (**Public certificate**, **Public certificate and pin**, or **Pinned self-signed**), the **Tunnel MTU**, and how long the session has been up. Rows that do not apply are left out. **Copy details** copies them as English text for your provider.

## Questions the app asks

Some connections need your answer before the first connect. It applies to that connection. **Don't connect** cancels.

| Question | What it means |
|---|---|
| Connect to a private address? | The connection goes to an address that is not on the internet, such as a device on your current network. That is normal for a server on your own network. The app asks once per connection and does not connect without your yes. Your yes covers only a private address. An address that looks like the internet is never dialled because your network says it is local. |
| Connect without checking the server? | The connection does not check who it talks to, so anyone on the network can read and change what you send. The button is red. |
| This subscription expired over 30 days ago | Its addresses and keys may no longer belong to your provider. Refresh it first if you can. The button is red. |
| Use the connection that looks like ordinary web traffic? | The provider set this way up to blend in with normal browsing. |
| Allow a way that does not look like web traffic? | May be the only way through on some networks. A watcher can tell something unusual is going on, but not what. |
| Allow a connection the network can see? | The provider offers `ws-plain`, a WebSocket over plain HTTP with no TLS. May be the only way through on some networks. The network can see this server's name, and can tell that you use this app, and when and how much, now and later in its records. It cannot see what you send. If this transport's key ever leaks, it ties all of your device's plain connections together. The app asks again when the provider's plain host name changes. |
| Allow a plain VPN tunnel? | May be the only way through on some networks. Easy to recognize: a watcher can tell that you use a VPN. |
| The connection needs your answer | Any other question. The app shows the engine's own words; the button says **Yes, continue**. |

If the app says **The answer did not reach the connection**, press connect again.

## Exits

If your provider lists exits, the **Exit** row on the **Connection** screen opens **Choose an exit**. Your traffic leaves the provider's network at the exit you pick. From v0.2.20 you can pick it while disconnected too: the choice is kept for that subscription and used when you connect.

- **Automatic** uses your provider's exit for you, or one of the exits your provider set up to switch to while yours is down. The **Exit** row shows which, such as **Automatic: Amsterdam**.
- Each exit shows its country and, when reported, its load: **Not busy**, **Busy** or **Very busy** (coarse, changes at most once a minute). An exit that does not answer shows **Not answering right now**.

If the app cannot change the exit, it says **The exit could not be changed**.

## Usage

The **Usage** screen shows:

- While connected: the session total, what you received and sent, and a graph of the speed over the last minute.
- The data allowance, as a bar labeled **Today**, **This week**, **This month**, or **Data allowance** when the provider sets no period. Under it, **Plan ends** gives the date.

When not connected, the screen says **Connect to see live speed and how much data this session used**. While connected, the **Connection** screen also shows download and upload speed and the allowance bar. The allowance and plan date come from your provider's server.

## The provider card

Below the connection, the app can show a card with what the provider posts: notices, numbers such as a stat or a progress bar, links, and support links. The card says **Your provider wrote this, not the app.** The app shows it as received, unchecked and unchanged.

- Notices from the provider also appear as banners titled **From {provider}**.
- A link asks first: **Open {domain}?** Then it opens that site in your browser.
- **Hide provider cards** hides the card. **Show what {provider} posts** brings it back.

## Kill switch

The kill switch is on by default. If the connection drops, it blocks all traffic, so nothing leaves outside the tunnel. A change takes effect the next time you connect. With it off, traffic can leave outside the tunnel when the connection drops.

If a connection ends on its own while it is on, the **Connection** screen says **The connection ended**, then **The kill switch still blocks all traffic. Disconnect to lift it.** with a **Disconnect** button. The internet may look down because traffic outside the tunnel is blocked. Press **Disconnect** to lift the block. Closing the app does not lift it. **Quit** does, because it disconnects first.

## Start at login

**Start Veilway when I sign in** starts the app at sign-in. Turn it off to start it only yourself.

## Language and theme

In **Settings**, pick **English** or **فارسی**. Persian switches the whole app to Persian, with the layout from right to left.

Under **Theme**, pick **System**, **Dark** or **Light**. System follows your computer's setting.

## Updates

**Check for updates when the app opens** is on by default. Press **Check for updates** any time. The screen then shows **This is the newest version**, or **Version {version} is ready** with an **Install and restart** button.

Updates come from the project's GitHub releases and are checked against the project's signing key before installing. On Windows the update installs without questions. On Linux the app does not update itself: install the newer `.deb` or `.rpm` from the release page.

## Log

Press **Show the log** in **Settings**. The log leaves out paths, file names, keys and secrets. Press **Copy the log** when you report a problem. If it is empty, connect once.

## Subscriptions

The **Subscriptions** screen lists each subscription with its provider, logo, standing, end date and number of connections. The standing is one of **Up to date**, **Needs a refresh** or **Out of date**.

- **Refresh** (the icon on the row) gets the provider's current settings. Shown only when the provider allows it.
- **Share** gives the subscription to another device. Shown on a subscription added with a link. See [Share a subscription](#share-a-subscription).
- **Backup update addresses** appear when your provider has added addresses for refreshing while the main address is blocked. See [Backup update addresses](#backup-update-addresses).
- **Remove** deletes the subscription, its connections and its keys from this computer. First it tells your provider this device left, freeing its place on your account (a few seconds at most). It is removed even when the provider cannot be reached. To use it again you need the link from your provider. You cannot remove a subscription in use, so disconnect first. `veilway remove` does the same on the command line: it tells the provider first, then removes, also when the provider cannot be reached. With one subscription it needs no argument. With several, name one with `--subscription` (the start of its id, which the error message lists). `--data-dir` sets where the client keeps its data, as for `connect`. It refuses while a connection runs.
- **Let apps reach devices on this network** (a checkbox on the row) is off by default. Off, everything goes through the tunnel, local network included, so a printer or router is not reachable while connected. On, apps can reach devices on the networks you are connected to (a printer, your router) outside the VPN. Only the private subnets you are on go outside, not whole private ranges, and the list is re-read when you change networks. The network can see that traffic. Names are still only looked up through the tunnel. On Android nothing goes outside the VPN on mobile data. The choice is kept per subscription and applies from the next connect. Everything else still goes through the tunnel and stays blocked when the connection drops.

### Share a subscription

**Share** opens a dialog with three ways to hand the subscription on:

- **Text** shows the subscription link, with a **Copy** button.
- **QR code** shows the link as a QR code.
- **Sealed file** saves the link as a file named `veilway-subscription.vwsealed`, locked with a password you choose (at least 10 characters, typed twice). Send the password by a different way than the file, for example by voice. Anyone with the file who guesses the password can use the link, so a long password is the only protection.

Only the link is shared, never this device's keys. The other device joins as a new device and counts against your device limit. A subscription added from a file has no link, so no **Share**.

### Backup update addresses

A provider can list more addresses that serve its subscription, such as mirrors, and sometimes a new main address. The app never uses one until you allow it. When some are added, the row says **Your provider added backup update addresses** with a **Review** button. The dialog lists each address with what it can see:

- **Update server** sees your subscription link's token, as the main server does.
- **New main address** is where your provider is moving the subscription. Once you allow it, it is tried first.
- **Static mirror** never sees your token.
- An address with no TLS carries a warning: the network can tell that you use this app.

Every address sees your device's address. Tick the ones you allow and press **Save choices**, or press **Allow all**. **Not now** leaves it for later. Afterward the row shows how many are allowed, and **Manage** changes your choice.

## Known limits

- On Windows the app has never connected to a node, and on macOS it has never run on a real Mac.
- On Linux, a real desktop with systemd-resolved and a reboot have not been tested.
- On Android, with Always-on VPN and Block connections without VPN, the system may block the local network even when the box is on. Not tried on a real phone.
- On Android, when the connection drops, the app keeps the VPN interface up and drops your traffic until you tap Disconnect, and the notification says the internet is blocked. If the system kills the app, only Always-on VPN with Block connections without VPN keeps traffic from leaving.
- The Android app has its own [manual](../android/).
