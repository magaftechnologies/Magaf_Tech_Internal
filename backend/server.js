import app from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/environment.js'

let server

async function start() {
  await connectDatabase()
  server = app.listen(env.port, () => console.info(`MAGAF API listening on port ${env.port} (${env.nodeEnv}).`))
  const shutdown = async (signal) => {
    console.info(`${signal} received; shutting down gracefully.`)
    server.close(async (error) => {
      await disconnectDatabase()
      if (error) {
        console.error('HTTP server shutdown failed.', error)
        process.exitCode = 1
      }
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((error) => {
  console.error('Backend failed to start.', error)
  process.exitCode = 1
})
