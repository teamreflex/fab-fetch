import { getRepository } from 'typeorm';
import chalk from 'chalk'
import { getEmoji } from './emoji.js'
import { DownloadPath, ParsedMessage } from './types.js'
import { TweetV1, TwitterApi } from 'twitter-api-v2'
import { Message, MessageType } from './entity/Message.js'
import { DateTime } from 'luxon'

export const twitterClient = (): TwitterApi => {
  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY as string,
    appSecret: process.env.TWITTER_API_SECRET as string,
    accessToken: process.env.TWITTER_ACCESS_TOKEN as string,
    accessSecret: process.env.TWITTER_ACCESS_SECRET as string,
  })
}

const formatTweet = (message: Message): string => {
  const date = DateTime.fromISO(message.createdAt).toFormat('yyMMdd')
  const time = DateTime.fromISO(message.createdAt).toFormat('hh:mma')

  return `[${date}] ${message.memberEmoji}\n— ${time} KST`
}

export const postTweet = async (client: TwitterApi, message: Message): Promise<boolean> => {
  console.info(chalk.cyan(`Posting to Twitter...`))

  const text = formatTweet(message)

  // upload media to twitter
  let mediaIds = await Promise.all(
    message.images
      .filter(image => message.type === MessageType.POSTCARD ? image.path.includes('.mp4') : true)
      .map(
        image => client.v1.uploadMedia(image.path)
      )
  );

  // recursively reply to the first tweet until all images are posted
  let lastTweet: TweetV1 | undefined;
  while (mediaIds.length > 0) {
    if (! lastTweet) {
      lastTweet = await client.v1.tweet(text, { media_ids: mediaIds.splice(0, 4) })
    } else {
      lastTweet = await client.v1.reply(text, lastTweet.id_str, { media_ids: mediaIds.splice(0, 4) })
    }
  }

  // mark message as posted
  message.twitterPosted = true
  await getRepository(Message).save(message)

  return true
}