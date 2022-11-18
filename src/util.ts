import { DateTime } from 'luxon';
import chalk, { ChalkInstance } from 'chalk'

export namespace Log {
  const log = (ch: ChalkInstance, message: string, bold: boolean = false): void => {
    console.log(bold ? ch.bold(message) : ch(message))
  }
  
  export const error = (str: string) => log(chalk.red, str, true)
  export const warning = (str: string, bold = false) => log(chalk.hex('#FFA500'), str, true)
  export const dev = (str: string, bold = false) => log(chalk.yellow, str, true)
  export const info = (str: string, bold = false) => log(chalk.cyan, str, true)
  export const success = (str: string, bold = false) => log(chalk.green, str, true)
}

export const sleep = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const parseUserIds = (): number[] => {
  const userIds = process.env.PAY_FOR_USER_IDS as string
  return userIds.split(',').map((userId) => parseInt(userId));
};

// 🐰🐱🕊🐻🦌🦉🐟🦇🦢🐧🦋🐺
const mapping: Record<number, string> = {
  1: '🌙',
  2: '🐰',
  3: '🐱',
  4: '🕊',
  5: '🐻',
  6: '🦌',
  7: '🦉',
  8: '🐟',
  9: '🦇',
  10: '🦢',
  11: '🐧',
  12: '🦋',
  13: '🐺',
}

export const getEmoji = (id: number): string => {
  return mapping[id]
}

export const fromTimestamp = (timestamp: number): DateTime => {
  return DateTime.fromMillis(timestamp, { zone: 'Asia/Seoul' })
}