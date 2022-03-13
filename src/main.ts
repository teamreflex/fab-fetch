import chalk from 'chalk'
import { getRepository } from 'typeorm'
import { login, userInfo } from "./auth.js"
import { Message, MessageType } from './entity/Message.js'
import { downloadMessage } from './files.js'
import { buildMessage, fetchAndFilterMessages } from './messages.js'
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

  // fetch messages and filter them
  const messages = await fetchAndFilterMessages()
  console.info(chalk.green(`Fetched ${messages.length} new messages`))

  // save to the database and tweet if necessary
  for (const parsed of messages) {
    // save to db
    const message = await buildMessage(parsed)
    console.info(chalk.green(`Saved message #${message.messageId} to the database`))

    // download
    console.info(chalk.green(`Downloading message from:`, chalk.cyan.bold(message.artist.nameEn)))
    await downloadMessage(message)

    // tweet
    if (postToSocial) {
      await postTweet(twitter, message.images, formatTweet(message.createdAt, message.memberEmoji))

      // mark message as posted
      message.twitterPosted = true
      await getRepository(Message).save(message)
    }
  }
}