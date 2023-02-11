import { parseUserIds } from './functions.js';
import chalk from 'chalk'
import { DateTime } from "luxon"
import { In } from 'typeorm'
import { handleProfile, loadArtists } from './artists.js'
import { Artist } from './entity/Artist.js'
import { Image } from './entity/Image.js'
import { Message, MessageType } from './entity/Message.js'
import { bruteforceImages, deriveUrl, downloadMessage } from "./files.js"
import { request } from "./http.js"
import { getEmoji } from './emoji.js';
import { FabUser, LetterTextObject, FabMessage, ParsedMessage, PostcardType, DownloadResult } from "./types.js"
import { decryptString } from './encryption.js'
import { AppDataSource } from './data-source.js'
import { scanComments } from './comments.js'
import { getName } from './names.js';

const parseMessage = (message: FabMessage): ParsedMessage => {
  let text = ''
  const parsedJson = message.letter && message.letter.text
    ? JSON.parse(message.letter.text as string)
    : {}
  if (parsedJson && parsedJson.contents) {
    text = parsedJson.contents
      .filter(({ type }: LetterTextObject) => type === 'text')
      .map(({ text }: LetterTextObject) => text)
      .join('\n')
  }

  let media = []
  if (!!message.letter) {
    // if the thumbnail exists, use it as the base
    if (message.letter.thumbnail) {
      media = [{ url: message.letter.thumbnail }]
    }

    // handle paid for letter messages
    if (message.letter.images.length > 0) {
      media = message.letter.images.map(image => {
        return {
          url: image.image
        }
      })
    }

    // and finally, have to derive the url from the message createdAt timestamp
    if (media.length === 0) {
      media = [{ url: deriveUrl(message.createdAt, message.letter.id) }]
    }
  }

  // handle postcards, paid for and not paid for
  let postcardType = PostcardType.NONE
  if (!!message.postcard) {
    postcardType = message.postcard.type
    if (message.postcard?.postcardVideo) {
      media = [{ url: message.postcard?.postcardVideo }]
    } else if (message.postcard?.postcardImage) {
      media = [{ url: message.postcard?.postcardImage }]
    } else {
      media = [{ url: message.postcard?.thumbnail }]
    }
  }

  const parsed = {
    id: message.id,
    createdAt: DateTime.fromMillis(message.createdAt, { zone: 'Asia/Seoul' }),
    // must fetch from the letter/postcard for string decryption
    updatedAt: !!message.postcard ? message.postcard.updatedAt : message.letter.updatedAt,
    user: parseUser(message),
    text: text,
    media: media,
    emoji: getEmoji(message.userId),
    isPostcard: !!message.postcard,
    postcardType: postcardType,
  } as ParsedMessage

  return parsed
}

const parseUser = (message: FabMessage): FabUser => {
  if (message.isGroup === 'Y' && message.group) {
    return {
      id: message.userId,
      nickName: message.group.enName,
      name: message.group.name,
      enName: message.group.enName,
      profileImage: message.group.profileImage,
      bannerImage: message.group.bannerImage,
      statusMessage: message.group.statusMessage,
    } as FabUser
  }

  return {
    id: message.userId,
    nickName: message.user.nickName,
    name: message.user.artist.name,
    enName: getName(message.userId, message.user.artist.enName),
    profileImage: message.user.profileImage,
    bannerImage: message.user.artist.bannerImage,
    statusMessage: message.user.artist.statusMessage,
  } as FabUser
}

const fetchMessagesByArtist = async (artist: Artist): Promise<FabMessage[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request('get', `artists/${artist.artistId}/messages`, {
    userid: userId,
    accessToken: accessToken,
  })

  if (error) {
    console.info(chalk.red(`Error fetching messages: ${error}`))
    process.exit()
  }

  // pass the user off to check for new profile updates
  if (data.messages && data.messages.length > 0) {
    await handleProfile(parseUser(data.messages[0]), artist)
  }

  return data.messages
}

const fetchMessages = async (): Promise<FabMessage[]> => {
  const artists = await loadArtists()
  const messages = await Promise.all(artists.map(artist => fetchMessagesByArtist(artist)))

  return messages.flat().sort((a, b) => a.id < b.id ? 1 : -1)
}

const payForMessage = async (message: FabMessage): Promise<ParsedMessage> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request('get', `users/${userId}/message/${message.id}`, {
    userid: userId,
    accessToken: accessToken
  })

  if (error) {
    console.info(chalk.red(`Error fetching message #${message.id}: ${error}`))
    return parseMessage(message)
  }

  const parsed = parseMessage(data.message)

  // decrypt all the media urls
  console.info(chalk.green(`Decrypting message #${message.id}`))
  parsed.media = parsed.media.map(media => {
    media.url = decryptString(parsed.updatedAt, media.url)
    return media
  })

  return parsed
}

