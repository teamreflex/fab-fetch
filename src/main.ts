import chalk from "chalk";
import { login, userInfo } from "./auth.js";
import { AppDataSource } from "./data-source.js";
import { Message } from "./entity/Message.js";
import { saveMessages } from "./messages.js";
import { formatTweet, postTweet, twitterClient } from "./twitter.js";
import { User } from "./types.js";

export const startup = async (): Promise<User> => {
  if (!process.env.FAB_ACCESS_TOKEN) {
    const { user } = await login();
    return user;
  } else {
    console.info(chalk.green("Using access token..."));
    return await userInfo();
  }
};

export const main = async (postToSocial: boolean) => {
  let twitter: any = null;
  if (postToSocial) {
    twitter = twitterClient();
  }

  // fetch messages and filter them
  const messages = await saveMessages();

  // tweet if necessary
  for (const message of messages) {
    // tweet
    if (postToSocial) {
      await postTweet(
        twitter,
        message.images,
        formatTweet(message.createdAt, message.memberEmoji)
      );

      // mark message as posted
      message.twitterPosted = true;
      await AppDataSource.getRepository(Message).save(message);
    }
  }
};
