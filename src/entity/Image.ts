import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Relation,
} from "typeorm";
import { Message } from "./Message.js";

@Entity()
export class Image {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Message, (message) => message.images)
  message: Relation<Message>;

  @Column()
  createdAt: string;

  @Column()
  url: string;

  @Column()
  folder: string;

  @Column()
  path: string;
}
