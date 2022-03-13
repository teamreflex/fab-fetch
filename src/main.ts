import chalk from 'chalk'
import { getRepository } from 'typeorm'
import { login, userInfo } from "./auth.js"
import { Message, MessageType } from './entity/Message.js'
import { downloadMessage } from './files.js'
import { saveMessages } from './messages.js'
import { formatTweet, postTweet, twitterClient } from "./twitter.js"
import { User } from "./types.js"

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
  let twitter: any = null
  if (postToSocial) {
    twitter = twitterClient()
  }

  // save messages and image urls to the database
  const messages = await saveMessages()
  console.info(chalk.green(`Saved ${messages.length} messages to the database`))

  // download images
  for (const message of messages) {
    console.info(chalk.green(`Downloading message from:`, chalk.cyan.bold(message.artist.nameEn)))
    await downloadMessage(message)

    if (postToSocial) {
      await postTweet(twitter, message.images, formatTweet(message.createdAt, message.memberEmoji))

      // mark message as posted
      message.twitterPosted = true
      await getRepository(Message).save(message)
    }
  }
}