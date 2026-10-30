import { useState, useMemo, useRef, useEffect } from "react";
import { filterCompanions, buildLineup, data as generalsData } from "@/utils/recommend.js";
import weaponTraits from "../data/weaponTraits.json";

// ===================== 配色常量 =====================
const COLORS = {
  bg: "#0d1117",
  card: "#161b22",
  border: "#30363d",
  text: "#e6edf3",
  subtext: "#8b949e",
  attack: "#e67e22",
  shield_break: "#3498db",
  functional: "#27ae60",
  tagHighlight: "#f1c40f",
};

// 角色类型配置
const ROLE_CONFIG = {
  attack: { label: "攻击强化", color: COLORS.attack, bg: "rgba(230,126,34,0.15)", border: "rgba(230,126,34,0.4)" },
  shield_break: { label: "破盾强化", color: COLORS.shield_break, bg: "rgba(52,152,219,0.15)", border: "rgba(52,152,219,0.4)" },
  functional: { label: "功能辅助", color: COLORS.functional, bg: "rgba(39,174,96,0.15)", border: "rgba(39,174,96,0.4)" },
};

// 属性球颜色映射
const TAG_COLORS = {
  力: "#e74c3c", 斩: "#c0392b", 坚: "#7f8c8d", 冰: "#3498db",
  炎: "#e67e22", 火: "#e74c3c", 电: "#f39c12", 雷: "#f1c40f",
  风: "#1abc9c", 速: "#2ecc71", 技: "#9b59b6", 智: "#8e44ad",
  魅: "#e91e63", 蛮力: "#d35400",
  魏: "#3498db", 蜀: "#27ae60", 吴: "#e74c3c",
  猛将: "#e67e22", 大将军: "#f1c40f", 主君之盾: "#7f8c8d",
};

function getTagColor(tag) {
  for (const key of Object.keys(TAG_COLORS)) {
    if (tag.includes(key)) return TAG_COLORS[key];
  }
  return "#8b949e";
}

// ===================== 属性球标签集合 =====================
const ABILITY_TAGS = new Set(['力','斩','坚','冰','炎','火','电','雷','风','速','技','智','魅']);

// ===================== 获取所有武将名（去重） =====================
function getUniqueGeneralNames(data) {
  const names = [...new Set(data.map(g => g.name))];
  return names.sort();
}

// ===================== 子组件 =====================

// 标签徽章
const TagBadge = ({ tag, highlight }) => {
  const color = getTagColor(tag);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: highlight ? 700 : 400,
        color: highlight ? COLORS.tagHighlight : color,
        background: highlight ? "rgba(241,196,15,0.12)" : `${color}18`,
        border: `1px solid ${highlight ? "rgba(241,196,15,0.5)" : `${color}50`}`,
        margin: "2px",
      }}
    >
      {tag}
    </span>
  );
};

// 角色类型徽章
const RoleBadge = ({ type }) => {
  const cfg = ROLE_CONFIG[type] || ROLE_CONFIG.functional;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
};

