---
title: Add a second server
description: Install a second Veilway node, connect it to your panel as a managed node, and let users connect through it.
---

One panel can run more than one server. The panel's own server is **This server**. Every other server is a **remote node**. A [node link](../../protocol/node-links/) joins it to this server, and the panel manages it through that link. Users get a set of profiles for each server they may use.

## Before you start

- A panel and its node, installed with [Getting started](../../getting-started/).
- A second server with its own public address.
- Both operators on a channel you trust. The pairing ends with a fingerprint check read aloud.

## Choose the direction

One server dials, and the other listens. The listening side must be reachable from the dialing side.

- **The new server dials this panel.** Use this when the new server can reach this panel's server. It is the usual choice, and the new server needs nothing extra.
- **This panel dials the new server.** Use this when only the new server can be reached. The new server needs a Veilway inbound first. Add one by hand, as the [node links](../../protocol/node-links/) page describes.

## Step by step

1. On the new server, run `sudo bash veilway.sh install node`. This installs the node only. At the end it prints the command for step 3.
2. On this panel, open **Servers**, choose **Add a server**, and give the server a name and a position. Choose **The new server dials this panel**. The panel shows an offer code. Copy it.
3. On the new server, run the printed command. It is `veilway link answer`, and it asks for the offer. Paste the code. It shows where the node will dial, then asks you to type `yes`. It then says that this panel will be able to read and change the node, and asks you to type `yes` again. Type it only if you agree.
4. The command prints an answer code. On the panel, choose **Paste the answer** and paste it.
5. Both operators read their eight fingerprint groups aloud and type the other side's groups. Confirm only when they match.
6. The new server shows as **Up** on **Servers** once the link works. Users reach it only after this confirmation.

To have the panel dial the new server instead:

1. On the new server, run `veilway link offer --managed` with the inbound, addresses and transports from the [node links](../../protocol/node-links/) page, and `--apply=/run/veilway/control.sock`. The command asks for a `yes` first, then prints the offer code.
2. On this panel, open **Servers**, choose **Add a server**, and choose **This panel dials the new server**. Choose **Paste an offer** and paste the code. The panel shows where it will dial and gives back an answer code.
3. On the new server, choose **Paste the answer** and paste the code, then do the fingerprint check as in step 5.

## A server with no domain

Since v0.3.6 a server with no domain can be linked too, with its own self-signed certificate.

- The side that listens needs a `tls` transport with `"self_signed": true`. The node makes the certificate itself and works out its pin.
- The offer carries that pin, and the other side trusts the certificate through the pin alone. No certificate authority is asked, so the fingerprint check in step 5 is the whole check. Compare every group.
- The pin stays the same when the certificate renews. If the key file is lost, the node makes a new key and the link shows **Key changed**. Pair it again.
- A `ws` transport cannot be trusted this way, only `tls`.

See [Pins and self-signed links](../../protocol/node-links/#pins-and-self-signed-links).

## Give users the new server

- Set the server's **Address pool** when you add it. You can change it only while no device has an address in it.
- On each user, **Servers this user may use** is **Every server**, or **Only these servers** with the servers you tick. A user gets only the servers you pick.
- Each device gets an address in every pool of the nodes its user may use. Confirming a device takes an address in each of them. If a pool is full, the panel leaves that node out of the device's profiles and shows a warning.

## What users see

- A subscription holds one set of profiles for each server the user may use, in node order.
- This server's profile ids do not change. The new node's ids start with its slug, and each name starts with the node's name when the user has more than one node.
- A node's profiles appear once that node has the user's device, and stay while it is down.
- A subscription holds at most 64 profiles. The panel refuses a change that would pass that, and names the nodes and inbounds that add up.

## Quotas across servers

- The panel adds up the user's usage on every node that counts it. Turn off **Count this server's usage** on a server to leave its traffic out of the total.
- Every node also gets the user's full quota. A node the panel cannot reach still enforces the limit alone.
- When the total reaches the quota, the panel cuts the user on every node. Apps show "quota reached". Each node starts its own count again at the next period, and the panel sets the full quota again.
- A user can go a little over the quota: about a minute on nodes that are up, and up to a full quota on a node the panel cannot reach.
- A usage reset in the panel reaches each node at its next sync.
- On the user's page, usage is shown for each node.

## When a node is down

- A node that cannot be reached keeps serving its last users, limits and expiry. The panel shows the node as out of date since that moment, and does the same on each user it affects.
- Users, devices, quotas and resets do not wait for it.
- Changes to the node itself, such as inbounds, routing, DNS, links and upstreams, wait until it is online.

## Remove a server

- **Remove server**: the panel asks the node, through the link, to remove its users and the link. Then the panel removes the link from this server. The panel asks for your password and code again.
- **The server is gone**: if the server was seized or is gone, choose that option in the remove dialog. The panel then removes the link without asking the node. Nothing the node sends is served from then on, and nothing is sent to it. The panel can no longer change that node, so stop it or remove its users on the server itself.
- Either operator can remove the link from their own config at any time. Management ends at once. On the remote server: `sudo veilway link remove --config /etc/veilway/node/config.json --tag panel --apply=/run/veilway/control.sock` (use the link's tag on that server). Add `--empty` to remove its users too. Without it they stay and keep working, and the panel can no longer change them.

## Who can do what

- The panel and this server control every node. Protect them as you protect the panel.
- A node's operator can read and change that node, drop the link and report false usage within a limit. The operator cannot reach the panel or any other node.
- Each node has its own user names and secrets for each user, so a node's secrets do not work on another node.
- Management is not a shell. It works through the node's config API, on a fixed list of routes.
