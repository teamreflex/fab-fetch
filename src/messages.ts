import chalk from "chalk"
import { DateTime } from "luxon"
import { request } from "./http"
import { LetterTextObject, Message, ParsedMessage } from "./types"

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
    if (parsedJson) {
      text = parsedJson.contents
        .filter(({ type }: LetterTextObject) => type === 'text')
        .map(({ text }: LetterTextObject) => text)
        .join('\n')
    }

  const media = message.letter
    ? message.letter.images.map(image => image.image)
    : [message.postcard?.postcardVideo]

  return {
    id: message.id,
    createdAt: DateTime.fromMillis(message.createdAt, { zone: 'Asia/Seoul' }),
    user: message.user,
    text: text,
    media: media,
  } as ParsedMessage
}