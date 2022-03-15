import { DateTime } from "luxon"
import { ProfilePicture } from './entity/ProfilePicture.js'
import { Image as DBImage } from './entity/Image.js'
import { ProfileBanner } from './entity/ProfileBanner.js'

export interface AuthResult {
  token: string
  user: User
}

export interface Response {
  data?: any
  error?: any
}

export interface Artist {
  id: number
  artistUserId: number
  groupdId: number
  agencyId: number
  managerId: number
  name: string
  enName: string
  bannerImage: string
  launchImage: string
  statusMessage: string
  messageUpdatedAt: number
  isPublishable: string
  affectionateName: string
  groupName: string
  groupEnName: string
  agencyName: string
  agencyEnName: string
}

export interface ArtistUser {
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
  artist: Artist
  isFollow: string
  followedUpdatedAt: number
}

export interface FabUser {
  id: number
  nickName: string
  name: string
  enName: string
  profileImage: string
  bannerImage: string
  statusMessage: string
}

export interface User {
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
  follows: ArtistUser[]
  followCount: number
  savedMessageCount: number
  points: number
}

export interface Group {
  id: number
  agencyId: number
  managerId: number
  name: string
  enName: string
  profileImage: string
  bannerImage: string
  launchImage: string
  statusMessage: string
  messageUpdatedAt: number
  youtube: string
  twitter: string
  instagram: string
  vlive: string
  cafe: string
  isSolo: string
  agencyName: string
  agencyEnName: string
  isFollow: string
}

export interface Image {
  id: number
  letterId: number
  image: string
}

export interface LetterTextObject {
  color: string
  size: number
  type: 'image' | 'br' | 'text'
  text: string
  urls: string[]
}

export interface LetterText {
  align: string
  version: string
  contents: LetterTextObject[]
}

export interface Letter {
  id: number
  messageId: number
  userId: number
  text?: LetterText | string
  status: number
  createdAt: number
  updatedAt: number
  images: Image[]
}

export interface Postcard {
  id: number
  messageId: number
  userId: number
  postcardImage: string
  postcardVideo: string
  thumbnail: string
  type: number
  status: number
  createdAt: number
  updatedAt: number
}

export interface FabMessage {
  id: number
  userId: number
  groupId: number
  type: number
  isGroup: string
  createdAt: number
  updatedAt: number
  user: ArtistUser
  isLike: string
  isSave: string
  isRead: string
  likeCount: number
  commentCount: number
  letter?: Letter
  postcard?: Postcard
  group?: Group
  thumbnail: string
}

export enum PostcardType {
  NONE = -1,
  IMAGE = 0,
  VIDEO = 1,
}

export interface Media {
  url: string
  stream?: NodeJS.ReadableStream
}

export interface ParsedMessage {
  id: number
  createdAt: DateTime
  emoji: string
  user: FabUser
  text: string
  media: Media[]
  isPostcard: boolean
  postcardType: PostcardType
}

export interface DownloadPath {
  url: string
  folder: string
  fullPath: string
}

export interface SplitUrl {
  base: string
  timestamp: number
  date: string
  imageNumber: number
  extension: string
}

export interface DownloadablePost {
  message: ParsedMessage
  downloadables: DownloadPath[]
}

export type DownloadableImage = DBImage | ProfilePicture | ProfileBanner

export enum TwitterAccount {
  ARCHIVE = 'archive',
  PROFILES = 'profiles',
}

export interface BruteforceAttempt {
  success: boolean
  stream?: NodeJS.ReadableStream
}