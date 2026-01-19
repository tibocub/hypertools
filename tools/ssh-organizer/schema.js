const schema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    host: { type: 'string' },
    port: { type: 'number', default: 22 },
    username: { type: 'string' },
    password: { type: 'string' },
    privateKey: { type: 'string' },
    publicKey: { type: 'string' },
    description: { type: 'string' }
  },
  required: ['host', 'username']
}
