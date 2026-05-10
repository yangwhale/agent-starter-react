// Mood map for Live2D backgrounds + expression triggers.
//
// Architecture: bot can emit 50+ Gemini TTS emotion tags, but Natori only
// supports 8 base expressions. We expose 20 distinct "moods" — each mood has
// its own background color (so the user sees emotion shifts visually) but
// reuses one of Natori's 8 expressions. Tag → mood mapping is one-to-many,
// 50+ Gemini tags fan out into these 20 moods.
//
// Expression name reference (from public/live2d/natori/Natori.model3.json):
// Normal | Smile | exp_02 | Angry | exp_03 | Surprised | Blushing | Sad
// (also exp_01 / exp_04 / exp_05 available but unused).

export type EmotionKey =
  | 'calm'
  | 'focused'
  | 'curious'
  | 'confident'
  | 'friendly'
  | 'happy'
  | 'excited'
  | 'amused'
  | 'realization'
  | 'confused'
  | 'informative'
  | 'concerned'
  | 'serious'
  | 'urgent'
  | 'frustrated'
  | 'angry'
  | 'disappointed'
  | 'sad'
  | 'tired'
  | 'shy';

export interface EmotionConfig {
  icon: string;
  name: string;
  ttsTags: string[];
  /** Natori expression name. Multiple moods may share the same expression. */
  expression: string;
  motion: { group: string; index?: number };
  /** CSS gradient fallback; used when bgImage is empty. */
  bg: string;
  /**
   * Optional background image URL (e.g. '/live2d/backgrounds/happy.jpg').
   * When set, takes priority over `bg`. Rendered as `cover center` no-repeat.
   */
  bgImage?: string;
}

