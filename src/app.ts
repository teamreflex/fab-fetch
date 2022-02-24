import 'dotenv/config'
import { main, startup } from './main'

// config fetching
const post = process.argv.includes('--no-posting')
const devMode = process.argv.includes('--dev')
const timeout = Number(process.env.TIMEOUT)

await startup()
if (devMode) {
  await main()
} else {
  setInterval(main, timeout)
}
