import 'reflect-metadata'
import 'dotenv/config'
import { main, startup } from './main.js'
import { createConnection } from 'typeorm'
import chalk from 'chalk'

// config fetching
const post = process.env.TWITTER_ENABLED === 'true'
const devMode = process.env.ENVIRONMENT === 'dev'
const timeout = Number(process.env.TIMEOUT)

console.info(chalk.bold.cyan('Starting fab-fetch...'))

createConnection().then(async connection => {
  console.info(chalk.green('Database connected!'))

  // load the Fab user into memory
  if (!devMode) {
    await startup()
  }

  if (devMode) {
    await main(post)
  } else {
    setInterval(async () => main(post), timeout)
  }
})


