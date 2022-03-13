import { createWriteStream, existsSync, mkdirSync } from "fs";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";
import { ParsedMessage, SplitUrl, DownloadableImage, PostcardType, BruteforceAttempt, Media } from "./types.js";
import retry from "async-retry"
import chalk from "chalk";

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
        bail();
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

export const downloadMessage = async (message: ParsedMessage): Promise<boolean> => {
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = message.user.enName
  const date = message.createdAt.toFormat('yyMMdd')
  const folder = `${downloadFolder}/${name}/${date}`

  try {
    const result = await Promise.all(message.media.map(async (media: Media) => {
      const filename = media.url.split('/').pop()
      const path = `${folder}/${filename}`
      return await downloadImage(media, folder, path)
    }))
    return true
  } catch (e) {
    console.info(chalk.bold.red(`Error downloading message #${message.id}: ${e}`))
    return false
  }
}

const checkForValidImage = async (url: string): Promise<BruteforceAttempt> => {
  console.log('bruteforce:', url)
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

  return {
    base: baseUrl,
    timestamp: Number(timestamp),
    date: parts[1],
    imageNumber: Number(parts[2]),
    extension: parts[3],
  }
}

export const bruteforceImages = async (message: ParsedMessage): Promise<ParsedMessage> => {
  const foundMedia: Media[] = []
  // fab only sends the first image when it isn't pulled from the individual message endpoint
  let { base, timestamp, date, imageNumber, extension } = parseUrl(message.media[0].url)

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
        failures = 5
      }
    } else {
      // if the imageNumber increase fails, try a timestamp change
      // if it's a postcard, decrease by 1, otherwise increase by 1
      if (message.isPostcard) {
        timestamp--
      } else {
        timestamp++
      }
      failures++
    }

    // bail out if we've failed twice, as it means a timestamp + 1 AND imageNumber + 1 has failed
    // this means either:
    // - we've found all the images
    // - the image url structure has deviated from the expected pattern
    if (failures < 2) {
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

