# fab-fetch
Fetch and archive content from Fab.

## Requirements
- Only tested on Node 14
- A Fab account, either email & password or an already generated access token.

## Setup
```bash
$ git clone git@github.com:teamreflex/fab-fetch.git
$ cd fab-fetch
$ npm install
$ cp .env.example .env
$ nano .env # Fill in your details here, and update the user-agent
```

## Running
```bash
$ npm run dev # Runs instantly and posts to Twitter
$ npm run dev-without-posting # Runs instantly and skips Twitter
$ npm run fetch # Runs according to the timeout (ms) and posts to Twitter
$ npm run fetch-without-posting # Runs according to the timeout (ms) and skips Twitter
```

## Caveats & Considerations
- Message fetching is done via the "unread" messages endpoint, as in those colored blocks you see on the homepage.
    - This means that you must manually subscribe to each member or else their posts won't come through.
    - As soon as you open a message in the app, it's now marked as "read" and is removed from this endpoint.
    - The bot does not mark these as read, it just leaves it alone, thus allowing the endpoint to pile up with posts.
- The user-agent requires the latest Android app version number. They have a little bit of leeway in terms of enforcing switching over during update rollouts, but requests will fail once they fully switch everything over. You will need to keep on top of app updates and update your environment when necessary.
    - I could probably just web scrape this from the Play Store page but haven't got around to it. Maybe later.
- There's little error handling. I run it using pm2 so it'll just restart upon an error crash, like during maintenance periods.
- If you run it with Twitter posting enabled but don't fill in your Twitter credentials, it'll crash.
    - Twitter rate limiting when enabling Twitter posting, while having more than 10~ posts to update will also crash it.
- I have no idea if they have rate limiting or account banning or what. I've been running a couple bots using the same account credentials since the weekend the app launched and everything has been fine, but Neowiz could quite easily block Android emulator usage/user-agents, accounts querying on intervals etc.
    - Because of the uncertainty, just use common sense. Personally, I have my access token in the environment, as if it gets in a crash loop and keeps spamming requests, at least it'll just look like I'm spamming refresh on the home screen rather than spamming login requests.
- It judges whether or not to post to Twitter based on if the first piece of media in the message is on the drive. So don't go deleting anything as it doesn't mark the post as read within the API yet either.
    - If I end up working on comment fetching/translation, I'll probably swap this over to a sqlite database which would probably fix the first caveat too.
- Neowiz have made some REST API 101 rookie mistakes already, so if you find anything suspicious then just report it. They're quick to respond.

## License
I don't really know what MIT permits, it's just always been my default. Don't really care what you do, just give credit I guess.

## Contact
- [@Kairuxo](https://twitter.com/Kairuxo)
- kairu@team-reflex.com
- Discord: Kairu#0613