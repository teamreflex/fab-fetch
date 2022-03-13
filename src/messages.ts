import chalk from 'chalk'
import { DateTime } from "luxon"
import { getRepository, In } from 'typeorm'
import { handleProfile, loadArtists } from './artists.js'
import { Artist } from './entity/Artist.js'
import { Image } from './entity/Image.js'
import { Message, MessageType } from './entity/Message.js'
import { bruteforceImages } from "./files.js"
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

  const media = message.letter
    ? message.letter.images.map(image => image.image)
    : [message.postcard?.thumbnail]

  // if the message is a postcard and we paid for it, directly download it
  let postcardType = PostcardType.NONE
  if (!!message.postcard) {
    postcardType = message.postcard.type
    if (message.postcard?.postcardVideo) {
      media[0] = message.postcard?.postcardVideo
    }
    if (message.postcard?.postcardImage) {
      media[0] = message.postcard?.postcardImage
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

  return messages.flat()
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

  return parsedMessage.media.map(url => {
    const filename = url.split('/').pop()

    const image = new Image()
    image.createdAt = parsedMessage.createdAt.toISO()
    image.url = url
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
    .filter(message => !!message.postcard || Number(message?.letter?.images?.length) > 0)
  console.info(chalk.green(`Fetched ${filteredMessages.length} new messages`))

  // parse each message
  const parsedMessages = await Promise.all(filteredMessages.map(async fabMessage => {
    // must pay for posts by members using android due to unpredictable image urls
    const isAndroid = (!!fabMessage.letter && fabMessage.letter.images[0].image.includes('IMAGE')) || (!!fabMessage.postcard && fabMessage.postcard.thumbnail.includes('IMAGE'))

    // pay for & fetch android posts
    // bruteforce everything else
    return isAndroid ? await payForMessage(fabMessage) : await bruteforceImages(parseMessage(fabMessage))
  }))

  // save each message to the database
  const messages: Message[] = []
  for (const parsed of parsedMessages) {
    const dbMessage = await buildMessage(parsed)
    messages.push(dbMessage)
  }

  return messages
}
