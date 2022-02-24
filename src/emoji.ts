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