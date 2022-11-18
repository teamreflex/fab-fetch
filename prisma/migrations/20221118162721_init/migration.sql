-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('LETTER', 'POSTCARD_IMAGE', 'POSTCARD_VIDEO');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('TEXT', 'VOICE');

-- CreateTable
CREATE TABLE "Artist" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fabArtistId" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameKr" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "artistId" INTEGER NOT NULL,
    "fabMessageId" INTEGER NOT NULL,
    "type" "MessageType" NOT NULL,
    "socialPosted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "messageId" INTEGER NOT NULL,
    "fabCommentId" INTEGER NOT NULL,
    "text" TEXT,
    "voiceMessageUrl" TEXT,
    "path" TEXT,
    "type" "CommentType" NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "messageId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileBanner" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "artistId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "socialPosted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProfileBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilePicture" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "artistId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "socialPosted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProfilePicture_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileBanner" ADD CONSTRAINT "ProfileBanner_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilePicture" ADD CONSTRAINT "ProfilePicture_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
