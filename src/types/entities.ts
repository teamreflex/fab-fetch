import { DateTime } from "luxon"
import { Image, LetterText, MessageType } from "."

export type FabArtist = {
  id: number
  artistUserId: number
  groupId: number
  agencyId: number
  managerId: number
  name: string
  enName: string
  bannerImage: string
  launchImage: string
  statusMessage: string
  messageUpdatedAt: DateTime
  isPublishable: boolean
  isTerminated: boolean
  affectionateName: string
  groupName: string
  groupEnName: string
  agencyName: string
  agencyEnName: string
}

export type FabArtistUser = {
  id: number
  email: string
  nickName: string
  profileImage: string
  birthday: string
  type: number
  isAllowMessagePush: boolean
  isAllowCommentPush: boolean
  status: number
  birthdayUpdatedAt?: DateTime
  createdAt: DateTime
  updatedAt: DateTime
  artist: FabArtist
  isFollow: boolean
  followedUpdatedAt?: DateTime
}

export type FabGroup = {
  id: number
  agencyId: number
  managerId: number
  name: string
  enName: string
  profileImage: string
  bannerImage: string
  launchImage: string
  statusMessage: string
  messageUpdatedAt: DateTime
  youtube: string
  twitter: string
  instagram: string
  vlive: string
  cafe: string
  isSolo: boolean
  agencyName: string
  agencyEnName: string
  isFollow: boolean
}

export type FabLetter = {
  id: number
  messageId: number
  userId: number
  text?: LetterText | string
  status: number
  createdAt: DateTime
  updatedAt: DateTime
  thumbnail: string
  images: Image[]
}

export type FabPostcard = {
  id: number
  messageId: number
  userId: number
  postcardImage: string
  postcardVideo: string
  thumbnail: string
  type: number
  status: number
  createdAt: DateTime
  updatedAt: DateTime
}

export type FabMessage = {
  id: number
  userId: number
  groupId: number
  type: number
  isGroup: boolean
  createdAt: DateTime
  updatedAt: DateTime
  user?: FabArtistUser
  isLike: boolean
  isSave: boolean
  isRead: boolean
  likeCount: number
  commentCount: number
  letter?: FabLetter
  postcard?: FabPostcard
  group?: FabGroup
  isNewArtistUserComment: boolean;
  messageType: MessageType
  enName: string
}

export type FabComment = {
  id: number;
  messageId: number;
  parentId: number;
  pollId: number;
  userId: number;
  groupId: number;
  isGroup: boolean;
  type: number;
  comment?: string;
  voiceComment?: string;
  status: number;
  createdAt: DateTime;
  updatedAt: DateTime;
  isArtist: boolean;
  name: string;
  enName: string;
  profileImage: string;
  userNickname: string;
  isLike: boolean;
  subComments: FabComment[];
  quotedComment?: string;
}