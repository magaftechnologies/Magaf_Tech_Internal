import mongoose from 'mongoose'
import { env } from './environment.js'

export async function connectDatabase(uri = env.mongoUri) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri)
  console.info('Database connected successfully.')
  return mongoose.connection
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
