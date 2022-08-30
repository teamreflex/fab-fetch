import chalk from 'chalk'
import { DateTime } from 'luxon'
import { In } from 'typeorm'
import { AppDataSource } from './data-source.js'
import { decryptString } from './encryption.js'
import { Comment, CommentType } from './entity/Comment.js'
import { Message } from './entity/Message.js'
import { downloadImage } from './files.js'
import { request } from './http.js'
import { FabComment, DownloadResult, FabMessage, VoiceCommentDownloadResult } from './types.js'

const fetchCommentThread = async (messageId: number): Promise<FabComment[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request('get', `users/${userId}/message/${messageId}/ncomments`, {
    userid: userId,
    accessToken: accessToken,
  })

  if (error) {
    console.info(chalk.red(`Error fetching comments: ${error}`))
    process.exit()
  }

  return data.comments.map(c => {
    return {
      ...c,
      createdAt: DateTime.fromMillis(c.createdAt),
      updatedAt: DateTime.fromISO(c.updatedAt),
    }
  })
}

export const buildFolderPath = (comment: FabComment, decryptedUrl: string) => {
  // build folder structure
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = comment.enName
  const date = comment.createdAt.toFormat(process.env.MONTHLY_FOLDERS === 'true' ? 'yyyy-MM' : 'yyMMdd')
  const folder = `${downloadFolder}/${name}/${date}/voice_comments`
  const pathSplit = decryptedUrl.split('/')
  const path = pathSplit[pathSplit.length - 1]

  return { folder, path }
}

export const downloadVoiceComment = async (comment: FabComment): Promise<VoiceCommentDownloadResult> => {
  const decrypted = decryptString(comment.createdAt.toMillis(), comment.voiceComment)

  const { folder, path } = buildFolderPath(comment, decrypted)

  try {
    await downloadImage({
      url: decrypted,
    }, folder, `${folder}/${path}`)

    return {
      downloadResult: DownloadResult.SUCCESS,
      url: decrypted,
      folder,
      path,
    }
  } catch (e) {
    return { downloadResult: DownloadResult.CONNECTION_ERROR }
  }
}

export const saveComment = async (comment: FabComment, downloadResult: VoiceCommentDownloadResult): Promise<Comment> => {
  const dbComment = new Comment()
  dbComment.commentId = comment.id
  dbComment.createdAt = comment.createdAt.toISO()
  dbComment.updatedAt = comment.updatedAt.toISO()
  dbComment.type = comment.voiceComment ? CommentType.VOICE : CommentType.TEXT
  dbComment.text = comment.comment
  dbComment.folder = downloadResult.folder
  dbComment.path = downloadResult.path
  dbComment.voiceMessageUrl = downloadResult.url
  dbComment.message = await AppDataSource.getRepository(Message).findOne({ where: { messageId: comment.messageId } })

  return await AppDataSource.getRepository(Comment).save(dbComment)
}

export const scanComments = async (messages: FabMessage[]): Promise<void> => {
  for (const message of messages) {
    const comments = await fetchCommentThread(message.id)
    // filter out anything with no voiceComment and anything that's already been saved
    const filteredVoiceComments = []
    const voiceComments = comments.filter(c => c.voiceComment !== null)
    // not sure why async filters aren't working here but ok
    for (const voiceComment of voiceComments) {
      const inDatabase: Comment[] = await AppDataSource.getRepository(Comment).find({
        where: {
          commentId: In(voiceComments.map(c => c.id))
        }
      })
      if (inDatabase.findIndex(c => c.commentId === voiceComment.id) === -1) {
        filteredVoiceComments.push(voiceComment)
      }
    }

    if (filteredVoiceComments.length === 0) {
      continue;
    }
    
    for (const voiceComment of filteredVoiceComments) {
      const result = await downloadVoiceComment(voiceComment)
      if (result.downloadResult !== DownloadResult.SUCCESS) {
        console.info(chalk.red(`Error downloading voice comment`))
        continue
      }
      await saveComment(voiceComment, result)
      console.info(chalk.green('Saved voice comment from:', chalk.bold.cyan(voiceComment.enName)))
    }
  }
}