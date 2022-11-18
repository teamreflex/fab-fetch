import { RawArtist, RawArtistUser, RawGroup, RawMessage, FabArtist, FabArtistUser, FabGroup, FabMessage, RawLetter, FabLetter, RawPostcard, RawComment, FabPostcard, MessageType, FabComment } from './../types'
import { fromTimestamp } from '../util';
import { DateTime } from 'luxon';

export namespace Parsing {
  export const artist = (raw: RawArtist): FabArtist => {
    return {
      ...raw,
      messageUpdatedAt: fromTimestamp(raw.messageUpdatedAt),
      isPublishable: raw.isPublishable === 'Y,'
    }
  }
  
  export const artistUser = (raw: RawArtistUser): FabArtistUser => {
    return {
      ...raw,
      isAllowMessagePush: raw.isAllowMessagePush === 'Y',
      isAllowCommentPush: raw.isAllowCommentPush === 'Y',
      birthdayUpdatedAt: raw.birthdayUpdatedAt ? fromTimestamp(raw.birthdayUpdatedAt) : undefined,
      createdAt: fromTimestamp(raw.createdAt),
      updatedAt: fromTimestamp(raw.updatedAt),
      artist: artist(raw.artist),
      isFollow: raw.isFollow === 'Y',
      followedUpdatedAt: raw.followedUpdatedAt ? fromTimestamp(raw.followedUpdatedAt) : undefined,
    }
  }
  
  export const group = (raw: RawGroup): FabGroup => {
    return {
      ...raw,
      messageUpdatedAt: fromTimestamp(raw.messageUpdatedAt),
      isSolo: raw.isSolo === 'Y',
      isFollow: raw.isFollow === 'Y',
    }
  }

  export const letter = (raw: RawLetter): FabLetter => {
    return {
      ...raw,
      createdAt: fromTimestamp(raw.createdAt),
      updatedAt: fromTimestamp(raw.updatedAt),
    }
  }

  export const postcard = (raw: RawPostcard): FabPostcard => {
    return {
      ...raw,
      createdAt: fromTimestamp(raw.createdAt),
      updatedAt: fromTimestamp(raw.updatedAt),
    }
  }

  export const message = (raw: RawMessage): FabMessage => {
    return {
      ...raw,
      isGroup: raw.isGroup === 'Y',
      createdAt: fromTimestamp(raw.createdAt),
      updatedAt: fromTimestamp(raw.updatedAt),
      user: artistUser(raw.user),
      isLike: raw.isLike === 'Y',
      isSave: raw.isSave === 'Y',
      isRead: raw.isRead === 'Y',
      letter: raw.letter ? letter(raw.letter) : undefined,
      postcard: raw.postcard ? postcard(raw.postcard) : undefined,
      group: raw.group ? group(raw.group) : undefined,
      isNewArtistUserComment: raw.isNewArtistUserComment === 'Y',
      messageType: raw.postcard ? (raw.postcard.type === 1 ? MessageType.POSTCARD_VIDEO : MessageType.POSTCARD_IMAGE) : MessageType.LETTER,
    }
  }

  export const comment = (raw: RawComment): FabComment => {
    return {
      ...raw,
      isGroup: raw.isGroup === 'Y',
      createdAt: fromTimestamp(raw.createdAt),
      updatedAt: DateTime.fromISO(raw.updatedAt, { zone: 'Asia/Seoul' }),
      isArtist: raw.isArtist === 'Y',
      isLike: raw.isLike === 'Y',
      subComments: raw.subComments.map(comment),
    }
  }
}