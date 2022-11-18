import { SavedMedia, TwitterAccount } from '../types'
import { TweetV1, TwitterApi } from 'twitter-api-v2'
import { DateTime } from 'luxon'
import { Log, sleep } from '../util'

/**
 * Build up the Twitter client.
 * @param account TwitterAccount
 * @returns TwitterApi | undefined
 */
export const client = (account: TwitterAccount = TwitterAccount.ARCHIVE): TwitterApi | undefined => {
  switch (account) {
    case TwitterAccount.ARCHIVE:
      if (!process.env.TWITTER_ARCHIVE_API_KEY) return undefined
      
      return new TwitterApi({
        appKey: process.env.TWITTER_ARCHIVE_API_KEY as string,
        appSecret: process.env.TWITTER_ARCHIVE_API_SECRET as string,
        accessToken: process.env.TWITTER_ARCHIVE_ACCESS_TOKEN as string,
        accessSecret: process.env.TWITTER_ARCHIVE_ACCESS_SECRET as string,
      })
    case TwitterAccount.PROFILES:
      if (!process.env.TWITTER_PROFILES_API_KEY) return undefined

      return new TwitterApi({
        appKey: process.env.TWITTER_PROFILES_API_KEY as string,
        appSecret: process.env.TWITTER_PROFILES_API_SECRET as string,
        accessToken: process.env.TWITTER_PROFILES_ACCESS_TOKEN as string,
        accessSecret: process.env.TWITTER_PROFILES_ACCESS_SECRET as string,
      })
    default:
      // oh fuggg
      throw new Error(`Unknown Twitter account: ${account}`)
  }
}

/**
 * Formats the given date into a usable string in KST format.
 * @param createdAt string
 * @param emoji string
 * @returns string
 */
export const format = (createdAt: DateTime, emoji: string): string => {
  const date = createdAt.toFormat('yyMMdd')
  const time = createdAt.toFormat('hh:mma')

  return `[${date}] ${emoji}\n— ${time} KST`
}

/**
 * Recursively posts the given images to Twitter.
 * @param client TwitterApi
 * @param media SavedMedia[]
 * @param text string
 * @returns Promise<boolean>
 */
export const post = async (client: TwitterApi, media: SavedMedia[], text: string): Promise<boolean> => {
  Log.info(`Posting to Twitter...`)

  // upload media to twitter
  let mediaIds = await Promise.all(
    media.map(image => client.v1.uploadMedia(image.path))
  );

  // recursively reply to the first tweet until all images are posted
  let lastTweet: TweetV1 | undefined;
  while (mediaIds.length > 0) {
    if (! lastTweet) {
      lastTweet = await client.v1.tweet(text, { media_ids: mediaIds.splice(0, 4) })
    } else {
      await sleep(5000)
      lastTweet = await client.v1.reply(text, lastTweet.id_str, { media_ids: mediaIds.splice(0, 4) })
    }
  }

  return true
}