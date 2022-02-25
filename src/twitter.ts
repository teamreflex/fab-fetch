import chalk from 'chalk';
import { getEmoji } from './emoji';
import { DownloadPath, ParsedMessage } from './types';
import { TweetV1, TwitterApi } from 'twitter-api-v2';

export const twitterClient = (): TwitterApi => {
  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY as string,
    appSecret: process.env.TWITTER_API_SECRET as string,
    accessToken: process.env.TWITTER_ACCESS_TOKEN as string,
    accessSecret: process.env.TWITTER_ACCESS_SECRET as string,
  });
}

export const formatTweet = (message: ParsedMessage): string => {
  const date = message.createdAt.toFormat('yyMMdd')
  const time = message.createdAt.toFormat('hh:mma')

  return `[${date}] ${getEmoji(message.user.id)}\n— ${time} KST\n${message.text}`
}

export const postTweet = async (client: TwitterApi, media: DownloadPath[], text: string, isPostcard: boolean) => {
  console.info(chalk.cyan(`Posting to Twitter...`))

  let mediaIds = await Promise.all(
    media
      .filter(media => isPostcard ? media.fullPath.includes('.mp4') : true)
      .map(
        image => client.v1.uploadMedia(image.fullPath)
      )
  );

  // recursively reply to the first tweet until all images are posted
  let lastTweet: TweetV1 | undefined;
  while (mediaIds.length > 0) {
    if (! lastTweet) {
      lastTweet = await client.v1.tweet(text, { media_ids: mediaIds.splice(0, 4) })
    } else {
      lastTweet = await client.v1.reply(text, lastTweet.id_str, { media_ids: mediaIds.splice(0, 4) })
    }
  }
}