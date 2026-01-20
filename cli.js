import Enquirer from 'enquirer'
import { IdentityManager } from './src/identity.js'
import { Database } from './src/database.js'
import { promptPassword, newPassword, decrypt, encrypt } from './lib/crypto.js'
import { homedir } from 'os'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import c from 'ansi-colors'
import readline from 'readline'

const enquirer = new Enquirer()

async function main() {
  const identityManager = new IdentityManager()
  const db = new Database()
  
  const appDir = join(homedir(), '.hypertools')
  const identityPath = join(appDir, 'identity.enc')

  let user
  let isNewIdentity = false
  let password

  console.log(c.bold('\n╔═════════════════════════╗'))
  console.log(c.bold('║     HYPERTOOLS  CLI     ║'))
  console.log(c.bold('╚═════════════════════════╝\n'))

  if (!existsSync(appDir)) {
    mkdirSync(appDir, { recursive: true })
  }

  if (!existsSync(identityPath)) {
    console.log(c.yellow('No identity found. Creating new identity...\n'))
    
    password = await newPassword()

    // New User ID
    isNewIdentity = true
    const user = await identityManager.initUser()

    // Encrypt ID and save to drive
    const encryptedData = encrypt(user.mnemonic, password)
    writeFileSync(identityPath, JSON.stringify(encryptedData, null, 2))

    console.log(c.green('\nIdentity created and encrypted'))
    console.log(c.yellow('\nIMPORTANT: Your mnemonic phrase (backup):'))
    console.log(c.gray('━'.repeat(70)))
    console.log(c.white.bold(user.mnemonic))
    console.log(c.gray('━'.repeat(70)))
    console.log(c.yellow('Write this down and store it securely offline.\n'))
  } else {
    console.log(c.bold('Existing identity found.'))
    
    let decrypted = null
    while (!decrypted) {
      password = await promptPassword('Enter password to unlock: ')
      const encryptedData = JSON.parse(readFileSync(identityPath, 'utf8'))
      decrypted = decrypt(encryptedData, password)

      if (!decrypted) {
        console.log('Incorrect password. Please try again.')
      }
    }
    console.log('Identity unlocked')
    user = await identityManager.initUser(decrypted)
  }


  // Main menu loop
  while (true) {
    const { action } = await enquirer.prompt({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'identity', message: 'Identity Management' },
        { name: 'devices', message: 'Device Management' },
        { name: 'tools', message: 'Tool Management' },
        { name: 'exit', message: 'Exit' }
      ]
    })

    if (action === 'exit') {
      console.log(c.cyan('\nGoodbye!\n'))
      break
    }

    // Handle each action
    switch (action) {
      case 'identity':
        await handleIdentity()
        break
      case 'devices':
        await handleDevices()
        break
      case 'tools':
        await handleTools()
        break
    }
  }
}

async function handleIdentity() {
  console.log(c.blue('\n--- Identity Management ---\n'))
  // TODO: Show identity info, export, etc.
  console.log(c.gray('Coming soon...\n'))
}

async function handleDevices() {
  console.log(c.blue('\n--- Device Management ---\n'))
  // TODO: List devices, add/remove devices, etc.
  console.log(c.gray('Coming soon...\n'))
}

async function handleTools() {
  console.log(c.blue('\n--- Tool Management ---\n'))
  // TODO: Install, update, remove tools
  console.log(c.gray('Coming soon...\n'))
}

main().catch(err => {
  console.error(c.red('\nError:'), err.message)
  process.exit(1)
})
