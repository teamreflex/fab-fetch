import { Log } from '../util';
import { TwitterApi } from 'twitter-api-v2';
import { Artist } from "@prisma/client";
import { client, format, post } from "../social/twitter";
import { FabArtistUser, ImagePath, TwitterAccount } from "../types";
import { DateTime } from 'luxon';
import prisma from '../database';
import { downloadImage } from './files';
import chalk from 'chalk';

/**
 * Handle any profile changes.
 * @param artistUsers ArtistUser[]
 * @param dbArtists Artist[]
 * @returns Promise<void>
 */
export const handleProfileChanges = async (artistUsers: FabArtistUser[], dbArtists: Artist[]): Promise<void> => {
  const post = process.env.TWITTER_ENABLED === 'true'
  const twitter = post ? client(TwitterAccount.PROFILES) : undefined

  const promises: Promise<void>[] = []
  for (const artistUser of artistUsers) {
    const artist = dbArtists.find(artist => artist.fabArtistId === artistUser.id)
    if (!artist) {
      Log.error(`Could not find artist with ID #${artistUser.id} in the database.`)
      continue
    }
    promises.push(
      handleProfilePicture(artistUser, artist, twitter),
      handleProfileBanner(artistUser, artist, twitter)
    )
  }

  await Promise.all(promises)
}

/**
 * Handle any profile picture changes.
 * @param artistUser ArtistUser
 * @param artist Artist
 * @param twitter TwitterApi | undefined
 * @returns Promise<void>
 */
const handleProfilePicture = async (artistUser: FabArtistUser, artist: Artist, twitter?: TwitterApi): Promise<void> => {
  const { folder, path, url } = buildPath(artistUser, false)

  // check if profile picture url exists in the database
  const count = await prisma.profilePicture.count({ where: { url } })
  if (count >= 1) {
    return;
  }

  // if not, save it to the database
  Log.success(`Found new profile picture for: ${chalk.cyan(artistUser.artist.enName)}`)
  await prisma.profilePicture.create({
    data: {
      artistId: artist.id,
      url,
      path,
    }
  })

  // download the image
  const media = await downloadImage({ url }, folder, path)

  // send off to twitter
  if (twitter) {
    let text = format(DateTime.now(), artist.emoji)
    text = `${text}\nNew profile picture!`
    await post(twitter, [media], text)
  }
}

/**
 * Handle any profile banner changes.
 * @param artistUser ArtistUser
 * @param artist Artist
 * @param twitter TwitterApi | undefined
 * @returns Promise<void>
 */
const handleProfileBanner = async (artistUser: FabArtistUser, artist: Artist, twitter?: TwitterApi): Promise<void> => {
  const { folder, path, url } = buildPath(artistUser, true)

  // check if profile banner url exists in the database
  const count = await prisma.profileBanner.count({ where: { url } })
  if (count >= 1) {
    return;
  }

  // if not, save it to the database
  Log.success(`Found new profile banner for: ${chalk.bold.cyan(artistUser.artist.enName)}`)
  await prisma.profileBanner.create({
    data: {
      artistId: artist.id,
      url,
      path,
    }
  })

  // download the image
  const media = await downloadImage({ url }, folder, path)

  // // send off to twitter
  if (twitter) {
    let text = format(DateTime.now(), artist.emoji)
    text = `${text}\nNew profile banner!`
    await post(twitter, [media], text)
  }
}

/**
 * An object containing folder and path information for a profile picture or banner.
 * @param artistUser ArtistUser
 * @param isBanner boolean
 * @returns ImagePath
 */
const buildPath = (artistUser: FabArtistUser, isBanner: boolean): ImagePath => {
  let endFolder = 'profile-pictures'
  let url = artistUser.profileImage
  if (isBanner) {
    endFolder = 'profile-banners'
    url = artistUser.artist.bannerImage
  }

  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = artistUser.artist.enName
  const date = DateTime.now().setZone('Asia/Seoul').toFormat('yyyy-MM')
  let folder = `${downloadFolder}/${name}/${endFolder}`

  if (process.env.MONTHLY_FOLDERS === 'true') {
    folder = `${folder}/${date}`
  }

  const path = `${folder}/${url.split('/').pop()}`

  return { folder, path, url }
}