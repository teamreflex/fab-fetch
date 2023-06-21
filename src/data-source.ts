import "reflect-metadata";
import { DataSource } from "typeorm";
import { Artist } from "./entity/Artist.js";
import { Comment } from "./entity/Comment.js";
import { Image } from "./entity/Image.js";
import { Message } from "./entity/Message.js";
import { ProfileBanner } from "./entity/ProfileBanner.js";
import { ProfilePicture } from "./entity/ProfilePicture.js";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: "database.sqlite",
  synchronize: true,
  logging: false,
  entities: [Artist, Comment, Image, Message, ProfileBanner, ProfilePicture],
  migrations: [],
  subscribers: [],
});
