import { Comment } from '@prisma/client'
import chalk from 'chalk'
import prisma from '../database'
import { request } from '../http'
import { CommentType, DownloadResult, FabComment, FabMessage, RawComment, VoiceCommentDownloadResult } from '../types'
import { Log } from '../util'
import { decryptString } from './encryption'
import { downloadImage } from './files'
import { Parsing } from './parsing'

/**
 * Fetches comments for a given message.
 * @param messageId number
 * @returns Promise<FabComment[]>
 */
const fetchCommentThread = async (messageId: number): Promise<FabComment[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN
  const { data, error } = await request<{ comments: RawComment[] }>('get', `users/${userId}/message/${messageId}/ncomments`, {
    userid: userId,
    accessToken: accessToken,
  })

  if (!data || error) {
    Log.error(`Error fetching comments: ${error}`)
    process.exit()
  }

  return data.comments.map(comment => Parsing.comment(comment))
}

/**
 * Setup folder and path for saving audio files.
 * @param comment FabComment
 * @param decryptedUrl string
 * @returns { folder: string, path: string }
 */
export const buildFolderPath = (comment: FabComment, decryptedUrl: string): { folder: string, path: string } => {
  // build folder structure
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = comment.enName
  const date = comment.createdAt.toFormat(process.env.MONTHLY_FOLDERS === 'true' ? 'yyyy-MM' : 'yyMMdd')
  const folder = `${downloadFolder}/${name}/${date}/voice_comments`
  const pathSplit = decryptedUrl.split('/')
  const path = pathSplit[pathSplit.length - 1]

  return { folder, path }
}

/**
 * Save audio file.
 * @param comment FabComment
 * @returns Promise<VoiceCommentDownloadResult>
 */
export const downloadVoiceComment = async (comment: FabComment): Promise<VoiceCommentDownloadResult> => {
  if (!comment.voiceComment) {
    Log.error(`Comment ${comment.id} has no voice audio attached`)
    return { downloadResult: DownloadResult.NOT_FOUND }
  }

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

/**
 * Save comment to the database.
 * @param comment FabComment
 * @param result VoiceCommentDownloadResult
 * @returns Promise<Comment | undefined>
 */
export const saveComment = async (comment: FabComment, result: VoiceCommentDownloadResult): Promise<Comment | undefined> => {
  const message = await prisma.message.findFirst({
    where: {
      fabMessageId: comment.messageId,
    }
  })
  if (!message) {
    Log.error(`Message #${comment.messageId} not found, cannot save voice comment #${comment.id}`)
    return
  }

  return prisma.comment.create({
    data: {
      messageId: message.id,
      fabCommentId: comment.id,
      text: comment.comment,
      voiceMessageUrl: comment.voiceComment,
      path: result.path,
      type: comment.voiceComment ? CommentType.VOICE : CommentType.TEXT,
    }
  })
}

/**
 * Scans messages for voice comments to save.
 * @param messages FabMessage[]
 * @returns Promise<void>
 */
export const scanComments = async (messages: FabMessage[]): Promise<void> => {
  for (const message of messages) {
    const comments = await fetchCommentThread(message.id)

    // filter out anything with no voiceComment
    const filteredVoiceComments = []
    const voiceComments = comments.filter(c => c.voiceComment !== null)

    // and filter out anything that's already been saved
    const inDatabase = await prisma.comment.findMany({
      where: {
        fabCommentId: {
          in: voiceComments.map(vc => vc.id)
        }
      }
    })
    const difference = voiceComments.filter(vc => inDatabase.findIndex(id => id.fabCommentId === vc.id) === -1)
    filteredVoiceComments.push(...difference)

    if (filteredVoiceComments.length === 0) {
      continue;
    }
    
    // download audio files and save to the database
    for (const voiceComment of filteredVoiceComments) {
      const result = await downloadVoiceComment(voiceComment)
      if (result.downloadResult !== DownloadResult.SUCCESS) {
        Log.error(`Error downloading voice comment`)
        continue
      }

      await saveComment(voiceComment, result)
      Log.success(`Saved voice comment from: ${chalk.bold.cyan(voiceComment.enName)}`)
    }
  }
}