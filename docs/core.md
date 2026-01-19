# HyperTools Core Architecture

The core is responsible for the tools metadata replication across user's devices.

It also provides a way to share device-specific configurations across all tools.
For example, a file-sharing app could use the core user and devices keys instead
of implementing its own ID system to track ownership of data.

Data that is relevent to only one tool is storedinside the tool's data scheet.

The Core Data Scheet key is deterministically generated from the user's mnemonic.
Tools Data Scheets keys are randomly generated and stored in the Core Data Sheet.


### Core Data Sheet
- User ID (keypair)
- Mnemonic
- Devices (name, public key)
- Tools Data Scheets (name, schema-scheet key)


### Commands
- init (generate new user ID)
- recover ["your mnemonic"] (recover user ID and Core Data Sheet from mnemonic)
- devices
    - list
    - remove [name]
- tools
    - list
    - get
    - remove
