import 'dotenv/config'
import chalk from 'chalk'
import { fetchUser, login } from './http/auth'
import { Log } from './util'
import { User } from './types'
import { fetchFabVersion } from './http/version-scrape';
import prisma from './database'
import { main } from './main'

// config fetching
const postToTwitter = process.env.TWITTER_ENABLED === 'true'
const devMode = process.env.ENVIRONMENT === 'dev'
const timeout = Number(process.env.TIMEOUT)

async function startup() {
  Log.info('Starting fab-fetch...', true)
  if (devMode) {
    Log.dev('Development mode')
  }

  await prisma.$connect()
  Log.success('Database connected!')

  if (devMode === false) {
    // fetch the Fab app version
    if (! process.env.FAB_VERSION) {
      process.env.FAB_VERSION = await fetchFabVersion()
    }
    Log.info(`Loaded Fab version: ${chalk.bold(process.env.FAB_VERSION)}`)

    // login to Fab
    let user: User
    if (! process.env.FAB_ACCESS_TOKEN) {
      user = await login()
      process.env.FAB_USER_ID = String(user.id)
    } else {
      user = await fetchUser()
    }

    Log.success(`Logged in as user: ${chalk.cyan.bold(user.nickName)}`)
    Log.success(`Points available: ${chalk.cyan.bold(user.points)}`)
  }

  // start main process
  if (devMode) {
    await main(postToTwitter)
  } else {
    setInterval(async () => main(postToTwitter), timeout)
  }
}

startup()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    Log.error(`Disconnected from database due to error: ${e}`)
    await prisma.$disconnect()
    process.exit(1)
  })