// Each mood gets a distinct color stripe so the user can eyeball emotion
// transitions even before real images are dropped in. Replace the `bg` (or
// add `bgImage`) per mood when artwork lands.
export const EMOTIONS: Record<EmotionKey, EmotionConfig> = {
  // ───── 中性 / 思考 ─────
  calm: {
    icon: '😌',
    name: '平静',
    ttsTags: ['[calm]', '[calmly]', '[casually]', '[neutral]', '[serenity]', '[relaxation]'],
    expression: 'Normal',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #e0f2f1 0%, #e8eaf6 50%, #e3f2fd 100%)',
    bgImage: '/live2d/backgrounds/calm.png',
  },
  focused: {
    icon: '🤔',
    name: '专注',
    ttsTags: [
      '[focus]',
      '[thinking]',
      '[analysis]',
      '[contemplative]',
      '[reflection]',
      '[pensive]',
      '[planning]',
      '[thoughtfully]',
      '[speculation]',
    ],
    expression: 'Normal',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #cfd8dc 0%, #b0bec5 50%, #90a4ae 100%)',
    bgImage: '/live2d/backgrounds/focused.png',
  },
  curious: {
    icon: '🧐',
    name: '好奇',
    ttsTags: ['[curious]', '[curiosity]', '[wondering]'],
    expression: 'Surprised',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #ede7f6 0%, #d1c4e9 50%, #b39ddb 100%)',
    bgImage: '/live2d/backgrounds/curious.png',
  },
  confident: {
    icon: '😎',
    name: '自信',
    ttsTags: ['[confidence]', '[determination]', '[assertive]', '[pride]', '[certainty]'],
    expression: 'Normal',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #fff8e1 0%, #ffecb3 50%, #ffd54f 100%)',
    bgImage: '/live2d/backgrounds/confident.png',
  },

  // ───── 积极 / 愉悦 ─────
  friendly: {
    icon: '🙂',
    name: '友好',
    ttsTags: ['[friendly]', '[cheerful]', '[cheerfully]', '[contentment]'],
    expression: 'Smile',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #fff3e0 0%, #ffe0b2 50%, #ffcc80 100%)',
    bgImage: '/live2d/backgrounds/friendly.png',
  },
  happy: {
    icon: '😊',
    name: '开心',
    ttsTags: ['[happy]', '[joy]', '[pleased]', '[satisfaction]', '[optimism]'],
    expression: 'Smile',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #fffde7 0%, #fff59d 50%, #fff176 100%)',
    bgImage: '/live2d/backgrounds/happy.png',
  },
  excited: {
    icon: '🤩',
    name: '兴奋',
    ttsTags: ['[excited]', '[excitedly]', '[excitement]', '[enthusiasm]', '[amazed]', '[triumph]'],
    expression: 'exp_02',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #fce4ec 0%, #f8bbd0 50%, #f48fb1 100%)',
    bgImage: '/live2d/backgrounds/excited.png',
  },
  amused: {
    icon: '😆',
    name: '逗乐',
    ttsTags: ['[amused]', '[amusement]', '[humor]', '[playful]', '[laughs]', '[laughing]'],
    expression: 'Smile',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #ffe0b2 0%, #ffab91 50%, #ff8a65 100%)',
    bgImage: '/live2d/backgrounds/amused.png',
  },

  // ───── 惊讶 / 顿悟 ─────
  realization: {
    icon: '💡',
    name: '恍然',
    ttsTags: ['[realization]', '[amazement]', '[surprise]', '[surprised]', '[disbelief]'],
    expression: 'Surprised',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%)',
    bgImage: '/live2d/backgrounds/realization.png',
  },
  confused: {
    icon: '😕',
    name: '困惑',
    ttsTags: ['[confusion]', '[uncertainty]', '[doubt]'],
    expression: 'Surprised',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #eceff1 0%, #cfd8dc 50%, #b0bec5 100%)',
    bgImage: '/live2d/backgrounds/confused.png',
  },

  // ───── 说明 / 中性陈述 ─────
  informative: {
    icon: '📖',
    name: '说明',
    ttsTags: ['[informative]', '[explaining]', '[summary]', '[instruction]', '[suggestion]'],
    expression: 'Normal',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
    bgImage: '/live2d/backgrounds/informative.png',
  },

  // ───── 严肃 / 警示 ─────
  concerned: {
    icon: '😟',
    name: '担忧',
    ttsTags: ['[concern]', '[caution]', '[warning]'],
    expression: 'exp_03',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #fff9c4 0%, #fff176 50%, #ffd54f 100%)',
    bgImage: '/live2d/backgrounds/concerned.png',
  },
  serious: {
    icon: '😐',
    name: '严肃',
    ttsTags: ['[serious]', '[seriously]', '[seriousness]', '[emphasis]'],
    expression: 'exp_03',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #c5cae9 0%, #9fa8da 50%, #7986cb 100%)',
    bgImage: '/live2d/backgrounds/serious.png',
  },
  urgent: {
    icon: '⚡',
    name: '急迫',
    ttsTags: ['[urgency]', '[urgent]', '[gasp]'],
    expression: 'Surprised',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #ffccbc 0%, #ff8a65 50%, #ff5722 100%)',
    bgImage: '/live2d/backgrounds/urgent.png',
  },

  // ───── 负面 / 怒/烦 ─────
  frustrated: {
    icon: '😤',
    name: '烦躁',
    ttsTags: [
      '[frustrated]',
      '[frustration]',
      '[sarcasm]',
      '[sarcastic]',
      '[scornful]',
      '[self-deprecation]',
    ],
    expression: 'exp_03',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #efebe9 0%, #d7ccc8 50%, #bcaaa4 100%)',
    bgImage: '/live2d/backgrounds/frustrated.png',
  },
  angry: {
    icon: '😡',
    name: '生气',
    ttsTags: ['[angry]'],
    expression: 'Angry',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #ffcdd2 0%, #ef9a9a 50%, #e57373 100%)',
    bgImage: '/live2d/backgrounds/angry.png',
  },

  // ───── 沮丧 / 难过 / 疲惫 ─────
  disappointed: {
    icon: '😞',
    name: '失望',
    ttsTags: ['[disappointment]', '[regret]'],
    expression: 'Sad',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #d1c4e9 0%, #b39ddb 50%, #9575cd 100%)',
    bgImage: '/live2d/backgrounds/disappointed.png',
  },
  sad: {
    icon: '😢',
    name: '难过',
    ttsTags: ['[sad]', '[crying]', '[sighs]'],
    expression: 'Sad',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #bbdefb 0%, #90caf9 50%, #64b5f6 100%)',
    bgImage: '/live2d/backgrounds/sad.png',
  },
  tired: {
    icon: '😩',
    name: '疲惫',
    ttsTags: ['[exhaustion]', '[weariness]', '[bored]'],
    expression: 'Sad',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #d7ccc8 0%, #a1887f 50%, #8d6e63 100%)',
    bgImage: '/live2d/backgrounds/tired.png',
  },

  // ───── 害羞 / 共情 ─────
  shy: {
    icon: '😳',
    name: '害羞',
    ttsTags: ['[empathetic]', '[bashful]', '[shy]', '[whispers]'],
    expression: 'Blushing',
    motion: { group: 'Idle' },
    bg: 'linear-gradient(160deg, #f8bbd0 0%, #f48fb1 50%, #f06292 100%)',
    bgImage: '/live2d/backgrounds/shy.png',
  },
};

export const TAG_TO_EMOTION: Record<string, EmotionKey> = (() => {
  const map: Record<string, EmotionKey> = {};
  (Object.entries(EMOTIONS) as Array<[EmotionKey, EmotionConfig]>).forEach(([key, emo]) => {
    emo.ttsTags.forEach((tag) => {
      map[tag.toLowerCase()] = key;
    });
  });
  return map;
})();

export function extractEmotion(text: string | undefined | null): EmotionKey {
  if (!text) return 'calm';
  // LiveKit transcription accumulates the full message text as the bot streams.
  // Take the LAST recognized tag so the background tracks the most recently
  // emitted emotion rather than getting stuck on whatever the first chunk used.
  const matches = Array.from(text.matchAll(/\[([a-zA-Z_-]+)\]/g));
  for (let i = matches.length - 1; i >= 0; i--) {
    const tag = `[${matches[i][1].toLowerCase()}]`;
    if (TAG_TO_EMOTION[tag]) return TAG_TO_EMOTION[tag];
  }
  return 'calm';
}

/**
 * Resolve the CSS `background` shorthand for an emotion. Prefers `bgImage`
 * when present (rendered as `cover center` no-repeat); falls back to the
 * gradient otherwise.
 */
export function resolveEmotionBackground(emo: EmotionConfig): string {
  if (emo.bgImage) {
    return `url(${emo.bgImage}) center/cover no-repeat`;
  }
  return emo.bg;
}
