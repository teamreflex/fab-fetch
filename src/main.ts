import chalk from "chalk"
import { login, userInfo } from "./auth"
import { fetchMessage } from "./messages"
import { User } from "./types"

export const startup = async (): Promise<User> => {
  if (!process.env.FAB_ACCESS_TOKEN) {
    const { user } = await login()
    return user
  } else {
    console.info(chalk.green('Using access token...'))
    return await userInfo()
  }
}

export const main = async () => {
  const message = await fetchMessage(225)
  console.log(message)
}