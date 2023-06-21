import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Relation,
} from "typeorm";
import { Artist } from "./Artist.js";

@Entity()
export class ProfilePicture {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Artist, (artist) => artist.messages)
  artist: Relation<Artist>;

  @Column()
  createdAt: string;

  @Column()
  url: string;

  @Column()
  folder: string;

  @Column()
  path: string;

  @Column({ default: false })
  twitterPosted: boolean;

  @Column({ default: false })
  discordPosted: boolean;
}
