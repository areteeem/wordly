export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export function now(): number {
  return Date.now()
}

// Design-system helpers
export const wobbly = '255px 15px 225px 15px / 15px 225px 15px 255px'
export const wobblyMd = '15px 255px 15px 225px / 255px 15px 225px 15px'
export const wobblyLg = '225px 15px 255px 15px / 15px 255px 15px 225px'
export const wobblySmall = '12px 8px 10px 14px / 10px 12px 14px 8px'
