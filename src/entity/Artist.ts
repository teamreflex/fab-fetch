import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Relation,
} from "typeorm";
import { Message } from "./Message.js";

@Entity()
export class Artist {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToMany(() => Message, (message) => message.artist)
  messages: Relation<Message[]>;

  @Column({ type: "int" })
  artistId: number;

  @Column()
  nameEn: string;

  @Column()
  nameKr: string;

  @Column()
  emoji: string;

  @Column({ type: "tinyint" })
  isTerminated: boolean;
}
