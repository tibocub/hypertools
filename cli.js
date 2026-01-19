import { Database } from './core/database.js'
import { IdentityManager } from './core/identity.js'
import { homedir } from 'os'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import crypto from 'crypto'
import readline from 'readline'

// Encryption utilities
function encryptMnemonic(mnemonic, password) {
  // Derive a key from the password using PBKDF2
  const salt = crypto.randomBytes(32)
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  
  // Encrypt the mnemonic using AES-256-GCM
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  let encrypted = cipher.update(mnemonic, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Return all components needed for decryption
  return {
    encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  }
}

function decryptMnemonic(encryptedData, password) {
  try {
    // Derive the same key from password and salt
    const salt = Buffer.from(encryptedData.salt, 'hex')
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
    
    // Decrypt the mnemonic
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const authTag = Buffer.from(encryptedData.authTag, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    // Decryption failed - likely wrong password
    return null
  }
}

// Prompt for password from command line
function promptPassword(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    
    // Hide password input
    const stdin = process.openStdin()
    process.stdin.on('data', char => {
      char = char.toString()
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.pause()
          break
        default:
          process.stdout.clearLine()
          process.stdout.cursorTo(0)
          process.stdout.write(prompt + '*'.repeat(rl.line.length))
          break
      }
    })
    
    rl.question(prompt, (answer) => {
      rl.close()
      console.log() // New line after password input
      resolve(answer)
    })
  })
}

async function main() {
  const identityManager = new IdentityManager()
  const db = new Database()
  
  // Get storage paths
  const appDir = join(homedir(), '.p2p-app')
  const storagePath = join(appDir, 'db')
  const identityPath = join(appDir, 'identity.enc') // .enc for encrypted
  
  // Create directory if it doesn't exist
  if (!existsSync(appDir)) {
    mkdirSync(appDir, { recursive: true })
  }
  
  let user
  let isNewIdentity = false
  let password
  
  // Check if identity exists
  if (existsSync(identityPath)) {
    console.log('Existing identity found.')
    
    // Prompt for password to decrypt
    let decrypted = null
    while (!decrypted) {
      password = await promptPassword('Enter password to unlock: ')
      
      const encryptedData = JSON.parse(readFileSync(identityPath, 'utf8'))
      decrypted = decryptMnemonic(encryptedData, password)
      
      if (!decrypted) {
        console.log('❌ Incorrect password. Please try again.')
      }
    }
    
    console.log('Identity unlocked')
    user = await identityManager.initUser(decrypted)
  } else {
    console.log('No existing identity found. Creating new identity...')
    
    // Prompt for new password
    let password1, password2
    do {
      password1 = await promptPassword('Create a password to protect your identity: ')
      password2 = await promptPassword('Confirm password: ')
      
      if (password1 !== password2) {
        console.log('Passwords do not match. Please try again.\n')
      }
    } while (password1 !== password2)
    
    password = password1
    
    // Create new identity
    user = await identityManager.initUser()
    isNewIdentity = true
    
    // Encrypt and save identity
    const encryptedData = encryptMnemonic(user.mnemonic, password)
    writeFileSync(identityPath, JSON.stringify(encryptedData, null, 2))
    
    console.log('\nIdentity created and encrypted')
    console.log('\nIMPORTANT: Your mnemonic phrase (keep this safe as a backup):')
    console.log('━'.repeat(80))
    console.log(user.mnemonic)
    console.log('━'.repeat(80))
    console.log('\nWrite this down and store it securely offline.')
    console.log('You can recover your identity with this phrase if you forget your password.\n')
  }
  
  console.log('Identity Public Key:', user.identityPublicKey.toString('hex'))
  
  // Initialize device
  console.log('\nInitializing device...')
  const device = await identityManager.initDevice('my-laptop')
  console.log('Device Name:', device.deviceName)
  console.log('Device Public Key:', device.devicePublicKey.toString('hex'))
  
  // Get database keys
  const keys = identityManager.getDatabaseKeys()
  
  // Initialize database
  console.log('\nInitializing database...')
  await db.init(storagePath, keys.identityPublicKey, keys.profileDiscoveryEncryptionKey, device.deviceName)
  
  // Get room link for sharing
  const roomLink = db.getRoomLink()
  console.log('\nRoom link for other devices:')
  console.log(roomLink)
  
  // Register this device
  const existingDevices = await db.query('devices', {
    query: "[?deviceId == '" + device.devicePublicKey.toString('hex') + "']"
  })
  
  if (existingDevices.length === 0) {
    await db.registerDevice({
      deviceId: device.devicePublicKey.toString('hex'),
      name: device.deviceName,
      publicKey: device.devicePublicKey.toString('hex'),
      userIdentity: user.identityPublicKey.toString('hex')
    })
    console.log('\nDevice registered in database')
  } else {
    await db.updateDeviceLastSeen(device.devicePublicKey.toString('hex'))
    console.log('\nDevice last seen updated')
  }
  
  // Only add sample data if this is a new identity
  if (isNewIdentity) {
    // Example: Add an SSH connection
    await db.addRow('ssh_connections', {
      name: 'my-server',
      host: 'example.com',
      user: 'admin',
      port: 22,
      authType: 'keypair',
      keyPath: '~/.ssh/id_rsa',
      userIdentity: user.identityPublicKey.toString('hex'),
      deviceId: device.devicePublicKey.toString('hex')
    })
    
    console.log('Added sample SSH connection')
  }
  
  // Query SSH connections
  const connections = await db.getSSHConnections(user.identityPublicKey.toString('hex'))
  console.log('\nCurrent SSH connections:')
  console.log(JSON.stringify(connections, null, 2))
  
  await db.close()
  console.log('\nDone!')
}

main().catch(console.error)
