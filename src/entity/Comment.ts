import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Relation,
} from "typeorm";
import { Message } from "./Message.js";

export enum CommentType {
  TEXT = "TEXT",
  VOICE = "VOICE",
  IMAGE = "IMAGE",
}

@Entity()
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Message, (message) => message.comments)
  message: Relation<Message>;

  @Column()
  commentId: number;

  @Column()
  createdAt: string;

  @Column()
  updatedAt: string;

  @Column({ nullable: true })
  text?: string;

  @Column({ nullable: true })
  voiceMessageUrl?: string;

  @Column({ nullable: true })
  imageMessageUrl?: string;

  @Column({ nullable: true })
  folder?: string;

  @Column({ nullable: true })
  path?: string;

  @Column({
    type: "simple-enum",
    enum: CommentType,
  })
  type: CommentType;
}
