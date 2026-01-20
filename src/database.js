import schemasheets from 'schema-sheets'
import corestore from 'corestore'
import z32 from 'z32'
import Hyperswarm from 'hyperswarm'

export class Database {
  constructor() {
    this.store = null
    this.sheets = null
    this.swarm = null
    this.schemas = new Map()
    this.isReady = false
  }

  async init(storagePath, dbKey, encryptionKey, deviceName) {
    try {
      // Initialize corestore
      this.store = new corestore(storagePath)
      
      // Create schema-sheets instance
      this.sheets = new schemasheets(this.store, dbKey, { encryptionKey })
      await this.sheets.ready()
      
      // Join the network with device name
      await this.sheets.join(deviceName)
      
      // Initialize P2P networking
      this.swarm = new Hyperswarm()
      this.swarm.join(dbKey) // Use identity key as discovery topic
      this.swarm.on('connection', (connection) => {
        console.log('Peer connected')
        this.store.replicate(connection)
      })
      
      this.isReady = true
      console.log(`Database initialized for device: ${deviceName}`)
      
      // Initialize core schemas
      await this._initCoreSchemas()
      
      return true
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  }

  getRoomLink() {
    if (!this.sheets) {
      throw new Error('Database not initialized')
    }
    
    const combined = Buffer.concat([
      this.sheets.key,
      this.sheets.encryptionKey
    ])
    
    return z32.encode(combined)
  }

  static async joinRoom(roomLink, storagePath, deviceName) {
    try {
      const decoded = z32.decode(roomLink)
      const key = decoded.subarray(0, 32)
      const encryptionKey = decoded.subarray(32)
      
      const db = new Database()
      await db.init(storagePath, key, encryptionKey, deviceName)
      return db
    } catch (error) {
      console.error('Failed to join room:', error)
      throw error
    }
  }

  async createToolNamespace(toolName) {
    if (!this.isReady) {
      throw new Error('Database not initialized')
    }
    
    console.log(`Creating namespace for tool: ${toolName}`)
    
    const toolDb = new Database()
    toolDb.store = this.store.namespace(toolName)
    toolDb.sheets = new schemasheets(toolDb.store, this.sheets.key, { 
      encryptionKey: this.sheets.encryptionKey 
    })
    await toolDb.sheets.ready()
    await toolDb.sheets.join(`${toolName}-db`)
    toolDb.swarm = this.swarm // Share swarm connection
    toolDb.isReady = true
    
    return toolDb
  }

  async _initCoreSchemas() {
    // Core app metadata
    await this.ensureSchema('app_metadata', {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' }
      },
      required: ['key', 'value']
    })

    // Device registry
    await this.ensureSchema('devices', {
      type: 'object',
      properties: {
        deviceId: { type: 'string' },
        name: { type: 'string' },
        publicKey: { type: 'string' },
        lastSeen: { type: 'number' },
        userIdentity: { type: 'string' }
      },
      required: ['deviceId', 'name', 'userIdentity']
    })

    // Installed tools tracking
    await this.ensureSchema('tools', {
      type: 'object',
      properties: {
        name: { type: 'string' },
        gitUrl: { type: 'string' },
        version: { type: 'string' },
        installedAt: { type: 'number' }
      },
      required: ['name', 'gitUrl']
    })
  }

  async ensureSchema(name, jsonSchema) {
    const schemas = await this.sheets.listSchemas()
    const existing = schemas.find(s => s.name === name)
    
    if (existing) {
      this.schemas.set(name, existing.schemaId)
      return existing.schemaId
    }
    
    const schemaId = await this.sheets.addNewSchema(name, jsonSchema)
    this.schemas.set(name, schemaId)
    return schemaId
  }

  async addRow(schemaName, data, timestamp) {
    const schemaId = this.schemas.get(schemaName)
    if (!schemaId) {
      throw new Error(`Schema ${schemaName} not found. Call ensureSchema first.`)
    }
    
    return await this.sheets.addRow(schemaId, data, timestamp)
  }

  async query(schemaName, options = {}) {
    const schemaId = this.schemas.get(schemaName)
    if (!schemaId) {
      throw new Error(`Schema ${schemaName} not found.`)
    }
    
    return await this.sheets.list(schemaId, options)
  }

  async updateRow(uuid, data) {
    return await this.sheets.updateRow(uuid, data)
  }

  async deleteRow(uuid) {
    return await this.sheets.deleteRow(uuid)
  }

  async registerDevice(deviceInfo) {
    return await this.addRow('devices', {
      ...deviceInfo,
      lastSeen: Date.now()
    })
  }

  async updateDeviceLastSeen(deviceId) {
    const devices = await this.query('devices', {
      query: "[?deviceId == '" + deviceId + "']"
    })
    
    if (devices.length > 0) {
      return await this.updateRow(devices[0].uuid, {
        lastSeen: Date.now()
      })
    }
    
    return false
  }

  async close() {
    if (this.swarm) {
      await this.swarm.destroy()
    }
    this.sheets = null
    this.store = null
    this.isReady = false
  }
}

export default Database
