import chalk from 'chalk'
import { DateTime } from "luxon"
import { getRepository, In } from 'typeorm'
import { handleProfile, loadArtists } from './artists.js'
import { Artist } from './entity/Artist.js'
import { Image } from './entity/Image.js'
import { Message, MessageType } from './entity/Message.js'
import { bruteforceImages, deriveUrl, downloadMessage } from "./files.js"
import { request } from "./http.js"
import { getEmoji } from './emoji.js';
import { FabUser, LetterTextObject, FabMessage, ParsedMessage, PostcardType } from "./types.js"

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

  // default to the letter thumbnail
  let media = message.letter
    ? message.letter.thumbnail
      ? [{ url: message.letter.thumbnail }]
      : []
    : []

  if (!!message.letter) {
    // handle paid for letter messages
    if (message.letter.images.length > 0) {
      media = message.letter.images.map(image => {
        return {
          url: image.image
        }
      })
    }

    // handle messages that have a thumbnail url
    if (message.letter.thumbnail) {
      media = [{ url: message.letter.thumbnail }]
    }

    // and finally, have to derive the url from the message createdAt timestamp
    if (message.letter.images.length === 0 && !message.letter.thumbnail) {
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
    enName: message.user.artist.enName,
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

  return parseMessage(data.message)
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
  message.artist = await getRepository(Artist).findOne({ where: { artistId: parsedMessage.user.id } })
  message.images = saveImages(parsedMessage)

  await getRepository(Message).save(message)

  return message
}

export const saveMessages = async (): Promise<Message[]> => {
  // fetch messages
  const unfilteredMessages = await fetchMessages()

  // filter out anything already in the database and anything without media
  const inDatabase = await getRepository(Message).find({
    where: {
      messageId: In(unfilteredMessages.map(m => m.id))
    }
  })
  const filteredMessages = unfilteredMessages
    .filter(message => inDatabase.find(m => m.messageId === message.id) === undefined)
  console.info(chalk.green(`Fetched ${filteredMessages.length} new messages`))

  // perform various tasks on each message
  const messages: Message[] = []
  for (const fabMessage of filteredMessages) {
    // must pay for posts by members using android due to unpredictable image urls
    const isAndroid = (fabMessage.userId === 4) // haseul
    || (!!fabMessage.letter && fabMessage.letter.thumbnail.includes('IMAGE')) // old posts still have thumbnail urls, so this will catch old yves posts
    || (!!fabMessage.postcard && fabMessage.postcard.thumbnail.includes('IMAGE')) // postcards still have thumbnail urls

    // pay for & fetch android posts
    // bruteforce everything else
    console.info(chalk.green('Fetching message from:', chalk.bold.cyan(fabMessage.user?.artist.enName || 'LOONA')))
    const parsed = isAndroid ? await payForMessage(fabMessage) : await bruteforceImages(parseMessage(fabMessage))

    // no media, save to database but ultimately skip the message
    if (parsed.media.length === 0) {
      await buildMessage(parsed)
      continue
    }

    // download media
    if (await downloadMessage(parsed)) {
      // save to the database
      messages.push(await buildMessage(parsed))
      console.info(chalk.green('Saved message from:', chalk.bold.cyan(parsed.user.enName), `(Found ${parsed.media.length} images/videos)`))
    }
  }

  return messages
}
