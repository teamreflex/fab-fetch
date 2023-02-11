import { RawArtistUser } from './../types/fab';
import { Artist } from "@prisma/client"
import cloneDeep from 'lodash/cloneDeep'
import prisma from "../database"
import { request } from "../http"
import { FabArtistUser, FabMessage, FetchFollowedArtistsResponse, RawGroup, RawMessage } from "../types"
import { getEmoji, getName, Log } from "../util"
import { Parsing } from "./parsing"

/**
 * Fetch all followed artists in one request.
 * @returns Promise<ArtistUser[]>
 */
export const fetchFollowedArtists = async (): Promise<FetchFollowedArtistsResponse> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN
  const { data, error } = await request<{ artistUsers: RawArtistUser[] }>('get', `/users/${userId}/artists`, {
    userid: userId,
    accessToken: accessToken
  })

  if (!data || error) {
    Log.error(`Error fetching followed artists: ${error}`)
    process.exit()
  }

  // parse entities
  const parsed = data.artistUsers.map((artistUser: any) => Parsing.artistUser(artistUser))

  // save to the database or fetch if they already exist
  const dbArtists = await saveOrFetchArtists(parsed)

  // only operate on accounts not terminated
  return {
    fabArtists: parsed.filter(artist => artist.artist.isTerminated === false),
    dbArtists: dbArtists.filter(artist => artist.isTerminated === false),
  };
}

/**
 * Saves artists into the database if they don't exist and returns if they do.
 * @param artistUsers ArtistUser[]
 * @returns Promise<Artist[]>
 */
const saveOrFetchArtists = async (artistUsers: FabArtistUser[]): Promise<Artist[]> => {
  const artists: Artist[] = []
  for (const artistUser of artistUsers) {
    let artist: Artist | null;

    // check if it exists
    artist = await prisma.artist.findFirst({
      where: {
        fabArtistId: artistUser.id,
      }
    })

    // create if it doesn't
    if (!artist) {
      artist = await prisma.artist.create({
        data: {
          fabArtistId: artistUser.id,
          nameEn: getName(artistUser.id, artistUser.artist.enName),
          nameKr: artistUser.artist.name,
          emoji: getEmoji(artistUser.id),
        }
      })
    }

    artists.push(artist)
  }

  return artists
}

/**
 * Fetch all messages for the given artist.
 * @param artistId number
 * @returns Promise<FabMessage[]>
 */
export const fetchArtistMessages = async (artistId: number): Promise<FabMessage[]> => {
  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN
  const { data, error } = await request<{ messages: RawMessage[] }>('get', `/artists/${artistId}/messages`, {
    userid: userId,
    accessToken: accessToken
  })

  if (!data || error) {
    Log.error(`Error fetching artist #${artistId} messages: ${error}`)
    process.exit()
  }

  return data.messages
    .map((message: RawMessage) => Parsing.message(message))
}