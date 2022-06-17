import CryptoJS from 'crypto-js'

const seedMap = [
  '3$fI*1', '7Y5s_@', 'Jd_#rM', 'P~wc>9', '.of#4a',
  'ga+f;S', 'M?d}#f', 'aI8=37', 'k@x&d6', '5T^d.o',
]

/**
 * Decrypts a the encrypted image URL.
 * @param timestamp string
 * @param encryptedString string
 * @returns string
 */
export const decryptString = (timestamp: number, encryptedString: string): string => {
  const userId = parseInt(process.env.FAB_USER_ID)
  const seconds = timestamp / 1000

  // get the seed string for the last character of the userId
  const seed1 = seedMap[userId % 10]
  // get the seed string for the last character of the timestamp
  const seed2 = seedMap[seconds % 10]
  // hardcoded string
  const hardcode = "sp_Dh%voQ!20*22@"
  // get the last 3 characters of the timestamp
  const lastThree = seconds % 1000

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