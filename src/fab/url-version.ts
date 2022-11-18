import { SplitUrl, URLVersion } from "../types";
import { Log } from "../util";

/**
 * Parse a URL based on the v1 type.
 * @param url string
 * @returns SplitUrl
 */
export const parseV1Url = (url: string): SplitUrl => {
  const parts = url.split('_')
  const baseUrl = parts[0].substring(0, parts[0].lastIndexOf("/") + 1);
  const timestamp = parts[0].substring(parts[0].lastIndexOf("/") + 1, parts[0].length);

  const usingThumbnail = parts[2] === 't.jpg'

  return {
    version: URLVersion.V1,
    base: baseUrl,
    timestamp: Number(timestamp),
    date: Number(parts[1]),
    imageNumber: usingThumbnail ? 1 : Number(parts[2]),
    extension: usingThumbnail ? parts[2] : parts[3],
  }
}

/**
 * Parse a URL based on the v2 type.
 * @param url string
 * @returns SplitUrl
 */
export const parseV2Url = (url: string): SplitUrl => {
  const parts = url.split('_')
  const baseUrl = parts[0].substring(0, parts[0].lastIndexOf("/") + 1);
  const timestamp = parts[0].substring(parts[0].lastIndexOf("/") + 1, parts[0].length);

  const extension = parts[1].replace(/[0-9]/g, '')
  const usingThumbnail = ['b.jpg', 't.jpg'].includes(extension)

  // match the first 14 digits
  let datetime = ''
  if (usingThumbnail) {
    const match = parts[1].match(/\d{14,}/g)
    if (!match) {
      Log.error(`Could not find datetime in v2 URL: ${url}`)
      process.exit()
    }
    datetime = match[0]
  } else {
    datetime = parts[1]
  }
  const imageNumber = usingThumbnail ? 1 : parts[1].substring(0, parts[1].length - 4)

  return {
    version: URLVersion.V2,
    base: baseUrl,
    timestamp: Number(timestamp),
    date: Number(datetime),
    imageNumber: Number(imageNumber),
    extension: extension
  }
}

/**
 * Build a URL using its split parts.
 * @param param0 SplitUrl
 * @param isPostcard boolean
 * @returns string
 */
export const buildUrl = ({ version, base, timestamp, date, imageNumber, extension }: SplitUrl, isPostcard: boolean): string => {
  const underscore = version === URLVersion.V1 ? '_' : ''

  if (isPostcard) {
    return `${base}${timestamp}_${date}${underscore}${extension}`
  }

  return `${base}${timestamp}_${date}_${imageNumber}${underscore}${extension}`
}