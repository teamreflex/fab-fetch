import { createWriteStream, existsSync, mkdirSync } from "fs";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";
import { ParsedMessage, SplitUrl, DownloadableImage, PostcardType, BruteforceAttempt, Media, DownloadResult } from "./types.js";
import retry from "async-retry"
import chalk from "chalk";
import { DateTime } from "luxon";

const makeFolder = (folder: string) => {
  return !existsSync(folder) && mkdirSync(folder, { recursive: true })
}

export const downloadImage = async (media: Media, folder: string, path: string): Promise<any> => {
  makeFolder(folder)

  const streamPipeline = promisify(pipeline);

  return await retry(
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
        return;
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
}

export const downloadMessage = async (message: ParsedMessage): Promise<DownloadResult> => {
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = message.user.enName
  const date = message.createdAt.toFormat(process.env.MONTHLY_FOLDERS === 'true' ? 'yyyy-MM' : 'yyMMdd')
  const folder = `${downloadFolder}/${name}/${date}`

  try {
    const result = await Promise.all(message.media.map(async (media: Media) => {
      const filename = media.url.split('/').pop()
      const path = `${folder}/${filename}`
      const res = await downloadImage(media, folder, path)
      return !!res ? DownloadResult.SUCCESS : DownloadResult.CONNECTION_ERROR
    }))
    return DownloadResult.SUCCESS
  } catch (e) {
    if ((e as string).includes('404')) {
      console.info(chalk.bold.yellow(`Skipping message #${message.id} due to no images`))
      return DownloadResult.NOT_FOUND
    }
    return DownloadResult.CONNECTION_ERROR
  }
}

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

const parseUrl = (url: string): SplitUrl => {
  const parts = url.split('_')
  const baseUrl = parts[0].substring(0, parts[0].lastIndexOf("/") + 1);
  const timestamp = parts[0].substring(parts[0].lastIndexOf("/") + 1, parts[0].length);

  const usingThumbnail = parts[2] === 't.jpg'

  return {
    base: baseUrl,
    timestamp: Number(timestamp),
    date: Number(parts[1]),
    imageNumber: usingThumbnail ? 1 : Number(parts[2]),
    extension: usingThumbnail ? parts[2] : parts[3],
  }
}

export const deriveUrl = (timestamp: number, letterId: number): string => {
  const time = DateTime.fromMillis(timestamp, { zone: 'Asia/Seoul' });
  return `https://dnkvjm1f8biz3.cloudfront.net/images/letter/${letterId}/${time.toFormat('X')}_${time.toFormat('yyyyMMddHHmmss')}_1_f.jpg`
}

export const bruteforceImages = async (message: ParsedMessage): Promise<ParsedMessage> => {
  const foundMedia: Media[] = []
  // fab only sends the first image when it isn't pulled from the individual message endpoint
  let { base, timestamp, date, imageNumber, extension } = parseUrl(message.media[0].url)

  // t.jpg indicates we're using a thumbnail as the base url
  const usingThumbnail = extension === 't.jpg'
  if (usingThumbnail) {
    extension = 'f.jpg'
  }

  // if the image is a postcard thumbnail, we need to adjust what we're checking
  if (message.isPostcard) {
    extension = message.postcardType === PostcardType.IMAGE ? 'f.jpg' : 'f.mp4'
  }

  let failures = 0
  const check = async () => {
    let url = `${base}${timestamp}_${date}_${imageNumber}_${extension}`

    if (message.isPostcard) {
      url = `${base}${timestamp}_${date}_${extension}`
    }

    const attempt = await checkForValidImage(url)
    if (attempt.success) {
      // found an image, check for next one
      foundMedia.push({
        url: url,
        stream: attempt.stream
      })
      imageNumber++

      if (message.isPostcard) {
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
      if (foundMedia.length === 0 && usingThumbnail === false && message.isPostcard === false) {
        const convertedDate = DateTime.fromFormat(String(date), 'yyyyMMddHHmmss')
        date = Number(convertedDate.minus({ seconds: 1 }).toFormat('yyyyMMddHHmmss'))
      } else {
        // try increasing the timestamp
        // if it's a postcard, decrease by 1, otherwise increase by 1
        timestamp += message.isPostcard || (usingThumbnail && foundMedia.length === 0) ? -1 : 1
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

  // if we've found images, replace the existing media with the found urls
  if (foundMedia.length > 0) {
    message.media = foundMedia
  }

  return message
}

