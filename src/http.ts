import chalk from "chalk"
import fetch from "node-fetch"
import { Response } from "./types.js"
import * as cheerio from 'cheerio'

const baseUri = process.env.API_URL as string

export const request = async (method: string, path: string, { body, userId, accessToken }: any): Promise<Response> => {
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
        console.info(chalk.red.bold('Fab version mismatch, restarting to trigger a version fetch.'))
        process.exit()
      }

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

export const fetchFabVersion = async (): Promise<string> => {
  const fabUrl = process.env.FAB_PLAYSTORE as string

  const response = await fetch(fabUrl)
  const $ = cheerio.load(await response.text())

  let version = (process.env.FAB_VERSION as string)

  try {
    version = $($('.htlgb').get(6)).text()
  } catch (e) {
    console.info(chalk.red('Error fetching Fab version from Play Store:', chalk.bold(e)))
  }

  return version
}