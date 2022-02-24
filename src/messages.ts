import chalk from "chalk"
import { DateTime } from "luxon"
import { bruteforceImages, buildDownloadables, fileExists } from "./files"
import { request } from "./http"
import { DownloadablePost, LetterTextObject, Message, ParsedMessage } from "./types"

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

export const fetchMessage = async (messageId: number): Promise<ParsedMessage> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request('get', `/users/${userId}/message/${messageId}`, {
    userid: userId,
    accessToken: accessToken
  })

  if (error) {
    console.info(chalk.red(`Error fetching message #${messageId}: ${error}`))
    process.exit()
  }

  return parseMessage(data.message)
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
    : [message.postcard?.thumbnail, message.postcard?.postcardVideo]

  const parsed = {
    id: message.id,
    createdAt: DateTime.fromMillis(message.createdAt, { zone: 'Asia/Seoul' }),
    user: message.user,
    text: text,
    media: media,
  } as ParsedMessage

  return parsed
}

export const buildMessages = async (): Promise<DownloadablePost[]> => {
  const unreadMessages = await fetchUnreadMessages()

  const downloadablePosts = unreadMessages
    .slice(0, 1) // remove when in prod
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
      ? await fetchMessage(dl.message.id)
      : await bruteforceImages(parseMessage(dl.message))
    return {
      message: message,
      downloadables: buildDownloadables(message),
    } as DownloadablePost
  })

  return await Promise.all(messages)
}