import { TwitterApi } from 'twitter-api-v2';
import { formatTweet, postTweet, twitterClient } from './twitter.js';
import { DateTime } from "luxon";
import { getEmoji } from "./emoji.js";
import { Artist } from "./entity/Artist.js";
import { ProfileBanner } from "./entity/ProfileBanner.js";
import { ProfilePicture } from "./entity/ProfilePicture.js";
import { request } from "./http.js";
import { FabUser, TwitterAccount } from "./types.js";
import chalk from 'chalk';
import { downloadImage } from './files.js';
import { AppDataSource } from './data-source.js';

// holy shit this is so ugly
export const loadArtists = async (): Promise<Artist[]> => {
  return await fetchFromRemote()
}

const fetchFromDatabase = async (): Promise<Artist[]> => {
  return await AppDataSource.getRepository(Artist).find();
}

const fetchFromRemote = async (): Promise<Artist[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  // fetch followed artists
  const { data, error } = await request('get', `/users/${userId}/artists`, {
    userid: userId,
    accessToken: accessToken
  })

  const artists: Artist[] = []
  const followedArtists = data.artistUsers
  for (const remoteArtist of followedArtists) {
    const localArtist = await AppDataSource.getRepository(Artist).findOne({
      where: {
        artistId: remoteArtist.id,
      }
    })

    // save new artist
    if (localArtist === null) {
      const artist = new Artist()
      artist.artistId = remoteArtist.id
      artist.nameEn = remoteArtist.artist.enName
      artist.nameKr = remoteArtist.artist.name
      artist.emoji = getEmoji(remoteArtist.id)
      artist.isTerminated = remoteArtist.artist.isTerminated === 'Y'
      await AppDataSource.getRepository(Artist).save(artist)
      artists.push(artist)
    } else {
      // update existing artist
      if (localArtist.isTerminated !== (remoteArtist.artist.isTerminated === 'Y')) {
        localArtist.isTerminated = remoteArtist.artist.isTerminated === 'Y'
        await AppDataSource.getRepository(Artist).save(localArtist)
      }

      artists.push(localArtist)
    }
  }

  return artists
}

const handleProfilePicture = async (user: FabUser, artist: Artist, twitter?: TwitterApi): Promise<void> => {
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = artist.nameEn
  const date = DateTime.now().setZone('Asia/Seoul').toFormat('yyyy-MM')
  let folder = `${downloadFolder}/${name}/profile-pictures`
  if (process.env.MONTHLY_FOLDERS === 'true') {
    folder = `${folder}/${date}`
  }
  const path = `${folder}/${user.profileImage.split('/').pop()}`

  // check if profile picture url exists in the database
  const profilePicture = await AppDataSource.getRepository(ProfilePicture).findOne({
    where: {
      url: user.profileImage
    }
  })

  if (profilePicture) {
    return;
  }

  // if not, save it to the database
  console.info(chalk.green(`Found new profile picture for: ${name}`))
  const newProfilePicture = new ProfilePicture()
  newProfilePicture.artist = artist
  newProfilePicture.createdAt = DateTime.now().toISO()
  newProfilePicture.url = user.profileImage
  newProfilePicture.folder = folder
  newProfilePicture.path = path
  await AppDataSource.getRepository(ProfilePicture).save(newProfilePicture)

  // download the image
  await downloadImage({
    url: user.profileImage,
  }, folder, path)

  // send off to twitter
  if (twitter) {
    let text = formatTweet(DateTime.now().toISO(), artist.emoji)
    text = `${text}\nNew profile picture!`
    await postTweet(twitter, [newProfilePicture], text)
  }
}

const handleProfileBanner = async (user: FabUser, artist: Artist, twitter?: TwitterApi): Promise<void> => {
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = artist.nameEn
  const date = DateTime.now().setZone('Asia/Seoul').toFormat('yyyy-MM')
  let folder = `${downloadFolder}/${name}/profile-banners`
  if (process.env.MONTHLY_FOLDERS === 'true') {
    folder = `${folder}/${date}`
  }
  const path = `${folder}/${user.bannerImage.split('/').pop()}`

  // check if profile banner url exists in the database
  const profileBanner = await AppDataSource.getRepository(ProfileBanner).findOne({
    where: {
      url: user.bannerImage
    }
  })

  if (profileBanner) {
    return;
  }

  // if not, save it to the database
  console.info(chalk.green(`Found new profile banner for: ${name}`))
  const newProfileBanner = new ProfileBanner()
  newProfileBanner.artist = artist
  newProfileBanner.createdAt = DateTime.now().toISO()
  newProfileBanner.url = user.bannerImage
  newProfileBanner.folder = folder
  newProfileBanner.path = path
  await AppDataSource.getRepository(ProfileBanner).save(newProfileBanner)

  // download the image
  await downloadImage({
    url: user.bannerImage,
  }, folder, path)

  // send off to twitter
  if (twitter) {
    let text = formatTweet(DateTime.now().toISO(), artist.emoji)
    text = `${text}\nNew profile banner!`
    await postTweet(twitter, [newProfileBanner], text)
  }
}

export const handleProfile = async (user: FabUser, artist: Artist): Promise<void> => {
  const post = process.env.TWITTER_ENABLED === 'true'
  const twitter = post ? twitterClient(TwitterAccount.PROFILES) : undefined

  await handleProfilePicture(user, artist, twitter)
  await handleProfileBanner(user, artist, twitter)
}