import chalk from "chalk";
import { DateTime } from "luxon";
import { In } from "typeorm";
import { AppDataSource } from "./data-source.js";
import { decryptString } from "./encryption.js";
import { Comment, CommentType } from "./entity/Comment.js";
import { Message } from "./entity/Message.js";
import { downloadImage } from "./files.js";
import { request } from "./http.js";
import { getName } from "./names.js";
import {
  FabComment,
  DownloadResult,
  FabMessage,
  CommentDownloadResult,
} from "./types.js";
import { formatTweet, postTweet, twitterClient } from "./twitter.js";
import { getEmoji } from "./emoji.js";

const fetchCommentThread = async (messageId: number): Promise<FabComment[]> => {
  const userId = process.env.FAB_USER_ID;
  const accessToken = process.env.FAB_ACCESS_TOKEN;

  const { data, error } = await request(
    "get",
    `users/${userId}/message/${messageId}/ncomments`,
    {
      userid: userId,
      accessToken: accessToken,
    }
  );

  if (error) {
    console.info(chalk.red(`Error fetching comments: ${error}`));
    process.exit();
  }

  return data.comments;
};

export const buildFolderPath = (
  comment: FabComment,
  decryptedUrl: string,
  type: "imageComment" | "voiceComment"
) => {
  const dir = type === "voiceComment" ? "voice_comments" : "image_comments";

  // build folder structure
  const downloadFolder = process.env.DOWNLOAD_FOLDER;
  const name = getName(comment.userId, comment.enName);
  const date = DateTime.fromMillis(comment.createdAt, {
    zone: "Asia/Seoul",
  }).toFormat(process.env.MONTHLY_FOLDERS === "true" ? "yyyy-MM" : "yyMMdd");
  const folder = `${downloadFolder}/${name}/${date}/${dir}`;
  const pathSplit = decryptedUrl.split("/");
  const path = pathSplit[pathSplit.length - 1];

  return { folder, path };
};

export const downloadCommentContent = async (
  comment: FabComment,
  type: "imageComment" | "voiceComment"
): Promise<CommentDownloadResult> => {
  const decrypted = decryptString(comment.createdAt, comment[type]);

  const { folder, path } = buildFolderPath(comment, decrypted, type);

  try {
    await downloadImage(
      {
        url: decrypted,
      },
      folder,
      `${folder}/${path}`
    );

    return {
      downloadResult: DownloadResult.SUCCESS,
      url: decrypted,
      folder,
      path,
    };
  } catch (e) {
    return { downloadResult: DownloadResult.CONNECTION_ERROR };
  }
};

export const saveComment = async (
  comment: FabComment,
  downloadResult: CommentDownloadResult,
  type: CommentType
): Promise<Comment> => {
  const dbComment = new Comment();
  dbComment.commentId = comment.id;
  dbComment.createdAt = DateTime.fromMillis(comment.createdAt, {
    zone: "Asia/Seoul",
  }).toISO();
  dbComment.updatedAt = DateTime.fromISO(comment.updatedAt, {
    zone: "Asia/Seoul",
  }).toISO();
  dbComment.type = type;
  dbComment.text = comment.comment;
  dbComment.folder = downloadResult.folder;
  dbComment.path = `${downloadResult.folder}/${downloadResult.path}`;
  dbComment.voiceMessageUrl =
    type === CommentType.VOICE ? downloadResult.url : null;
  dbComment.imageMessageUrl =
    type === CommentType.IMAGE ? downloadResult.url : null;
  dbComment.message = await AppDataSource.getRepository(Message).findOne({
    where: { messageId: comment.messageId },
  });

  return await AppDataSource.getRepository(Comment).save(dbComment);
};

const findRelevantComments = async (
  comments: FabComment[],
  property: keyof FabComment
): Promise<FabComment[]> => {
  const filtered = [];
  const validComments = comments.filter((c) => c[property] !== null);

  for (const validComment of validComments) {
    const inDatabase: Comment[] = await AppDataSource.getRepository(
      Comment
    ).find({
      where: {
        commentId: In(validComments.map((c) => c.id)),
      },
    });
    if (inDatabase.findIndex((c) => c.commentId === validComment.id) === -1) {
      filtered.push(validComment);
    }
  }

  return filtered;
};

export const scanComments = async (messages: FabMessage[]): Promise<void> => {
  if (
    process.env.VOICE_COMMENTS_ENABLED === "false" &&
    process.env.IMAGE_COMMENTS_ENABLED === "false"
  ) {
    return;
  }

  for (const message of messages) {
    const comments = await fetchCommentThread(message.id);

    // process voice comments
    if (process.env.VOICE_COMMENTS_ENABLED === "true") {
      console.info(
        chalk.green(
          `Scanning ${messages.length} messages for voice comments...`
        )
      );

      // fetch all comments with a valid voiceComment field
      const voiceComments = await findRelevantComments(
        comments,
        "voiceComment"
      );

      // download and save voice comments
      for (const voiceComment of voiceComments) {
        const result = await downloadCommentContent(
          voiceComment,
          "voiceComment"
        );
        if (result.downloadResult !== DownloadResult.SUCCESS) {
          console.info(chalk.red(`Error downloading voice comment`));
          continue;
        }
        await saveComment(voiceComment, result, CommentType.VOICE);
        console.info(
          chalk.green(
            "Saved voice comment from:",
            chalk.bold.cyan(voiceComment.enName)
          )
        );
      }
    }

    // process image comments
    if (process.env.IMAGE_COMMENTS_ENABLED === "true") {
      console.info(
        chalk.green(
          `Scanning ${messages.length} messages for image comments...`
        )
      );

      // fetch all comments with a valid imageComment field
      const imageComments = await findRelevantComments(
        comments,
        "imageComment"
      );

      // download and save image comments
      for (const imageComment of imageComments) {
        const result = await downloadCommentContent(
          imageComment,
          "imageComment"
        );
        if (result.downloadResult !== DownloadResult.SUCCESS) {
          console.info(chalk.red(`Error downloading image comment`));
          continue;
        }
        const dbComment = await saveComment(
          imageComment,
          result,
          CommentType.IMAGE
        );
        console.info(
          chalk.green(
            "Saved image comment from:",
            chalk.bold.cyan(imageComment.enName)
          )
        );

        // tweet image
        if (process.env.TWITTER_ENABLED === "true") {
          const twitter = twitterClient(); // use archive account
          let text = formatTweet(
            DateTime.now().toISO(),
            getEmoji(imageComment.userId)
          );
          text = `${text}\nNew image comment!`;
          await postTweet(twitter, [dbComment], text);
        }
      }
    }
  }
};
