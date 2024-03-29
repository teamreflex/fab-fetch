import { sleep } from "./functions.js";
import chalk from "chalk";
import { DownloadableImage, TwitterAccount } from "./types.js";
import { TweetV2PostTweetResult, TwitterApi } from "twitter-api-v2";
import { DateTime } from "luxon";

export const twitterClient = (
  account: TwitterAccount = TwitterAccount.ARCHIVE
): TwitterApi | undefined => {
  switch (account) {
    case TwitterAccount.ARCHIVE:
      if (!process.env.TWITTER_ARCHIVE_API_KEY) return undefined;

      return new TwitterApi({
        appKey: process.env.TWITTER_ARCHIVE_API_KEY as string,
        appSecret: process.env.TWITTER_ARCHIVE_API_SECRET as string,
        accessToken: process.env.TWITTER_ARCHIVE_ACCESS_TOKEN as string,
        accessSecret: process.env.TWITTER_ARCHIVE_ACCESS_SECRET as string,
      });
    case TwitterAccount.PROFILES:
      if (!process.env.TWITTER_PROFILES_API_KEY) return undefined;

      return new TwitterApi({
        appKey: process.env.TWITTER_PROFILES_API_KEY as string,
        appSecret: process.env.TWITTER_PROFILES_API_SECRET as string,
        accessToken: process.env.TWITTER_PROFILES_ACCESS_TOKEN as string,
        accessSecret: process.env.TWITTER_PROFILES_ACCESS_SECRET as string,
      });
    default:
      // oh fuggg
      throw new Error(`Unknown Twitter account: ${account}`);
  }
};

export const formatTweet = (createdAt: string, emoji: string): string => {
  const date = DateTime.fromISO(createdAt, { zone: "Asia/Seoul" }).toFormat(
    "yyMMdd"
  );
  const time = DateTime.fromISO(createdAt, { zone: "Asia/Seoul" }).toFormat(
    "hh:mma"
  );

  return `[${date}] ${emoji}\n— ${time} KST`;
};

export const postTweet = async (
  client: TwitterApi,
  images: DownloadableImage[],
  text: string
): Promise<boolean> => {
  if (images.length === 0) {
    return false;
  }

  console.info(chalk.cyan(`Posting to Twitter...`));

  // upload media to twitter
  let mediaIds = await Promise.all(
    images.map((image) => client.v1.uploadMedia(image.path))
  );

  // recursively reply to the first tweet until all images are posted
  let lastTweet: TweetV2PostTweetResult | undefined;
  while (mediaIds.length > 0) {
    if (!lastTweet) {
      lastTweet = await client.v2.tweet(text, {
        media: {
          media_ids: mediaIds.splice(0, 4),
        },
      });
    } else {
      await sleep(5000);
      lastTweet = await client.v2.reply(text, lastTweet.data.id, {
        media: {
          media_ids: mediaIds.splice(0, 4),
        },
      });
    }
  }

  return true;
};
