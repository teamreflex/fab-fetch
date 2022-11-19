import { saveArtist, saveProfilePictures, saveProfileBanners, saveMessages, saveImages, saveComments } from './database'
import Database from 'better-sqlite3'
import { Log } from '../util'
import { MessageType } from '../types'
import chalk from 'chalk'

const db = new Database('database.sqlite', { readonly: true })
Log.success('Connected to the sqlite database')

const images = await db.prepare(`select * from image`).all()
const comments = await db.prepare(`select * from comment`).all()

const oldArtists = await db.prepare(`select * from artist`).all()
for (const oldArtist of oldArtists) {
  Log.info(`Migrating artist ${chalk.yellow(oldArtist.nameEn)}...`)
  const newArtist = await saveArtist(oldArtist)

  // migrate profile pictures
  Log.info(`Migrating profile pictures...`)
  const profilePictures = await db.prepare(`select * from profile_picture where artistId = ${oldArtist.id}`).all()
  await saveProfilePictures(newArtist.id, profilePictures)

  // migrate profile banners
  Log.info(`Migrating profile banners...`)
  const profileBanners = await db.prepare(`select * from profile_banner where artistId = ${oldArtist.id}`).all()
  await saveProfileBanners(newArtist.id, profileBanners)
  
  // migrate messages
  Log.info(`Migrating messages...`)
  let messages = await db.prepare(`select * from message where artistId = ${oldArtist.id}`).all()
  // figure out message type based on whats in the image urls
  messages = messages.map(message => {
    let messageType = MessageType.LETTER
    const firstImage = images.find(image => image.messageId === message.id)
    if (firstImage.url.includes('postcard')) {
      if (firstImage.url.includes('mp4')) {
        messageType = MessageType.POSTCARD_VIDEO
      } else {
        messageType = MessageType.POSTCARD_IMAGE
      }
    }

    return {
      ...message,
      type: messageType,
    }
  })
  const newMessages = await saveMessages(newArtist.id, messages)

  // migrate images
  Log.info(`Migrating images...`)
  const imagesForArtist = images.filter(image => messages.map(m => m.id).includes(image.messageId))
  const mappedImages = imagesForArtist.map(image => {
    const oldMessage = messages.find(message => message.id === image.messageId)
    const newMessage = newMessages.find(message => message.fabMessageId === oldMessage.messageId)

    return {
      ...image,
      messageId: newMessage?.id
    }
  })
  await saveImages(mappedImages)

  // migrate comments
  Log.info(`Migrating comments...`)
  const commentsForArtist = comments.filter(image => messages.map(m => m.id).includes(image.messageId))
  const mappedComments = commentsForArtist.map(comment => {
    const oldMessage = messages.find(message => message.id === comment.messageId)
    const newMessage = newMessages.find(message => message.fabMessageId === oldMessage.messageId)

    return {
      ...comment,
      messageId: newMessage?.id
    }
  })
  await saveComments(mappedComments)

  Log.success(`Migration complete!`)
}
Log.success(`All data migrated!`)