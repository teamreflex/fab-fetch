import CryptoJS from 'crypto-js'

const seedMap = {
  0: '3$fI*1',
  1: '7Y5s_@',
  2: 'Jd_#rM',
  3: 'P~wc>9',
  4: '.of#4a',
  5: 'ga+f;S',
  6: 'M?d}#f',
  7: 'aI8=37',
  8: 'k@x&d6',
  9: '5T^d.o',
}

/**
 * Decrypts a the encrypted image URL.
 * @param timestamp string
 * @param encryptedString string
 * @returns string
 */
export const decryptString = (timestamp: string, encryptedString: string): string => {
  const userId = process.env.FAB_USER_ID

  // remove the last 3 chars because it needs to be in seconds
  const correctLength = timestamp.length - 3

  // get the seed string for the last character of the userId
  const seed1 = seedMap[parseInt(userId.substring(userId.length - 1, userId.length))]
  // get the seed string for the last character of the timestamp
  const seed2 = seedMap[parseInt(timestamp.substring(correctLength - 1, correctLength))]
  // hardcoded string
  const hardcode = "sp_Dh%voQ!20*22@"
  // get the last 3 characters of the timestamp
  const lastThree = timestamp.substring(correctLength - 3, correctLength)

  // build the password key
  const passwordKey = `${seed1}_${seed2}${hardcode}${lastThree}`

  // use the hardcoded vector
  let vector = CryptoJS.enc.Utf8.parse('voq^sp_dnl%Ms+af')
  // run decryption
  const bytes = CryptoJS.AES.decrypt(encryptedString, CryptoJS.enc.Utf8.parse(passwordKey), { iv: vector });
  const decrypted = bytes.toString(CryptoJS.enc.Utf8)

  // remove 6 random digits either side of the url
  return decrypted.substring(6, decrypted.length - 6)
}