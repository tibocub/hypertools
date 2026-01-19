# HyperTools

A suite of cli tools and a javascript cli/tui program framework
Program created with hypertools can:
- Easily and securely connect to another of your devices with hypertools installed (easy file and data transfers between devices)
- Store and sync data automatically across user devices (the data is always up-to-date like in webapps but it's free and your data stays yours)

The app automatically catch up to the latest available database updates when another device is online.


### Use Case 1 - Personal Devices Only :

You can simply sync the data on multiple devices registered under the same user by making sure
the device with the latest updates and the device you want to sync are both online.


### Use Case 2 - With Personal Server Setup :

You can bypass the need to have two devices online at the same time for them to share updates
by setting up an instance of hypertools on your homeserver or your cloud VM, just like you would
self-host any service so your latest updates are always available.


### Use Case 3 - With Sync-Groups :

By joining a sync-group, all users hosts every user update (which is not a privacy risk since such
data can only be decrypted by it's owner). If enough people are in the group, this can easily bypass
the need for a server setup while gaining the same advantages. A server can also be assigned to a
sync-group so a single server can assure 24/7 data availability to a group of many users.


# Implemented features
- User/devices IDs generation
- Store localy password-encrypted mnemonic
- main schema-sheet database (store user ID, device IDs, databases keys...)


## Archtecture

see docs/core and docs/tools for hypertools and tools architecture details

We're mostly using :
- [https://github.com/ryanramage/schema-sheets](schema-sheets) as a simple way to
replicate data in P2P on top of a multi-writer and conflict-free data-structure
- [https://github.com/holepunchto/keet-identity-key](keet-identity-key) to generate user ID and recover
ID from a mnemonic passphrase

And other holepunch building blocks when needed, such as hyperswarm, hyperbee, etc.
