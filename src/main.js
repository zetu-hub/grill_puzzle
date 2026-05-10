import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  width: 375,
  height: 812,
  backgroundColor: '#c8974a',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  parent: document.body,
};

new Phaser.Game(config);
