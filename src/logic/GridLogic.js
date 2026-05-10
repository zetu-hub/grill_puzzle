// グリッド上のマッチ判定・消去ロジック（Phaser非依存）

export const COLS = 6;
export const ROWS = 6;

// 空のグリッドを作る（0 = 空）
export function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// 指定マスに食材IDを置く（空きマスのみ）
export function placeFood(grid, row, col, foodId) {
  if (grid[row][col] !== 0) return false;
  grid[row][col] = foodId;
  return true;
}

// 全方向の揃いを検索する
// 返値: [ { cells: [{row,col}, ...], foodId } ]
export function findMatches(grid) {
  const matched = new Set(); // "row,col" の文字列セット
  const groups = [];

  const directions = [
    { dr: 0, dc: 1 },  // 横
    { dr: 1, dc: 0 },  // 縦
    { dr: 1, dc: 1 },  // 右斜め
    { dr: 1, dc: -1 }, // 左斜め
  ];

  for (const { dr, dc } of directions) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const id = grid[r][c];
        if (id === 0) continue;

        // この方向に3つ以上連続しているか調べる
        let len = 1;
        while (true) {
          const nr = r + dr * len;
          const nc = c + dc * len;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (grid[nr][nc] !== id) break;
          len++;
        }

        if (len >= 3) {
          // 3つごとにグループ化
          for (let start = 0; start + 3 <= len; start += 3) {
            const cells = [];
            for (let i = start; i < start + 3; i++) {
              cells.push({ row: r + dr * i, col: c + dc * i });
            }
            // 全セルが未登録の場合だけ追加（重複排除）
            const keys = cells.map(p => `${p.row},${p.col}`);
            if (keys.every(k => !matched.has(k))) {
              keys.forEach(k => matched.add(k));
              groups.push({ cells, foodId: id });
            }
          }
        }
      }
    }
  }

  return groups;
}

// マッチしたセルを消去し、消えた食材の数をカウントして返す
// 返値: { cleared: { foodId: count }, totalScore: number }
export function clearMatches(grid, groups, chainCount = 1) {
  const cleared = {};
  let totalScore = 0;
  const multiplier = chainCount; // 連鎖倍率

  for (const { cells, foodId } of groups) {
    for (const { row, col } of cells) {
      grid[row][col] = 0;
    }
    cleared[foodId] = (cleared[foodId] || 0) + cells.length;
    totalScore += 50 * cells.length * multiplier;
  }

  return { cleared, totalScore };
}

// 詰み判定: 空きマスが存在するかどうか
export function hasEmptyCell(grid) {
  return grid.some(row => row.includes(0));
}
