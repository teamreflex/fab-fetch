import fetch from "node-fetch"
import { Log } from "../util"
import { Response } from "../types"

const baseUri = process.env.API_URL as string

export const request = async <T>(method: string, path: string, { body, userId, accessToken }: any): Promise<Response<T>> => {
  const version = process.env.FAB_VERSION as string
  const userAgent = (process.env.FAB_USER_AGENT as string).replace('%version%', version)

  try {
    const response = await fetch(`${baseUri}/${path}`, {
      method: method,
      body: body,
      headers: {
        'Content-Type': method === 'post' ? 'application/x-www-form-urlencoded' : 'application/json',
        userid: userId,
        "user-agent": userAgent,
        accesstoken: accessToken
      },
    })
    const data: any = await response.json()

    // handle fab errors
    if (data.error) {
      // handle version mismatch
      if (data.error.error_code === 1002) {
        Log.error('Fab version mismatch, restarting to trigger a version fetch.')
        process.exit()
      }

      return { error: data.error.error_msg }
    }

    return { data: data }
  } catch (e) {
    return { error: e }
  }
}