const saveImages = (parsedMessage: ParsedMessage): Image[] => {
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = parsedMessage.user.enName
  const date = parsedMessage.createdAt.toFormat('yyMMdd')
  const folder = `${downloadFolder}/${name}/${date}`

  return parsedMessage.media.map(media => {
    const filename = media.url.split('/').pop()

    const image = new Image()
    image.createdAt = parsedMessage.createdAt.toISO()
    image.url = media.url
    image.folder = folder
    image.path = `${folder}/${filename}`

    return image
  })
}

const buildMessage = async (parsedMessage: ParsedMessage): Promise<Message> => {
  const message = new Message()
  message.messageId = parsedMessage.id
  message.memberId = parsedMessage.user.id
  message.memberName = parsedMessage.user.enName
  message.memberEmoji = parsedMessage.emoji
  message.createdAt = parsedMessage.createdAt.toISO()
  message.type = parsedMessage.isPostcard ? MessageType.POSTCARD : MessageType.LETTER
  message.artist = await AppDataSource.getRepository(Artist).findOne({ where: { artistId: parsedMessage.user.id } })
  message.images = saveImages(parsedMessage)

  await AppDataSource.getRepository(Message).save(message)

  return message
}

export const saveMessages = async (): Promise<Message[]> => {
  // config for decrypting or bruteforcing
  const decryptAll = process.env.DECRYPT_ALL === 'true'

  // fetch messages
  const unfilteredMessages = (await fetchMessages()).filter(m => m.user.artist.isTerminated === 'N')

  // we want to operate on already saved messages, but filter on new comments
  const messagesWithNewComments = unfilteredMessages.filter(m => m.isNewArtistUserComment === 'Y')

  // filter out anything already in the database and anything without media
  // have to chunk this as sqlite doesn't like loading everything in at once
  const filteredMessages = []
  const chunkSize = 250;
  for (let i = 0; i < unfilteredMessages.length; i += chunkSize) {
    const chunk = unfilteredMessages.slice(i, i + chunkSize);

    const inDatabase = await AppDataSource.getRepository(Message).find({
      where: {
        messageId: In(chunk.map(m => m.id))
      }
    })
    filteredMessages.push(...chunk.filter(message => inDatabase.find(m => m.messageId === message.id) === undefined))
  }
  console.info(chalk.green(`Fetched ${filteredMessages.length} new messages`))

  // perform various tasks on each message
  const messages: Message[] = []
  for (const fabMessage of filteredMessages) {
    // must pay for posts by members using android due to unpredictable image urls
    const payForUserIds = parseUserIds();
    const isAndroid = payForUserIds.includes(fabMessage.userId)

    // need to fetch and pay for android posts
    // either fetch, pay for and decrypt posts or just bruteforce, depending on config
    const name = getName(fabMessage.userId, fabMessage.user?.artist.enName || 'LOONA')
    console.info(chalk.green('Fetching message from:', chalk.bold.cyan(name)))
    let parsed: ParsedMessage;
    try {
      parsed = (isAndroid || decryptAll) ? await payForMessage(fabMessage) : await bruteforceImages(parseMessage(fabMessage))
    } catch (e) {
      if (e.message.includes('Malformed UTF-8 data')) {
        console.info(chalk.red('Could not decrypt message, skipping'))
        continue;
      }
      console.info(chalk.red('Unknown error:', chalk.bold.red(e.message)))
      process.exit()
    }
    
    // no media found
    if (parsed.media.length === 0) {
      // try paying for the message
      if (process.env.PAY_ON_FALLBACK === 'true') {
        console.info(chalk.bold.yellow('No media found, trying to pay for message'))
        parsed = await payForMessage(fabMessage)
      }

      // if there's still no media, save to the db and skip, otherwise continue and download
      if (parsed.media.length === 0) {
        await buildMessage(parsed)
        continue
      }
    }

    // download media
    const result = await downloadMessage(parsed)
    if (result !== DownloadResult.CONNECTION_ERROR) {
      // save to the database
      messages.push(await buildMessage(parsed))
      console.info(chalk.green('Saved message from:', chalk.bold.cyan(parsed.user.enName), `(Found ${parsed.media.length} images/videos)`))
    }
  }

  // scan comment threads for voice messages
  if (process.env.VOICE_COMMENTS_ENABLED === 'true') {
    console.info(chalk.green(`Scanning ${messagesWithNewComments.length} messages for comments...`))
    await scanComments(messagesWithNewComments)
  }

  return messages
}
