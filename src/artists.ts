import { getRepository } from "typeorm";
import { getEmoji } from "./emoji.js";
import { Artist } from "./entity/Artist.js";
import { request } from "./http.js";

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
  artist.artistId = data.group.id // this isn't correct for groups after loona
  artist.nameEn = 'LOONA' // hardcoding this because the real one is "LOOΠΔ" :///
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

