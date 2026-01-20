# HyperTools

**A framework for building P2P-synced tools without the complexity.**

HyperTools handles identity, encryption, replication, and networking so you can 
focus on building useful applications. Your tools automatically sync across all 
your devices with zero configuration (but can be configured with a system like 
git's .gitignore to avoid some data on some specific devices).

## What is it?

- **For users**: A runtime that keeps your tools' data synced across devices
- **For developers**: A framework that makes P2P networking trivial
- **Under the hood**: Cryptographic ID system + distributed databases + P2P networking

The tools don't have to be P2P focused, they can simply enjoy sharing a P2P database bewteen many devices (e.g password manager).


## Why
Making [holepunch libs](https://github.com/holepunchto) work as more tedious than expected so I wanted an even easier way to make my P2P programs.
Instead of making a wrapper around the P2P libs I needed, I decided to make a single P2P program with an API that my scripts can uses.


## How
- NodeJS its cross-plateform and holepunch's libs are in javascript
- A main database, that sync automatically across user devices (contains the user keys, devices keys, and tools databases keys)
- Tools databases (each tool can have its own database)
- 

### Use Case 1 - Personal Devices Only :
You can simply sync the data on multiple devices registered under the same user by making sure
the device with the latest files and the device you want to sync are both online.


### Use Case 2 - With Personal Server Setup :
You can bypass the need to have two devices online at the same time for them to share updates
by setting up an instance of hypertools on your homeserver or your cloud VM, just like you would
self-host any service so your latest updates are always available.


### Use Case 3 - With Sync-Groups :
By joining a sync-group, all users hosts every user update (which is not a privacy risk since such
data can only be decrypted by it's owner). If enough people are in the group, this can easily bypass
the need for a server setup while gaining the same advantages. A server can also be assigned to a
sync-group so a single server can assure 24/7 data availability to a group of many users.


## Implemented features
- Generate User ID from mnemonic (recoverable user ID if main device lost/broken/unavailable)
- Store localy a password-encrypted copy of the mnemonic (safer than storing it in plain text and more convenient than not storing it)
- main schema-sheet database (store user ID, device IDs, databases keys...)

## Roadmap



## Archtecture

see docs/core and docs/tools for hypertools and tools architecture details

### We're mostly using :
- [https://github.com/ryanramage/schema-sheets](schema-sheets) as a simple way to
replicate data in P2P on top of a multi-writer and conflict-free data-structure
- [https://github.com/holepunchto/keet-identity-key](keet-identity-key) to generate user ID and recover
ID from a mnemonic passphrase
- other holepunch building blocks when needed, such as hyperswarm, hyperbee, etc.
- [https://www.npmjs.com/package/enquirer](enquirer)
- commander

### Core Concept :

Hypertools Service (System-Service install Optional) :
- runs and continuously updates the sepcified databases
- simple message server to interract with online friends and remote devices (send clipboard, quick 
hyperswarm/hyperssh/hyperbeam connection by sending the command with the topic, etc)

Hypertools CLI (If Hypertools service is not running already, run it while the CLI runs) :
CLI Main menu:
- User (change passwd/pseudo)
- Devices (add/rename/delete)
- Tools (download/delete/configure)
- Contacts (add/modify/delete)
- Hypertools Background Service (install/uninstall)

Tools:
- tool.conf file with tool info and permissions asked to hypertools (file read/write, used programs, npm dependencies...)
- index.js
- schema.js (schemes can be put in index.js but this is more readable)


MIT - This software is free and open-source <3
