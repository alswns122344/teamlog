import { describe, expect, it } from 'vitest'
import { clampChars, countChars } from './format'

describe('countChars (DB char_length 와 같은 기준)', () => {
  it('한글·줄바꿈을 한 글자씩 센다', () => {
    expect(countChars('가나다')).toBe(3)
    expect(countChars('첫 줄\n둘째 줄')).toBe(8) // 첫,␠,줄,\n,둘,째,␠,줄
  })

  it('이모지는 1자로 센다 (JS length 는 2)', () => {
    expect('👍'.length).toBe(2)
    expect(countChars('👍')).toBe(1)
  })
})

describe('clampChars', () => {
  it('최대 글자 수를 넘으면 자른다', () => {
    expect(clampChars('가나다라', 2)).toBe('가나')
  })

  it('이모지를 반으로 쪼개지 않는다', () => {
    expect(clampChars('a👍b', 2)).toBe('a👍')
  })

  it('넘지 않으면 그대로 둔다', () => {
    expect(clampChars('가\n나', 2000)).toBe('가\n나')
  })
})
