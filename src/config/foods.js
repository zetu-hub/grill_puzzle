// Food definitions. color/label remain as lightweight fallbacks; texture/asset
// are the generated Phase 1 illustrations used by the game scene.
export const FOODS = [
  { id: 1, name: 'yakitori', color: 0xc8813a, label: 'Y', texture: 'food-yakitori', asset: 'src/assets/foods/yakitori.png' },
  { id: 2, name: 'tsukune',  color: 0xa0522d, label: 'T', texture: 'food-tsukune',  asset: 'src/assets/foods/tsukune.png' },
  { id: 3, name: 'sausage',  color: 0xe05020, label: 'S', texture: 'food-sausage',  asset: 'src/assets/foods/sausage.png' },
  { id: 4, name: 'corn',     color: 0xf5d000, label: 'C', texture: 'food-corn',     asset: 'src/assets/foods/corn.png' },
  { id: 5, name: 'shrimp',   color: 0xff7040, label: 'E', texture: 'food-shrimp',   asset: 'src/assets/foods/shrimp.png' },
  { id: 6, name: 'pepper',   color: 0x40a040, label: 'P', texture: 'food-pepper',   asset: 'src/assets/foods/pepper.png' },
  { id: 7, name: 'beef',     color: 0x7b3f00, label: 'B', texture: 'food-beef',     asset: 'src/assets/foods/beef.png' },
  { id: 8, name: 'onion',    color: 0xf0e8d0, label: 'O', texture: 'food-onion',    asset: 'src/assets/foods/onion.png' },
];

// ID lookup for food rendering and game logic.
export const FOOD_MAP = Object.fromEntries(FOODS.map(f => [f.id, f]));
