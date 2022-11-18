import { Image, LetterText } from "."

export type RawArtist = {
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
  messageUpdatedAt: number
  isPublishable: string
  affectionateName: string
  groupName: string
  groupEnName: string
  agencyName: string
  agencyEnName: string
}

export type RawArtistUser = {
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
  artist: RawArtist
  isFollow: string
  followedUpdatedAt?: number
}

export type RawGroup = {
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
  artistUsers: RawArtistUser[]
  agencyName: string
  agencyEnName: string
  isFollow: string
}

export type RawLetter = {
  id: number
  messageId: number
  userId: number
  text?: LetterText | string
  status: number
  createdAt: number
  updatedAt: number
  thumbnail: string
  images: Image[]
}

export type RawPostcard = {
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

export type RawMessage = {
  id: number
  userId: number
  groupId: number
  type: number
  isGroup: string
  createdAt: number
  updatedAt: number
  user: RawArtistUser
  isLike: string
  isSave: string
  isRead: string
  likeCount: number
  commentCount: number
  letter?: RawLetter
  postcard?: RawPostcard
  group?: RawGroup
  isNewArtistUserComment: string;
}

export type RawComment = {
  id: number;
  messageId: number;
  parentId: number;
  pollId: number;
  userId: number;
  groupId: number;
  isGroup: string;
  type: number;
  comment?: string;
  voiceComment?: string;
  status: number;
  createdAt: number;
  updatedAt: string;
  isArtist: string;
  name: string;
  enName: string;
  profileImage: string;
  userNickname: string;
  isLike: string;
  subComments: RawComment[];
  quotedComment?: string;
}