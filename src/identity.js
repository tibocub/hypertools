import IdentityKey from 'keet-identity-key'
import crypto from 'hypercore-crypto'

export class IdentityManager {
  constructor() {
    this.userIdentity = null
    this.deviceKeyPair = null
    this.deviceProof = null
    this.deviceName = null
    this.mnemonic = null
  }

  /**
   * Initialize or load user identity
   * @param {string} mnemonic - Optional mnemonic phrase for existing user
   */
  async initUser(mnemonic = null) {
    console.log('Initializing user identity...')
    
    if (mnemonic) {
      // Load existing identity from mnemonic
      this.mnemonic = mnemonic
      this.userIdentity = await IdentityKey.from({ mnemonic })
    } else {
      // Generate new identity
      this.mnemonic = IdentityKey.generateMnemonic()
      this.userIdentity = await IdentityKey.from({ mnemonic: this.mnemonic })
    }
    
    console.log('User identity initialized')
    
    return {
      mnemonic: this.mnemonic,
      identityPublicKey: this.userIdentity.identityPublicKey,
      profileDiscoveryPublicKey: this.userIdentity.profileDiscoveryPublicKey
    }
  }

  /**
   * Generate device identity
   * @param {string} deviceName - Human-readable device name
   */
  async initDevice(deviceName) {
    console.log('Initializing device...')
    
    if (!this.userIdentity) {
      throw new Error('User identity must be initialized first')
    }
    
    this.deviceName = deviceName
    
    // Generate a new keypair for this device using hypercore-crypto
    this.deviceKeyPair = crypto.keyPair()
    
    // Bootstrap the device proof using the user identity
    // Check if bootstrap returns a promise and await it if needed
    const proofResult = this.userIdentity.bootstrap(this.deviceKeyPair.publicKey)
    this.deviceProof = proofResult instanceof Promise ? await proofResult : proofResult
    
    console.log('Device initialized')
    console.log('Proof type:', typeof this.deviceProof)
    console.log('Proof is Buffer:', Buffer.isBuffer(this.deviceProof))
    
    return {
      deviceName,
      devicePublicKey: this.deviceKeyPair.publicKey,
      identityPublicKey: this.userIdentity.identityPublicKey,
      proof: this.deviceProof
    }
  }

  /**
   * Verify a device proof
   * @param {*} proof - The proof to verify
   */
  verifyDeviceProof(proof) {
    // Verify the proof
    const verified = IdentityKey.verify(proof, null)
    
    if (verified === null) {
      throw new Error('Failed to verify device proof')
    }
    
    return verified
  }

  /**
   * Attest a new device using an existing device
   * @param {Buffer} newDevicePublicKey - Public key of the new device to attest
   */
  attestNewDevice(newDevicePublicKey) {
    if (!this.deviceKeyPair || !this.deviceProof) {
      throw new Error('Device identity must be initialized first')
    }
    
    // Create a proof chain: identity -> current device -> new device
    const newProof = IdentityKey.attestDevice(
      newDevicePublicKey,
      this.deviceKeyPair,
      this.deviceProof
    )
    
    return newProof
  }

  /**
   * Get database keys derived from identity
   */
  getDatabaseKeys() {
    if (!this.userIdentity) {
      throw new Error('User identity not initialized')
    }
    
    return {
      identityPublicKey: this.userIdentity.identityPublicKey,
      profileDiscoveryPublicKey: this.userIdentity.profileDiscoveryPublicKey,
      // Get encryption key for profile discovery
      profileDiscoveryEncryptionKey: this.userIdentity.getProfileDiscoveryEncryptionKey()
    }
  }

  /**
   * Get encryption key for a specific profile
   * @param {Buffer} profileKey - The profile key to derive encryption for
   */
  getProfileEncryptionKey(profileKey) {
    if (!this.userIdentity) {
      throw new Error('User identity not initialized')
    }
    
    return this.userIdentity.getEncryptionKey(profileKey)
  }

  /**
   * Export identity for backup
   */
  exportIdentity() {
    if (!this.userIdentity) {
      throw new Error('User identity not initialized')
    }
    
    return {
      mnemonic: this.mnemonic,
      deviceName: this.deviceName,
      identityPublicKey: this.userIdentity.identityPublicKey.toString('hex'),
      devicePublicKey: this.deviceKeyPair ? this.deviceKeyPair.publicKey.toString('hex') : null
    }
  }

  /**
   * Clear sensitive data from memory
   */
  clear() {
    if (this.userIdentity) {
      this.userIdentity.clear()
    }
    this.deviceKeyPair = null
    this.deviceProof = null
    this.mnemonic = null
  }
}

export default IdentityManager