// 武将信息卡
const GeneralInfoCard = ({ general }) => {
  if (!general) return null;
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: "16px",
        marginTop: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{general.name}</span>
          <span
            style={{
              marginLeft: 10,
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 4,
              background: general.breakthrough === "突破后" ? "rgba(241,196,15,0.15)" : "rgba(139,148,158,0.15)",
              color: general.breakthrough === "突破后" ? COLORS.tagHighlight : COLORS.subtext,
              border: `1px solid ${general.breakthrough === "突破后" ? "rgba(241,196,15,0.4)" : COLORS.border}`,
            }}
          >
            {general.breakthrough}
          </span>
        </div>
      </div>

      {/* 属性球 & 势力球（从 allTags 动态分类） */}
      {(() => {
        const abilityTags = (general.allTags || []).filter(t => ABILITY_TAGS.has(t));
        const factionTags = (general.allTags || []).filter(t => !ABILITY_TAGS.has(t));
        return (
          <>
            {abilityTags.length > 0 && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.subtext, whiteSpace: "nowrap", marginTop: 3 }}>属性球</span>
                <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 2 }}>
                  {abilityTags.map((tag, i) => <TagBadge key={i} tag={tag} />)}
                </span>
              </div>
            )}
            {factionTags.length > 0 && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: COLORS.subtext, whiteSpace: "nowrap", marginTop: 3 }}>势力球</span>
                <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 2 }}>
                  {factionTags.map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#2ecc71",
                        background: "rgba(46,204,113,0.1)",
                        border: "1px solid rgba(46,204,113,0.35)",
                        margin: "2px",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </>
        );
      })()}

      {/* 基础特性 */}
      {general.basicTraits && (
        <div
          style={{
            background: "rgba(230,237,243,0.04)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            padding: "10px 12px",
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 11, color: COLORS.subtext, marginBottom: 4 }}>基础特性</div>
          <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7, whiteSpace: "pre-line" }}>
            {general.basicTraits}
          </div>
        </div>
      )}

      {/* 武器特性 */}
      {(() => {
        const wtKey = `${general.name}|${general.breakthrough}`;
        const wtText = weaponTraits[wtKey];
        if (!wtText) return null;
        return (
          <div
            style={{
              background: "rgba(230,237,243,0.04)",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 11, color: COLORS.subtext, marginBottom: 4 }}>武器特性</div>
            <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.7 }}>
              {wtText.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// 随行武将卡片（effect 文本匹配版：显示命中标签和固有战法效果）
const CompanionCard = ({ companion, skill, matchedTags, btLabel }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 8,
      }}
    >
      {/* 头部 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, flex: 1 }}>
          {companion.name}
          {btLabel && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                fontWeight: 600,
                padding: "1px 6px",
                borderRadius: 3,
                color: btLabel === '突破后' ? '#e67e22' : COLORS.subtext,
                background: btLabel === '突破后' ? 'rgba(230,126,34,0.12)' : 'rgba(139,148,158,0.1)',
                border: `1px solid ${btLabel === '突破后' ? 'rgba(230,126,34,0.4)' : COLORS.border}`,
                verticalAlign: 'middle',
              }}
            >
              {btLabel}
            </span>
          )}
        </span>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: "none",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            color: COLORS.subtext,
            fontSize: 11,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          {expanded ? "收起" : "详情"}
        </button>
      </div>

      {/* 命中标签（高亮金色） */}
      {matchedTags && matchedTags.length > 0 && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: COLORS.subtext, marginTop: 3, whiteSpace: "nowrap" }}>命中标签</span>
          {matchedTags.map((tag, i) => (
            <TagBadge key={i} tag={tag} highlight />
          ))}
        </div>
      )}

      {/* 固有战法效果文本（始终显示） */}
      {skill.effect && (
        <div
          style={{
            fontSize: 12,
            color: COLORS.text,
            lineHeight: 1.65,
            background: "rgba(230,237,243,0.03)",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            padding: "8px 10px",
          }}
        >
          {skill.effect}
        </div>
      )}

      {/* 展开详情 */}
      {expanded && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
          {skill.text && (
            <div style={{ fontSize: 12, color: COLORS.subtext, lineHeight: 1.6, marginBottom: 6 }}>
              {skill.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 分组面板
const GroupPanel = ({ type, items, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = ROLE_CONFIG[type];

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${cfg.border}`,
        borderRadius: 10,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      {/* 面板头部 */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          background: cfg.bg,
          border: "none",
          padding: "14px 16px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 4,
            height: 18,
            background: cfg.color,
            borderRadius: 2,
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
          <span style={{ fontSize: 12, color: COLORS.subtext, marginLeft: 10 }}>
            共 {items.length} 名随行武将
          </span>
        </div>
        <span style={{ color: COLORS.subtext, fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* 武将列表 */}
      {open && (
        <div style={{ padding: "12px 16px 16px" }}>
          {items.length === 0 ? (
            <div style={{ color: COLORS.subtext, fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              暂无符合条件的随行武将
            </div>
          ) : (
            items.map(({ companion, skill, matchedTags, btLabel }, i) => (
              <CompanionCard
                key={`${companion.name}-${i}`}
                companion={companion}
                skill={skill}
                matchedTags={matchedTags}
                btLabel={btLabel}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ===================== 主页面 =====================
const Index = () => {
  const [searchText, setSearchText] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [breakthrough, setBreakthrough] = useState("突破前");
  const dropdownRef = useRef(null);

  const allNames = useMemo(() => getUniqueGeneralNames(generalsData), []);

  const filteredNames = useMemo(() => {
    if (!searchText.trim()) return allNames;
    return allNames.filter(n => n.includes(searchText.trim()));
  }, [allNames, searchText]);

  // 当前选中武将数据
  const selectedGeneral = useMemo(() => {
    if (!selectedName) return null;
    return generalsData.find(g => g.name === selectedName && g.breakthrough === breakthrough) || null;
  }, [selectedName, breakthrough]);

  // 过滤结果
  const groups = useMemo(() => {
    if (!selectedName) return null;
    return filterCompanions(selectedName, breakthrough);
  }, [selectedName, breakthrough]);

  const totalCount = groups ? groups.attack.length + groups.shield_break.length + groups.functional.length : 0;

  // 阵容推荐
  const lineupAfter  = useMemo(() => selectedName ? buildLineup(selectedName, breakthrough, true)  : null, [selectedName, breakthrough]);
  const lineupBefore = useMemo(() => selectedName ? buildLineup(selectedName, breakthrough, false) : null, [selectedName, breakthrough]);
  const [lineupTab, setLineupTab] = useState(true); // true=突破后，false=突破前

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectName = (name) => {
    setSelectedName(name);
    setSearchText(name);
    setDropdownOpen(false);
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setDropdownOpen(true);
    if (e.target.value !== selectedName) setSelectedName("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
        padding: "0 0 40px",
      }}
    >
      {/* 顶部标题 */}
      <div
        style={{
          background: "linear-gradient(135deg, #161b22 0%, #0d1117 100%)",
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "20px 16px 16px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 900,
              margin: 0,
              background: "linear-gradient(90deg, #f1c40f, #e67e22, #e74c3c)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            无双深渊 · 随行推荐助手
          </h1>
          <p style={{ fontSize: 13, color: COLORS.subtext, margin: "6px 0 0" }}>
            效果文本匹配 · 按类型分组展示所有可用随行
          </p>
          {generalsData.length === 0 && (
            <div
              style={{
                marginTop: 10,
                padding: "6px 14px",
                background: "rgba(241,196,15,0.1)",
                border: "1px solid rgba(241,196,15,0.3)",
                borderRadius: 6,
                fontSize: 12,
                color: COLORS.tagHighlight,
                display: "inline-block",
              }}
            >
              ⚠ 数据文件为空，等待武将数据导入
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 0" }}>

        {/* ===== 区域1：选择操作武将 ===== */}
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 10,
            padding: "16px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.text,
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 4,
                height: 16,
                background: COLORS.tagHighlight,
                borderRadius: 2,
              }}
            />
            选择操作武将
          </div>

          {/* 搜索框 + 下拉 */}
          <div ref={dropdownRef} style={{ position: "relative", marginBottom: 12 }}>
            <input
              type="text"
              value={searchText}
              onChange={handleSearchChange}
              onFocus={() => setDropdownOpen(true)}
              placeholder={allNames.length === 0 ? "暂无武将数据" : "输入武将名搜索…"}
              disabled={allNames.length === 0}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#0d1117",
                border: `1px solid ${dropdownOpen ? COLORS.tagHighlight : COLORS.border}`,
                borderRadius: 6,
                padding: "10px 14px",
                fontSize: 14,
                color: COLORS.text,
                outline: "none",
                transition: "border-color 0.2s",
              }}
            />
            {dropdownOpen && filteredNames.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  maxHeight: 240,
                  overflowY: "auto",
                  zIndex: 100,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
              >
                {filteredNames.map(name => (
                  <div
                    key={name}
                    onMouseDown={() => handleSelectName(name)}
                    style={{
                      padding: "9px 14px",
                      fontSize: 14,
                      color: name === selectedName ? COLORS.tagHighlight : COLORS.text,
                      background: name === selectedName ? "rgba(241,196,15,0.08)" : "transparent",
                      cursor: "pointer",
                      borderBottom: `1px solid ${COLORS.border}`,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(230,237,243,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = name === selectedName ? "rgba(241,196,15,0.08)" : "transparent"; }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 突破状态切换 */}
          <div style={{ display: "flex", gap: 8 }}>
            {["突破前", "突破后"].map(bt => (
              <button
                key={bt}
                onClick={() => setBreakthrough(bt)}
                style={{
                  padding: "7px 20px",
                  borderRadius: 6,
                  border: `1px solid ${breakthrough === bt ? COLORS.tagHighlight : COLORS.border}`,
                  background: breakthrough === bt ? "rgba(241,196,15,0.12)" : "transparent",
                  color: breakthrough === bt ? COLORS.tagHighlight : COLORS.subtext,
                  fontSize: 13,
                  fontWeight: breakthrough === bt ? 700 : 400,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {bt}
              </button>
            ))}
          </div>

          {/* 武将信息卡 */}
          {selectedGeneral && <GeneralInfoCard general={selectedGeneral} />}
          {selectedName && !selectedGeneral && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                background: "rgba(231,76,60,0.08)",
                border: "1px solid rgba(231,76,60,0.3)",
                borderRadius: 6,
                fontSize: 13,
                color: "#e74c3c",
              }}
            >
              未找到「{selectedName}」的{breakthrough}数据
            </div>
          )}
        </div>

        {/* ===== 区域2：推荐结果（分组展示） ===== */}
        {groups && (
          <div>
            {/* 标题栏 */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.text,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    flexShrink: 0,
                    width: 4,
                    height: 16,
                    background: COLORS.attack,
                    borderRadius: 2,
                  }}
                />
                可用随行武将
              </div>
              <div style={{ fontSize: 12, color: COLORS.subtext, marginTop: 4, paddingLeft: 12 }}>
                以「{selectedName}」{breakthrough}为操作武将，共匹配到 {totalCount} 名随行
              </div>
            </div>

            {totalCount === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: COLORS.subtext,
                  background: COLORS.card,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>🔍</div>
                <div style={{ fontSize: 14 }}>暂无符合条件的随行武将</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>该武将的标签未在任何随行固有战法的效果文本中出现</div>
              </div>
            ) : (
              <>
                {/* 按 破盾 → 攻击 → 功能 顺序展示 */}
                {(['shield_break', 'attack', 'functional']).map((type, i) => (
                  <GroupPanel
                    key={type}
                    type={type}
                    items={groups[type]}
                    defaultOpen={i === 0}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* ===== 区域3：阵容推荐 Beta ===== */}
        {selectedName && lineupAfter && (
          <div style={{ marginTop: 24 }}>
            {/* 标题 */}
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 4, height: 16, background: COLORS.functional, borderRadius: 2 }} />
              阵容推荐
              <span style={{ fontSize: 11, color: COLORS.tagHighlight, fontWeight: 700, padding: "1px 6px", borderRadius: 3, background: "rgba(241,196,15,0.1)", border: "1px solid rgba(241,196,15,0.3)" }}>Beta</span>
              <span style={{ fontSize: 12, color: COLORS.subtext, fontWeight: 400 }}>· 3攻击·1破盾·2功能</span>
            </div>

            {/* Tab 切换 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[{ val: true, label: "所有随行已突破" }, { val: false, label: "所有随行未突破" }].map(({ val, label }) => (
                <button
                  key={String(val)}
                  onClick={() => setLineupTab(val)}
                  style={{
                    padding: "7px 18px",
                    borderRadius: 6,
                    border: `1px solid ${lineupTab === val ? COLORS.tagHighlight : COLORS.border}`,
                    background: lineupTab === val ? "rgba(241,196,15,0.12)" : "transparent",
                    color: lineupTab === val ? COLORS.tagHighlight : COLORS.subtext,
                    fontSize: 13,
                    fontWeight: lineupTab === val ? 700 : 400,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 阵容卡片 */}
            {(() => {
              const lineup = lineupTab ? lineupAfter : lineupBefore;
              const QUOTA = [{ type: "attack", count: 3 }, { type: "shield_break", count: 1 }, { type: "functional", count: 2 }];
              const cards = [];
              for (const { type, count } of QUOTA) {
                const members = lineup.team.filter(m => m.slotType === type);
                for (let i = 0; i < count; i++) {
                  if (members[i]) {
                    cards.push({ ...members[i], key: `${type}-${i}` });
                  } else {
                    cards.push({ empty: true, slotType: type, key: `${type}-empty-${i}` });
                  }
                }
              }
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {cards.map(card => {
                    const cfg = ROLE_CONFIG[card.slotType] || ROLE_CONFIG.functional;
                    if (card.empty) {
                      return (
                        <div key={card.key} style={{ flex: "1 1 140px", minWidth: 130, maxWidth: 200, background: "rgba(139,148,158,0.05)", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "12px 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 11, color: COLORS.border }}>暂无合适人选</span>
                        </div>
                      );
                    }
                    return (
                      <div key={card.key} style={{ flex: "1 1 140px", minWidth: 130, maxWidth: 200, background: COLORS.card, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: "12px 10px" }}>
                        {/* 定位标签 */}
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 3, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.label}</span>
                        </div>
                        {/* 武将名 + btLabel */}
                        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4, marginBottom: 6, lineHeight: 1.3 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{card.companion.name}</span>
                          {card.btLabel && (
                            <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 3, color: card.btLabel === "突破后" ? "#e67e22" : COLORS.subtext, background: card.btLabel === "突破后" ? "rgba(230,126,34,0.12)" : "rgba(139,148,158,0.1)", border: `1px solid ${card.btLabel === "突破后" ? "rgba(230,126,34,0.4)" : COLORS.border}` }}>
                              {card.btLabel}
                            </span>
                          )}
                        </div>
                        {/* effect 文本 */}
                        {card.skill?.effect && (
                          <div style={{ fontSize: 10, color: COLORS.subtext, lineHeight: 1.55 }}>
                            {card.skill.effect}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* 空状态 */}
        {!selectedName && generalsData.length > 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: COLORS.subtext,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>⚔</div>
            <div style={{ fontSize: 15, marginBottom: 6 }}>请选择操作武将</div>
            <div style={{ fontSize: 13 }}>系统将根据武将标签匹配随行固有战法效果文本</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
