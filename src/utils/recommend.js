import p1 from '../data/generals-p1.json'
import p2 from '../data/generals-p2.json'
import p3 from '../data/generals-p3.json'
import p4 from '../data/generals-p4.json'
import p5 from '../data/generals-p5.json'
import p6 from '../data/generals-p6.json'
import p7 from '../data/generals-p7.json'
import p8 from '../data/generals-p8.json'
import p9 from '../data/generals-p9.json'
import p10 from '../data/generals-p10.json'
import SUMMON_SKILL_MAP from '../data/summonSkillMap.json'

export const data = [...p1,...p2,...p3,...p4,...p5,...p6,...p7,...p8,...p9,...p10]

// 带边界的标签匹配：前后紧邻字符不能是中文字
function containsTag(text, t) {
  const isNonBoundary = c => c !== undefined && /[一-鿿0-9\*]/.test(c)
  let idx = text.indexOf(t)
  while (idx !== -1) {
    const before = text[idx - 1]
    const after = text[idx + t.length]
    if (!isNonBoundary(before) && !isNonBoundary(after)) return true
    idx = text.indexOf(t, idx + 1)
  }
  return false
}

// 属性球标签集合
const ABILITY_TAGS = new Set(['炎','雷','斩','风','冰','智','魅','力','技','坚','速'])

// 属性球对应的状态词（命中任意状态词也视为命中该属性球）
const ABILITY_STATE_MAP = {
  '冰': ['结冰'],
  '炎': ['火炎'],
  '雷': ['触电'],
  '风': ['强风'],
  '斩': ['裂伤', '斩击'],
}

// 属性球标签专用匹配：前一字符为引号、后两字符为"属性"，或命中对应状态词
function containsAbilityTag(effect, t) {
  // 状态词匹配
  const stateWords = ABILITY_STATE_MAP[t]
  if (stateWords) {
    for (const sw of stateWords) {
      if (effect.includes(sw)) return true
    }
  }
  // 引号/属性边界匹配
  let i = effect.indexOf(t)
  while (i !== -1) {
    const prev = effect[i - 1]
    const next = effect.slice(i + t.length, i + t.length + 2)
    if (prev === '"' || prev === '\u201c' || next === '\u5c5e\u6027') return true
    i = effect.indexOf(t, i + 1)
  }
  return false
}

/**
 * filterCompanions
 *
 * effect 文本匹配模式（不看 condition），支持突破前/突破后合并判断：
 *
 * - 突破前命中 && 突破后命中 → 取突破后数据，btLabel = ""
 * - 只有突破后命中 → 取突破后数据，btLabel = "突破后"
 * - 只有突破前命中 → 取突破前数据，btLabel = "突破前"
 * - 都不命中 → 跳过
 *
 * 返回：{ attack: [...], shield_break: [...], functional: [...] }
 * 每项：{ companion, skill, matchedTags: string[], btLabel: string }
 */

// 内部：对单个武将做命中检测，返回 { type, matchedTags } 或 null
function checkMatch(general, factionTags, abilityTags, opSummon) {
  const skill = general.inherentSkill
  if (!skill) return null

  const effect = skill.effect || ''

  // 描述随行自身被召唤后行为 → 跳过
  if (effect.startsWith('若召唤此英豪')) return null

  // 召唤技检查：effect 提到了具体召唤技名，且不是操作武将的召唤技 → 跳过
  const allSummons = Object.values(SUMMON_SKILL_MAP)
  const mentionedSummon = allSummons.find(s => s && effect.includes(s))
  if (mentionedSummon && mentionedSummon !== opSummon) return null

  const matchedTags = []
  let factionHit = false
  let abilityHit = false

  // 检查势力/角色标签
  for (const t of factionTags) {
    if (containsTag(effect, t)) {
      matchedTags.push(t)
      factionHit = true
    }
  }

  // 检查属性球标签
  for (const t of abilityTags) {
    const hit = containsAbilityTag(effect, t) || (t === '雷' && effect.includes('触电'))
    if (hit) {
      matchedTags.push(t)
      abilityHit = true
    }
  }

  if (!factionHit && !abilityHit) return null

  // 决定归类：势力球命中优先，否则属性球命中一律 functional
  let type
  if (factionHit) {
    type = skill.effectType === 'attack' ? 'attack'
      : skill.effectType === 'shield_break' ? 'shield_break'
      : 'functional'
  } else {
    type = 'functional'
  }

  return { type, matchedTags }
}

