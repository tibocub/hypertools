import schemasheets from 'schema-sheets'
import corestore from 'corestore'
import z32 from 'z32'

export class Database {
  constructor() {
    this.store = null
    this.sheets = null
    this.schemas = new Map() // Cache of schemaId by name
    this.isReady = false
  }

  /**
   * Initialize the P2P database
   * @param {string} storagePath - Path for corestore storage
   * @param {Buffer} dbKey - 32-byte database key
   * @param {Buffer} encryptionKey - 32-byte encryption key
   * @param {string} deviceName - Name for this device in the network
   */
  async init(storagePath, dbKey, encryptionKey, deviceName) {
    try {
      // Initialize corestore
      this.store = new corestore(storagePath)
      
      // Create schema-sheets instance with the shared user key
      this.sheets = new schemasheets(this.store, dbKey, { encryptionKey })
      await this.sheets.ready()
      
      // Join the network with device name
      await this.sheets.join(deviceName)
      
      this.isReady = true
      console.log(`Database initialized for device: ${deviceName}`)
      
      // Initialize core schemas for the app
      await this._initCoreSchemas()
      
      return true
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Create room link for sharing with other devices
   * @returns {string} z32 encoded room link
   */
  getRoomLink() {
    if (!this.sheets) {
      throw new Error('Database not initialized')
    }
    
    // Combine dbKey and encryptionKey for sharing
    const combined = Buffer.concat([
      this.sheets.key,
      this.sheets.encryptionKey
    ])
    
    return z32.encode(combined)
  }

  /**
   * Join an existing room using room link
   * @param {string} roomLink - z32 encoded room link
   * @param {string} storagePath - Path for corestore storage
   * @param {string} deviceName - Name for this device
   */
  static async joinRoom(roomLink, storagePath, deviceName) {
    try {
      // Decode room link to get keys
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

  /**
   * Initialize core schemas for the application
   */
  async _initCoreSchemas() {
    // Schema for device registry
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

    // Schema for file tracking
    await this.ensureSchema('files', {
      type: 'object',
      properties: {
        path: { type: 'string' },
        hash: { type: 'string' },
        size: { type: 'number' },
        lastModified: { type: 'number' },
        deviceId: { type: 'string' },
        userIdentity: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['path', 'deviceId', 'userIdentity']
    })

    // Schema for SSH connections (your first tool)
    await this.ensureSchema('ssh_connections', {
      type: 'object',
      properties: {
        name: { type: 'string' },
        host: { type: 'string' },
        user: { type: 'string' },
        port: { type: 'number', default: 22 },
        authType: { 
          type: 'string', 
          enum: ['password', 'keypair', 'agent'] 
        },
        keyPath: { type: 'string' },
        password: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        userIdentity: { type: 'string' },
        deviceId: { type: 'string' }
      },
      required: ['name', 'host', 'user', 'userIdentity']
    })
  }

  /**
   * Ensure a schema exists, create if it doesn't
   * @param {string} name - Schema name
   * @param {object} jsonSchema - JSON Schema definition
   */
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

  /**
   * Add a row to a schema
   * @param {string} schemaName - Schema name
   * @param {object} data - Data to add
   * @param {number} timestamp - Optional timestamp
   */
  async addRow(schemaName, data, timestamp) {
    const schemaId = this.schemas.get(schemaName)
    if (!schemaId) {
      throw new Error(`Schema ${schemaName} not found. Call ensureSchema first.`)
    }
    
    return await this.sheets.addRow(schemaId, data, timestamp)
  }

  /**
   * Query rows from a schema
   * @param {string} schemaName - Schema name
   * @param {object} options - Query options
   */
  async query(schemaName, options = {}) {
    const schemaId = this.schemas.get(schemaName)
    if (!schemaId) {
      throw new Error(`Schema ${schemaName} not found.`)
    }
    
    return await this.sheets.list(schemaId, options)
  }

  /**
   * Update a row
   * @param {string} uuid - Row UUID
   * @param {object} data - Updated data
   */
  async updateRow(uuid, data) {
    return await this.sheets.updateRow(uuid, data)
  }

  /**
   * Delete a row
   * @param {string} uuid - Row UUID
   */
  async deleteRow(uuid) {
    return await this.sheets.deleteRow(uuid)
  }

  /**
   * Get all tracked files for a user
   * @param {string} userIdentity - User identity
   */
  async getUserFiles(userIdentity) {
    return await this.query('files', {
      query: "[?userIdentity == '" + userIdentity + "']"
    })
  }

  /**
   * Get SSH connections for a user
   * @param {string} userIdentity - User identity
   * @param {string} deviceId - Optional device filter
   */
  async getSSHConnections(userIdentity, deviceId = null) {
    let query
    if (deviceId) {
      query = "[?userIdentity == '" + userIdentity + "' && deviceId == '" + deviceId + "']"
    } else {
      query = "[?userIdentity == '" + userIdentity + "']"
    }
    
    return await this.query('ssh_connections', { query })
  }

  /**
   * Add a device to the registry
   * @param {object} deviceInfo - Device information
   */
  async registerDevice(deviceInfo) {
    return await this.addRow('devices', {
      ...deviceInfo,
      lastSeen: Date.now()
    })
  }

  /**
   * Update device last seen timestamp
   * @param {string} deviceId - Device ID
   */
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

  /**
   * Close the database
   */
  async close() {
    // Note: schema-sheets doesn't have a close method in the API
    // but we can clean up references
    this.sheets = null
    this.store = null
    this.isReady = false
  }
}

export default Database
