import chalk from "chalk"
import { login, userInfo } from "./auth"
import { downloadImage } from "./files"
import { buildMessages} from "./messages"
import { formatTweet, postTweet, twitterClient } from "./twitter"
import { User } from "./types"

export const startup = async (): Promise<User> => {
  if (! process.env.FAB_ACCESS_TOKEN) {
    const { user } = await login()
    return user
  } else {
    console.info(chalk.green('Using access token...'))
    return await userInfo()
  }
}

export const main = async (postToSocial: boolean) => {
  const twitter = twitterClient()
  const messages = await buildMessages()

  messages.forEach(async post => {
    console.info(chalk.green(`Downloading message from:`, chalk.cyan.bold(post.message.user.artist.enName)))

    // download images
    await Promise.all(post.downloadables.map(async downloadable => await downloadImage(downloadable)))

    // post to twitter
    if (postToSocial) {
      await postTweet(twitter, post.downloadables, formatTweet(post.message))
    }
  })
}