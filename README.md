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

## How?
Because all content is just on CloudFront, and each message has either the first image (letter), or the thumbnail (postcard) attached. Using these, we can bruteforce the rest of the message.

The way this works is that for letters (standard image post), the URL is structured like so:
```
https://dnkvjm1f8biz3.cloudfront.net/images/letter/197/1645623283_20220223223440_1_f.jpg
https://dnkvjm1f8biz3.cloudfront.net/images/letter/LETTERID/UNIXTIMESTAMP_DATETIME_IMAGENUMBER_f.jpg
```
In most cases, all you need to do is increment `IMAGENUMBER` and you'll get the next image. In some cases, you will need to increment `UNIXTIMESTAMP`, as obviously things overlap two milliseconds from time to time. I'm yet to find a post that requires a `DATETIME` increment, but that would be trivial to add.

As for postcards (video posts), this is a little different. The thumbnail URL is structured like so:
```
https://dnkvjm1f8biz3.cloudfront.net/images/postcard/27/1645498037_20220222114713_b.jpg
https://dnkvjm1f8biz3.cloudfront.net/images/postcard/POSTCARDID/UNIXTIMESTAMP_DATETIME_b.jpg
```
Because postcards only have one piece of content (it's either postcardVideo or postcardImage, I actually haven't accounted for images...), we can also bruteforce the .mp4 based on the thumbnail .jpg. This is the .mp4 URL for the thumbnail .jpg above:
```
https://dnkvjm1f8biz3.cloudfront.net/images/postcard/27/1645498036_20220222114713_f.mp4
```

Naturally, thumbnails can only be generated after the video has been uploaded, which means in some cases, we have to decrement `UNIXTIMESTAMP` rather than increase it, as well as updating the extension from `_b.jpg` to `_f.mp4`.

Unfortunately, this only applies for members using iPhones. Posts from Androids are not predictable:
```
https://dnkvjm1f8biz3.cloudfront.net/images/letter/207/1645746549_IMAGE_20220225_084902_2362453240698742359844.jpg
```
It starts off much the same until the final segment. I have no idea what it could possibly correspond to, so for now I've made the bot just check for any URL including `_IMAGE_`, and it will just pay for that post. Thankfully it's just HaSeul and Yves for now, but Neowiz could start randomizing images whenever they wanted, and it would be trivial to do.

## Caveats & Considerations
- There is no need to go manually view a post before the bot reads it.
    - The "this message requires points to open" is client side.
    - As soon as a post is retreived from the API, their backend deducts points.
    - Because of this, anything you want to do with the API can be entirely automated.
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