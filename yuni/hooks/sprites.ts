// 유니의 도트 그림. 한 글자 = 한 픽셀, 오른쪽을 보는 옆모습.
// o 테두리 · f 몸 · F 몸 그림자 · m/M 갈기 두 색 · h 뿔 · k 눈 · p 볼 · u 발굽
// W 날개 · e 알껍질 · s 알무늬 · w 빛나는 눈 · . 투명

export type Box = { x: number; y: number; w: number; h: number }
export type Sprite = { rows: string[]; eye?: Box; horn: [number, number] }

export const EGG: Sprite = {
  rows: [
    '................',
    '................',
    '......oooo......',
    '.....oeeeeo.....',
    '....oeessseo....',
    '....oeeeeeeo....',
    '...oesseeeeeo...',
    '...oeeeeesseo...',
    '...oeeeeeeeeo...',
    '...oessseeeeo...',
    '...oeeeeeesso...',
    '....oeeesseo....',
    '....oeeeeeeo....',
    '.....oeeeeo.....',
    '......oooo......',
    '................',
  ],
  horn: [8, 2],
}

// 답변 20번이 넘으면 알에 금이 간다
export const CRACK: [number, number][] = [
  [7, 4], [8, 5], [7, 6], [6, 7], [7, 8], [8, 9], [9, 8], [10, 9],
]

// 사용량이 바닥나면 알 속으로 숨는다: 금 사이로 눈만 빛난다
export const HIDE: Sprite = {
  rows: [
    '................',
    '................',
    '......oooo......',
    '.....oeeeeo.....',
    '....oessseeo....',
    '....oeeeeeeo....',
    '...oeeseeeeeo...',
    '...oeoeoeoeoeo..',
    '...okwkkkkkwko..',
    '...oeoeoeoeoeo..',
    '...oeseeeeseo...',
    '...oeeeeeeeeo...',
    '....oeeseeeo....',
    '.....oeeeeo.....',
    '......oooo......',
    '................',
  ],
  horn: [8, 2],
}

export const BABY: Sprite = {
  rows: [
    '................',
    '................',
    '................',
    '................',
    '.............o..',
    '............oho.',
    '........mmooooo.',
    '.......mMmofffo.',
    '.......mMofffkfo',
    '......mMmofffkpo',
    '......mmooffffo.',
    '....m.offffffo..',
    '...mMoffffffo...',
    '...m.ofoFofo....',
    '.....ofo.ofo....',
    '.....ouo.ouo....',
  ],
  eye: { x: 13, y: 8, w: 1, h: 2 },
  horn: [13, 4],
}

export const YOUTH: Sprite = {
  rows: [
    '..............o.',
    '.............oho',
    '............oho.',
    '.......mmo.oooo.',
    '......mmMoofffo.',
    '.....mmMmofffkfo',
    '.....mMmmofffkfo',
    '....mmMmoffffffo',
    '...mMmmooffffppo',
    '..mMmoffffoooo..',
    '.mMmofffffffo...',
    '.mMoffffffffo...',
    'mMmoffffffffo...',
    'mM.ofoFoofoFo...',
    'm..ofo.o.ofo....',
    '...ouo...ouo....',
  ],
  eye: { x: 13, y: 5, w: 1, h: 2 },
  horn: [14, 0],
}

// 알리콘: 청년 유니콘 등 위에 날개를 얹는다
const WING = ['..oo..', '.oWWo.', 'oWWWWo', 'oWWWo.', '.oWo..', '..o...']
export const ALICORN: Sprite = {
  rows: YOUTH.rows.map((row, y) => {
    const w = WING[y - 4]
    if (!w) return row
    return [...row].map((ch, x) => (w[x - 4] && w[x - 4] !== '.' ? w[x - 4] : ch)).join('')
  }),
  eye: YOUTH.eye,
  horn: YOUTH.horn,
}

// 컨텍스트가 가득 차면 배불러서 드러눕는다
export const LYING: Sprite = {
  rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..............o.',
    '.............oho',
    '............oho.',
    '......mmo..oooo.',
    '....mmMmoooffkfo',
    '..mmMmooffffffpo',
    '.mMmoffffffffoo.',
    'mMmoffffffffffo.',
    'oooooooooooooo..',
  ],
  eye: { x: 13, y: 11, w: 1, h: 1 },
  horn: [14, 7],
}

// 서브에이전트 친구: 굴러오는 알, 끝나면 날개 달린 아기가 되어 날아간다
export const FRIEND_EGG = ['..oo..', '.oeso.', 'oeeeeo', 'oseeso', 'oeeeeo', '.oeeo.', '..oo..']
export const FRIEND_FOAL = ['......o.', '.....oho', '.oo.mooo', 'oWWomofk', 'oWWWoffo', '.ooffffo', '..ofoofo', '..o..o..']

export type Branch = '알' | '불꽃' | '바람' | '강철'

export const BRANCHES: Record<Branch, { mane: number; mane2: number; horn: number; about: string }> = {
  알: { mane: 0xc6b3ff, mane2: 0xffb3d9, horn: 0xffd75e, about: '아직 어떤 유니콘이 될지 몰라요' },
  불꽃: { mane: 0xff7a59, mane2: 0xffc145, horn: 0xffd75e, about: '코드를 많이 고치는 사람의 유니콘' },
  바람: { mane: 0x7ad7ff, mane2: 0xb38cff, horn: 0xe0f7ff, about: '많이 찾아보고 읽는 사람의 유니콘' },
  강철: { mane: 0x8b98a9, mane2: 0xcfd8e3, horn: 0xe8edf2, about: '명령어를 많이 돌리는 사람의 유니콘' },
}

// 부화할 때 털색이 무작위로 정해져서 매번 다른 유니콘이 나온다
export const COATS = [
  { name: '눈송이', body: 0xfffaf3, shade: 0xe9dcf0 },
  { name: '복숭아', body: 0xffe8dc, shade: 0xf5c6b5 },
  { name: '라벤더', body: 0xf0e6ff, shade: 0xd3c0f5 },
  { name: '민트', body: 0xe6fbf2, shade: 0xb5e8d3 },
  { name: '밤하늘', body: 0x4b4f7a, shade: 0x363a5e },
]

export const STAGES = [
  { name: '알', turns: 0 },
  { name: '아기 망아지', turns: 50 },
  { name: '청년 유니콘', turns: 200 },
  { name: '알리콘', turns: 500 },
] as const

export const CRACK_AT = 20

export function stageOf(turns: number) {
  let i = 0
  STAGES.forEach((s, n) => turns >= s.turns && (i = n))
  return i
}
