import fetch from "node-fetch"
import { Response } from "./types"

const baseUri = process.env.API_URL as string

export const request = async (method: string, path: string, { body, userId, accessToken }: any): Promise<Response> => {
  try {
    const response = await fetch(`${baseUri}/${path}`, {
      method: method,
      body: body,
      headers: {
        'Content-Type': method === 'post' ? 'application/x-www-form-urlencoded' : 'application/json',
        userid: userId,
        "user-agent": process.env.FAB_USER_AGENT as string,
        accesstoken: accessToken
      },
    })
    const data: any = await response.json()

    // handle fab errors
    if (data.error) {
      return {
        error: data.error.error_msg
      } as Response
    }

    return {
      data: data,
    } as Response
  } catch (e) {
    return {
      error: e,
    } as Response
  }
}