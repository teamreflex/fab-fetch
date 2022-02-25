import chalk from "chalk"
import { DateTime } from "luxon"
import { bruteforceImages, buildDownloadables, fileExists } from "./files"
import { request } from "./http"
import { DownloadablePost, FabUser, LetterTextObject, Message, ParsedMessage } from "./types"

export const fetchUnreadMessages = async (): Promise<Message[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request('get', `/users/${userId}/messages`, {
    userid: userId,
    accessToken: accessToken
  })

  if (error) {
    console.info(chalk.red(`Error fetching messages: ${error}`))
    process.exit()
  }

  return data.messages
}

export const fetchMessage = async (message: Message): Promise<ParsedMessage> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request('get', `/users/${userId}/message/${message.id}`, {
    userid: userId,
    accessToken: accessToken
  })

  if (error) {
    console.info(chalk.red(`Error fetching message #${message.id}: ${error}`))
    return parseMessage(message)
  }

  return parseMessage(data.message)
}

const parseUser = (message: Message): FabUser => {
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

export const parseMessage = (message: Message): ParsedMessage => {
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

  // if the message is a postcard and we paid for it, directly download the video
  if (!!message.postcard && message.postcard?.postcardVideo) {
    media[0] = message.postcard?.postcardVideo
  }

  const parsed = {
    id: message.id,
    createdAt: DateTime.fromMillis(message.createdAt, { zone: 'Asia/Seoul' }),
    user: parseUser(message),
    text: text,
    media: media,
    isPostcard: !!message.postcard,
  } as ParsedMessage

  return parsed
}

export const buildMessages = async (): Promise<DownloadablePost[]> => {
  const unreadMessages = await fetchUnreadMessages()

  const downloadablePosts = unreadMessages
    .filter(message => !!message.postcard || Number(message?.letter?.images?.length) > 0)
    .map(message => {
      return {
        message: message,
        downloadables: buildDownloadables(parseMessage(message)),
      }
    })
    .filter(({ downloadables }) => !fileExists(downloadables[0].fullPath))

  const messages = downloadablePosts.map(async dl => {
    // must pay for posts by members using android due to unpredictable image urls
    const isAndroid = (!!dl.message.letter && dl.message.letter.images[0].image.includes('IMAGE')) || (!!dl.message.postcard && dl.message.postcard.thumbnail.includes('IMAGE'))

    // pay for & fetch android posts
    // bruteforce everything else
    const message = isAndroid 
      ? await fetchMessage(dl.message)
      : await bruteforceImages(parseMessage(dl.message))
    return {
      message: message,
      downloadables: buildDownloadables(message),
    } as DownloadablePost
  })

  return await Promise.all(messages)
}