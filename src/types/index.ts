import { Artist } from "@prisma/client"
import { FabArtistUser, FabMessage } from "./entities"
import { RawArtistUser } from "./fab"

export * from './fab'
export * from './entities'

export type Response<T> = {
  data?: T
  error?: any
}

export type User = {
  id: number
  email: string
  nickName: string
  profileImage: string
  birthday: string
  type: number
  isAllowMessagePush: string
  isAllowCommentPush: string
  status: number
  birthdayUpdatedAt?: number
  createdAt: number
  updatedAt: number
  follows: RawArtistUser[]
  followCount: number
  savedMessageCount: number
  points: number
}

export type LoginResponse = {
  login: {
    token: string,
    user: User,
  }
}

export type FetchGroupResponse = {
  fabArtists: FabArtistUser[]
  dbArtists: Artist[]
}

export type ImagePath = {
  folder: string
  path: string
  url: string
}

export type Image = {
  id: number
  letterId: number
  image: string
}

export type LetterTextObject = {
  color: string
  size: number
  type: 'image' | 'br' | 'text'
  text: string
  urls: string[]
}

export type LetterText = {
  align: string
  version: string
  contents: LetterTextObject[]
}

export type FetchMessagesOptions = {
  all: boolean
}

export type MessageResponse = {
  latestMessages: FabMessage[]
  messagesWithNewComments: FabMessage[]
  filteredMessages: FabMessage[]
}

export type Media = {
  url: string
  stream?: NodeJS.ReadableStream
}

export type SavedMedia = Media & {
  path: string
}

export enum DownloadResult {
  SUCCESS = 'SUCCESS',
  NOT_FOUND = 'NOT_FOUND',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
}

export type DownloadResponse = {
  result: DownloadResult,
  media: SavedMedia[]
}

export enum MessageType {
  LETTER = 'LETTER',
  POSTCARD_VIDEO = 'POSTCARD_VIDEO',
  POSTCARD_IMAGE = 'POSTCARD_IMAGE',
}

export type BruteforceAttempt = {
  success: boolean
  stream?: NodeJS.ReadableStream
}

export type SplitUrl = {
  version: URLVersion
  base: string
  timestamp: number
  date: number
  imageNumber: number
  extension: string
}

export enum TwitterAccount {
  ARCHIVE = 'archive',
  PROFILES = 'profiles',
}

export interface VoiceCommentDownloadResult {
  downloadResult: DownloadResult,
  url?: string;
  folder?: string;
  path?: string;
}

export enum CommentType {
  TEXT =  'TEXT',
  VOICE = 'VOICE',
}

export const URLVersion1Regex = /\d{10,}_\d{14,}_[tb]\.jpg/
export const URLVersion2Regex = /\d{10,}_\d{14,}[tb]\.jpg/

export enum URLVersion {
  V1 = 'V1',
  V2 = 'V2',
}

export type DerivedURL = {
  url: string
  version: URLVersion
}

export type AvailableRegex = {
  version: URLVersion
  test: RegExp
}