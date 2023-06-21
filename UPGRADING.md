when adding image comments, you must:

1. start the app to migrate the database
2. terminate it before it fetches anything
3. verify the `imageMessageUrl` column exists
4. run this SQL to remove CHECK constraints

```sql
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;
ALTER TABLE comment rename TO comment_old;
CREATE TABLE "comment" (
	"id" INTEGER NOT NULL,
	"commentId" INTEGER NOT NULL,
	"createdAt" VARCHAR NOT NULL,
	"updatedAt" VARCHAR NOT NULL,
	"text" VARCHAR NULL,
	"voiceMessageUrl" VARCHAR NULL,
	"folder" VARCHAR NULL,
	"path" VARCHAR NULL,
	"type" VARCHAR NOT NULL,
	"messageId" INTEGER NULL,
	"imageMessageUrl" VARCHAR NULL,
	PRIMARY KEY ("id"),
	CONSTRAINT "0" FOREIGN KEY ("messageId") REFERENCES "message" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
INSERT INTO comment SELECT * FROM comment_old;
DROP TABLE comment_old;
COMMIT;
PRAGMA foreign_keys=on;
```
