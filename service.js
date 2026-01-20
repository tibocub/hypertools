import { IdentityManager } from './core/identity.js'
import { Database } from './core/database.js'
import { homedir } from 'os'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import crypto from 'crypto'

// Encryption utilities
function decryptMnemonic(encryptedData, password) {
  try {
    const salt = Buffer.from(encryptedData.salt, 'hex')
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
    
    const iv = Buffer.from(encryptedData.iv, 'hex')
    const authTag = Buffer.from(encryptedData.authTag, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    return null
  }
}

class HypertoolsService {
  constructor() {
    this.identityManager = null
    this.mainDb = null
    this.toolDbs = new Map()
    this.isRunning = false
  }

  async start(password) {
    console.log('🚀 Starting Hypertools service...')
    
    const appDir = join(homedir(), '.hypertools')
    const storagePath = join(appDir, 'db')
    const identityPath = join(appDir, 'identity.enc')
    
    if (!existsSync(appDir)) {
      mkdirSync(appDir, { recursive: true })
    }

    // Load identity
    if (!existsSync(identityPath)) {
      throw new Error('No identity found. Run CLI to create one first.')
    }

    const encryptedData = JSON.parse(readFileSync(identityPath, 'utf8'))
    const mnemonic = decryptMnemonic(encryptedData, password)
    
    if (!mnemonic) {
      throw new Error('Invalid password')
    }

    // Initialize identity
    this.identityManager = new IdentityManager()
    const user = await this.identityManager.initUser(mnemonic)
    console.log(`✓ User identity loaded: ${user.identityPublicKey.toString('hex').substring(0, 16)}...`)

    // Initialize device
    const device = await this.identityManager.initDevice('main-device')
    console.log(`✓ Device initialized: ${device.deviceName}`)

    // Initialize main database with P2P networking
    const keys = this.identityManager.getDatabaseKeys()
    this.mainDb = new Database()
    await this.mainDb.init(storagePath, keys.identityPublicKey, keys.profileDiscoveryEncryptionKey, device.deviceName)

    // Register/update device
    const existingDevices = await this.mainDb.query('devices', {
      query: "[?deviceId == '" + device.devicePublicKey.toString('hex') + "']"
    })
    
    if (existingDevices.length === 0) {
      await this.mainDb.registerDevice({
        deviceId: device.devicePublicKey.toString('hex'),
        name: device.deviceName,
        publicKey: device.devicePublicKey.toString('hex'),
        userIdentity: user.identityPublicKey.toString('hex')
      })
    } else {
      await this.mainDb.updateDeviceLastSeen(device.devicePublicKey.toString('hex'))
    }

    this.isRunning = true
    console.log('✓ Service running')
    console.log(`📡 Room link: ${this.mainDb.getRoomLink()}`)
    console.log('\nPress Ctrl+C to stop')
  }

  async getToolDatabase(toolName) {
    if (this.toolDbs.has(toolName)) {
      return this.toolDbs.get(toolName)
    }

    const toolDb = await this.mainDb.createToolNamespace(toolName)
    this.toolDbs.set(toolName, toolDb)
    return toolDb
  }

  async stop() {
    console.log('\n🛑 Stopping service...')
    
    for (const [name, db] of this.toolDbs) {
      await db.close()
    }
    
    if (this.mainDb) {
      await this.mainDb.close()
    }
    
    this.isRunning = false
    console.log('✓ Service stopped')
  }
}

// Run service if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = new HypertoolsService()
  
  // Get password from command line arg or prompt
  const password = process.argv[2]
  if (!password) {
    console.error('Usage: node service.js <password>')
    process.exit(1)
  }

  await service.start(password)

  process.on('SIGINT', async () => {
    await service.stop()
    process.exit(0)
  })
}

export default HypertoolsService
