import { getEmoji, Log } from './util';
import { handleProfileChanges } from './fab/profile';
import { fetchFollowedArtists } from "./fab/artists"
import { client, format, post } from "./social/twitter"
import { fetchMessages, handleMessage, saveToDatabase } from './fab/messages';
import chalk from 'chalk';
import { DownloadResult } from './types';
import { scanComments } from './fab/comments';

/**
 * Main process.
 * @param postToSocial boolean
 * @returns Promise<void>
 */
export const main = async (postToSocial: boolean): Promise<void> => {
  let twitter: any = null
  if (postToSocial) {
    twitter = client()
  }

  Log.info(`Fetching artists and messages...`)

  // fetch group
  const { fabArtists, dbArtists } = await fetchFollowedArtists()

  // handle profile updates
  await handleProfileChanges(fabArtists, dbArtists)

  // fetch latest messages
  const {
    messagesWithNewComments,
    filteredMessages,
  } = await fetchMessages({ all: process.env.FETCH_ALL === 'true' })

  // handle letters/postcards
  for (const message of filteredMessages) {
    let socialPosted = false
    const { result, media } = await handleMessage(message)
    if (result === DownloadResult.SUCCESS && media.length > 0) {
      // post to twitter
      if (postToSocial) {
        const text = format(message.createdAt, getEmoji(message.userId))
        socialPosted = await post(twitter, media, text)
      }

      // save to database
      saveToDatabase(message, media, socialPosted)
      Log.success(`Saved message from: ${chalk.bold.cyan(message.enName)} (Found ${media.length} images/videos)`)
    }
  }

  // scan comment threads for voice messages
  if (process.env.VOICE_COMMENTS_ENABLED === 'true') {
    Log.success(`Scanning ${messagesWithNewComments.length} messages for comments...`)
    await scanComments(messagesWithNewComments)
  }
}