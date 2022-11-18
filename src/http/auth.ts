import { LoginResponse, User } from '../types';
import { request } from "."
import { Log } from "../util"
import chalk from 'chalk';

/**
 * Logs into Fab using email and password.
 * @returns Promise<User>
 */
export const login = async (): Promise<User> => {
  const email = process.env.FAB_EMAIL as string
  const password = process.env.FAB_PASSWORD as string
  Log.success(`Logging in with email: ${chalk.bold(email)}`)

  const { data, error } = await request<LoginResponse>('post', '/signin', {
    body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    userid: 0,
  })

  if (!data || error) {
    Log.error(`Error logging in: ${error}`)
    process.exit()
  }

  // set the token
  process.env.FAB_ACCESS_TOKEN = data.login.token

  return data.login.user
}

/**
 * Fetches the current user based on the provided access token.
 * @returns Promise<User>
 */
export const fetchUser = async (): Promise<User> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request<{ user: User }>('get', `/users/${userId}/info`, {
    userid: userId,
    accessToken: accessToken
  })

  if (!data || error) {
    Log.error(`Error fetching user info: ${error}`)
    process.exit()
  }

  return data.user
}
