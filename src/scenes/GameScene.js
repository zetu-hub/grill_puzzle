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
const DRAG_GHOST_OFFSET_Y = 0;
const DROP_HIT_PAD = 10;
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

    const start = this.add.text(W / 2, 390, 'START', {
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

    const icons = ['S', 'R', 'H', 'F'];
    const labels = ['', '', 'Lv.8', 'Lv.20'];
    const locked = [false, false, true, true];
    for (let i = 0; i < 4; i++) {
      const bx = 44 + i * 74;
      this.add.circle(bx, barY + 30, 26, locked[i] ? 0x9a7450 : 0xd4b07a)
        .setDepth(6)
        .setStrokeStyle(2, 0x7a5030);
      this.add.text(bx, barY + 30, icons[i], {
        fontSize: '18px',
        fill: '#5a3010',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(7);
      if (labels[i]) {
        this.add.text(bx, barY + 56, labels[i], {
          fontSize: '10px',
          fill: '#5a3010',
          fontFamily: 'sans-serif',
        }).setOrigin(0.5).setDepth(7);
      }
      if (!locked[i]) {
        this.add.circle(bx + 18, barY + 10, 9, 0x228822).setDepth(8);
        this.add.text(bx + 18, barY + 10, '1', {
          fontSize: '10px',
          fill: '#fff',
          fontFamily: 'sans-serif',
        }).setOrigin(0.5).setDepth(9);
      }
    }
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

    const toFoodIdx = this._resolveDropSlot(dst.foods, preferredSlot);
    src.foods[fromFoodIdx] = null;
    dst.foods[toFoodIdx] = foodId;
    this.selected = null;

    const refilledSource = this._refillEmptyGrill(fromIdx);
    this._redrawAll();
    this._checkMatch(toIdx);
    if (!this.isAnimating && refilledSource) this._checkMatch(fromIdx);
  }

  _resolveDropSlot(foods, preferredSlot) {
    if (!foods[preferredSlot]) return preferredSlot;
    return foods.findIndex(id => !id);
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
    if (this.levelConfig.level >= LEVELS.length) {
      this._overlay('ALL CLEAR!', '#ffee00', `SCORE: ${this.score}`, 'TITLE', () => this._showTitleScreen());
      return;
    }
    this._overlay(
      'LEVEL CLEAR!',
      '#ffee00',
      `NEXT: Lv.${this.levelConfig.level + 1}`,
      'NEXT',
      () => this._startLevel(this.levelConfig.level + 1),
    );
  }

  _onTimeUp() {
    this._overlay('TIME UP!', '#ff4444', `${this.clearedSets} / ${this.levelConfig.targetSets}`, 'RETRY', () => {
      this._startLevel(this.levelConfig.level);
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
