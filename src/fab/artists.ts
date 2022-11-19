import { Artist } from "@prisma/client"
import cloneDeep from 'lodash/cloneDeep'
import prisma from "../database"
import { request } from "../http"
import { FabArtistUser, FabMessage, FetchGroupResponse, RawGroup, RawMessage } from "../types"
import { getEmoji, Log } from "../util"
import { Parsing } from "./parsing"

/**
 * Fetch all group members in one request.
 * @returns Promise<ArtistUser[]>
 */
export const fetchGroupMembers = async (): Promise<FetchGroupResponse> => {
  const groupId = Number(process.env.GROUP_ID)
  if (!groupId) {
    Log.error('Group ID is invalid. Please check your .env file.')
    process.exit()
  }

  const userId = process.env.FAB_USER_ID
  const accessToken = process.env.FAB_ACCESS_TOKEN
  const { data, error } = await request<{ group: RawGroup }>('get', `/groups/${groupId}`, {
    userid: userId,
    accessToken: accessToken
  })

  if (!data || error) {
    Log.error(`Error fetching group members: ${error}`)
    process.exit()
  }

  // parse entities
  const parsed = data.group.artistUsers.map((artistUser: any) => Parsing.artistUser(artistUser))

  // handle the group account
  const groupUser = cloneDeep(parsed[0])
  groupUser.id = data.group.id
  groupUser.nickName = data.group.enName
  groupUser.artist.name = data.group.name
  groupUser.artist.enName = data.group.enName
  groupUser.artist.bannerImage = data.group.bannerImage
  groupUser.profileImage = data.group.profileImage

  // save to the database or fetch if they already exist
  const dbArtists = await saveOrFetchArtists([groupUser, ...parsed])

  return {
    fabArtists: [groupUser, ...parsed],
    dbArtists,
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
          nameEn: artistUser.artist.enName,
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