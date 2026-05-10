// 食材定義（Phase 0: 色付き四角でプレースホルダー）
// color: プレースホルダー色, label: 略称
export const FOODS = [
  { id: 1, name: '焼き鳥',     color: 0xc8813a, label: '鳥' },
  { id: 2, name: 'つくね',     color: 0xa0522d, label: 'ね' },
  { id: 3, name: 'ソーセージ', color: 0xe05020, label: '腸' },
  { id: 4, name: 'とうもろこし', color: 0xf5d000, label: '玉' },
  { id: 5, name: 'えび',       color: 0xff7040, label: '海' },
  { id: 6, name: 'ピーマン串', color: 0x40a040, label: '緑' },
  { id: 7, name: '牛串',       color: 0x7b3f00, label: '牛' },
  { id: 8, name: 'たまねぎ串', color: 0xf0e8d0, label: '葱' },
];

// IDで食材を引く
export const FOOD_MAP = Object.fromEntries(FOODS.map(f => [f.id, f]));
