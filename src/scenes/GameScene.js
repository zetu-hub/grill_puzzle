import { FOODS, FOOD_MAP } from '../config/foods.js';
import { findMatchingFoods, removeThree } from '../logic/MatchLogic.js';

const COLS = 3;
const ROWS = 4;
const CELL_W = 125;
const CELL_H = 128;

const GRID_X = 0;
const GRID_Y = 95;

const GRILL_PAD_X = 6;
const GRILL_PAD_Y = 6;
const GRILL_W = 113;
const GRILL_H = 50;

const ICON_SIZE = 32;
const FOOD_HIT_PAD = 12;
const DRAG_START_DISTANCE = 3;
const DRAG_GHOST_SIZE = 50;
const DRAG_GHOST_OFFSET_Y = -42;
const DROP_HIT_PAD = 10;
const RECORDS_KEY = 'grillPuzzleRecordsV1';
const FOOD_SLOTS = [
  { x: 4, y: 9 },
  { x: 41, y: 9 },
  { x: 78, y: 9 },
];
const CAPACITY = 3;

const PLATE_GAP = 5;
const PLATE_H = 36;
const PLATE_ICON_SIZE = 22;
const PLATE_OFFSET = GRILL_H + PLATE_GAP;

const LEVELS = Array.from({ length: 20 }, (_, i) => {
  const level = i + 1;
  const targetSets = 8 + level * 2;
  const foodCount = Math.min(FOODS.length, 4 + Math.floor((level + 1) / 3));
  const activeGrills = Math.min(COLS * ROWS, 5 + Math.floor((level + 1) / 2));
  return {
    level,
    targetSets,
    timeSecs: Math.ceil(targetSets * 4),
    activeGrills,
    foodIds: FOODS.slice(0, foodCount).map(food => food.id),
  };
});

