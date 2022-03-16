import 'reflect-metadata'
import 'dotenv/config'
import { main, startup } from './main.js'
import { createConnection } from 'typeorm'
import chalk from 'chalk'
import { fetchFabVersion } from './http.js'

// config fetching
const post = process.env.TWITTER_ENABLED === 'true'
const devMode = process.env.ENVIRONMENT === 'dev'
const timeout = Number(process.env.TIMEOUT)

console.info(chalk.bold.cyan('Starting fab-fetch...'))
if (devMode) {
  console.info(chalk.bold.yellow('Development mode'))
}

createConnection().then(async connection => {
  console.info(chalk.bold.green('Database connected!'))

  if (!devMode) {
    // fetch the Fab app version
    process.env.FAB_VERSION = await fetchFabVersion()
    console.info(chalk.cyan('Loaded Fab version:', chalk.bold(process.env.FAB_VERSION)))

    // load the Fab user into memory
    await startup()
  }

  if (devMode) {
    await main(post)
  } else {
    setInterval(async () => main(post), timeout)
  }
})


