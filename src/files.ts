import { createWriteStream, existsSync, mkdirSync } from "fs";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";
import { DownloadPath, ParsedMessage, SplitUrl } from "./types";
import retry from "async-retry"
import { DateTime } from "luxon";

export const makeFolder = (folder: string) => {
  return !existsSync(folder) && mkdirSync(folder, { recursive: true })
}

export const fileExists = (path: string): boolean => {
  return existsSync(path)
}

export const downloadImage = async (path: DownloadPath): Promise<any> => {
  makeFolder(path.folder)

  const streamPipeline = promisify(pipeline);

  return await retry(
    async (bail: Function) => {
      const response = await fetch(path.url);
  
      if (response.status === 403) {
        // don't retry upon 403, means image doesn't exist
        bail();
        return;
      }
  
      if (response.body !== null) {
        return await streamPipeline(response.body, createWriteStream(path.fullPath));
      } else {
        return false
      }
    },
    {
      retries: 3,
    }
  );
}

export const buildPath = (name: string, date: string, imageUrl: string): DownloadPath => {
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const filename = imageUrl.split('/').pop()

  return {
    url: imageUrl,
    folder: `${downloadFolder}/${name}/${date}`,
    fullPath: `${downloadFolder}/${name}/${date}/${filename}`
  } as DownloadPath
}

export const buildDownloadables = (message: ParsedMessage): DownloadPath[] => {
  return message.media.map(url => {
    return buildPath(
      message.user.enName,
      message.createdAt.toFormat('yyMMdd'),
      url,
    )
  })
}

const checkForValidImage = async (url: string): Promise<boolean> => {
  const response = await fetch(url);
  return response.status === 200
}

const parseUrl = (url: string): SplitUrl => {
  const parts = url.split('_')
  const baseUrl = parts[0].substring(0, parts[0].lastIndexOf("/") + 1);
  const timestamp = parts[0].substring(parts[0].lastIndexOf("/") + 1, parts[0].length);

  return {
    base: baseUrl,
    timestamp: Number(timestamp),
    date: Number(parts[1]),
    imageNumber: Number(parts[2]),
    extension: parts[3],
  }
}

export const bruteforceImages = async (message: ParsedMessage): Promise<ParsedMessage> => {
  const foundUrls: string[] = []
  // fab only sends the first image when it isn't pulled from the individual message endpoint
  let { base, timestamp, date, imageNumber, extension } = parseUrl(message.media[0])

  // if the image is a postcard thumbnail, we need to adjust what we're checking
  const isPostcard = message.media[0].includes('_b.jpg')
  if (isPostcard) {
    extension = 'f.mp4'
  }

  let failures = 0
  let dateDecreased = false
  const check = async () => {
    let url = `${base}${timestamp}_${date}_${imageNumber}_${extension}`

    if (isPostcard) {
      url = `${base}${timestamp}_${date}_${extension}`
    }

    const exists = await checkForValidImage(url)
    if (exists) {
      // found an image, check for next one
      foundUrls.push(url)
      imageNumber++

      if (isPostcard) {
        // we've found our .mp4, time to bail out
        failures = 5
      }
      failures = 0
      // console.log(`Found image:`, url)
    } else {
      // first failure, try decreasing the date, because we have to rely on deriving urls now
      // only want to do this once and only after before finding anything
      if (failures === 0 && dateDecreased === false && foundUrls.length === 0) {
        date--
        dateDecreased = true
      }

      // second failure, try increasing the timestamp
      // if it's a postcard, decrease by 1, otherwise increase by 1
      if (failures > 0) {
        timestamp += isPostcard ? -1 : 1
      }

      failures++
      // console.log(`Failed image:`, url)
    }

    // bail out if we've failed three times, as it means a timestamp increase/decrease, date decrease AND imageNumber + 1 has failed
    // this means either:
    // - we've found all the images
    // - the image url structure has deviated from the expected pattern
    if (failures < 3) {
      await check()
    }
  }

  // start recursive image checks
  await check()

  // if we've found images, replace the existing media with the found urls
  if (foundUrls.length > 0) {
    if (isPostcard) {
      message.media = message.media.concat(foundUrls)
    } else {
      message.media = foundUrls
    }
  }

  return message
}

export const deriveUrl = (timestamp: number, letterId: number): string => {
  const time = DateTime.fromMillis(timestamp, { zone: 'Asia/Seoul' });
  return `https://dnkvjm1f8biz3.cloudfront.net/images/letter/${letterId}/${time.toFormat('X')}_${time.toFormat('yyyyMMddHHmmss')}_1_f.jpg`
}