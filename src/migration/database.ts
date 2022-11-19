import { Artist, Message } from "@prisma/client"
import prisma from "../database"
import { Log } from "../util"

export const saveArtist = async (data: any): Promise<Artist> => {
  return await prisma.artist.create({
    data: {
      fabArtistId: data.artistId,
      nameEn: data.nameEn,
      nameKr: data.nameKr,
      emoji: data.emoji,
    }
  })
}

export const saveProfilePictures = async (artistId: number, data: any[]): Promise<boolean> => {
  const payload = await prisma.profilePicture.createMany({
    data: data.map(d => ({
      artistId: artistId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      url: d.url,
      path: d.path,
      socialPosted: d.twitterPosted === 1,
    }))
  })

  return data.length === payload.count
}

export const saveProfileBanners = async (artistId: number, data: any[]): Promise<boolean> => {
  const payload = await prisma.profileBanner.createMany({
    data: data.map(d => ({
      artistId: artistId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      url: d.url,
      path: d.path,
      socialPosted: d.twitterPosted === 1,
    }))
  })

  return data.length === payload.count
}

export const saveMessages = async (artistId: number, data: any[]): Promise<Message[]> => {
  const payload = await prisma.message.createMany({
    data: data.map(d => ({
      artistId: artistId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      fabMessageId: d.messageId,
      type: d.type,
      socialPosted: d.twitterPosted === 1,
    }))
  })

  if (data.length !== payload.count) {
    Log.error(`Input messages does not match output`)
  }

  return await prisma.message.findMany()
}

export const saveImages = async (data: any[]): Promise<boolean> => {
  const payload = await prisma.image.createMany({
    data: data.map(d => ({
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      messageId: d.messageId,
      url: d.url,
      path: d.path,
    }))
  })

  return data.length === payload.count
}

export const saveComments = async (data: any[]): Promise<boolean> => {
  const payload = await prisma.comment.createMany({
    data: data.map(d => ({
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      messageId: d.messageId,
      fabCommentId: d.commentId,
      path: d.path,
      text: d.text,
      voiceMessageUrl: d.voiceMessageUrl,
      type: d.type,
    }))
  })

  return data.length === payload.count
}