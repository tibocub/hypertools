import crypto from 'crypto'
import readline from 'readline'

export function encrypt(data, password) {
  const salt = crypto.randomBytes(32)
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  return {
    encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  }
}

export function decrypt(data, password) {
  try {
    // Derive the same key from password and salt
    const salt = Buffer.from(data.salt, 'hex')
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
    
    const iv = Buffer.from(data.iv, 'hex')
    const authTag = Buffer.from(data.authTag, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    // Decryption failed - likely wrong password
    return null
  }
}

export function promptPassword(prompt) {
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

export async function newPassword() {
  let password1, password2
  do {
    password1 = await promptPassword('Create a password: ')
    password2 = await promptPassword('Confirm password: ')
    
    if (password1 !== password2) {
      console.log('Passwords do not match. Please try again.\n')
    }
  } while (password1 !== password2)

  return password1
}
