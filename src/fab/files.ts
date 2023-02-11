import { createWriteStream, existsSync, mkdirSync } from "fs";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";
import retry from "async-retry"
import { DateTime } from "luxon";
import { BruteforceAttempt, DerivedURL, DownloadResponse, DownloadResult, FabMessage, Media, MessageType, SavedMedia, SplitUrl, URLVersion, URLVersion1Regex, URLVersion2Regex } from "../types";
import { Log } from "../util";
import { availableRegex, buildUrl, parseV1Url, parseV2Url } from "./url-version";

/**
 * Recursively make the given folder.
 * @param folder string
 * @returns boolean
 */
export const makeFolder = (folder: string) => {
  return !existsSync(folder) && mkdirSync(folder, { recursive: true })
}

/**
 * Downloads a single image.
 * @param media Media
 * @param folder string
 * @param path string
 * @returns Promise<SavedMedia>
 */
export const downloadImage = async (media: Media, folder: string, path: string): Promise<SavedMedia> => {
  makeFolder(folder)

  const streamPipeline = promisify(pipeline);

  const result = await retry(
    async (bail: Function) => {
      // media was bruteforced
      if (media.stream) {
        return await streamPipeline(media.stream, createWriteStream(path));
      }

      // media was not bruteforced, downloading from url
      const response = await fetch(media.url);
      if (response.status === 403) {
        // don't retry upon 403, means image doesn't exist
        bail('404');
        return false;
      }
  
      if (response.body !== null) {
        return await streamPipeline(response.body, createWriteStream(path));
      } else {
        return false
      }
    },
    {
      retries: 3,
    }
  );

  if (result === void 0) {
    return {
      ...media,
      path: path,
    }
  }

  Log.error(`Failed to download image: ${media.url}`)
  process.exit()
}

/**
 * Downloads all the media for a message.
 * @param message FabMessage
 * @param media Media[]
 * @returns Promise<DownloadResponse>
 */
export const downloadMessage = async (message: FabMessage, unsavedMedia: Media[]): Promise<DownloadResponse> => {
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = message.enName
  const date = message.createdAt.toFormat(process.env.MONTHLY_FOLDERS === 'true' ? 'yyyy-MM' : 'yyMMdd')
  const folder = `${downloadFolder}/${name}/${date}`

  try {
    const savedMedia = await Promise.all(unsavedMedia.map(async (media: Media): Promise<SavedMedia> => {
      const filename = media.url.split('/').pop()
      const path = `${folder}/${filename}`
      return await downloadImage(media, folder, path)
    }))

    return {
      result: DownloadResult.SUCCESS,
      media: savedMedia,
    }
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes('404')) {
        Log.warning(`Skipping message #${message.id} due to no images`)
        return {
          result: DownloadResult.NOT_FOUND,
          media: [],
        }
      }
    } else {
      Log.error(e as string)
    }
    
    return {
      result: DownloadResult.CONNECTION_ERROR,
      media: [],
    }
  }
}

/**
 * Checks the given URL to see if an image exists, and caches the stream if it does.
 * @param url string
 * @returns Promise<BruteforceAttempt>
 */
const checkForValidImage = async (url: string): Promise<BruteforceAttempt> => {
  const response = await fetch(url);
  
  if (response.status === 200 && response.body !== null) {
    return {
      success: true,
      stream: response.body
    }
  } else {
    return { success: false }
  }
}

/**
 * Detects the version of the image URL.
 * @param url string
 * @param messageId number
 * @returns URLVersion
 */
const getUrlVersion = (url: string, messageId: number): URLVersion => {
  for (const regex of availableRegex) {
    if (regex.test.test(url)) {
      return regex.version
    }
  }

  throw new Error(`Unknown URL version found: #${messageId} - ${url}`)
}

/**
 * Parse the given URL for bruteforcing.
 * @param url string
 * @param messageId number
 * @param version URLVersion | undefined
 * @returns SplitUrl
 */
