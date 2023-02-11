// 🐰🐱🕊🐻🦌🦉🐟🦇🦢🐧🦋🐺
const mapping: Record<number, string> = {
  1: 'LOONA',
  2: 'HeeJin',
  3: 'HyunJin',
  4: 'HaSeul',
  5: 'YeoJin',
  6: 'ViVi',
  7: 'Kim Lip',
  8: 'JinSoul',
  9: 'Choerry',
  10: 'Yves',
  11: 'Chuu',
  12: 'Go Won',
  13: 'Olivia Hye',

  85354: 'Kim Lip',
  85355: 'JinSoul',
  85357: 'Choerry',
  85356: 'HeeJin',
}

export const getName = (id: number, fallback: string): string => {
  return mapping[id] ?? fallback
}