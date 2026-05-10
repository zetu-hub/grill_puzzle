// 1つのグリル内のマッチ判定

// foods配列の中で3つ以上同じ食材IDがあれば、そのIDを返す
export function findMatchingFoods(foods) {
  const counts = {};
  for (const id of foods) counts[id] = (counts[id] || 0) + 1;
  return Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .map(([id]) => Number(id));
}

// foodsからfoodIdを3つだけ取り除いた新しい配列を返す
export function removeThree(foods, foodId) {
  let removed = 0;
  return foods.filter(id => {
    if (id === foodId && removed < 3) { removed++; return false; }
    return true;
  });
}