const ITEM_DEFS = [
  { key: 'shuffle', icon: 'S', label: 'MIX' },
  { key: 'undo', icon: 'R', label: 'UNDO' },
  { key: 'open', icon: 'H', label: 'OPEN' },
  { key: 'time', icon: 'F', label: '+10s' },
];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    for (const food of FOODS) {
      this.load.image(food.texture, food.asset);
    }
  }

  create() {
    this.game.canvas.style.touchAction = 'none';
    this.input.on('pointerdown', this._onPointerDown, this);
    this.input.on('pointermove', this._onPointerMove, this);
    this.input.on('pointerup', this._onPointerUp, this);
    this.input.on('pointerupoutside', this._onPointerUp, this);
    this._showTitleScreen();
  }

  _showTitleScreen() {
    this.gameState = 'title';
    this.grills = null;
    this.selected = null;
    this._clearDragVisuals();
    this.gameTimer?.remove();
    this.children.removeAll(true);
    this._drawBackground();

    const W = this.scale.width;
    this.add.text(W / 2, 180, 'Grill Puzzle', {
      fontSize: '42px',
      fill: '#fff5d6',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      stroke: '#5a2b00',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(20);

    this.add.text(W / 2, 250, 'Level 1 - 20', {
      fontSize: '20px',
      fill: '#7a4e10',
      fontFamily: 'sans-serif',
      backgroundColor: '#f2ead8',
      padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setDepth(20);

    const start = this.add.text(W / 2, 370, 'START', {
      fontSize: '30px',
      fill: '#ffdd00',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 4,
      backgroundColor: '#7a3300',
      padding: { x: 34, y: 16 },
    }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
    start.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation();
      if (this.gameState !== 'title') return;
      this._startLevel(1);
    });

    const records = this.add.text(W / 2, 450, 'RECORDS', {
      fontSize: '22px',
      fill: '#fff5d6',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3,
      backgroundColor: '#5b3a16',
      padding: { x: 26, y: 12 },
    }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
    records.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation();
      if (this.gameState !== 'title') return;
      this._showRecordsScreen();
    });
  }

  _showRecordsScreen() {
    this.gameState = 'records';
    this._clearDragVisuals();
    this.gameTimer?.remove();
    this.children.removeAll(true);
    this._drawBackground();

    const W = this.scale.width;
    const records = this._loadRecords();
    this.add.text(W / 2, 54, 'LEVEL RECORDS', {
      fontSize: '28px',
      fill: '#fff5d6',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      stroke: '#5a2b00',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(20);

    for (let i = 0; i < LEVELS.length; i++) {
      const level = i + 1;
      const col = i < 10 ? 0 : 1;
      const row = i % 10;
      const x = col === 0 ? 22 : 200;
      const y = 104 + row * 45;
      const record = records[level];
      const stars = record ? this._formatStars(record.stars) : '---';
      const moves = record ? `${record.moves}手` : '--手';
      const time = record ? this._formatTime(record.timeLeft) : '--:--';

      this.add.rectangle(x + 76, y + 16, 150, 36, 0xf2ead8, 0.9)
        .setDepth(18)
        .setStrokeStyle(1, 0x7a4e10);
      this.add.text(x, y, `Lv.${String(level).padStart(2, '0')}`, {
        fontSize: '13px',
        fill: '#5a3010',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
      }).setDepth(20);
      this.add.text(x + 42, y, stars, {
        fontSize: '14px',
        fill: '#d88a00',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setDepth(20);
      this.add.text(x + 42, y + 18, `${moves} ${time}`, {
        fontSize: '12px',
        fill: '#5a3010',
        fontFamily: 'sans-serif',
      }).setDepth(20);
    }

    const back = this.add.text(W / 2, 595, 'BACK', {
      fontSize: '22px',
      fill: '#ffdd00',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      stroke: '#000',
      strokeThickness: 3,
      backgroundColor: '#7a3300',
      padding: { x: 26, y: 12 },
    }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
    back.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation();
      this._showTitleScreen();
    });
  }

  _startLevel(levelNumber) {
    this.gameState = 'playing';
    this.children.removeAll(true);

    this.levelConfig = LEVELS[levelNumber - 1];
    this.stockFoods = this._buildLevelStock(this.levelConfig);
    this.grills = Array.from({ length: COLS * ROWS }, (_, i) => ({
      id: i,
      locked: i >= this.levelConfig.activeGrills,
      foods: i < this.levelConfig.activeGrills ? this._takeFoodSlots(Phaser.Math.Between(1, CAPACITY - 1)) : Array(CAPACITY).fill(null),
      plateFoods: i < this.levelConfig.activeGrills ? this._takeFoodSlots(Phaser.Math.Between(1, CAPACITY)) : Array(CAPACITY).fill(null),
    }));

    this.selected = null;
    this.dragState = null;
    this.dropTarget = null;
    this.score = 0;
    this.clearedSets = 0;
    this.timeLeft = this.levelConfig.timeSecs;
    this.isAnimating = false;
    this.moves = 0;
    this.moveHistory = [];
    this.helperUsed = false;
    this.itemUses = Object.fromEntries(ITEM_DEFS.map(item => [item.key, 1]));

    this._drawBackground();
    this._buildHUD();
    this._buildGrills();
    this._buildItemBar();

    this.gameTimer?.remove();
    this.gameTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this._onSecondTick,
      callbackScope: this,
    });
  }

  _drawBackground() {
    const W = this.scale.width;
    this.add.rectangle(W / 2, 406, W, 812, 0xc8974a);
    const bgGfx = this.add.graphics().setDepth(0).setAlpha(0.10);
    for (let r = 0; r < 22; r++) {
      for (let c = 0; c < 10; c++) {
        bgGfx.fillStyle(0x7b4f10);
        bgGfx.fillRect(c * 40 + (r % 2) * 20, r * 40, 20, 20);
      }
    }
  }

  _buildLevelStock(levelConfig) {
    const stock = [];
    for (let set = 0; set < levelConfig.targetSets; set++) {
      const id = Phaser.Utils.Array.GetRandom(levelConfig.foodIds);
      stock.push(id, id, id);
    }
    return Phaser.Utils.Array.Shuffle(stock);
  }

  _takeFoodSlots(requested) {
    const slots = Array(CAPACITY).fill(null);
    const count = Math.min(requested, this.stockFoods.length);
    const positions = Phaser.Utils.Array.Shuffle([0, 1, 2]);
    for (let i = 0; i < count; i++) {
      slots[positions[i]] = this._takeFoodAvoidingGeneratedTriple(slots);
    }
    return slots;
  }

  _takeFoodAvoidingGeneratedTriple(slots) {
    if (this.stockFoods.length === 0) return null;
    for (let i = this.stockFoods.length - 1; i >= 0; i--) {
      const candidate = this.stockFoods[i];
      if (!this._wouldCreateTriple(slots, candidate)) {
        this.stockFoods.splice(i, 1);
        return candidate;
      }
    }
    return null;
  }

  _wouldCreateTriple(slots, candidate) {
    if (!candidate) return false;
    const counts = {};
    for (const id of slots) {
      if (!id) continue;
      counts[id] = (counts[id] || 0) + 1;
    }
    return (counts[candidate] || 0) >= 2;
  }

  _filledCount(foods) {
    return foods.filter(Boolean).length;
  }

  _hasAnyFoods(foods) {
    return foods.some(Boolean);
  }

  _remainingFoodCount() {
    let total = this.stockFoods.length;
    for (const grill of this.grills) {
      if (grill.locked) continue;
      total += this._filledCount(grill.foods);
      total += this._filledCount(grill.plateFoods);
    }
    return total;
  }

  _grillPos(idx) {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    return {
      gx: GRID_X + col * CELL_W + GRILL_PAD_X,
      gy: GRID_Y + row * CELL_H + GRILL_PAD_Y,
    };
  }

  _buildHUD() {
    const W = this.scale.width;
    this.add.rectangle(W / 2, 47, W, 94, 0xb07830).setDepth(9);
    this.add.rectangle(W / 2, 94, W, 2, 0x7a4e10).setDepth(9);

    this.levelText = this.add.text(18, 28, `Lv.${this.levelConfig.level}`, {
      fontSize: '18px',
      fill: '#fff',
      fontFamily: 'sans-serif',
      backgroundColor: '#7a4e10',
      padding: { x: 10, y: 6 },
    }).setDepth(10);

    this.timerText = this.add.text(W / 2, 20, this._formatTime(this.timeLeft), {
      fontSize: '36px',
      fill: '#44ee44',
      fontFamily: 'monospace',
      stroke: '#003300',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(10);

    this.counterText = this.add.text(W - 18, 28, `0/${this.levelConfig.targetSets}`, {
      fontSize: '18px',
      fill: '#fff',
      fontFamily: 'sans-serif',
      backgroundColor: '#7a4e10',
      padding: { x: 10, y: 6 },
    }).setOrigin(1, 0).setDepth(10);

    this.add.circle(W - 22, 74, 17, 0xd4a860)
      .setDepth(10)
      .setInteractive();
    this.add.text(W - 22, 74, 'II', {
      fontSize: '14px',
      fill: '#5a3010',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);
  }

  _buildGrills() {
    this.grillGfx = this.add.graphics().setDepth(2);
    this.foodObjs = [];
    this._redrawAll();
  }

  _redrawAll() {
    this.grillGfx.clear();
    this.foodObjs.forEach(o => o.destroy());
    this.foodObjs = [];
    for (let i = 0; i < COLS * ROWS; i++) this._drawGrill(i);
  }

  _drawGrill(idx) {
    const grill = this.grills[idx];
    const { gx, gy } = this._grillPos(idx);
    const isSel = this.selected?.grillIdx === idx;
    const isDropTarget = this.dropTarget === idx;

    this.grillGfx.fillStyle(0x111111, 0.7);
    this.grillGfx.fillRoundedRect(gx - 2, gy - 2, GRILL_W + 4, GRILL_H + 4, 7);
    this.grillGfx.fillStyle(0x2a2a2a, 1);
    this.grillGfx.fillRoundedRect(gx, gy, GRILL_W, GRILL_H, 6);

    this.grillGfx.lineStyle(1.5, 0x505050, 0.9);
    for (let r = 1; r <= 2; r++) {
      this.grillGfx.lineBetween(gx + 4, gy + (GRILL_H / 3) * r, gx + GRILL_W - 4, gy + (GRILL_H / 3) * r);
    }
    for (let c = 1; c <= 5; c++) {
      this.grillGfx.lineBetween(gx + (GRILL_W / 6) * c, gy + 3, gx + (GRILL_W / 6) * c, gy + GRILL_H - 3);
    }

    if (grill.locked) {
      this._drawGrillLid(gx, gy);
      return;
    }

    if (isSel) {
      this.grillGfx.lineStyle(3, 0xffee00, 1);
      this.grillGfx.strokeRoundedRect(gx - 3, gy - 3, GRILL_W + 6, GRILL_H + 6, 9);
    }
    if (isDropTarget) {
      const canDrop = this._filledCount(grill.foods) < CAPACITY && this.dragState?.fromIdx !== idx;
      this.grillGfx.lineStyle(3, canDrop ? 0x66ff66 : 0xff3333, 1);
      this.grillGfx.strokeRoundedRect(gx - 4, gy - 4, GRILL_W + 8, GRILL_H + 8, 10);
    }

    for (let fi = 0; fi < CAPACITY; fi++) {
      const foodId = grill.foods[fi];
      if (!foodId) continue;
      const food = FOOD_MAP[foodId];
      const { x: sx, y: sy } = FOOD_SLOTS[fi];
      const ax = gx + sx;
      const ay = gy + sy;
      const isSelFood = isSel && this.selected?.foodIdx === fi;

      if (isSelFood) {
        this.grillGfx.fillStyle(0xffffff, 0.45);
        this.grillGfx.fillRoundedRect(ax - 4, ay - 4, ICON_SIZE + 8, ICON_SIZE + 8, 9);
      }

      this._addFoodImage(food, ax + ICON_SIZE / 2, ay + ICON_SIZE / 2, 38, 4, {
        draggable: true,
        grillIdx: idx,
        foodIdx: fi,
      });
    }

    const plateX = gx;
    const plateY = gy + PLATE_OFFSET;

    this.grillGfx.fillStyle(0xf2ead8, 1);
    this.grillGfx.fillRoundedRect(plateX, plateY, GRILL_W, PLATE_H, 8);
    this.grillGfx.lineStyle(1.5, 0xc8a870, 1);
    this.grillGfx.strokeRoundedRect(plateX, plateY, GRILL_W, PLATE_H, 8);
    this.grillGfx.lineStyle(1, 0xddd0b0, 0.5);
    this.grillGfx.strokeRoundedRect(plateX + 4, plateY + 3, GRILL_W - 8, PLATE_H - 6, 5);

    for (let pi = 0; pi < CAPACITY; pi++) {
      const foodId = grill.plateFoods[pi];
      if (!foodId) continue;
      const food = FOOD_MAP[foodId];
      const slotW = PLATE_ICON_SIZE + 5;
      const px = plateX + Math.floor((GRILL_W - (CAPACITY * PLATE_ICON_SIZE + 10)) / 2) + pi * slotW;
      const py = plateY + Math.floor((PLATE_H - PLATE_ICON_SIZE) / 2);
      this._addFoodImage(food, px + PLATE_ICON_SIZE / 2, py + PLATE_ICON_SIZE / 2, 26, 4);
    }
  }

  _drawGrillLid(gx, gy) {
    this.grillGfx.fillStyle(0x151515, 0.72);
    this.grillGfx.fillRoundedRect(gx - 1, gy - 1, GRILL_W + 2, GRILL_H + PLATE_GAP + PLATE_H + 2, 8);
    this.grillGfx.fillStyle(0x5a5247, 1);
    this.grillGfx.fillRoundedRect(gx + 7, gy + 9, GRILL_W - 14, GRILL_H + PLATE_GAP + PLATE_H - 12, 8);
    this.grillGfx.lineStyle(2, 0x2f2a24, 0.9);
    this.grillGfx.strokeRoundedRect(gx + 7, gy + 9, GRILL_W - 14, GRILL_H + PLATE_GAP + PLATE_H - 12, 8);
    this.grillGfx.fillStyle(0x2f2a24, 1);
    this.grillGfx.fillRoundedRect(gx + GRILL_W / 2 - 18, gy + 18, 36, 8, 4);
  }

  _addFoodImage(food, x, y, size, depth, options = {}) {
    if (this.textures.exists(food.texture)) {
      const image = this.add.image(x, y, food.texture)
        .setDisplaySize(size, size)
        .setDepth(depth);
      this._bindFoodInput(image, options);
      this.foodObjs.push(image);
      return image;
    }

    const fallback = this.add.text(x, y, food.label, {
      fontSize: `${Math.max(9, Math.floor(size * 0.38))}px`,
      fill: '#fff',
      fontFamily: 'sans-serif',
      stroke: '#000',
      strokeThickness: 2,
      backgroundColor: `#${food.color.toString(16).padStart(6, '0')}`,
      padding: { x: 4, y: 3 },
    }).setOrigin(0.5).setDepth(depth);
    this._bindFoodInput(fallback, options);
    this.foodObjs.push(fallback);
    return fallback;
  }

  _bindFoodInput(obj, options) {
    if (!options.draggable) return;
    obj.setInteractive({ useHandCursor: true });
    obj.on('pointerdown', (pointer, localX, localY, event) => {
      event?.stopPropagation();
      if (this.gameState !== 'playing' || this.isAnimating) return;
      this._beginFoodDrag(pointer, options.grillIdx, options.foodIdx);
    });
  }

  _buildItemBar() {
    const W = this.scale.width;
    const barY = GRID_Y + ROWS * CELL_H + 14;
    this.add.rectangle(W / 2, barY + 32, W, 68, 0xb07830).setDepth(5);
    this.add.rectangle(W / 2, barY, W, 2, 0x7a4e10).setDepth(5);
    this.itemBarY = barY;
    this.itemBarObjs = [];
    this._redrawItemBar();
  }

  _redrawItemBar() {
    this.itemBarObjs?.forEach(obj => obj.destroy());
    this.itemBarObjs = [];

    for (let i = 0; i < ITEM_DEFS.length; i++) {
      const item = ITEM_DEFS[i];
      const bx = 44 + i * 74;
      const uses = this.itemUses?.[item.key] ?? 0;
      const enabled = uses > 0 && this.gameState === 'playing';
      const circle = this.add.circle(bx, this.itemBarY + 30, 26, enabled ? 0xd4b07a : 0x9a7450)
        .setDepth(6)
        .setStrokeStyle(2, 0x7a5030)
        .setInteractive({ useHandCursor: enabled });
      circle.on('pointerdown', (pointer, localX, localY, event) => {
        event?.stopPropagation();
        this._useItem(item.key);
      });

      const icon = this.add.text(bx, this.itemBarY + 23, item.icon, {
        fontSize: '18px',
        fill: '#5a3010',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(7);
      const label = this.add.text(bx, this.itemBarY + 42, item.label, {
        fontSize: '9px',
        fill: '#5a3010',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(7);
      const badge = this.add.circle(bx + 18, this.itemBarY + 10, 9, uses > 0 ? 0x228822 : 0x666666).setDepth(8);
      const badgeText = this.add.text(bx + 18, this.itemBarY + 10, String(uses), {
        fontSize: '10px',
        fill: '#fff',
        fontFamily: 'sans-serif',
      }).setOrigin(0.5).setDepth(9);
      this.itemBarObjs.push(circle, icon, label, badge, badgeText);
    }
  }

  _useItem(key) {
    if (this.gameState !== 'playing' || this.isAnimating || (this.itemUses?.[key] ?? 0) <= 0) return;

    let used = false;
    if (key === 'shuffle') used = this._useShuffleItem();
    if (key === 'undo') used = this._useUndoItem();
    if (key === 'open') used = this._useOpenItem();
    if (key === 'time') used = this._useTimeItem();

    if (!used) return;
    this.itemUses[key] -= 1;
    this.helperUsed = true;
    this.selected = null;
    this._clearDragVisuals();
    this._redrawAll();
    this._redrawItemBar();
    this._updateHUD();
  }

  _useShuffleItem() {
    const slots = [];
    const ids = [];
    for (const grill of this.grills) {
      if (grill.locked) continue;
      for (let i = 0; i < CAPACITY; i++) {
        if (!grill.foods[i]) continue;
        slots.push({ grill, index: i });
        ids.push(grill.foods[i]);
      }
    }
    if (ids.length < 2) return false;

    for (let attempt = 0; attempt < 30; attempt++) {
      const shuffled = Phaser.Utils.Array.Shuffle([...ids]);
      slots.forEach((slot, index) => {
        slot.grill.foods[slot.index] = shuffled[index];
      });
      if (!this.grills.some(grill => !grill.locked && findMatchingFoods(grill.foods).length > 0)) {
        return true;
      }
    }
    slots.forEach((slot, index) => {
      slot.grill.foods[slot.index] = ids[index];
    });
    return false;
  }

  _useUndoItem() {
    const snapshot = this.moveHistory.pop();
    if (!snapshot) return false;
    this._restoreSnapshot(snapshot);
    return true;
  }

  _useOpenItem() {
    const grill = this.grills.find(candidate => candidate.locked);
    if (!grill) return false;
    grill.locked = false;
    grill.foods = this._takeFoodSlots(Phaser.Math.Between(1, CAPACITY - 1));
    grill.plateFoods = this._takeFoodSlots(Phaser.Math.Between(1, CAPACITY));
    return true;
  }

  _useTimeItem() {
    this.timeLeft += 10;
    return true;
  }

  _onPointerDown(pointer) {
    if (this.gameState !== 'playing' || this.isAnimating || !this.grills) return;
    const { x: px, y: py } = pointer;

    const foodHit = this._findFoodAt(px, py);
    if (foodHit) {
      this._beginFoodDrag(pointer, foodHit.grillIdx, foodHit.foodIdx);
      return;
    }

    const grillIdx = this._findGrillBodyAt(px, py);
    if (grillIdx !== null) {
      this._onGrillBodyTap(grillIdx);
      return;
    }

    if (this.selected) {
      this.selected = null;
      this._redrawAll();
    }
  }

  _onPointerMove(pointer) {
    if (this.gameState !== 'playing') return;
    if (!this.dragState) return;

    const dx = pointer.x - this.dragState.startX;
    const dy = pointer.y - this.dragState.startY;
    if (!this.dragState.hasMoved && Math.hypot(dx, dy) < DRAG_START_DISTANCE) return;

    if (!this.dragState.hasMoved) {
      this.dragState.hasMoved = true;
      this.selected = { grillIdx: this.dragState.fromIdx, foodIdx: this.dragState.foodIdx };
    }

    this._positionDragGhost(pointer);
    const nextDropTarget = this._findDropTargetAt(pointer.x, pointer.y);
    if (nextDropTarget !== this.dropTarget) {
      this.dropTarget = nextDropTarget;
      this._redrawAll();
      this._positionDragGhost(pointer);
    }
  }

  _onPointerUp(pointer) {
    if (this.gameState !== 'playing') return;
    if (!this.dragState) return;

    const drag = this.dragState;
    const dropIdx = this._findDropTargetAt(pointer.x, pointer.y);
    this._clearDragVisuals();

    if (!drag.hasMoved) {
      this._onFoodTap(drag.fromIdx, drag.foodIdx);
      return;
    }

    if (dropIdx !== null && dropIdx !== drag.fromIdx) {
      this._moveFood(drag.fromIdx, drag.foodIdx, dropIdx, drag.foodIdx);
      return;
    }

    this.selected = null;
    this._redrawAll();
  }

  _findFoodAt(px, py) {
    for (let gi = 0; gi < COLS * ROWS; gi++) {
      const grill = this.grills[gi];
      if (grill.locked) continue;
      const { gx, gy } = this._grillPos(gi);
      for (let fi = 0; fi < CAPACITY; fi++) {
        if (!grill.foods[fi]) continue;
        const ax = gx + FOOD_SLOTS[fi].x;
        const ay = gy + FOOD_SLOTS[fi].y;
        if (
          px >= ax - FOOD_HIT_PAD &&
          px < ax + ICON_SIZE + FOOD_HIT_PAD &&
          py >= ay - FOOD_HIT_PAD &&
          py < ay + ICON_SIZE + FOOD_HIT_PAD
        ) {
          return { grillIdx: gi, foodIdx: fi };
        }
      }
    }
    return null;
  }

  _findGrillBodyAt(px, py) {
    for (let gi = 0; gi < COLS * ROWS; gi++) {
      if (this.grills[gi].locked) continue;
      const { gx, gy } = this._grillPos(gi);
      if (px >= gx && px < gx + GRILL_W && py >= gy && py < gy + GRILL_H) return gi;
    }
    return null;
  }

  _findDropTargetAt(px, py) {
    for (let gi = 0; gi < COLS * ROWS; gi++) {
      if (this.grills[gi].locked) continue;
      const { gx, gy } = this._grillPos(gi);
      const left = gx - DROP_HIT_PAD;
      const top = gy - DROP_HIT_PAD;
      const right = gx + GRILL_W + DROP_HIT_PAD;
      const bottom = gy + GRILL_H + PLATE_GAP + PLATE_H + DROP_HIT_PAD;
      if (px >= left && px < right && py >= top && py < bottom) return gi;
    }
    return null;
  }

  _beginFoodDrag(pointer, grillIdx, foodIdx) {
    this._clearDragVisuals();
    this.dragState = {
      fromIdx: grillIdx,
      foodIdx,
      foodId: this.grills[grillIdx].foods[foodIdx],
      startX: pointer.x,
      startY: pointer.y,
      hasMoved: false,
      ghost: null,
    };
    this._createDragGhost(pointer);
  }

  _createDragGhost(pointer) {
    if (!this.dragState) return;
    const food = FOOD_MAP[this.dragState.foodId];
    this.dragState.ghost = this.add.image(pointer.x, pointer.y, food.texture)
      .setDisplaySize(DRAG_GHOST_SIZE, DRAG_GHOST_SIZE)
      .setAlpha(0.9)
      .setDepth(25);
    this._positionDragGhost(pointer);
  }

  _positionDragGhost(pointer) {
    if (!this.dragState?.ghost) return;
    this.dragState.ghost.setPosition(pointer.x, pointer.y + DRAG_GHOST_OFFSET_Y);
  }

  _clearDragVisuals() {
    this.dragState?.ghost?.destroy();
    this.dragState = null;
    this.dropTarget = null;
  }

  _onFoodTap(grillIdx, foodIdx) {
    if (!this.selected) {
      this.selected = { grillIdx, foodIdx };
      this._redrawAll();
    } else if (this.selected.grillIdx === grillIdx) {
      this.selected = null;
      this._redrawAll();
    } else {
      this._moveFood(this.selected.grillIdx, this.selected.foodIdx, grillIdx, this.selected.foodIdx);
    }
  }

  _onGrillBodyTap(grillIdx) {
    if (!this.selected) return;
    if (this.selected.grillIdx === grillIdx) {
      this.selected = null;
      this._redrawAll();
      return;
    }
    this._moveFood(this.selected.grillIdx, this.selected.foodIdx, grillIdx, this.selected.foodIdx);
  }

  _moveFood(fromIdx, fromFoodIdx, toIdx, preferredSlot = fromFoodIdx) {
    const src = this.grills[fromIdx];
    const dst = this.grills[toIdx];

    if (src.locked || dst.locked || this._filledCount(dst.foods) >= CAPACITY) {
      this._shakeFeedback(toIdx);
      this.selected = null;
      this._redrawAll();
      return;
    }

    const foodId = src.foods[fromFoodIdx];
    if (!foodId) return;

    const snapshot = this._snapshotState();
    const toFoodIdx = this._resolveDropSlot(dst.foods, preferredSlot);
    src.foods[fromFoodIdx] = null;
    dst.foods[toFoodIdx] = foodId;
    this.selected = null;
    this.moves += 1;
    this.moveHistory.push(snapshot);
    if (this.moveHistory.length > 20) this.moveHistory.shift();

    const refilledSource = this._refillEmptyGrill(fromIdx);
    this._redrawAll();
    this._checkMatch(toIdx);
    if (!this.isAnimating && refilledSource) this._checkMatch(fromIdx);
  }

  _resolveDropSlot(foods, preferredSlot) {
    if (!foods[preferredSlot]) return preferredSlot;
    return foods.findIndex(id => !id);
  }

  _snapshotState() {
    return {
      grills: this.grills.map(grill => ({
        id: grill.id,
        locked: grill.locked,
        foods: [...grill.foods],
        plateFoods: [...grill.plateFoods],
      })),
      stockFoods: [...this.stockFoods],
      score: this.score,
      clearedSets: this.clearedSets,
      timeLeft: this.timeLeft,
      moves: this.moves,
    };
  }

  _restoreSnapshot(snapshot) {
    this.grills = snapshot.grills.map(grill => ({
      id: grill.id,
      locked: grill.locked,
      foods: [...grill.foods],
      plateFoods: [...grill.plateFoods],
    }));
    this.stockFoods = [...snapshot.stockFoods];
    this.score = snapshot.score;
    this.clearedSets = snapshot.clearedSets;
    this.timeLeft = snapshot.timeLeft;
    this.moves = snapshot.moves;
  }

  _checkMatch(grillIdx) {
    const grill = this.grills[grillIdx];
    const matches = findMatchingFoods(grill.foods);
    if (matches.length === 0) return;

    this.isAnimating = true;
    let gained = 0;

    this._flashGrill(grillIdx, () => {
      for (const foodId of matches) {
        grill.foods = removeThree(grill.foods, foodId);
        this.clearedSets += 1;
        this.score += 150;
        gained += 150;
      }
      this._showScorePopup(`+${gained}`, grillIdx);
      this._updateHUD();

      const afterClear = () => {
        this._redrawAll();

        if (this._remainingFoodCount() === 0) {
          this.isAnimating = false;
          this.time.delayedCall(500, () => this._onLevelClear());
          return;
        }

        this.time.delayedCall(180, () => {
          this.isAnimating = false;
          this._checkMatch(grillIdx);
        });
      };

      if (!this._hasAnyFoods(grill.foods) && this._canRefillGrill(grill)) {
        this.time.delayedCall(250, () => {
          this._refillEmptyGrill(grillIdx);
          afterClear();
        });
      } else {
        afterClear();
      }
    });
  }

  _canRefillGrill(grill) {
    return !grill.locked && (this._hasAnyFoods(grill.plateFoods) || this.stockFoods.length > 0);
  }

  _refillEmptyGrill(grillIdx) {
    const grill = this.grills[grillIdx];
    if (this._hasAnyFoods(grill.foods) || !this._canRefillGrill(grill)) return false;

    if (this._hasAnyFoods(grill.plateFoods)) {
      grill.foods = [...grill.plateFoods];
    } else {
      grill.foods = this._takeFoodSlots(Phaser.Math.Between(1, CAPACITY));
    }
    grill.plateFoods = this._takeFoodSlots(Phaser.Math.Between(1, CAPACITY));
    return true;
  }

  _onSecondTick() {
    this.timeLeft--;
    this._updateHUD();
    if (this.timeLeft <= 0) {
      this.gameTimer.remove();
      this._onTimeUp();
    }
  }

  _formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  _updateHUD() {
    this.timerText.setText(this._formatTime(this.timeLeft));
    this.counterText.setText(`${this.clearedSets}/${this.levelConfig.targetSets}`);
    this.timerText.setStyle({ fill: this.timeLeft <= 10 ? '#ff4444' : '#44ee44' });
  }

  _flashGrill(grillIdx, onComplete) {
    const { gx, gy } = this._grillPos(grillIdx);
    const gfx = this.add.graphics().setDepth(8);
    let n = 0;
    const tick = () => {
      gfx.clear();
      if (n % 2 === 0) {
        gfx.fillStyle(0xffff88, 0.7);
        gfx.fillRoundedRect(gx, gy, GRILL_W, GRILL_H, 6);
      }
      if (++n < 6) this.time.delayedCall(80, tick);
      else {
        gfx.destroy();
        onComplete();
      }
    };
    tick();
  }

  _showScorePopup(text, grillIdx) {
    const { gx, gy } = this._grillPos(grillIdx);
    const t = this.add.text(gx + GRILL_W / 2, gy + GRILL_H / 2, text, {
      fontSize: '26px',
      fill: '#ffff00',
      fontFamily: 'sans-serif',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: t,
      y: gy - 18,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    });
  }

  _shakeFeedback(grillIdx) {
    const { gx, gy } = this._grillPos(grillIdx);
    const gfx = this.add.graphics().setDepth(8);
    gfx.lineStyle(3, 0xff3333, 1);
    gfx.strokeRoundedRect(gx - 1, gy - 1, GRILL_W + 2, GRILL_H + 2, 7);
    this.time.delayedCall(350, () => gfx.destroy());
  }

  _onLevelClear() {
    this.gameTimer?.remove();
    const stars = this._calculateStars();
    this._saveLevelRecord(stars);
    if (this.levelConfig.level >= LEVELS.length) {
      this._resultOverlay('ALL CLEAR!', 'TITLE', () => this._showTitleScreen(), stars);
      return;
    }
    this._resultOverlay('LEVEL CLEAR!', 'NEXT', () => this._startLevel(this.levelConfig.level + 1), stars);
  }

  _onTimeUp() {
    this._overlay('TIME UP!', '#ff4444', `${this.clearedSets} / ${this.levelConfig.targetSets}  MOVES: ${this.moves}`, 'RETRY', () => {
      this._startLevel(this.levelConfig.level);
    });
  }

  _calculateStars() {
    if (this.helperUsed) return 1;
    const timeRatio = this.timeLeft / this.levelConfig.timeSecs;
    const parMoves = Math.max(1, this.levelConfig.targetSets * 2);
    if (timeRatio >= 0.35 && this.moves <= parMoves) return 3;
    if (timeRatio >= 0.15 && this.moves <= Math.ceil(parMoves * 1.5)) return 2;
    return 1;
  }

  _formatStars(stars) {
    return '*'.repeat(stars).padEnd(3, '-');
  }

  _loadRecords() {
    try {
      return JSON.parse(window.localStorage.getItem(RECORDS_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  _saveLevelRecord(stars) {
    const records = this._loadRecords();
    const level = this.levelConfig.level;
    const current = {
      stars,
      moves: this.moves,
      timeLeft: Math.max(0, this.timeLeft),
    };
    const previous = records[level];
    const isBetter = !previous ||
      current.stars > previous.stars ||
      (current.stars === previous.stars && current.timeLeft > previous.timeLeft) ||
      (current.stars === previous.stars && current.timeLeft === previous.timeLeft && current.moves < previous.moves);
    if (!isBetter) return;

    records[level] = current;
    try {
      window.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch (error) {
      // Local storage may be unavailable in private browsing. The run can continue without records.
    }
  }

  _resultOverlay(title, buttonText, onButton, stars) {
    const W = this.scale.width;
    this.gameState = 'overlay';
    this.isAnimating = true;
    this.add.rectangle(W / 2, 406, W, 812, 0x000000, 0.62).setDepth(30);
    this.add.text(W / 2, 230, title, {
      fontSize: '42px',
      fill: '#ffee00',
      fontFamily: 'sans-serif',
      stroke: '#000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(31);
    this.add.text(W / 2, 302, this._formatStars(stars), {
      fontSize: '38px',
      fill: '#ffcc22',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#3a2100',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(31);
    const lines = [
      `MOVES: ${this.moves}`,
      `TIME LEFT: ${this._formatTime(Math.max(0, this.timeLeft))}`,
      this.helperUsed ? 'HELPER USED: STAR 1' :
        (this.levelConfig.level >= LEVELS.length ? 'ALL LEVELS COMPLETE' : `NEXT: Lv.${this.levelConfig.level + 1}`),
    ];
    for (let i = 0; i < lines.length; i++) {
      this.add.text(W / 2, 360 + i * 34, lines[i], {
        fontSize: '20px',
        fill: '#fff',
        fontFamily: 'sans-serif',
      }).setOrigin(0.5).setDepth(31);
    }
    this.add.text(W / 2, 500, buttonText, {
      fontSize: '22px',
      fill: '#ffdd00',
      fontFamily: 'sans-serif',
      stroke: '#000',
      strokeThickness: 2,
      backgroundColor: '#7a3300',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer, localX, localY, event) => {
        event?.stopPropagation();
        onButton();
      });
  }

  _overlay(title, titleColor, sub, buttonText, onButton) {
    const W = this.scale.width;
    this.gameState = 'overlay';
    this.isAnimating = true;
    this.add.rectangle(W / 2, 406, W, 812, 0x000000, 0.6).setDepth(30);
    this.add.text(W / 2, 290, title, {
      fontSize: '48px',
      fill: titleColor,
      fontFamily: 'sans-serif',
      stroke: '#000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(31);
    this.add.text(W / 2, 372, sub, {
      fontSize: '24px',
      fill: '#fff',
      fontFamily: 'sans-serif',
    }).setOrigin(0.5).setDepth(31);
    this.add.text(W / 2, 452, buttonText, {
      fontSize: '22px',
      fill: '#ffdd00',
      fontFamily: 'sans-serif',
      stroke: '#000',
      strokeThickness: 2,
      backgroundColor: '#7a3300',
      padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer, localX, localY, event) => {
        event?.stopPropagation();
        onButton();
      });
  }
}
