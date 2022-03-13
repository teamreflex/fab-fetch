import { TwitterApi } from 'twitter-api-v2';
import { formatTweet, postTweet, twitterClient } from './twitter.js';
import { DateTime } from "luxon";
import { getRepository } from "typeorm";
import { getEmoji } from "./emoji.js";
import { Artist } from "./entity/Artist.js";
import { ProfileBanner } from "./entity/ProfileBanner.js";
import { ProfilePicture } from "./entity/ProfilePicture.js";
import { request } from "./http.js";
import { FabUser, TwitterAccount } from "./types.js";
import chalk from 'chalk';
import { downloadImage } from './files.js';

// holy shit this is so ugly

export const loadArtists = async (): Promise<Artist[]> => {
  let artists = await fetchFromDatabase();
  if (artists.length === 0) {
    artists = await fetchFromRemote()
  }

  return artists
}

const fetchFromDatabase = async (): Promise<Artist[]> => {
  return await getRepository(Artist).find();
}

const fetchFromRemote = async (): Promise<Artist[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN

  const { data, error } = await request('get', `/groups/1`, {
    userid: userId,
    accessToken: accessToken
  })

  const artists: Artist[] = []

  // add the loona user first
  const artist = new Artist()
  artist.artistId = data.group.id // this doesn't send the group's userId, but loona just happens to be groupId === 1 and userId === 1
  artist.nameEn = 'LOONA' // hardcoding this because the real one is "LOOΠΔ" :/
  artist.nameKr = data.group.name
  artist.emoji = getEmoji(data.group.id)
  await getRepository(Artist).save(artist)
  artists.push(artist)

  // then the members
  for (const artistUser of data.group.artistUsers) {
    const artist = new Artist()
    artist.artistId = artistUser.id
    artist.nameEn = artistUser.artist.enName
    artist.nameKr = artistUser.artist.name
    artist.emoji = getEmoji(artistUser.id)
    await getRepository(Artist).save(artist)
    artists.push(artist)
  }

  return artists
}

const handleProfilePicture = async (user: FabUser, artist: Artist, twitter?: TwitterApi): Promise<void> => {
  const downloadFolder = process.env.DOWNLOAD_FOLDER
  const name = artist.nameEn
  const folder = `${downloadFolder}/${name}/profile-pictures`
  const path = `${folder}/${user.profileImage.split('/').pop()}`

  // check if profile picture url exists in the database
  const profilePicture = await getRepository(ProfilePicture).findOne({
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
  await getRepository(ProfilePicture).save(newProfilePicture)

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
  const folder = `${downloadFolder}/${name}/profile-banners`
  const path = `${folder}/${user.profileImage.split('/').pop()}`

  // check if profile banner url exists in the database
  const profileBanner = await getRepository(ProfileBanner).findOne({
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
  await getRepository(ProfileBanner).save(newProfileBanner)

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