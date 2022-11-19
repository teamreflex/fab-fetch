import { DateTime } from 'luxon';
import prisma from "../database"
import { request } from "../http"
import { FetchMessagesOptions, FabMessage, MessageType, MessageResponse, RawMessage, Media, SavedMedia, DownloadResponse, DownloadResult } from "../types"
import { Log, parseUserIds } from "../util"
import { Parsing } from "./parsing"
import { fetchArtistMessages } from './artists';
import chalk from 'chalk';
import { decryptString } from './encryption';
import { Message } from '@prisma/client';
import { bruteforceImages, downloadMessage } from './files';

/**
 * Fetch latest messages, filtered by group.
 * @returns Promise<FabMessage[]>
 */
export const fetchLatestMessages = async (): Promise<FabMessage[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request<{ messages: RawMessage[] }>('get', `/messages`, {
    userid: userId,
    accessToken: accessToken
  })

  if (!data || error) {
    Log.error(`Error fetching messages: ${error}`)
    process.exit()
  }

  return data.messages
    .map((message: RawMessage) => Parsing.message(message))
    .filter((message: FabMessage) => message.groupId === Number(process.env.GROUP_ID))
}

/**
 * Fetch all messages.
 * @returns Promise<FabMessage[]>
 */
export const fetchAllMessages = async (): Promise<FabMessage[]> => {
  const artists = await prisma.artist.findMany()
  if (artists.length === 0) {
    Log.error(`No artists found in database.`)
    process.exit()
  }

  const messages = artists.map(a => fetchArtistMessages(a.fabArtistId))

  return (await Promise.all(messages)).flat()
}

/**
 * Fetches latest messages and filters.
 * @returns Promise<MessageResponse>
 */
export const fetchMessages = async (options?: FetchMessagesOptions): Promise<MessageResponse> => {
  const latestMessages = options?.all ? await fetchAllMessages() : await fetchLatestMessages()
  const messagesWithNewComments = latestMessages.filter(m => m.isNewArtistUserComment)
  const inDatabase = await prisma.message.findMany({
    where: {
      fabMessageId: {
        in: latestMessages.map(m => m.id)
      }
    }
  })
  const filteredMessages = latestMessages.filter(message => inDatabase.find(m => m.fabMessageId === message.id) === undefined)

  return {
    latestMessages,
    messagesWithNewComments,
    filteredMessages,
  }
}

/**
 * Spend points to fetch the full message.
 * @param message FabMessage
 * @returns Promise<Media[]>
 */
const payForMessage = async (message: FabMessage): Promise<Media[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN
  const { data, error } = await request<{ message: RawMessage }>('get', `users/${userId}/message/${message.id}`, {
    userid: userId,
    accessToken: accessToken
  })

  if (!data || error) {
    Log.error(`Error fetching message #${message.id}: ${error}`)
    return []
  }

  const parsed = Parsing.message(data.message)

  // decrypt all the media urls
  Log.success(`Decrypting message #${message.id}`)

  // figure out all the media urls and timestamp for decryption
  let updatedAt: DateTime
  let media: Media[] = []
  if (parsed.messageType === MessageType.LETTER && parsed.letter) {
    updatedAt = parsed.letter.updatedAt
    media = (parsed.letter?.images || []).map(image => ({ url: image.image }))
  }
  if (parsed.postcard) {
    updatedAt = parsed.postcard.updatedAt
    if (parsed.messageType === MessageType.POSTCARD_IMAGE) {
      media = [{ url: parsed.postcard.postcardImage }]
    } else {
      media = [{ url: parsed.postcard.postcardVideo }]
    }
  }

  return media.map(media => {
    media.url = decryptString(updatedAt.toMillis(), media.url)
    return media
  })
}

/**
 * Save the message to the database.
 * @param message FabMessage
 * @param media SavedMedia[]
 * @param socialPosted boolean
 * @returns Promise<Message>
 */
export const saveToDatabase = async (message: FabMessage, media: SavedMedia[], socialPosted: boolean): Promise<Message> => {
  const artist = await prisma.artist.findFirst({
    where: {
      fabArtistId: message.userId,
    }
  })
  if (!artist) {
    Log.error(`Artist not found for message #${message.id}`)
    process.exit()
  }

  const dbMessage = await prisma.message.create({
    data: {
      fabMessageId: message.id,
      artistId: artist.id,
      type: message.messageType,
      socialPosted,
    }
  })

  const images = await Promise.all(media.map(m => prisma.image.create({
    data: {
      messageId: dbMessage.id,
      url: m.url,
      path: m.path,
    }
  })))

  return dbMessage
}

/**
 * Use thumbnails as a starting point.
 * @param message FabMessage
 * @returns Media[]
 */
const getStarterMedia = (message: FabMessage): Media[] => {
  if (message.postcard) {
    return message.postcard.thumbnail ? [{ url: message.postcard.thumbnail }] : []
  }

  if (message.letter) {
    return message.letter.thumbnail ? [{ url: message.letter.thumbnail }] : []
  }

  Log.error(`Letter and postcard missing from message #${message.id}`)
  process.exit()
}

/**
 * Process a single message.
 * @param message FabMessage
 * @returns Promise<DownloadResponse>
 */
export const handleMessage = async (message: FabMessage): Promise<DownloadResponse> => {
  // config for decrypting or bruteforcing
  const decryptAll = process.env.DECRYPT_ALL === 'true'

  // get thumbnails as starting point
  const starter = getStarterMedia(message)

  // must pay for posts by members using android due to unpredictable image urls
  const hasAndroidUrl = starter.some(s => s.url.includes('_IMAGE_'))
  const payForUserIds = parseUserIds();
  const isAndroid = payForUserIds.includes(message.userId) || hasAndroidUrl
  const pay = isAndroid || decryptAll

  // need to fetch and pay for android posts
  // either fetch, pay for and decrypt posts or just bruteforce, depending on config
  Log.success(`Fetching message from: ${chalk.bold.cyan(message.enName)}`)

  let unsavedMedia: Media[] = []
  try {
    unsavedMedia = pay ? await payForMessage(message) : await bruteforceImages(message, starter)

    // no media found
  if (unsavedMedia.length === 0) {
    // try paying for the message
    if (process.env.PAY_ON_FALLBACK === 'true' && !pay) {
      Log.warning('No media found, trying to pay for message')
      unsavedMedia = await payForMessage(message)
    }

    // if there's still no media, save to the db and skip, otherwise continue and download
    if (unsavedMedia.length === 0) {
      Log.warning('No media found, skipping')
      await saveToDatabase(message, [], false)
      return {
        result: DownloadResult.NOT_FOUND,
        media: [],
      }
    }
  }
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes('Malformed UTF-8 data')) {
        Log.error('Could not decrypt message, skipping')
        return {
          result: DownloadResult.DECRYPTION_ERROR,
          media: [],
        }
      }
      Log.error(`${e.message}`)
      process.exit()
    }
  }

  // download media
  return await downloadMessage(message, unsavedMedia)
}