export function findMatchingFoods(foods) {
  const counts = {};
  for (const id of foods) {
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .map(([id]) => Number(id));
}

export function removeThree(foods, foodId) {
  let removed = 0;
  return foods.map(id => {
    if (id === foodId && removed < 3) {
      removed++;
      return null;
    }
    return id;
  });
}