export function filterCompanions(generalName, breakthrough) {
  const opGeneral = data.find(g => g.name === generalName && g.breakthrough === breakthrough)
  if (!opGeneral) return { attack: [], shield_break: [], functional: [] }

  const opTags = opGeneral.allTags || []
  const opSummon = SUMMON_SKILL_MAP[generalName] || ''

  // 分成势力/角色标签 和 属性球标签
  const factionTags = opTags.filter(t => !ABILITY_TAGS.has(t))
  const abilityTags = opTags.filter(t => ABILITY_TAGS.has(t))

  // 按名字分组，存 { before, after }
  const byName = {}
  for (const g of data) {
    if (g.name === generalName) continue
    if (!byName[g.name]) byName[g.name] = { before: null, after: null }
    if (g.breakthrough === '突破前') byName[g.name].before = g
    else if (g.breakthrough === '突破后') byName[g.name].after = g
  }

  const result = { attack: [], shield_break: [], functional: [] }

  for (const name of Object.keys(byName)) {
    const { before, after } = byName[name]

    const beforeResult = before ? checkMatch(before, factionTags, abilityTags, opSummon) : null
    const afterResult  = after  ? checkMatch(after,  factionTags, abilityTags, opSummon) : null

    let chosen = null   // { companion, skill, matchedTags, btLabel }

    if (beforeResult && afterResult) {
      // 两者都命中 → 取突破后，标注"突破后"
      chosen = { companion: after, skill: after.inherentSkill, matchedTags: afterResult.matchedTags, btLabel: '突破后', type: afterResult.type }
    } else if (afterResult) {
      // 只有突破后命中
      chosen = { companion: after, skill: after.inherentSkill, matchedTags: afterResult.matchedTags, btLabel: '突破后', type: afterResult.type }
    } else if (beforeResult) {
      // 只有突破前命中
      chosen = { companion: before, skill: before.inherentSkill, matchedTags: beforeResult.matchedTags, btLabel: '突破前', type: beforeResult.type }
    }

    if (!chosen) continue

    const { type, ...item } = chosen
    result[type].push(item)
  }

  return result
}

// 从 effect 文本中提取最大百分比数字（无则返回 0）
function maxPercent(effect) {
  const matches = (effect || '').match(/(\d+)%/g)
  if (!matches) return 0
  return Math.max(...matches.map(m => parseInt(m)))
}

export function buildLineup(generalName, breakthrough, useAfterBreakthrough) {
  const opGeneral = data.find(g => g.name === generalName && g.breakthrough === breakthrough)
  if (!opGeneral) return { afterBreakthrough: useAfterBreakthrough, team: [] }

  const opTags = opGeneral.allTags || []
  const opSummon = SUMMON_SKILL_MAP[generalName] || ''
  const factionTags = opTags.filter(t => !ABILITY_TAGS.has(t))
  const abilityTags = opTags.filter(t => ABILITY_TAGS.has(t))

  // 按名字分组
  const byName = {}
  for (const g of data) {
    if (g.name === generalName) continue
    if (!byName[g.name]) byName[g.name] = { before: null, after: null }
    if (g.breakthrough === '突破前') byName[g.name].before = g
    else if (g.breakthrough === '突破后') byName[g.name].after = g
  }

  const result = { attack: [], shield_break: [], functional: [] }

  for (const { before, after } of Object.values(byName)) {
    // 强制使用目标突破状态，找不到则用另一个
    const companion = (useAfterBreakthrough ? after : before) || (useAfterBreakthrough ? before : after)
    if (!companion) continue

    const match = checkMatch(companion, factionTags, abilityTags, opSummon)
    if (!match) continue

    const btLabel = companion.breakthrough === '突破后' ? '突破后' : '突破前'
    result[match.type].push({ companion, skill: companion.inherentSkill, btLabel, matchedTags: match.matchedTags })
  }

  // 按最大百分比降序排序
  for (const type of ['attack', 'shield_break', 'functional']) {
    result[type].sort((a, b) => maxPercent(b.skill.effect) - maxPercent(a.skill.effect))
  }

  // 3攻击 + 1破盾 + 2功能
  const QUOTA = { attack: 3, shield_break: 1, functional: 2 }
  const team = []
  for (const [type, count] of Object.entries(QUOTA)) {
    for (const item of result[type].slice(0, count)) {
      team.push({ ...item, slotType: type })
    }
  }

  return { afterBreakthrough: useAfterBreakthrough, team }
}
