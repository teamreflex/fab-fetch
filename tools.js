import { DateTime } from "luxon"

const timestamp = process.argv[2]
const letter = process.argv[3]
if (!timestamp || !letter) {
  console.error('Must provide timestamp & letterID.')
  process.exit();
}

const time = DateTime.fromMillis(Number(timestamp), { zone: 'Asia/Seoul' });

console.log(
  `https://dnkvjm1f8biz3.cloudfront.net/images/letter/${letter}/${time.toFormat('X')}_${time.toFormat('yyyyMMddHHmmss')}_1_f.jpg`
);