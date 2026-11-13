export const LANGS = [
  ['en', 'English'], ['es', 'Español'], ['fr', 'Français'],
  ['ja', '日本語'], ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'],
];

const S = {
  en: {
    tagline: 'Plow oceans of gems. Crush them into gold. Get bigger.',
    play: 'Play', cont: 'Continue', newGame: 'New game', confirmNew: 'Tap again to erase progress',
    hintDrag: 'Drag anywhere to drive', hintKeys: 'WASD / arrows, or drag to drive',
    hintCrush: 'Push the gems into the crusher!', hintPads: 'Push coins onto a pad to upgrade',
    zones: ['Dirt Quarry', 'Lava Canyon', 'Ice Field', 'Jungle Ruin', 'Treasure Vault'],
    blade: 'Blade', speed: 'Speed', crusher: 'Crusher', bridge: 'Bridge', conveyor: 'Conveyor',
    next: 'Next Zone', statue: 'Golden Cat', lv: 'Lv',
    unlocked: 'New zone unlocked!', upgraded: '{name} Lv {lv}!', conveyorOn: 'Conveyor online!',
    endTitle: 'The Golden Cat awakens!', endSub: 'You plowed the whole ad. For real this time.',
    gems: 'Gems crushed', time: 'Play time', again: 'Play again', mute: 'Sound',
  },
  es: {
    tagline: 'Ara océanos de gemas. Tritúralas en oro. Hazte enorme.',
    play: 'Jugar', cont: 'Continuar', newGame: 'Nueva partida', confirmNew: 'Toca otra vez para borrar el progreso',
    hintDrag: 'Arrastra en cualquier lugar para conducir', hintKeys: 'WASD / flechas, o arrastra para conducir',
    hintCrush: '¡Empuja las gemas a la trituradora!', hintPads: 'Empuja monedas sobre una plataforma para mejorar',
    zones: ['Cantera de Tierra', 'Cañón de Lava', 'Campo de Hielo', 'Ruina de la Jungla', 'Cámara del Tesoro'],
    blade: 'Pala', speed: 'Velocidad', crusher: 'Trituradora', bridge: 'Puente', conveyor: 'Cinta',
    next: 'Siguiente zona', statue: 'Gato Dorado', lv: 'Nv',
    unlocked: '¡Nueva zona desbloqueada!', upgraded: '¡{name} Nv {lv}!', conveyorOn: '¡Cinta en marcha!',
    endTitle: '¡El Gato Dorado despierta!', endSub: 'Has arado todo el anuncio. Esta vez de verdad.',
    gems: 'Gemas trituradas', time: 'Tiempo de juego', again: 'Jugar de nuevo', mute: 'Sonido',
  },
  fr: {
    tagline: 'Labourez des océans de gemmes. Broyez-les en or. Devenez énorme.',
    play: 'Jouer', cont: 'Continuer', newGame: 'Nouvelle partie', confirmNew: 'Touchez encore pour tout effacer',
    hintDrag: 'Glissez n’importe où pour conduire', hintKeys: 'ZQSD / flèches, ou glissez pour conduire',
    hintCrush: 'Poussez les gemmes dans le broyeur !', hintPads: 'Poussez les pièces sur une dalle pour améliorer',
    zones: ['Carrière de terre', 'Canyon de lave', 'Champ de glace', 'Ruine de la jungle', 'Salle du trésor'],
    blade: 'Lame', speed: 'Vitesse', crusher: 'Broyeur', bridge: 'Pont', conveyor: 'Tapis',
    next: 'Zone suivante', statue: 'Chat d’or', lv: 'Nv',
    unlocked: 'Nouvelle zone débloquée !', upgraded: '{name} Nv {lv} !', conveyorOn: 'Tapis en marche !',
    endTitle: 'Le Chat d’or s’éveille !', endSub: 'Vous avez labouré toute la pub. Pour de vrai, cette fois.',
    gems: 'Gemmes broyées', time: 'Temps de jeu', again: 'Rejouer', mute: 'Son',
  },
  ja: {
    tagline: '宝石の海を押しまくれ。砕いて金貨に。もっと大きく。',
    play: 'プレイ', cont: 'つづける', newGame: 'はじめから', confirmNew: 'もう一度タップでデータを消去',
    hintDrag: 'どこでもドラッグして運転', hintKeys: 'WASD・矢印キー、またはドラッグで運転',
    hintCrush: '宝石をクラッシャーに押し込もう！', hintPads: 'コインをパッドに押してアップグレード',
    zones: ['土の採石場', '溶岩の峡谷', '氷原', 'ジャングル遺跡', '宝物庫'],
    blade: 'ブレード', speed: 'スピード', crusher: 'クラッシャー', bridge: '橋', conveyor: 'コンベア',
    next: '次のエリア', statue: '黄金のネコ', lv: 'Lv',
    unlocked: '新エリア解放！', upgraded: '{name} Lv {lv}！', conveyorOn: 'コンベア稼働！',
    endTitle: '黄金のネコが目覚めた！', endSub: 'あの広告のゲーム、ついに本当に完全制覇。',
    gems: '砕いた宝石', time: 'プレイ時間', again: 'もう一度', mute: 'サウンド',
  },
  'zh-CN': {
    tagline: '推平宝石的海洋，碾成金币，越变越大。',
    play: '开始', cont: '继续', newGame: '新游戏', confirmNew: '再点一次以清除进度',
    hintDrag: '在任意位置拖动来驾驶', hintKeys: 'WASD / 方向键，或拖动来驾驶',
    hintCrush: '把宝石推进粉碎机！', hintPads: '把金币推到升级板上来升级',
    zones: ['泥土采石场', '熔岩峡谷', '冰原', '丛林遗迹', '宝藏金库'],
    blade: '推铲', speed: '速度', crusher: '粉碎机', bridge: '桥', conveyor: '传送带',
    next: '下一区域', statue: '黄金猫', lv: 'Lv',
    unlocked: '新区域已解锁！', upgraded: '{name} Lv {lv}！', conveyorOn: '传送带已启动！',
    endTitle: '黄金猫苏醒了！', endSub: '你把整个广告都推平了，这次是真的。',
    gems: '粉碎的宝石', time: '游戏时间', again: '再玩一次', mute: '声音',
  },
  'zh-TW': {
    tagline: '推平寶石的海洋，碾成金幣，越變越大。',
    play: '開始', cont: '繼續', newGame: '新遊戲', confirmNew: '再點一次以清除進度',
    hintDrag: '在任意位置拖曳來駕駛', hintKeys: 'WASD / 方向鍵，或拖曳來駕駛',
    hintCrush: '把寶石推進粉碎機！', hintPads: '把金幣推到升級板上來升級',
    zones: ['泥土採石場', '熔岩峽谷', '冰原', '叢林遺跡', '寶藏金庫'],
    blade: '推鏟', speed: '速度', crusher: '粉碎機', bridge: '橋', conveyor: '輸送帶',
    next: '下一區域', statue: '黃金貓', lv: 'Lv',
    unlocked: '新區域已解鎖！', upgraded: '{name} Lv {lv}！', conveyorOn: '輸送帶已啟動！',
    endTitle: '黃金貓甦醒了！', endSub: '你把整個廣告都推平了，這次是真的。',
    gems: '粉碎的寶石', time: '遊戲時間', again: '再玩一次', mute: '聲音',
  },
};

let lang = 'en';

export function detectLang() {
  for (const l of navigator.languages || [navigator.language || 'en']) {
    const low = l.toLowerCase();
    if (low.startsWith('zh')) {
      return (low.includes('tw') || low.includes('hk') || low.includes('mo') || low.includes('hant')) ? 'zh-TW' : 'zh-CN';
    }
    const p = low.slice(0, 2);
    if (S[p]) return p;
  }
  return 'en';
}

export function setLang(l) { lang = S[l] ? l : 'en'; document.documentElement.lang = lang; }
export function getLang() { return lang; }
export function t(key, vars) {
  let s = S[lang][key] ?? S.en[key] ?? key;
  if (vars && typeof s === 'string') for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