export const parseUrl = (url: string, messageId: number, version?: URLVersion): SplitUrl => {
  // allow a pre-set URL version (ie; for derived URLs)
  if (!version) {
    version = getUrlVersion(url, messageId)
  }

  switch (version) {
    case URLVersion.V1:
      return parseV1Url(url)
    case URLVersion.V2:
      return parseV2Url(url)
    default:
      Log.error(`Could not determine URL version for message #${messageId}.`)
      process.exit()
  }
}

/**
 * Build an image URL based on the message timestamp.
 * @param timestamp number
 * @param letterId number
 * @returns string
 */
export const deriveUrl = (timestamp: number, letterId: number): DerivedURL => {
  const time = DateTime.fromMillis(timestamp, { zone: 'Asia/Seoul' })
  let extension = '_1_f.jpg'
  let version = URLVersion.V1
  // extensions changed after letterId 2994 (messageId 3565)
  if (letterId >= 2994) {
    extension = '_1f.jpg'
    version = URLVersion.V2
  }
  return {
    url: `https://dnkvjm1f8biz3.cloudfront.net/images/letter/${letterId}/${time.toFormat('X')}_${time.toFormat('yyyyMMddHHmmss')}${extension}`,
    version,
  }
}

/**
 * Recursively search CloudFront URLs for existing media files.
 * @param message FabMessage
 * @param media Media[]
 * @returns Promise<Media[]>
 */
export const bruteforceImages = async (message: FabMessage, media: Media[]): Promise<Media[]> => {
  const foundMedia: Media[] = []

  // if there's no media to start with, derive the URL from the message timestamp
  let derivedVersion: URLVersion | undefined
  if (media.length === 0 && message.letter) {
    const { url, version } = deriveUrl(message.createdAt.toMillis(), message.letter.id)
    media.push({ url })
    derivedVersion = version
  }

  // fab only sends the first image when it isn't pulled from the individual message endpoint
  let { version, base, timestamp, date, imageNumber, extension } = parseUrl(media[0].url, message.id, derivedVersion)

  // t.jpg indicates we're using a thumbnail as the base url
  const usingThumbnail = extension === 't.jpg'
  if (usingThumbnail) {
    extension = 'f.jpg'
  }

  // if the image is a postcard thumbnail, we need to adjust what we're checking
  if (message.postcard) {
    extension = message.messageType === MessageType.POSTCARD_IMAGE ? 'f.jpg' : 'f.mp4'
  }

  let failures = 0
  const check = async () => {
    // build the url as there's different versions
    const url = buildUrl({ version, base, timestamp, date, imageNumber, extension }, message.postcard !== undefined)

    const attempt = await checkForValidImage(url)
    if (attempt.success) {
      // found an image, check for next one
      foundMedia.push({
        url: url,
        stream: attempt.stream
      })
      imageNumber++

      if (message.postcard !== undefined) {
        // we've found our .mp4, time to bail out
        failures = 10
      } else {
        // reset upon finding a valid url
        failures = 0
      }
      // console.log(`Found image:`, url)
    } else {
      // try decreasing the date, because we have to rely on deriving urls now
      // only want to do this before finding anything and if we're not using the thumbnail url and not on postcards
      // convert back and from the timestamp so seconds are decremented properly
      if (foundMedia.length === 0 && usingThumbnail === false && message.postcard === undefined) {
        const convertedDate = DateTime.fromFormat(String(date), 'yyyyMMddHHmmss')
        date = Number(convertedDate.minus({ seconds: 1 }).toFormat('yyyyMMddHHmmss'))
      } else {
        // try increasing the timestamp
        // if it's a postcard, decrease by 1, otherwise increase by 1
        timestamp += message.postcard !== undefined || (usingThumbnail && foundMedia.length === 0) ? -1 : 1
      }

      failures++
      // console.log(`Failed image:`, url)
    }

    // set the maximum failures to 5 when checking the datetime, as it's only able to get within 1-3~ tries
    // otherwise make it 2
    const maximumFailures = foundMedia.length === 0 ? 5 : 2
    // bail out if we've failed five times, as it means a timestamp decrement/increment, date decrement AND imageNumber increment have all failed
    // this means either:
    // - we've found all the images
    // - the image url structure has deviated from the expected pattern
    if (failures < maximumFailures) {
      await check()
    }
  }

  // start recursive image checks
  await check()

  // return any found images
  return foundMedia
}