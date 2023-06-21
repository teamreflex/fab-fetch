import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  Relation,
} from "typeorm";
import { Artist } from "./Artist.js";
import { Comment } from "./Comment.js";
import { Image } from "./Image.js";

export enum MessageType {
  LETTER = "LETTER",
  POSTCARD = "POSTCARD",
}

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Comment, (comment) => comment.message, {
    cascade: true,
  })
  comments: Relation<Comment[]>;

  @OneToMany(() => Image, (image) => image.message, {
    cascade: true,
  })
  images: Relation<Image[]>;

  @ManyToOne(() => Artist, (artist) => artist.messages)
  artist: Relation<Artist>;

  @Column({ type: "int" })
  messageId: number;

  @Column({ type: "int" })
  memberId: number;

  @Column()
  memberName: string;

  @Column()
  memberEmoji: string;

  @Column()
  createdAt: string;

  @Column({
    type: "simple-enum",
    enum: MessageType,
  })
  type: MessageType;

  @Column({ default: false })
  twitterPosted: boolean;

  @Column({ default: false })
  discordPosted: boolean;
}
