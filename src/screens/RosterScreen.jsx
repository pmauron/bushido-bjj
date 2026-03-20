import React, { useState, useEffect, useMemo, useRef } from "react";
import { uid, fmt, toDateStr, today, isQuarterClosed, getActiveScoringCycle, ageAt, ageCat, weightCat, coachName, coachGym, kidGymsStr, kidInGym, computeSubtotals, computeRankings, computePromoProjection } from "../utils.js";
import { BELT_HEX, CATEGORY_COLORS, RUBRIC_HINTS } from "../constants.js";
import { uploadPhoto } from "../storage.js";
import { C, s } from "../styles.js";
import { BeltBadge, KidAvatar, Modal, Tabs, ScoreBar, RadarChart, PageHelp } from "../components.jsx";

function buildReportHtml({ kid, config, attendance, latest, approvedKidAssessments }) {
  if (!kid || !latest) return "";
  const sub = computeSubtotals(latest.scores, config);
  const prevAssessment = approvedKidAssessments && approvedKidAssessments.length > 1 ? approvedKidAssessments[1] : null;
  const prevSub = prevAssessment ? computeSubtotals(prevAssessment.scores, config) : null;
  const trend = prevSub ? sub.final - prevSub.final : 0;
  const trendIcon = trend > 0.1 ? "↑" : trend < -0.1 ? "↓" : "→";
  const trendColor = trend > 0.1 ? "#4CAF50" : trend < -0.1 ? "#E53935" : "#888";
  const trendWord = trend > 0.1 ? "improved" : trend < -0.1 ? "declined slightly" : "remained stable";
  const trendWordZh = trend > 0.1 ? "有所提升" : trend < -0.1 ? "略有下降" : "保持稳定";

  const catScores = Object.entries(config.criteria).map(([cat, crits]) => ({
    cat, score: sub[cat], crits
  })).sort((a, b) => b.score - a.score);
  const strongest = catScores[0];
  const weakest = catScores[catScores.length - 1];

  // ── SVG Radar Chart ──
  const radarSvg = (() => {
    const cats = catScores.map(c => c.cat);
    const vals = catScores.map(c => c.score);
    const n = cats.length;
    const cx = 120, cy = 110, maxR = 85;
    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2;
    const polar = (i, r) => {
      const a = startAngle + i * angleStep;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    let grid = "";
    [1, 2, 3, 4, 5].forEach(level => {
      const r = (level / 5) * maxR;
      const pts = Array.from({length: n}, (_, i) => polar(i, r).join(",")).join(" ");
      grid += '<polygon points="' + pts + '" fill="none" stroke="#e0e0e0" stroke-width="0.5"/>';
    });
    let axes = "";
    cats.forEach((cat, i) => {
      const [lx, ly] = polar(i, maxR);
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + lx + '" y2="' + ly + '" stroke="#ddd" stroke-width="0.5"/>';
      const [tx, ty] = polar(i, maxR + 16);
      const anchor = tx < cx - 10 ? "end" : tx > cx + 10 ? "start" : "middle";
      axes += '<text x="' + tx + '" y="' + (ty + 3) + '" text-anchor="' + anchor + '" font-size="9" font-weight="600" fill="#555">' + cat + '</text>';
    });
    const dataPts = vals.map((v, i) => polar(i, (v / 5) * maxR).join(",")).join(" ");
    const dataShape = '<polygon points="' + dataPts + '" fill="rgba(196,30,58,0.15)" stroke="#C41E3A" stroke-width="2"/>';
    let dots = "";
    vals.forEach((v, i) => {
      const [dx, dy] = polar(i, (v / 5) * maxR);
      dots += '<circle cx="' + dx + '" cy="' + dy + '" r="3" fill="#C41E3A"/>';
      const [vx, vy] = polar(i, (v / 5) * maxR + 10);
      dots += '<text x="' + vx + '" y="' + (vy + 3) + '" text-anchor="middle" font-size="8" font-weight="700" fill="#C41E3A">' + v.toFixed(1) + '</text>';
    });
    let prevShape = "";
    if (prevSub) {
      const prevVals = catScores.map(c => prevSub[c.cat] || 0);
      const prevPts = prevVals.map((v, i) => polar(i, (v / 5) * maxR).join(",")).join(" ");
      prevShape = '<polygon points="' + prevPts + '" fill="none" stroke="#999" stroke-width="1" stroke-dasharray="4,3"/>';
    }
    return '<svg viewBox="0 0 240 230" style="width:100%;max-width:240px">' + grid + axes + prevShape + dataShape + dots + '</svg>';
  })();

  // ── Attendance data ──
  const attData = (() => {
    const kidAtt = (attendance || []).filter(r => r.records?.[kid.id] === "attend");
    const total = kidAtt.length;
    const now = new Date();
    const curQ = Math.floor(now.getMonth() / 3);
    const prevQStart = new Date(now.getFullYear(), curQ * 3 - 3, 1);
    if (curQ === 0) { prevQStart.setFullYear(prevQStart.getFullYear() - 1); prevQStart.setMonth(9); }
    const prevQEnd = new Date(prevQStart.getFullYear(), prevQStart.getMonth() + 3, 0);
    const qStart = toDateStr(prevQStart);
    const qEnd = toDateStr(prevQEnd);
    const qAtt = kidAtt.filter(r => r.date >= qStart && r.date <= qEnd);
    const qWeeks = Math.max(1, Math.round((prevQEnd - prevQStart) / (7 * 86400000)));
    const weeklyAvg = (qAtt.length / qWeeks).toFixed(1);
    const qLabel = ["Q1","Q2","Q3","Q4"][prevQStart.getMonth() / 3] + " " + prevQStart.getFullYear();
    const getMonday = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = day === 0 ? -6 : 1 - day; dt.setDate(dt.getDate() + diff); dt.setHours(0,0,0,0); return dt; };
    const firstMon = getMonday(prevQStart);
    const lastMon = getMonday(prevQEnd);
    const wks = [];
    const dd = new Date(firstMon);
    while (dd <= lastMon) { wks.push({ start: new Date(dd), count: 0 }); dd.setDate(dd.getDate() + 7); }
    qAtt.forEach(r => {
      const mon = getMonday(new Date(r.date + "T00:00:00"));
      const w = wks.find(w => w.start.getTime() === mon.getTime());
      if (w) w.count++;
    });
    const maxWk = Math.max(1, ...wks.map(w => w.count));
    let bars = "";
    const bw = 14, bh = 32, gap = 2;
    wks.forEach((w, i) => {
      const x = i * (bw + gap);
      const h = w.count > 0 ? Math.max(2, (w.count / maxWk) * bh) : 1;
      bars += '<rect x="' + x + '" y="' + (bh - h) + '" width="' + bw + '" height="' + h + '" rx="1" fill="' + (w.count === 0 ? "#e8e8e8" : "#C41E3A") + '" opacity="' + (w.count === 0 ? "0.4" : "0.8") + '"/>';
    });
    const sparkW = wks.length * (bw + gap);
    const sparkSvg = wks.length > 0 ? '<svg viewBox="0 0 ' + sparkW + ' ' + bh + '" style="width:100%;height:32px;margin-top:6px">' + bars + '</svg>' : '';
    return { total, qCount: qAtt.length, weeklyAvg, sparkSvg, qLabel };
  })();

  // ── Promotion data ──
  const promoData = (() => {
    const p = computePromoProjection(kid, attendance, config);
    if (p.type === "complete") return null;
    const targetDt = (config.promoTargets || {})[kid.id] || "";
    const displayDt = targetDt || p.projectedDate;
    return { ...p, targetDt, displayDt };
  })();

  const topGoal = ((config.goals || {})[kid.id] || []).find(g => !g.done);

  const maxStripes = config.promotionRules?.stripesForBelt || 4;
  const stripeDots = Array.from({length: maxStripes}, (_, i) =>
    '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 2px;background:' + (i < (kid.stripes || 0) ? "#C41E3A" : "#ddd") + '"></span>'
  ).join("");

  // ── Page 2: Detailed Assessment ──
  const page2 = '<div style="page-break-before:always"></div>'
    + '<div class="header"><div class="brand"><div style="font-size:24px;margin-bottom:2px">🥋</div><h1>BUSHIDO</h1><div class="sub">Detailed Assessment · 详细评估</div></div>'
    + '<div class="kid"><div class="name">' + kid.name + '</div><div class="meta">'
    + '<span class="tag">🥋 ' + kid.belt + ' Belt ' + stripeDots + '</span>'
    + '<span class="tag">📅 Age ' + ageAt(kid.dob, today()) + '</span>'
    + '<span class="tag">' + latest.cycle + '</span>'
    + '<span class="tag">Final: ' + fmt(sub.final) + '/5</span>'
    + '</div></div></div>'
    + '<div style="display:flex;gap:12px">'
    + '<div style="flex:1">'
    + [["BJJ","#C41E3A"],["Commitment","#4CAF50"]].map(([cat, catColor]) => {
      const crits = config.criteria[cat] || [];
      return '<div style="margin-bottom:8px">'
        + '<div style="font-size:9px;font-weight:800;color:' + catColor + ';text-transform:uppercase;letter-spacing:0.5px;padding-bottom:2px;border-bottom:2px solid ' + catColor + '33;margin-bottom:4px">' + cat + ' — ' + fmt(sub[cat]) + '/5</div>'
        + crits.map(c => {
          const score = latest.scores[c] || 0;
          const current = RUBRIC_HINTS[c] ? (RUBRIC_HINTS[c][score - 1] || "—") : "—";
          const next = score < 5 && RUBRIC_HINTS[c] ? (RUBRIC_HINTS[c][score] || null) : null;
          const color = score >= 4 ? "#4CAF50" : score >= 3 ? "#FF9800" : "#E53935";
          return '<div style="padding:3px 0;border-bottom:1px solid #f5f5f5">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1px">'
            + '<span style="font-size:10px;font-weight:700;color:#1a1a1a">' + c + '</span>'
            + '<span style="font-size:9px;font-weight:800;color:' + color + ';background:' + color + '15;padding:1px 6px;border-radius:4px">' + score + '/5</span>'
            + '</div>'
            + '<div style="font-size:8px;color:#444;line-height:1.4;padding:2px 0 2px 6px;border-left:2px solid ' + color + '">' + current + '</div>'
            + (next
              ? '<div style="font-size:8px;color:#555;line-height:1.4;padding:2px 0 2px 6px;border-left:2px solid #2196F344;background:#2196F306;margin-top:1px;border-radius:0 3px 3px 0">'
                + '<span style="font-weight:700;color:#2196F3;font-size:7px">NEXT 下一步 → </span>' + next + '</div>'
              : '<div style="font-size:7px;color:#4CAF50;font-weight:700;margin-top:1px;padding-left:6px">✓ Top level 已达最高</div>')
            + '</div>';
        }).join("")
        + '</div>';
    }).join("")
    + '</div>'
    + '<div style="flex:1">'
    + [["Athletic","#2196F3"],["Competition","#FF9800"]].map(([cat, catColor]) => {
      const crits = config.criteria[cat] || [];
      return '<div style="margin-bottom:8px">'
        + '<div style="font-size:9px;font-weight:800;color:' + catColor + ';text-transform:uppercase;letter-spacing:0.5px;padding-bottom:2px;border-bottom:2px solid ' + catColor + '33;margin-bottom:4px">' + cat + ' — ' + fmt(sub[cat]) + '/5</div>'
        + crits.map(c => {
          const score = latest.scores[c] || 0;
          const current = RUBRIC_HINTS[c] ? (RUBRIC_HINTS[c][score - 1] || "—") : "—";
          const next = score < 5 && RUBRIC_HINTS[c] ? (RUBRIC_HINTS[c][score] || null) : null;
          const color = score >= 4 ? "#4CAF50" : score >= 3 ? "#FF9800" : "#E53935";
          return '<div style="padding:3px 0;border-bottom:1px solid #f5f5f5">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1px">'
            + '<span style="font-size:10px;font-weight:700;color:#1a1a1a">' + c + '</span>'
            + '<span style="font-size:9px;font-weight:800;color:' + color + ';background:' + color + '15;padding:1px 6px;border-radius:4px">' + score + '/5</span>'
            + '</div>'
            + '<div style="font-size:8px;color:#444;line-height:1.4;padding:2px 0 2px 6px;border-left:2px solid ' + color + '">' + current + '</div>'
            + (next
              ? '<div style="font-size:8px;color:#555;line-height:1.4;padding:2px 0 2px 6px;border-left:2px solid #2196F344;background:#2196F306;margin-top:1px;border-radius:0 3px 3px 0">'
                + '<span style="font-weight:700;color:#2196F3;font-size:7px">NEXT 下一步 → </span>' + next + '</div>'
              : '<div style="font-size:7px;color:#4CAF50;font-weight:700;margin-top:1px;padding-left:6px">✓ Top level 已达最高</div>')
            + '</div>';
        }).join("")
        + '</div>';
    }).join("")
    + '</div></div>'
    + '<div class="footer"><div class="logo">🥋 BUSHIDO BJJ ACADEMY</div>'
    + '<div class="fmeta">Detailed Assessment · ' + today() + ' · ' + latest.cycle + ' · Coach: ' + latest.coach + ' · ' + kidGymsStr(kid) + '</div></div>';

  return `<!DOCTYPE html><html><head><title>${kid.name} - Bushido BJJ Progress Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{font-family:'Segoe UI',-apple-system,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#2a2a2a;line-height:1.4;font-size:12px}
.header{display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:3px solid #C41E3A;margin-bottom:14px}
.header .brand{text-align:center}
.header .brand h1{font-size:22px;color:#C41E3A;letter-spacing:3px;margin:0;line-height:1}
.header .brand .sub{font-size:8px;color:#888;letter-spacing:1.5px;text-transform:uppercase}
.header .kid{flex:1}
.header .kid .name{font-size:20px;font-weight:800;color:#1a1a1a;margin-bottom:2px}
.header .kid .meta{display:flex;flex-wrap:wrap;gap:4px}
.header .kid .meta .tag{display:inline-flex;align-items:center;padding:2px 8px;background:#f5f5f5;border-radius:10px;font-size:10px;font-weight:600;color:#555}
.cols{display:flex;gap:16px;min-height:0}
.col-l{flex:3}
.col-r{flex:2}
.card{background:#fafafa;border-radius:8px;padding:12px;margin-bottom:10px}
.card-title{font-size:10px;font-weight:700;color:#C41E3A;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
.score-hero{text-align:center;padding:10px 0}
.score-hero .num{font-size:40px;font-weight:900;color:#C41E3A;line-height:1}
.score-hero .of{font-size:14px;color:#aaa;font-weight:400}
.score-hero .trend{font-size:11px;margin-top:2px}
.score-hero .cycle{font-size:9px;color:#999;margin-top:2px}
.summary{font-size:11px;color:#444;padding:8px 10px;background:#fff;border-radius:6px;border-left:3px solid #C41E3A;margin-top:8px}
.summary .zh{color:#999;font-size:10px;margin-top:4px}
.metric-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f0f0f0}
.metric-row:last-child{border-bottom:none}
.metric-label{font-size:10px;color:#888}
.metric-val{font-size:14px;font-weight:800;color:#1a1a1a}
.metric-sub{font-size:9px;color:#aaa;margin-left:4px}
.gate{margin-bottom:6px}
.gate-header{display:flex;justify-content:space-between;font-size:9px;margin-bottom:2px}
.gate-label{color:#888}
.gate-val{font-weight:700;color:#333}
.gate-bar{height:5px;background:#e8e8e8;border-radius:3px;overflow:hidden}
.gate-fill{height:100%;border-radius:3px}
.promo-date{margin-top:8px;padding:6px 10px;background:#fff;border-radius:6px;display:flex;justify-content:space-between;align-items:center}
.promo-date .lbl{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:0.5px}
.promo-date .dt{font-size:16px;font-weight:800;color:#C41E3A}
.footer{margin-top:12px;padding-top:10px;border-top:2px solid #C41E3A;text-align:center}
.footer .logo{font-size:13px;font-weight:800;color:#C41E3A;letter-spacing:2px}
.footer .fmeta{font-size:8px;color:#999;margin-top:2px}
@media print{body{padding:12px}@page{margin:12mm;size:A4}}
</style></head><body>

<div class="header">
  <div class="brand">
    <div style="font-size:24px;margin-bottom:2px">🥋</div>
    <h1>BUSHIDO</h1>
    <div class="sub">Progress Report · 进步报告</div>
  </div>
  <div class="kid">
    <div class="name">${kid.name}</div>
    <div class="meta">
      <span class="tag">🥋 ${kid.belt} Belt ${stripeDots}</span>
      <span class="tag">📅 Age ${ageAt(kid.dob, today())}</span>
      <span class="tag">⚖️ ${kid.weight}kg</span>
      <span class="tag">🏠 ${kidGymsStr(kid)}</span>
    </div>
  </div>
</div>

<div class="cols">
<div class="col-l">

  <div class="card">
    <div class="card-title">Assessment Score 评估分数</div>
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="flex:1">
        <div class="score-hero">
          <div class="num">${fmt(sub.final)}<span class="of"> / 5</span></div>
          <div class="trend" style="color:${trendColor}">${trendIcon} ${prevSub ? fmt(prevSub.final) + " → " + fmt(sub.final) : "First assessment · 首次评估"}</div>
          <div class="cycle">${latest.cycle} · ${latest.date}</div>
        </div>
      </div>
      <div style="flex:1;text-align:center">
        ${radarSvg}
        ${prevSub ? '<div style="font-size:8px;color:#999;text-align:center;margin-top:2px">Dashed = previous · 虚线=上次</div>' : ""}
      </div>
    </div>
    <div class="summary">
      <strong>${kid.name}</strong> scored <strong>${fmt(sub.final)}/5</strong> in the ${latest.cycle} cycle.
      ${strongest && weakest && strongest.cat !== weakest.cat ?
        `Strongest: <strong>${strongest.cat}</strong> (${fmt(strongest.score)}). Growth area: <strong>${weakest.cat}</strong> (${fmt(weakest.score)}).` : ""}
      ${prevSub ? `Performance has ${trendWord} (${trend > 0 ? "+" : ""}${fmt(trend)}).` : ""}
      <div class="zh">
        <strong>${kid.name}</strong> 在${latest.cycle}周期获得 <strong>${fmt(sub.final)}/5</strong>。
        ${strongest && weakest && strongest.cat !== weakest.cat ?
          `最强：<strong>${strongest.cat}</strong>（${fmt(strongest.score)}）。提升空间：<strong>${weakest.cat}</strong>（${fmt(weakest.score)}）。` : ""}
        ${prevSub ? `表现${trendWordZh}（${trend > 0 ? "+" : ""}${fmt(trend)}）。` : ""}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Skill Breakdown 分项详情</div>
    ${Object.entries(config.criteria).map(([cat, crits]) => {
      const score = sub[cat];
      const p = (score / 5) * 100;
      const color = score >= 4 ? "#4CAF50" : score >= 3 ? "#FFA726" : "#E53935";
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f0f0f0">
        <div style="min-width:70px;font-weight:700;font-size:11px">${cat}</div>
        <div style="flex:1">
          <div style="height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden"><div style="width:${p}%;height:100%;background:${color};border-radius:3px"></div></div>
          <div style="font-size:8px;color:#999;margin-top:2px">${crits.map(c => c + ": " + (latest.scores[c] || 0)).join(" · ")}</div>
        </div>
        <div style="min-width:30px;text-align:right;font-weight:700;font-size:11px;color:${color}">${fmt(score)}</div>
      </div>`;
    }).join("")}
  </div>

</div>
<div class="col-r">

  <div class="card">
    <div class="card-title">Attendance 出勤 (${attData.qLabel})</div>
    <div class="metric-row">
      <span class="metric-label">Weekly avg 周均</span>
      <span><span class="metric-val" style="color:${parseFloat(attData.weeklyAvg) >= 3 ? "#4CAF50" : parseFloat(attData.weeklyAvg) >= 2 ? "#FF9800" : "#E53935"}">${attData.weeklyAvg}</span><span class="metric-sub">classes/wk</span></span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Quarter total 季度出勤</span>
      <span><span class="metric-val">${attData.qCount}</span><span class="metric-sub">classes</span></span>
    </div>
    <div class="metric-row">
      <span class="metric-label">Total all-time 总数</span>
      <span><span class="metric-val">${attData.total}</span><span class="metric-sub">classes</span></span>
    </div>
    <div style="margin-top:6px;font-size:8px;color:#aaa;text-align:center">${attData.qLabel} weekly breakdown · 每周明细</div>
    ${attData.sparkSvg}
  </div>

${promoData ? `
  <div class="card">
    <div class="card-title">Next Belt 下次腰带晋级</div>
    <div style="font-weight:700;font-size:12px;margin-bottom:8px">🥋 ${kid.belt} → ${promoData.nextBelt}</div>
    ${promoData.gates.map(g => {
      const pct = Math.min(100, g.required > 0 ? (g.current / g.required) * 100 : 100);
      const color = g.done ? "#4CAF50" : "#FF9800";
      return `<div class="gate">
        <div class="gate-header">
          <span class="gate-label">${g.label} ${g.labelZh}</span>
          <span class="gate-val" style="color:${g.done ? '#4CAF50' : '#333'}">${g.current}${g.unit || ''} / ${g.required}${g.unit || ''} ${g.done ? '✓' : ''}</span>
        </div>
        <div class="gate-bar"><div class="gate-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
    }).join("")}
    <div class="promo-date">
      <div>
        <div class="lbl">${promoData.targetDt ? 'Target 目标' : 'Projected 预计'}</div>
        <div class="dt">${promoData.displayDt || 'TBD'}</div>
        ${promoData.targetDt && promoData.projectedDate && promoData.targetDt !== promoData.projectedDate ? '<div style="font-size:8px;color:#999">Projected: ' + promoData.projectedDate + '</div>' : ''}
      </div>
      <div style="font-size:9px;color:#888">${promoData.weeklyAvg > 0 ? promoData.weeklyAvg.toFixed(1) + '/wk' : ''}</div>
    </div>
  </div>
` : '<div class="card"><div class="card-title">Belt Promotion 腰带晋级</div><div style="color:#4CAF50;font-size:11px;text-align:center">✓ Highest belt achieved · 已达最高腰带</div></div>'}

${topGoal ? `
  <div class="card">
    <div class="card-title">Current Goal 当前目标</div>
    <div style="display:flex;gap:6px;align-items:flex-start">
      <span style="font-size:12px">🎯</span>
      <span style="font-size:11px;color:#333">${topGoal.text}</span>
    </div>
  </div>
` : ""}

</div>
</div>

${latest?.aiComment?.en ? `
<div class="card" style="margin-top:12px">
  <div class="card-title">Coach Commentary 教练评语</div>
  <div style="font-size:11px;color:#333;line-height:1.6;margin-bottom:8px">${latest.aiComment.en}</div>
  ${latest.aiComment.cn ? `<div style="font-size:11px;color:#555;line-height:1.6;border-top:1px solid #eee;padding-top:8px;margin-top:8px">${latest.aiComment.cn}</div>` : ""}
</div>
` : ""}

<div class="footer">
  <div class="logo">🥋 BUSHIDO BJJ ACADEMY</div>
  <div class="fmeta">Progress Report · ${today()} · Based on coach assessment · 教练专业评估 · ${kidGymsStr(kid)}</div>
</div>

${page2}

</body></html>`;
}

function AttendanceStats({ kidId, attendance, selections, config }) {
  const isCompKid = Object.values(selections || {}).some(arr => arr.includes(kidId));
  const classTypes = config?.classTypes || [];

  // Helper: determine category from attendance record (handles both old and new format)
  const recCategory = (r) => {
    if (r.classTypeId) {
      const ct = classTypes.find(c => c.id === r.classTypeId);
      return ct?.category || "group";
    }
    return r.type === "competition" ? "competition" : "group";
  };

  const stats = useMemo(() => {
    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const qStartStr = toDateStr(qStart);
    const d90 = new Date(); d90.setDate(d90.getDate() - 90);
    const cutoff90 = toDateStr(d90);

    const weeksBetween = (from, to) => Math.max(1, Math.round((to - from) / (7 * 86400000)));

    // All non-competition classes (group + private)
    const groupAll = (attendance || []).filter(r => recCategory(r) !== "competition");
    const groupQ = groupAll.filter(r => r.date >= qStartStr);
    const group90 = groupAll.filter(r => r.date >= cutoff90);

    const countAttend = (days) => days.filter(r => r.records?.[kidId] === "attend").length;
    const countAll = (days) => days.filter(r => r.records?.[kidId] !== undefined).length;

    const groupQAttend = countAttend(groupQ);
    const group90Attend = countAttend(group90);
    const group90Total = countAll(group90);

    // Competition classes
    const compAll = (attendance || []).filter(r => recCategory(r) === "competition");
    const compQ = compAll.filter(r => r.date >= qStartStr);
    const comp90 = compAll.filter(r => r.date >= cutoff90);
    const compQAttend = countAttend(compQ);
    const comp90Attend = countAttend(comp90);

    // Weekly avg = ALL classes (group + competition)
    const weeksQ = weeksBetween(qStart, now);
    const weeks90 = weeksBetween(d90, now);
    const avgWeeklyQ = ((groupQAttend + compQAttend) / weeksQ).toFixed(1);
    const avgWeekly90 = ((group90Attend + comp90Attend) / weeks90).toFixed(1);

    // Competition class % (only for selected kids)
    let compStats = null;
    if (isCompKid) {
      const compQTotal = compQ.filter(r => r.records?.[kidId] !== undefined).length;
      const comp90Total = comp90.filter(r => r.records?.[kidId] !== undefined).length;
      compStats = {
        qAttend: compQAttend, qTotal: compQTotal, qPct: compQTotal ? Math.round(compQAttend / compQTotal * 100) : 0,
        d90Attend: comp90Attend, d90Total: comp90Total, d90Pct: comp90Total ? Math.round(comp90Attend / comp90Total * 100) : 0,
      };
    }

    return {
      avgWeeklyQ, avgWeekly90,
      groupQAttend, group90Attend, group90Total,
      compStats,
      hasData: group90Total > 0 || comp90.length > 0,
    };
  }, [attendance, kidId, isCompKid]);

  if (!stats.hasData) return null;

  const MetricRow = ({ label, value, sub, color }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.textDim }}>{label}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 900, color: color || C.text, fontFamily: "'Bebas Neue', sans-serif" }}>{value}</span>
        {sub && <span style={{ fontSize: 10, color: C.textDim }}>{sub}</span>}
      </div>
    </div>
  );

  const weeklyColor = (v) => parseFloat(v) >= 3 ? "#4CAF50" : parseFloat(v) >= 2 ? "#ff9800" : C.red;
  const pctColor = (v) => v >= 80 ? "#4CAF50" : v >= 60 ? "#ff9800" : C.red;

  return (
    <>
      <h2 style={s.h2}>Attendance 出勤</h2>
      <div style={s.card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>📈 Weekly Training Avg</div>
        <MetricRow label="This quarter" value={stats.avgWeeklyQ} sub="classes/week" color={weeklyColor(stats.avgWeeklyQ)} />
        <MetricRow label="Last 90 days" value={stats.avgWeekly90} sub="classes/week" color={weeklyColor(stats.avgWeekly90)} />
        <MetricRow label="Total this quarter" value={stats.groupQAttend + (stats.compStats?.qAttend || 0)} sub="classes" />

        {stats.compStats && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginTop: 14, marginBottom: 6 }}>🏆 Competition Classes</div>
            <MetricRow label="Attendance % (quarter)" value={`${stats.compStats.qPct}%`} sub={`${stats.compStats.qAttend}/${stats.compStats.qTotal}`} color={pctColor(stats.compStats.qPct)} />
            <MetricRow label="Attendance % (90 days)" value={`${stats.compStats.d90Pct}%`} sub={`${stats.compStats.d90Attend}/${stats.compStats.d90Total}`} color={pctColor(stats.compStats.d90Pct)} />
          </>
        )}
      </div>
    </>
  );
}

function WeeklyAttendanceChart({ kidId, attendance }) {
  const [range, setRange] = useState("3m");
  const ranges = { "1m": 30, "3m": 90, "6m": 180, "12m": 365 };

  const data = useMemo(() => {
    const days = ranges[range];
    const now = new Date();
    const start = new Date(); start.setDate(start.getDate() - days);
    const cutoff = toDateStr(start);

    const attendDates = (attendance || [])
      .filter(r => r.date >= cutoff && r.records?.[kidId] === "attend")
      .map(r => new Date(r.date + "T00:00:00"));

    const getMonday = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = day === 0 ? -6 : 1 - day; dt.setDate(dt.getDate() + diff); dt.setHours(0,0,0,0); return dt; };

    const firstMonday = getMonday(start);
    const lastMonday = getMonday(now);
    const weeks = [];
    const d = new Date(firstMonday);
    while (d <= lastMonday) {
      weeks.push({ start: new Date(d), count: 0 });
      d.setDate(d.getDate() + 7);
    }

    attendDates.forEach(dt => {
      const mon = getMonday(dt);
      const w = weeks.find(w => w.start.getTime() === mon.getTime());
      if (w) w.count++;
    });

    return weeks;
  }, [attendance, kidId, range]);

  const maxCount = Math.max(1, ...data.map(w => w.count));
  const n = data.length || 1;
  // Use a logical coordinate system — viewBox scales to fill container
  const vW = 400;
  const chartH = 100;
  const labelH = 16;
  const vH = chartH + labelH;
  const barGap = Math.max(1, Math.round(vW * 0.01));
  const barW = Math.max(2, (vW - (n - 1) * barGap) / n);

  const avgPerWeek = data.length > 0 ? (data.reduce((s, w) => s + w.count, 0) / data.length).toFixed(1) : "0";

  const formatWeek = (d) => { const m = d.getMonth() + 1; const day = d.getDate(); return `${m}/${day}`; };

  // Show ~6-8 labels max regardless of range
  const labelEvery = Math.max(1, Math.ceil(n / 7));

  return (
    <>
      <h2 style={s.h2}>Weekly Classes 每周课时</h2>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: C.textDim }}>Avg <strong style={{ color: C.text }}>{avgPerWeek}</strong> classes/wk</span>
          <div style={{ display: "flex", gap: 0, background: C.card2, borderRadius: 6, overflow: "hidden" }}>
            {Object.keys(ranges).map(k => (
              <button key={k} onClick={() => setRange(k)} style={{
                padding: "4px 10px", fontSize: 11, fontWeight: range === k ? 700 : 400, border: "none", cursor: "pointer",
                background: range === k ? C.red : "transparent", color: range === k ? "#fff" : C.textDim,
              }}>{k}</button>
            ))}
          </div>
        </div>
        {data.length === 0 ? (
          <div style={{ textAlign: "center", color: C.textDim, fontSize: 12, padding: "20px 0" }}>No attendance data for this period</div>
        ) : (
          <svg viewBox={`0 0 ${vW} ${vH}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="xMidYMid meet">
            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map(pct => (
              <line key={pct} x1={0} x2={vW} y1={chartH * (1 - pct)} y2={chartH * (1 - pct)} stroke={C.border} strokeWidth={0.5} />
            ))}
            {/* Bars */}
            {data.map((w, i) => {
              const h = maxCount > 0 ? (w.count / maxCount) * chartH : 0;
              const x = i * (barW + barGap);
              const isCurrentWeek = i === data.length - 1;
              return (
                <g key={i}>
                  <rect x={x} y={chartH - Math.max(h, 1)} width={barW} height={Math.max(h, 1)} rx={barW > 6 ? 2 : 1}
                    fill={w.count === 0 ? C.card2 : isCurrentWeek ? C.orange : C.red} opacity={w.count === 0 ? 0.3 : 0.85} />
                  {w.count > 0 && barW >= 12 && (
                    <text x={x + barW / 2} y={chartH - h - 3} textAnchor="middle" fontSize={7} fill={C.textDim}>{w.count}</text>
                  )}
                  {i % labelEvery === 0 && (
                    <text x={x + barW / 2} y={chartH + 11} textAnchor="middle" fontSize={7} fill={C.textMuted}>{formatWeek(w.start)}</text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </>
  );
}

function TrainingLog({ kidId, attendance, config }) {
  const [expanded, setExpanded] = useState(false);
  const [filterType, setFilterType] = useState("");
  const classTypes = config?.classTypes || [];

  const log = useMemo(() => {
    const entries = [];
    (attendance || []).forEach(r => {
      const status = r.records?.[kidId];
      if (!status) return;
      const ct = r.classTypeId ? classTypes.find(c => c.id === r.classTypeId) : null;
      const category = ct?.category || (r.type === "competition" ? "competition" : "group");
      if (category !== "competition" && status !== "attend") return;
      entries.push({ date: r.date, time: r.time || "", type: r.classTypeId || r.type, typeName: ct?.name || (r.type === "competition" ? "Competition" : "Group"), typeColor: ct?.color || (category === "competition" ? "#FF9800" : "#4CAF50"), category, gym: r.gym, status, coach: r.coach || "" });
    });
    return entries.sort((a, b) => b.date !== a.date ? b.date.localeCompare(a.date) : b.time.localeCompare(a.time));
  }, [attendance, kidId, classTypes]);

  const filtered = filterType ? log.filter(e => e.type === filterType) : log;
  const shown = expanded ? filtered : filtered.slice(0, 15);

  // Weekly summary for header
  const now = new Date();
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
  const thisWeekStr = toDateStr(thisWeekStart);
  const lastWeekStart = new Date(thisWeekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStr = toDateStr(lastWeekStart);
  const thisWeek = log.filter(e => e.date >= thisWeekStr && e.status === "attend").length;
  const lastWeek = log.filter(e => e.date >= lastWeekStr && e.date < thisWeekStr && e.status === "attend").length;

  if (log.length === 0) return null;

  // Get unique types for filter buttons
  const uniqueTypes = [...new Set(log.map(e => e.type))];
  const getTypeMeta = (t) => {
    const ct = classTypes.find(c => c.id === t);
    if (ct) return { name: ct.name.length > 8 ? ct.name.slice(0, 8) : ct.name, color: ct.color };
    return { name: t === "competition" ? "Comp" : "Group", color: t === "competition" ? "#FF9800" : "#4CAF50" };
  };

  const statusStyle = (st) => st === "attend"
    ? { color: "#4CAF50", label: "✓" }
    : { color: "#f44336", label: "✗ missed" };

  // Group by month for visual separation
  let lastMonth = "";

  return (
    <>
      <h2 style={s.h2}>Training Log 训练日志</h2>
      <div style={s.card}>
        {/* Week summary */}
        <div style={{ display: "flex", gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>This week</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: thisWeek >= 3 ? "#4CAF50" : thisWeek >= 2 ? "#ff9800" : C.red, fontFamily: "'Bebas Neue', sans-serif" }}>{thisWeek}</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Last week</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text, fontFamily: "'Bebas Neue', sans-serif" }}>{lastWeek}</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text, fontFamily: "'Bebas Neue', sans-serif" }}>{log.filter(e => e.status === "attend").length}</div>
          </div>
        </div>

        {/* Filter pills */}
        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => setFilterType("")} style={{
            padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
            background: filterType === "" ? C.red : C.card2, color: filterType === "" ? "#fff" : C.textDim,
          }}>All ({log.length})</button>
          {uniqueTypes.map(t => {
            const meta = getTypeMeta(t);
            return (
              <button key={t} onClick={() => setFilterType(t)} style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, border: "none", cursor: "pointer",
                background: filterType === t ? meta.color + "33" : C.card2, color: filterType === t ? meta.color : C.textDim,
              }}>● {meta.name}</button>
            );
          })}
        </div>

        {/* Entries */}
        {shown.map((e, i) => {
          const month = e.date.slice(0, 7);
          const showMonth = month !== lastMonth;
          lastMonth = month;
          const ss = statusStyle(e.status);
          const d = new Date(e.date + "T00:00:00");
          const dayName = d.toLocaleDateString("en", { weekday: "short" });
          const dayNum = d.getDate();
          const monthName = d.toLocaleDateString("en", { month: "short" });
          return (
            <React.Fragment key={i}>
              {showMonth && (
                <div style={{ fontSize: 10, fontWeight: 800, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, padding: "8px 0 4px", marginTop: i > 0 ? 6 : 0 }}>
                  {d.toLocaleDateString("en", { month: "long", year: "numeric" })}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}22` }}>
                <div style={{ width: 36, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1 }}>{dayName}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{dayNum}</div>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.typeColor, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{e.typeName}</span>
                  {e.time && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 6 }}>{e.time}</span>}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: ss.color }}>{ss.label}</div>
              </div>
            </React.Fragment>
          );
        })}

        {filtered.length > 15 && (
          <button onClick={() => setExpanded(!expanded)} style={{
            width: "100%", marginTop: 8, padding: "8px 0", fontSize: 12, fontWeight: 700,
            background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.red, cursor: "pointer",
          }}>{expanded ? "Show less" : `Show all ${filtered.length} entries`}</button>
        )}
      </div>
    </>
  );
}

function GoalsSection({ kidId, config, setConfig, readOnly }) {
  const goals = (config.goals || {})[kidId] || [];
  const [adding, setAdding] = useState(false);
  const [newGoal, setNewGoal] = useState("");

  const saveGoals = (updatedGoals) => {
    setConfig(p => ({ ...p, goals: { ...(p.goals || {}), [kidId]: updatedGoals } }));
  };

  const addGoal = () => {
    if (!newGoal.trim()) return;
    saveGoals([...goals, { text: newGoal.trim(), done: false, date: today() }]);
    setNewGoal(""); setAdding(false);
  };

  const toggleGoal = (idx) => {
    const next = [...goals]; next[idx] = { ...next[idx], done: !next[idx].done }; saveGoals(next);
  };

  const removeGoal = (idx) => {
    saveGoals(goals.filter((_, i) => i !== idx));
  };

  return (
    <>
      <h2 style={s.h2}>Goals 目标 {!readOnly && <span onClick={() => setAdding(!adding)} style={{ cursor: "pointer", fontSize: 14, float: "right" }}>{adding ? "✕" : "+ Add"}</span>}</h2>
      <div style={s.card}>
        {goals.length === 0 && !adding && (
          <div style={{ color: C.textDim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>No goals set. {!readOnly && "Tap + Add to set focus areas for this kid."}</div>
        )}
        {goals.map((g, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0", borderBottom: i < goals.length - 1 ? `1px solid ${C.border}` : "none" }}>
            {!readOnly && (
              <div onClick={() => toggleGoal(i)} style={{
                width: 22, height: 22, borderRadius: 6, marginTop: 1, flexShrink: 0, cursor: "pointer",
                border: g.done ? `2px solid ${C.green}` : `2px solid ${C.border}`,
                background: g.done ? C.green : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff",
              }}>{g.done ? "✓" : ""}</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: g.done ? C.textDim : C.text, textDecoration: g.done ? "line-through" : "none" }}>{g.text}</div>
              <div style={{ fontSize: 10, color: C.textDim }}>Set {g.date}</div>
            </div>
            {!readOnly && <button onClick={() => removeGoal(i)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 12, padding: 4 }}>✕</button>}
          </div>
        ))}
        {adding && (
          <div style={{ display: "flex", gap: 6, marginTop: goals.length ? 8 : 0 }}>
            <input style={{ ...s.input, flex: 1, fontSize: 13 }} placeholder="e.g. Improve guard retention…" value={newGoal}
              onChange={e => setNewGoal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addGoal(); }} autoFocus />
            <button style={s.btn} onClick={addGoal}>Save</button>
          </div>
        )}
      </div>
    </>
  );
}


function PromotionProgress({ kid, attendance, config, setConfig, readOnly }) {
  const promo = useMemo(() => computePromoProjection(kid, attendance, config), [kid, attendance, config]);
  const targetDate = (config.promoTargets || {})[kid.id] || "";
  const [editing, setEditing] = useState(false);

  if (promo.type === "complete") {
    return (
      <>
        <h2 style={s.h2}>Next Belt 下次腰带晋级</h2>
        <div style={{ ...s.card, textAlign: "center", color: C.green, fontSize: 13 }}>✓ Highest belt achieved · 已达最高腰带</div>
      </>
    );
  }

  const setTarget = (date) => {
    setConfig(p => ({ ...p, promoTargets: { ...(p.promoTargets || {}), [kid.id]: date } }));
  };
  const clearTarget = () => {
    setConfig(p => {
      const t = { ...(p.promoTargets || {}) };
      delete t[kid.id];
      return { ...p, promoTargets: t };
    });
  };

  const typeLabel = `🥋 Next Belt → ${promo.nextBelt}`;
  const displayDate = targetDate || promo.projectedDate;
  const isOverride = targetDate && promo.projectedDate && targetDate !== promo.projectedDate;

  return (
    <>
      <h2 style={s.h2}>Next Belt 下次腰带晋级</h2>
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{typeLabel}</span>
          <span style={{ fontSize: 11, color: C.textDim }}>
            {promo.weeklyAvg > 0 ? `${promo.weeklyAvg.toFixed(1)} classes/wk` : "No recent training"}
          </span>
        </div>

        {/* Progress bars */}
        {promo.gates.map((g, i) => {
          const pct = Math.min(100, g.required > 0 ? (g.current / g.required) * 100 : 100);
          const color = g.done ? C.green : C.orange;
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: C.textDim }}>{g.label} {g.labelZh}</span>
                <span style={{ fontWeight: 700, color: g.done ? C.green : C.text }}>
                  {g.current}{g.unit ? g.unit : ""} / {g.required}{g.unit ? g.unit : ""} {g.done ? "✓" : ""}
                </span>
              </div>
              <div style={{ height: 6, background: C.card2, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
              </div>
            </div>
          );
        })}

        {/* Target date */}
        <div style={{ marginTop: 12, padding: 10, background: C.card2, borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {targetDate ? "Target Date 目标日期" : "Projected Date 预计日期"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: displayDate ? C.text : C.textDim, fontFamily: "'Bebas Neue', sans-serif", marginTop: 2 }}>
                {displayDate || "Insufficient data"}
              </div>
              {isOverride && (
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
                  Projected: {promo.projectedDate}
                </div>
              )}
            </div>
            {!readOnly && (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {editing ? (
                  <>
                    <input type="date" style={{ ...s.input, width: 140, fontSize: 12, padding: "4px 6px" }}
                      value={targetDate || promo.projectedDate || ""}
                      onChange={e => { setTarget(e.target.value); setEditing(false); }}
                    />
                    {targetDate && (
                      <button style={{ ...s.btnSm, fontSize: 10, padding: "4px 8px" }} onClick={() => { clearTarget(); setEditing(false); }}>Reset</button>
                    )}
                    <button style={{ ...s.btnSm, fontSize: 10, padding: "4px 8px" }} onClick={() => setEditing(false)}>✕</button>
                  </>
                ) : (
                  <button style={{ ...s.btnSm, fontSize: 11 }} onClick={() => setEditing(true)}>
                    {targetDate ? "✏️ Edit" : "🎯 Set Target"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ComparisonSection({ assessments, config }) {
  const [open, setOpen] = useState(false);
  const [idxA, setIdxA] = useState(0); // latest
  const [idxB, setIdxB] = useState(1); // previous

  if (assessments.length < 2) return null;

  const a = assessments[idxA];
  const b = assessments[idxB];
  const subA = computeSubtotals(a.scores, config);
  const subB = computeSubtotals(b.scores, config);
  const cats = Object.keys(config.criteria);
  const dataA = {}; const dataB = {};
  cats.forEach(c => { dataA[c] = subA[c]; dataB[c] = subB[c]; });

  return (
    <>
      <h2 style={s.h2}>
        Compare 对比
        <span onClick={() => setOpen(!open)} style={{ cursor: "pointer", fontSize: 12, float: "right", color: C.textDim }}>{open ? "▲ Close" : "▼ Open"}</span>
      </h2>
      {open && (
        <div style={s.card}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>● Current</label>
              <select style={{ ...s.select, fontSize: 12 }} value={idxA} onChange={e => setIdxA(Number(e.target.value))}>
                {assessments.map((a, i) => <option key={i} value={i}>{a.date} ({a.cycle})</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: "#64B5F6", fontWeight: 700 }}>◆ Compare</label>
              <select style={{ ...s.select, fontSize: 12 }} value={idxB} onChange={e => setIdxB(Number(e.target.value))}>
                {assessments.map((a, i) => <option key={i} value={i}>{a.date} ({a.cycle})</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
            <RadarChart data={dataA} compareData={dataB} size={200} />
          </div>

          <div style={{ marginTop: 8 }}>
            {cats.map(c => {
              const diff = subA[c] - subB[c];
              const diffColor = diff > 0.05 ? C.green : diff < -0.05 ? C.red : C.textDim;
              return (
                <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: C.text, minWidth: 80 }}>{c}</span>
                  <span style={{ color: C.red, fontWeight: 600, minWidth: 36 }}>{fmt(subA[c])}</span>
                  <span style={{ color: "#64B5F6", fontWeight: 600, minWidth: 36 }}>{fmt(subB[c])}</span>
                  <span style={{ fontWeight: 700, color: diffColor }}>
                    {diff > 0.05 ? `↑ +${fmt(diff)}` : diff < -0.05 ? `↓ ${fmt(diff)}` : "= same"}
                  </span>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 13, borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
              <span style={{ fontWeight: 800, color: C.text, minWidth: 80 }}>Final</span>
              <span style={{ color: C.red, fontWeight: 800, minWidth: 36 }}>{fmt(subA.final)}</span>
              <span style={{ color: "#64B5F6", fontWeight: 800, minWidth: 36 }}>{fmt(subB.final)}</span>
              <span style={{ fontWeight: 800, color: subA.final - subB.final > 0.05 ? C.green : subA.final - subB.final < -0.05 ? C.red : C.textDim }}>
                {subA.final - subB.final > 0.05 ? `↑ +${fmt(subA.final - subB.final)}` : subA.final - subB.final < -0.05 ? `↓ ${fmt(subA.final - subB.final)}` : "= same"}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AssessmentCard({ a, sub, config, onEdit, onDelete, onCopy, onApprove, onReject, canApprove }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = a.status === "pending";
  return (
    <div style={{ ...s.card, ...(isPending ? { border: `1px solid #FF980044`, background: "#FF980006" } : {}) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {a.date} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.cycle}</span>
            {isPending && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: "#FF980022", color: "#FF9800", fontSize: 10, fontWeight: 700 }}>⏳ Pending</span>}
            {a.status === "approved" && a.approvedBy && <span style={{ marginLeft: 6, fontSize: 10, color: "#4CAF50" }}>✓ {a.approvedBy}</span>}
            {a.aiComment?.en && <span style={{ marginLeft: 6, fontSize: 10 }} title="AI comment generated">💬</span>}
          </div>
          <div style={{ fontSize: 11, color: C.textDim }}>Coach: {a.coach}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{fmt(sub.final)}</div>
          <div style={{ fontSize: 10, color: C.textDim }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          {Object.entries(config.criteria).map(([cat, crits]) => (
            <div key={cat} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: CATEGORY_COLORS[cat] }}>{cat}: {fmt(sub[cat])}</div>
              <div style={{ fontSize: 11, color: C.textDim, marginLeft: 8 }}>
                {crits.map(c => `${c}: ${a.scores[c] || "—"}`).join(" · ")}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button style={s.btnSm} onClick={onEdit}>✏️ Edit</button>
            <button style={s.btnSm} onClick={onCopy}>📋 Copy for AI</button>
            <button style={s.btnDanger} onClick={onDelete}>🗑 Delete</button>
            {isPending && canApprove && onApprove && <button onClick={onApprove} style={{ ...s.btnSm, background: "#4CAF5022", color: "#4CAF50", fontWeight: 700 }}>✓ Approve</button>}
            {isPending && canApprove && onReject && <button onClick={onReject} style={{ ...s.btnSm, background: "#E5393522", color: "#E53935", fontWeight: 700 }}>✕ Reject</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailedRubricView({ assessment, config }) {
  const [expanded, setExpanded] = useState(false);
  if (!assessment) return null;

  const content = (
    <div>
      {Object.entries(config.criteria).map(([cat, crits]) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: CATEGORY_COLORS[cat], textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, paddingBottom: 4, borderBottom: `2px solid ${CATEGORY_COLORS[cat]}22` }}>{cat}</div>
          {crits.map(c => {
            const score = assessment.scores[c] || 0;
            const current = RUBRIC_HINTS[c]?.[score - 1] || "—";
            const next = score < 5 ? (RUBRIC_HINTS[c]?.[score] || null) : null;
            const color = score >= 4 ? "#4CAF50" : score >= 3 ? "#FF9800" : "#E53935";
            return (
              <div key={c} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color, background: color + "15", padding: "2px 8px", borderRadius: 6 }}>{score}/5</span>
                </div>
                <div style={{ fontSize: 11, color: C.text, lineHeight: 1.5, padding: "4px 0 4px 8px", borderLeft: `3px solid ${color}`, marginBottom: next ? 6 : 0 }}>
                  {current}
                </div>
                {next && (
                  <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5, padding: "4px 0 4px 8px", borderLeft: "3px solid #2196F333", background: "#2196F306", borderRadius: "0 4px 4px 0" }}>
                    <span style={{ fontWeight: 700, color: "#2196F3", fontSize: 10 }}>NEXT GOAL 下一步 → </span>{next}
                  </div>
                )}
                {score >= 5 && (
                  <div style={{ fontSize: 10, color: "#4CAF50", fontWeight: 700, marginTop: 2, paddingLeft: 8 }}>✓ Top level achieved 已达最高</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <h2 style={{ ...s.h2, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} onClick={() => setExpanded(!expanded)}>
        Detailed Assessment 详细评估 <span style={{ fontSize: 12, color: C.textDim }}>{expanded ? "▲" : "▼"}</span>
      </h2>
      {expanded && <div style={s.card}>{content}</div>}
    </>
  );
}

function AICommentSection({ kid, assessment, prevAssessment, config, assessments, setAssessments, attendance, selections, loggedCoach, isAdmin, isMasterCoach, isCommunity, roster }) {
  const [commentEn, setCommentEn] = useState(assessment?.aiComment?.en || "");
  const [commentCn, setCommentCn] = useState(assessment?.aiComment?.cn || "");
  const [loading, setLoading] = useState(false);
  const [retranslating, setRetranslating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState("");

  const isPending = assessment?.status === "pending";
  const canEdit = isAdmin || isMasterCoach || assessment?.coach === loggedCoach;
  const canViewHistory = isAdmin || isMasterCoach;
  const cnStale = assessment?.aiComment?.cnStale || false;
  const editHistory = assessment?.aiComment?.editHistory || [];

  // Sync state when assessment changes
  useEffect(() => {
    setCommentEn(assessment?.aiComment?.en || "");
    setCommentCn(assessment?.aiComment?.cn || "");
    setDirty(false);
    setError("");
  }, [assessment?.id, assessment?.aiComment?.en, assessment?.aiComment?.cn]);

  if (!kid || !assessment || isCommunity) return null;

  const sub = computeSubtotals(assessment.scores, config);
  const prevSub = prevAssessment ? computeSubtotals(prevAssessment.scores, config) : null;

  const buildPayload = () => {
    const kidAge = ageAt(kid.dob, assessment.date);
    const ac = ageCat(kidAge);
    const wc = weightCat(kid.weight, ac, config.weightRules);

    // Attendance stats
    const kidAtt = (attendance || []).filter(r => r.records?.[kid.id] === "attend");
    const totalClasses = kidAtt.length;
    const now = new Date();
    const d90 = new Date(now - 90 * 86400000);
    const att90 = kidAtt.filter(r => new Date(r.date) >= d90).length;
    const weeks90 = 90 / 7;
    const weeklyAvg = (att90 / weeks90).toFixed(1);

    // Promo projection
    const promo = computePromoProjection(kid, attendance, config);
    let promoStr = "";
    if (promo.type === "complete") {
      promoStr = "Highest belt achieved — no further promotion path.";
    } else if (promo.type === "belt" && promo.nextBelt) {
      const targetDt = (config.promoTargets || {})[kid.id] || "";
      const dt = targetDt || promo.projectedDate || "TBD";
      promoStr = `Next belt: ${kid.belt} → ${promo.nextBelt}. ${promo.weeklyAvg > 0 ? `Projected: ${dt}.` : "Insufficient training rate to project."}`;
      promo.gates.forEach(g => { promoStr += ` ${g.label}: ${g.current}/${g.required}${g.done ? " ✓" : ""}.`; });
    }

    // Rankings
    const ranked = computeRankings(assessments.filter(a => a.status !== "pending"), roster || [kid], config);
    const kidRanked = ranked.filter(e => e.cycle === assessment.cycle && e.ageCat === ac && e.weightCat === wc);
    kidRanked.sort((a, b) => b.final - a.final);
    const myRank = kidRanked.findIndex(e => e.kidId === kid.id);
    const bracketLabel = `${ac} · ${wc}`;

    // Competition team status
    let teamStatus = "Not selected for competition team.";
    const isSelected = Object.values(selections || {}).some(arr => arr.includes(kid.id));
    if (isSelected) {
      teamStatus = "Currently selected for the competition team.";
    } else {
      // Check if close or far — compare score to lowest selected kid in bracket
      const bracketKey = Object.keys(selections || {}).find(k => k.includes(assessment.cycle));
      const selectedInBracket = bracketKey ? (selections[bracketKey] || []).filter(id => {
        const r = kidRanked.find(e => e.kidId === id);
        return !!r;
      }) : [];
      if (selectedInBracket.length > 0) {
        const lowestSelectedScore = Math.min(...selectedInBracket.map(id => {
          const r = kidRanked.find(e => e.kidId === id);
          return r ? r.final : 5;
        }));
        const gap = lowestSelectedScore - sub.final;
        if (gap <= 0.3) teamStatus = "Close to competition team selection — within striking distance of selected athletes.";
        else teamStatus = "Not yet in contention for competition team — continued development needed.";
      }
    }

    // Rubric context for strongest/weakest
    const rubricContext = {};
    Object.entries(assessment.scores).forEach(([c, v]) => {
      if (RUBRIC_HINTS[c]) rubricContext[c] = RUBRIC_HINTS[c];
    });

    return {
      action: "generate",
      name: kid.name, age: kidAge, belt: kid.belt, stripes: kid.stripes || 0, cycle: assessment.cycle,
      scores: assessment.scores,
      categoryScores: { BJJ: sub.BJJ, Athletic: sub.Athletic, Commitment: sub.Commitment, Competition: sub.Competition, final: sub.final },
      rubricContext,
      prevScores: prevAssessment?.scores || null,
      prevFinal: prevSub?.final ?? null,
      weeklyAvg: parseFloat(weeklyAvg), totalClasses,
      promoProjection: promoStr,
      ranking: myRank >= 0 ? myRank + 1 : null,
      bracketSize: kidRanked.length,
      bracketLabel,
      teamStatus,
    };
  };

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = buildPayload();
      const res = await fetch("/api/comment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      const { en, cn } = await res.json();
      // Snapshot previous before overwriting
      const prev = assessment.aiComment || {};
      const historyEntry = prev.en ? { en: prev.en, cn: prev.cn, timestamp: new Date().toISOString(), editedBy: loggedCoach, action: commentEn ? "regenerate" : "generate" } : null;
      const newComment = {
        en, cn, cnStale: false,
        generatedAt: new Date().toISOString(),
        generatedBy: loggedCoach,
        editHistory: [...(prev.editHistory || []), ...(historyEntry ? [historyEntry] : [])],
      };
      setAssessments(prev2 => prev2.map(a => a.id === assessment.id ? { ...a, aiComment: newComment } : a));
      setCommentEn(en);
      setCommentCn(cn);
      setDirty(false);
    } catch (e) {
      setError(e.message || "Failed to generate comment");
    } finally {
      setLoading(false);
    }
  };

  const retranslate = async () => {
    setRetranslating(true);
    setError("");
    try {
      const res = await fetch("/api/comment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retranslate", en: commentEn }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
      const { cn } = await res.json();
      const prev = assessment.aiComment || {};
      const historyEntry = { en: prev.en, cn: prev.cn, timestamp: new Date().toISOString(), editedBy: loggedCoach, action: "retranslate" };
      const newComment = { ...prev, cn, cnStale: false, editHistory: [...(prev.editHistory || []), historyEntry] };
      setAssessments(prev2 => prev2.map(a => a.id === assessment.id ? { ...a, aiComment: newComment } : a));
      setCommentCn(cn);
    } catch (e) {
      setError(e.message || "Failed to retranslate");
    } finally {
      setRetranslating(false);
    }
  };

  const saveEdit = () => {
    const prev = assessment.aiComment || {};
    const historyEntry = { en: prev.en, cn: prev.cn, timestamp: new Date().toISOString(), editedBy: loggedCoach, action: "edit" };
    const newComment = { ...prev, en: commentEn, cnStale: true, editHistory: [...(prev.editHistory || []), historyEntry] };
    setAssessments(prev2 => prev2.map(a => a.id === assessment.id ? { ...a, aiComment: newComment } : a));
    setDirty(false);
  };

  const hasComment = !!assessment?.aiComment?.en;

  return (
    <>
      <h2 style={s.h2}>Coach Commentary 教练评语</h2>
      <div style={s.card}>
        {/* Generate / Regenerate */}
        {canEdit && (
          <div style={{ display: "flex", gap: 8, marginBottom: hasComment ? 12 : 0, flexWrap: "wrap" }}>
            <button
              style={{ ...s.btnSm, background: hasComment ? "#FF980022" : "#4CAF5022", color: hasComment ? "#FF9800" : "#4CAF50", fontWeight: 700, opacity: loading ? 0.6 : 1 }}
              disabled={loading}
              onClick={generate}
            >
              {loading ? "⏳ Generating…" : hasComment ? "🔄 Regenerate" : "✨ Generate AI Comment"}
            </button>
            {hasComment && assessment?.aiComment?.cnStale && (
              <button
                style={{ ...s.btnSm, background: "#FF980022", color: "#FF9800", fontWeight: 700, opacity: retranslating ? 0.6 : 1 }}
                disabled={retranslating}
                onClick={retranslate}
              >
                {retranslating ? "⏳ Translating…" : "🔄 Re-translate CN"}
              </button>
            )}
          </div>
        )}

        {error && <div style={{ padding: 8, background: "#E5393511", borderRadius: 6, color: "#E53935", fontSize: 12, marginBottom: 10 }}>{error}</div>}

        {!hasComment && !loading && (
          <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>
            No AI comment generated yet.{canEdit ? " Click the button above to generate one." : ""}
          </div>
        )}

        {/* English — editable */}
        {hasComment && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>English</div>
            {canEdit ? (
              <textarea
                value={commentEn}
                onChange={e => { setCommentEn(e.target.value); setDirty(true); }}
                style={{ width: "100%", minHeight: 90, padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card2, color: C.text, fontSize: 13, lineHeight: 1.5, resize: "vertical", fontFamily: "inherit" }}
              />
            ) : (
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{commentEn}</div>
            )}
          </div>
        )}

        {/* Chinese — read only */}
        {hasComment && commentCn && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>中文</span>
              {(assessment?.aiComment?.cnStale || dirty) && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#FF980022", color: "#FF9800", fontWeight: 700 }}>⚠ Stale</span>}
            </div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{commentCn}</div>
          </div>
        )}

        {/* Save edit button */}
        {dirty && canEdit && (
          <button style={{ ...s.btnSm, background: "#4CAF5022", color: "#4CAF50", fontWeight: 700 }} onClick={saveEdit}>
            💾 Save Edit
          </button>
        )}

        {/* Meta */}
        {hasComment && assessment.aiComment.generatedAt && (
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>
            Generated {assessment.aiComment.generatedAt.slice(0, 10)} by {assessment.aiComment.generatedBy || "—"}
            {editHistory.length > 0 && ` · ${editHistory.length} edit${editHistory.length > 1 ? "s" : ""}`}
          </div>
        )}

        {/* History accordion — master coach / admin only */}
        {canViewHistory && editHistory.length > 0 && (
          <div style={{ marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            <div style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: C.textDim }} onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? "▲" : "▼"} Edit History ({editHistory.length})
            </div>
            {showHistory && (
              <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
                {editHistory.slice().reverse().map((h, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}08`, fontSize: 11 }}>
                    <div style={{ color: C.textDim }}>
                      <span style={{ fontWeight: 600 }}>{h.action}</span> · {h.editedBy} · {h.timestamp?.slice(0, 16).replace("T", " ")}
                    </div>
                    {h.en && <div style={{ color: C.text, marginTop: 2, fontSize: 11, opacity: 0.7 }}>{h.en.slice(0, 100)}{h.en.length > 100 ? "…" : ""}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function TrendChart({ assessments, config }) {
  const sorted = [...assessments].sort((a, b) => a.date.localeCompare(b.date));
  const data = sorted.map(a => ({ date: a.date, ...computeSubtotals(a.scores, config) }));
  if (data.length < 2) return null;
  const w = 320, h = 140, pad = { t: 10, r: 10, b: 24, l: 30 };
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const maxVal = 5;
  const x = (i) => pad.l + (i / (data.length - 1)) * iw;
  const y = (v) => pad.t + ih - (v / maxVal) * ih;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {[1, 2, 3, 4, 5].map(v => (
        <g key={v}>
          <line x1={pad.l} y1={y(v)} x2={w - pad.r} y2={y(v)} stroke={C.border} strokeWidth={0.5} />
          <text x={pad.l - 4} y={y(v)} textAnchor="end" dominantBaseline="middle" fill={C.textDim} fontSize={9}>{v}</text>
        </g>
      ))}
      {data.map((d, i) => (
        <text key={i} x={x(i)} y={h - 4} textAnchor="middle" fill={C.textDim} fontSize={8}>{d.date.slice(5)}</text>
      ))}
      {/* Final score line */}
      <polyline fill="none" stroke={C.red} strokeWidth={2}
        points={data.map((d, i) => `${x(i)},${y(d.final)}`).join(" ")} />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.final)} r={3.5} fill={C.red} />)}
    </svg>
  );
}

function KidForm({ kid, config, onSave, onCancel }) {
  const [form, setForm] = useState({ ...kid });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const up = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const handlePhoto = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try { const url = await uploadPhoto(file); up("photoUrl", url); }
    catch (e) { alert("Photo upload failed: " + e.message); }
    finally { setUploading(false); }
  };
  return (
    <div>
      {/* Photo upload */}
      <div style={{ marginBottom: 14 }}>
        <label style={s.label}>Photo</label>
        {form.photoUrl ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img src={form.photoUrl} alt="" style={{ width: 90, height: 120, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}` }} />
              {uploading && <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 22, height: 22, border: "3px solid #fff3", borderTop: `3px solid ${C.red}`, borderRadius: "50%", animation: "bushido-spin 0.8s linear infinite" }} /></div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ ...s.btnSm, fontSize: 11 }}>📷 Change</button>
              <button type="button" onClick={() => up("photoUrl", null)} style={{ ...s.btnSm, fontSize: 11, color: "#e74c3c", borderColor: "#e74c3c44" }}>🗑 Remove</button>
              <div style={{ fontSize: 10, color: C.textMuted }}>JPG / PNG · max 5MB</div>
            </div>
          </div>
        ) : (
          <div onClick={() => !uploading && fileRef.current?.click()} style={{
            border: `2px dashed ${C.border}`, borderRadius: 10, padding: "20px 16px", textAlign: "center", cursor: "pointer", background: C.card2,
          }}>
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 24, height: 24, border: "3px solid #fff1", borderTop: `3px solid ${C.red}`, borderRadius: "50%", animation: "bushido-spin 0.8s linear infinite" }} />
                <span style={{ fontSize: 12, color: C.textDim }}>Uploading…</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 28, marginBottom: 4, opacity: 0.5 }}>📷</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Tap to add photo</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>JPG / PNG · max 5MB</div>
              </>
            )}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handlePhoto(e.target.files[0]); e.target.value = ""; }} />
      </div>
      <style>{`@keyframes bushido-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={s.grid2}>
        <div><label style={s.label}>Name</label><input style={s.input} value={form.name} onChange={e => up("name", e.target.value)} /></div>
        <div><label style={s.label}>Date of Birth</label><input style={s.input} type="date" value={form.dob} onChange={e => up("dob", e.target.value)} /></div>
        <div><label style={s.label}>Belt</label>
          <select style={s.select} value={form.belt} onChange={e => up("belt", e.target.value)}>
            {config.belts.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div><label style={s.label}>Weight (kg)</label><input style={s.input} type="number" value={form.weight} onChange={e => up("weight", +e.target.value)} /></div>
        <div><label style={s.label}>Stripes</label>
          <select style={s.select} value={form.stripes || 0} onChange={e => up("stripes", +e.target.value)}>
            {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div><label style={s.label}>Class count in cycle</label>
          <select style={s.select} value={form.classCountOffset || 0} onChange={e => up("classCountOffset", +e.target.value)}>
            {[0,1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Prior classes within current stripe cycle (0-9)</div>
        </div>
        <div><label style={s.label}>Gym{form.isNew ? "" : "(s)"}</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {config.gyms.map(g => {
              const current = (form.gyms || [form.gym]).filter(Boolean);
              const selected = current.includes(g);
              return (
                <button key={g} type="button" onClick={() => {
                  if (form.isNew) {
                    up("gyms", [g]);
                  } else {
                    const next = selected ? current.filter(x => x !== g) : [...current, g];
                    if (next.length > 0) up("gyms", next);
                  }
                }} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: selected ? 700 : 400, cursor: "pointer",
                  background: selected ? C.red + "22" : C.card2, border: selected ? `2px solid ${C.red}` : `1px solid ${C.border}`,
                  color: selected ? C.red : C.text,
                }}>{selected ? "✓ " : ""}{g}</button>
              );
            })}
          </div>
        </div>
        <div><label style={s.label}>Status</label>
          <select style={s.select} value={form.active ? "active" : "inactive"} onChange={e => up("active", e.target.value === "active")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      {/* Parent Contact */}
      <div style={{ marginTop: 14, padding: "12px 14px", background: C.card2, borderRadius: 10, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", marginBottom: 8 }}>Parent / Guardian</div>
        <div style={s.grid2}>
          <div><label style={s.label}>Name</label><input style={s.input} value={form.parentName || ""} onChange={e => up("parentName", e.target.value)} placeholder="e.g. Li Wei" /></div>
          <div><label style={s.label}>Phone / WeChat</label><input style={s.input} value={form.parentPhone || ""} onChange={e => up("parentPhone", e.target.value)} placeholder="e.g. 138-xxxx-xxxx" /></div>
          <div><label style={s.label}>Preferred Language</label>
            <select style={s.select} value={form.parentLang || "en"} onChange={e => up("parentLang", e.target.value)}>
              <option value="en">English</option>
              <option value="zh">中文 Chinese</option>
            </select>
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>Used for shared report messages</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
        <button style={s.btnSm} onClick={onCancel}>Cancel</button>
        <button style={s.btn} onClick={() => { if (form.name && form.dob && (form.gyms || []).filter(Boolean).length > 0) { const { isNew, ...data } = form; onSave(data); } }}>Save</button>
      </div>
    </div>
  );
}

export function RosterScreen({ roster, setRoster, config, setConfig, assessments, setAssessments, defaultGym, isAdmin, isCommunity, isMasterCoach, loggedCoach, selections, attendance, selectedKidId, setSelectedKidId, onEditAssessment, onScore, registrations, setRegistrations }) {
  const [search, setSearch] = useState("");
  const [filterGym, setFilterGym] = useState(defaultGym || "");
  const [filterActive, setFilterActive] = useState("active");
  const [filterAge, setFilterAge] = useState("");
  const [filterWeight, setFilterWeight] = useState("");
  const [filterComp, setFilterComp] = useState("");
  const [filterFreq, setFilterFreq] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [showFilters, setShowFilters] = useState(false);
  const [modal, setModal] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [rosterView, setRosterView] = useState("list");
  const [detailKid, setDetailKid] = useState(null);
  const [galleryMenu, setGalleryMenu] = useState(null);

  const currentCycle = (getActiveScoringCycle(config.cycles)?.cycle) || config.cycles.filter(c => isQuarterClosed(c)).slice(-1)[0] || config.cycles[0] || "";

  const compIds = useMemo(() => {
    const ids = new Set();
    Object.values(selections || {}).forEach(arr => arr.forEach(id => ids.add(id)));
    return ids;
  }, [selections]);

  const weeklyAvg = useMemo(() => {
    const d90 = new Date(); d90.setDate(d90.getDate() - 90);
    const cutoff = toDateStr(d90);
    const recent = (attendance || []).filter(r => r.date >= cutoff);
    const weeks = Math.max(1, Math.round(90 / 7));
    const map = {};
    roster.forEach(k => {
      const attended = recent.filter(r => r.records?.[k.id] === "attend").length;
      map[k.id] = parseFloat((attended / weeks).toFixed(1));
    });
    return map;
  }, [attendance, roster]);

  const kidStatus = useMemo(() => {
    const status = {};
    roster.forEach(k => {
      const kidAss = assessments.filter(a => a.kidId === k.id && a.status !== "pending").sort((a, b) => b.date.localeCompare(a.date));
      const hasPending = assessments.some(a => a.kidId === k.id && a.status === "pending");
      const latest = kidAss[0];
      const hasCurrent = kidAss.some(a => a.cycle === currentCycle);
      let trend = null;
      if (kidAss.length >= 2) {
        const s1 = computeSubtotals(kidAss[0].scores, config).final;
        const s0 = computeSubtotals(kidAss[1].scores, config).final;
        trend = s1 > s0 + 0.1 ? "\u2191" : s1 < s0 - 0.1 ? "\u2193" : "\u2192";
      }
      const score = latest ? computeSubtotals(latest.scores, config).final : 0;
      status[k.id] = { latest, hasCurrent, trend, count: kidAss.length, score, hasPending };
    });
    return status;
  }, [roster, assessments, config, currentCycle]);

  const filtered = useMemo(() => {
    return roster.filter(k => {
      if (search && !k.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterGym && !kidInGym(k, filterGym)) return false;
      if (filterActive === "active" && !k.active) return false;
      if (filterActive === "inactive" && k.active) return false;
      if (filterActive === "overdue" && (!k.active || kidStatus[k.id]?.hasCurrent)) return false;
      if (filterAge) {
        const ac = ageCat(ageAt(k.dob, today()));
        if (ac !== filterAge) return false;
      }
      if (filterWeight) {
        const ac = ageCat(ageAt(k.dob, today()));
        const wc = weightCat(k.weight, ac, config.weightRules || {});
        if (wc !== filterWeight) return false;
      }
      if (filterComp === "yes" && !compIds.has(k.id)) return false;
      if (filterComp === "no" && compIds.has(k.id)) return false;
      if (filterFreq) {
        const wa = weeklyAvg[k.id] || 0;
        if (filterFreq === "0" && wa > 0) return false;
        if (filterFreq === "0-1" && (wa <= 0 || wa > 1)) return false;
        if (filterFreq === "1-2" && (wa <= 1 || wa > 2)) return false;
        if (filterFreq === "2-3" && (wa <= 2 || wa > 3)) return false;
        if (filterFreq === "3+" && wa <= 3) return false;
      }
      return true;
    }).sort((a, b) => {
      const dir = sortBy.endsWith("_asc") ? 1 : -1;
      const field = sortBy.replace(/_asc|_desc/, "");
      switch (field) {
        case "name": {
          const cmp = a.name.localeCompare(b.name);
          return sortBy === "name" ? cmp : sortBy === "name_asc" ? -cmp : cmp;
        }
        case "age": return dir * (ageAt(a.dob, today()) - ageAt(b.dob, today()));
        case "weight": return dir * ((a.weight || 0) - (b.weight || 0));
        case "score": return dir * ((kidStatus[a.id]?.score || 0) - (kidStatus[b.id]?.score || 0));
        case "training": return dir * ((weeklyAvg[a.id] || 0) - (weeklyAvg[b.id] || 0));
        case "belt": {
          const bi = (config.belts || []).indexOf(a.belt) - (config.belts || []).indexOf(b.belt);
          const cmp = bi !== 0 ? bi : (a.stripes || 0) - (b.stripes || 0);
          return dir * cmp;
        }
        default: return 0;
      }
    });
  }, [roster, search, filterGym, filterActive, filterAge, filterWeight, filterComp, filterFreq, sortBy, kidStatus, compIds, weeklyAvg, config]);

  const hasFilters = filterAge || filterWeight || filterComp || filterFreq || sortBy !== "name";
  const clearFilters = () => { setFilterAge(""); setFilterWeight(""); setFilterComp(""); setFilterFreq(""); setSortBy("name"); };

  const nextId = () => {
    const nums = roster.map(k => parseInt(k.id.slice(1))).filter(n => !isNaN(n));
    const next = Math.max(0, ...nums) + 1;
    return "K" + String(next).padStart(3, "0");
  };

  const saveKid = (kid) => {
    setRoster(prev => {
      const exists = prev.find(k => k.id === kid.id);
      if (exists) return prev.map(k => k.id === kid.id ? kid : k);
      return [...prev, { ...kid, joinDate: kid.joinDate || today() }];
    });
    setModal(null);
  };

  const parseImport = () => {
    if (!importText.trim()) return;
    const lines = importText.trim().split("\n").filter(l => l.trim());
    const newKids = [];
    let nextNum = Math.max(0, ...roster.map(k => parseInt(k.id.slice(1))).filter(n => !isNaN(n))) + 1;
    lines.forEach(line => {
      const cols = line.split(/\t|,/).map(c => c.trim());
      if (cols.length < 2) return;
      const name = cols[0];
      if (!name || name.toLowerCase() === "name") return;
      const dob = cols[1] || "";
      const belt = cols[2] || "White";
      const weight = parseFloat(cols[3]) || 25;
      const gym = cols[4] || config.gyms[0] || "";
      const stripes = parseInt(cols[5]) || 0;
      const classCountOffset = parseInt(cols[6]) || 0;
      const parentName = (cols[7] || "").trim();
      const parentPhone = (cols[8] || "").trim();
      const parentLang = (cols[9] || "").trim().toLowerCase() === "zh" ? "zh" : "en";
      const gyms = gym.includes("+") ? gym.split("+").map(g => g.trim()) : [gym];
      newKids.push({ id: "K" + String(nextNum++).padStart(3, "0"), name, dob, belt, weight, gyms, active: true, stripes, classCountOffset, parentName, parentPhone, parentLang, joinDate: today() });
    });
    if (newKids.length > 0) {
      setRoster(prev => [...prev, ...newKids]);
      setImportText("");
      setShowImport(false);
    }
  };

  const overdueCount = roster.filter(k => k.active && !kidStatus[k.id]?.hasCurrent).length;

  // ── Profile view data ──
  const kid = roster.find(k => k.id === selectedKidId);
  const kidAssessments = useMemo(() =>
    assessments.filter(a => a.kidId === selectedKidId).sort((a, b) => b.date.localeCompare(a.date)),
    [assessments, selectedKidId]
  );
  const approvedKidAssessments = useMemo(() => kidAssessments.filter(a => a.status !== "pending"), [kidAssessments]);
  const latest = approvedKidAssessments[0];
  const latestSub = latest ? computeSubtotals(latest.scores, config) : null;

  const deleteAssessment = (id) => {
    setAssessments(prev => prev.filter(a => a.id !== id));
  };
  const copyForAI = (a) => {
    const kid2 = roster.find(k => k.id === a.kidId);
    const sub = computeSubtotals(a.scores, config);
    const lines2 = [
      `Assessment: ${a.date} | ${a.cycle} | Coach: ${a.coach}`,
      `Kid: ${kid2?.name} (${a.kidId}) | Age: ${ageAt(kid2?.dob, a.date)} | ${kid2?.weight}kg | ${kidGymsStr(kid2)}`,
      ``,
      ...Object.entries(config.criteria).map(([cat, crits]) =>
        `${cat}: ${crits.map(c => `${c}=${a.scores[c]}`).join(", ")} \u2192 ${fmt(sub[cat])}`
      ),
      ``,
      `Final Score: ${fmt(sub.final)}`,
    ];
    navigator.clipboard?.writeText(lines2.join("\n"));
  };

  const kidAge = kid ? ageAt(kid.dob, today()) : 0;
  const ac = kid ? ageCat(kidAge) : "";
  const wc = kid ? weightCat(kid.weight, ac, config.weightRules) : "";

  // ══════════════════════════════════════════════════════════════════════
  // PROFILE VIEW — when a kid is selected
  // ══════════════════════════════════════════════════════════════════════
  if (selectedKidId && kid) {
    return (
      <div style={s.page}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ ...s.h1, margin: 0 }}>Students</h1>
            <PageHelp page="roster" />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
          {kid && <button style={s.btnSm} onClick={() => {
            const html = buildReportHtml({ kid, config, attendance, latest, approvedKidAssessments });
            const w = window.open("", "_blank");
            w.document.write(html + '\n<script>window.print();</script>');
            w.document.close();
          }}>📄 Parent Report</button>}
            {kid && !isCommunity && (() => {
              const shareToken = () => {
                if (!latest) return;
                const token = uid() + uid();
                const shareTokens = { ...(config.shareTokens || {}), [token]: { kidId: kid.id, cycle: latest.cycle, createdBy: loggedCoach, createdAt: new Date().toISOString() } };
                setConfig(prev => ({ ...prev, shareTokens }));
                const url = window.location.origin + "/#/report/" + token;
                const lang = kid.parentLang || "en";
                const text = lang === "en"
                  ? `🥋 ${kid.name} — BJJ Progress Report (${latest.cycle})\n${url}`
                  : `🥋 ${kid.name} — 巴西柔术进步报告 (${latest.cycle})\n${url}`;
                navigator.clipboard?.writeText(text);
                alert(lang === "en"
                  ? "Link copied to clipboard!\n\nShare it with the parent."
                  : "链接已复制！\n\n请通过微信分享给家长。");
              };
              return latest ? <button style={s.btnSm} onClick={shareToken}>🔗 Share</button> : null;
            })()}
            {kid && !isCommunity && <button style={{ ...s.btnSm, background: C.red, color: "#fff" }} onClick={() => onScore(kid.id)}>📝 Score</button>}
            {kid && <button style={s.btnSm} onClick={() => setSelectedKidId("")}>← Back</button>}
          </div>
        </div>
      {/* Header Card */}
      {kid && (
        <div style={{ ...s.card, background: `linear-gradient(135deg, ${C.card} 0%, ${C.red}11 100%)` }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 80, height: 107, borderRadius: 10, overflow: "hidden", border: `2px solid ${BELT_HEX[kid.belt] || "#888"}`, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {kid.photoUrl ? <img src={kid.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <KidAvatar kid={kid} size={52} />}
              </div>
              {<button onClick={() => setModal(kid)} style={{ position: "absolute", bottom: -4, right: -4, width: 24, height: 24, borderRadius: "50%", background: C.red, border: `2px solid ${C.card}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, padding: 0 }}>📷</button>}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{kid.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{kid.id} · {kidGymsStr(kid)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <BeltBadge belt={kid.belt} />
            {(kid.stripes > 0) && <span style={s.badge(C.red)}>{"🎖".repeat(kid.stripes || 0)}</span>}
            <span style={s.badge(C.blue)}>{kidAge}y · {ac}</span>
            <span style={s.badge(C.orange)}>{kid.weight}kg · {wc}</span>
            <span style={s.badge(kid.active ? C.green : "#e74c3c")}>{kid.active ? "Active" : "Inactive"}</span>
            {(() => {
              const isCompKid = Object.values(selections || {}).some(arr => arr.includes(kid.id));
              if (isCompKid) return <span style={s.badge(C.red)}>🏆 Competition</span>;
              return null;
            })()}
          </div>
          <div style={{ marginTop: 10, padding: "8px 12px", background: C.card2, borderRadius: 8, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.textDim }}>👤 Parent</span>
              {(kid.parentName || kid.parentPhone) ? (<>
                {kid.parentName && <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{kid.parentName}</span>}
                {kid.parentPhone && <span style={{ fontSize: 12, color: C.textDim }}>{kid.parentPhone}</span>}
                <span style={{ fontSize: 10, color: C.textMuted, marginLeft: "auto" }}>{kid.parentLang === "en" ? "EN" : "中文"}</span>
              </>) : (
                <span style={{ fontSize: 11, color: C.orange, fontStyle: "italic" }}>No parent info — tap 📷 to edit</span>
              )}
            </div>
        </div>
      )}

      {/* Attendance Stats */}
      {kid && <AttendanceStats kidId={kid.id} attendance={attendance} selections={selections} config={config} />}

      {/* Weekly Attendance Chart */}
      {kid && <WeeklyAttendanceChart kidId={kid.id} attendance={attendance} />}

      {/* Training Log */}
      {kid && <TrainingLog kidId={kid.id} attendance={attendance} config={config} />}

      {/* Latest Assessment */}
      {kid && latestSub && (
        <>
          <h2 style={s.h2}>Latest Assessment</h2>
          <div style={s.card}>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>{latest.date} · {latest.cycle} · Coach: {latest.coach}</div>
            <div style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
              <RadarChart data={{ BJJ: latestSub.BJJ, Athletic: latestSub.Athletic, Commitment: latestSub.Commitment, Competition: latestSub.Competition }} size={180} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {Object.entries({ BJJ: latestSub.BJJ, Athletic: latestSub.Athletic, Commitment: latestSub.Commitment, Competition: latestSub.Competition }).map(([cat, val]) => (
                <div key={cat} style={{ padding: 8, background: C.card2, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: CATEGORY_COLORS[cat], fontWeight: 700, textTransform: "uppercase" }}>{cat}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{fmt(val)}</div>
                  <ScoreBar value={val} color={CATEGORY_COLORS[cat]} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: 10, background: C.red + "11", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Final</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.red, fontFamily: "'Bebas Neue', sans-serif" }}>{fmt(latestSub.final)}</div>
            </div>
          </div>
        </>
      )}

      {/* Goals */}
      {kid && latest && !isCommunity && (
        <AICommentSection
          kid={kid}
          assessment={latest}
          prevAssessment={approvedKidAssessments.length > 1 ? approvedKidAssessments[1] : null}
          config={config}
          assessments={assessments}
          setAssessments={setAssessments}
          attendance={attendance}
          selections={selections}
          loggedCoach={loggedCoach}
          isAdmin={isAdmin}
          isMasterCoach={isMasterCoach}
          isCommunity={isCommunity}
          roster={roster}
        />
      )}

      {/* Detailed Assessment */}
      {kid && latest && <DetailedRubricView assessment={latest} config={config} />}

      {/* Goals */}
      {kid && <GoalsSection kidId={kid.id} config={config} setConfig={setConfig} readOnly={isCommunity} />}

      {/* Promotion Progress */}
      {kid && <PromotionProgress kid={kid} attendance={attendance} config={config} setConfig={setConfig} readOnly={isCommunity} />}

      {/* Promotion History */}
      {kid && (() => {
        const log = (config.promotionLog || []).filter(p => p.kidId === kid.id);
        const rules = config.promotionRules || { stripeClasses: 10, stripesForBelt: 4 };
        if (!log.length && !(kid.stripes > 0)) return null;
        return (
          <>
            <h2 style={s.h2}>Promotions 晋级</h2>
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: log.length ? 10 : 0 }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {Array.from({ length: rules.stripesForBelt || 4 }).map((_, i) => (
                    <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: i < (kid.stripes || 0) ? C.red : C.border }} />
                  ))}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{kid.stripes || 0}/{rules.stripesForBelt || 4} stripes</span>
              </div>
              {log.slice().reverse().map((p, i) => (
                <div key={i} style={{ padding: "6px 0", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: p.type === "belt" ? C.orange : C.green }}>
                      {p.type === "belt" ? `🥋 ${p.from} → ${p.to}` : `🎖 Stripe ${p.to}`}
                    </span>
                    <span style={{ fontSize: 10, color: C.textDim }}> · {p.by}</span>
                  </div>
                  <span style={{ fontSize: 11, color: C.textDim }}>{p.date}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Assessment Comparison */}
      {kid && approvedKidAssessments.length >= 2 && (
        <ComparisonSection assessments={approvedKidAssessments} config={config} />
      )}

      {/* Score Trend */}
      {kid && approvedKidAssessments.length > 1 && (
        <>
          <h2 style={s.h2}>Score Trend</h2>
          <div style={s.card}>
            <TrendChart assessments={approvedKidAssessments} config={config} />
          </div>
        </>
      )}

      {/* History */}
      {kid && (
        <>
          <h2 style={s.h2}>Assessment History ({kidAssessments.length})</h2>
          {kidAssessments.length === 0 && <div style={{ ...s.card, color: C.textDim, textAlign: "center" }}>No assessments yet</div>}
          {kidAssessments.map(a => {
            const sub = computeSubtotals(a.scores, config);
            const canApproveHere = isAdmin || isMasterCoach;
            return (
              <AssessmentCard key={a.id} a={a} sub={sub} config={config} onEdit={() => onEditAssessment(a)} onDelete={() => deleteAssessment(a.id)} onCopy={() => copyForAI(a)}
                canApprove={canApproveHere}
                onApprove={() => { setAssessments(prev => prev.map(x => x.id === a.id ? { ...x, status: "approved", approvedBy: loggedCoach } : x)); }}
                onReject={() => { if (confirm(`Reject this assessment by ${a.coach}?`)) deleteAssessment(a.id); }}
              />
            );
          })}
        </>
      )}
 
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Kid" : "Edit Kid"}>
        {modal && <KidForm kid={modal === "add" ? { id: nextId(), name: "", dob: "", belt: "White", weight: 25, gyms: [defaultGym || config.gyms[0] || ""], active: true, stripes: 0, classCountOffset: 0, parentName: "", parentPhone: "", parentLang: "en", isNew: true } : modal} config={config} onSave={saveKid} onCancel={() => setModal(null)} />}
      </Modal>
    </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ ...s.h1, margin: 0 }}>Students</h1>
          <PageHelp page="roster" />
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2, marginRight: 4 }}>
            <button onClick={() => setRosterView("list")} style={{ padding: "5px 8px", borderRadius: 5, border: `1px solid ${C.border}`, cursor: "pointer", background: rosterView === "list" ? C.red + "20" : C.card2, color: rosterView === "list" ? C.red : C.textDim, fontSize: 14, lineHeight: 1 }}>☰</button>
            <button onClick={() => setRosterView("gallery")} style={{ padding: "5px 8px", borderRadius: 5, border: `1px solid ${C.border}`, cursor: "pointer", background: rosterView === "gallery" ? C.red + "20" : C.card2, color: rosterView === "gallery" ? C.red : C.textDim, fontSize: 14, lineHeight: 1 }}>⊞</button>
          </div>
          <button style={s.btnSm} onClick={() => setShowImport(!showImport)}>📋 Import</button>
          <button style={s.btn} onClick={() => setModal("add")}>+ Add Kid</button>
        </div>
      </div>

      {/* Bulk Import */}
      {showImport && (
        <div style={{ ...s.card, marginBottom: 14, border: `1px solid ${C.red}33` }}>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>
            Paste rows: <b>Name, DOB, Belt, Weight, Gym, Stripes, ClassOffset, ParentName, ParentPhone, ParentLang</b> (tab or comma separated). Cols 6–10 optional. ParentLang: en or zh (default en).
          </div>
          <textarea style={{ ...s.input, height: 100, fontFamily: "monospace", fontSize: 11 }} placeholder={"John Doe\t2017-03-15\tWhite\t28\tJing'An\t2\t5\tLi Wei\t138-0000-0000\tzh\nJane Smith\t2016-05-20\tGrey\t32\tXuhui\t0\t0\tJohn Smith\t+1-555-1234\ten"} value={importText} onChange={e => setImportText(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button style={s.btnSm} onClick={() => setShowImport(false)}>Cancel</button>
            <button style={{ ...s.btn, fontSize: 12 }} onClick={parseImport}>Import {importText.trim().split("\n").filter(l => l.trim()).length} rows</button>
          </div>
        </div>
      )}

      <input style={{ ...s.input, marginBottom: 10 }} type="text" placeholder="🔍 Search by name…" value={search}
        onChange={e => setSearch(e.target.value)} />

      {/* ── Pending Registrations (admin / master coach only) ── */}
      {(isAdmin || isMasterCoach) && (() => {
        const coachObj = config.coaches.find(c => coachName(c) === loggedCoach);
        const masterGym = isMasterCoach && coachObj ? coachGym(coachObj) : null;
        const pending = (registrations || []).filter(r => {
          if (!r || r._init || r.status !== "pending") return false;
          if (isAdmin) return true;
          if (isMasterCoach && masterGym) return r.gym === masterGym;
          return false;
        });
        if (pending.length === 0) return null;

        const approveReg = (reg) => {
          const nums = roster.map(k => parseInt(k.id.slice(1))).filter(n => !isNaN(n));
          const nextNum = Math.max(0, ...nums) + 1;
          const newKid = {
            id: "K" + String(nextNum).padStart(3, "0"),
            name: reg.name,
            dob: reg.dob,
            belt: reg.belt || "White",
            weight: reg.weight || 25,
            gyms: [reg.gym],
            active: true,
            stripes: reg.stripes || 0,
            classCountOffset: 0,
            parentName: reg.parentName || "",
            parentPhone: reg.parentPhone || "",
            parentLang: reg.parentLang || "en",
            photoUrl: reg.photoUrl || null,
            joinDate: today(),
          };
          setRoster(prev => [...prev, newKid]);
          setRegistrations(prev => (prev || []).filter(r => r.id !== reg.id));
        };

        const rejectReg = (reg) => {
          setRegistrations(prev => (prev || []).filter(r => r.id !== reg.id));
        };

        return (
          <div style={{ marginBottom: 14, padding: "12px 14px", background: "#FF980012", border: "1px solid #FF980033", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#FF9800" }}>📋 Pending Registrations ({pending.length})</div>
            </div>
            {pending.map(reg => (
              <div key={reg.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
                {reg.photoUrl
                  ? <img src={reg.photoUrl} alt="" style={{ width: 40, height: 52, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}` }} />
                  : <div style={{ width: 40, height: 52, borderRadius: 6, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: C.textMuted }}>👤</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{reg.name}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>
                    {reg.belt}{reg.stripes > 0 ? ` · ${reg.stripes}☆` : ""} · {reg.gym} · {reg.dob}
                  </div>
                  {(reg.parentName || reg.parentPhone) && (
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {reg.parentName}{reg.parentPhone ? ` · ${reg.parentPhone}` : ""}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => approveReg(reg)} style={{ ...s.btnSm, background: "#4CAF5022", color: "#4CAF50", fontWeight: 700, fontSize: 11 }}>✓ Approve</button>
                  <button onClick={() => rejectReg(reg)} style={{ ...s.btnSm, background: "#E5393522", color: "#E53935", fontWeight: 700, fontSize: 11 }}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {isAdmin ? (
        <div style={{ display: "flex", marginBottom: 10, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <button onClick={() => setFilterGym("")} style={{
            flex: 1, padding: "7px 10px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
            background: !filterGym ? C.red + "18" : "transparent",
            borderBottom: !filterGym ? `2px solid ${C.red}` : "2px solid transparent",
            color: !filterGym ? C.red : C.textDim, transition: "all 0.15s",
          }}>All</button>
          {config.gyms.map(g => (
            <button key={g} onClick={() => setFilterGym(g)} style={{
              flex: 1, padding: "7px 6px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: filterGym === g ? C.red + "18" : "transparent",
              borderBottom: filterGym === g ? `2px solid ${C.red}` : "2px solid transparent",
              color: filterGym === g ? C.red : C.textDim, transition: "all 0.15s",
            }}>{g}</button>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>📍 {filterGym}</div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Tabs items={["all", "active", "inactive", "overdue"]} active={filterActive} onChange={setFilterActive} />
        <button onClick={() => setShowFilters(!showFilters)} style={{
          ...s.btnSm, marginLeft: "auto", fontSize: 11, padding: "4px 10px",
          background: hasFilters ? C.red + "22" : "transparent", color: hasFilters ? C.red : C.textDim,
          border: `1px solid ${hasFilters ? C.red : C.border}`,
        }}>⚙ Filter{hasFilters ? " ●" : ""}</button>
      </div>

      {showFilters && (
        <div style={{ ...s.card, marginBottom: 12, padding: 12, border: `1px solid ${C.border}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginBottom: 3, fontWeight: 700 }}>Age</div>
              <select style={{ ...s.select, fontSize: 12 }} value={filterAge} onChange={e => setFilterAge(e.target.value)}>
                <option value="">All ages</option>
                {["U8", "U10", "U12", "U14"].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginBottom: 3, fontWeight: 700 }}>Weight</div>
              <select style={{ ...s.select, fontSize: 12 }} value={filterWeight} onChange={e => setFilterWeight(e.target.value)}>
                <option value="">All weights</option>
                {["Light", "Medium", "Heavy"].map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginBottom: 3, fontWeight: 700 }}>Comp Team</div>
              <select style={{ ...s.select, fontSize: 12 }} value={filterComp} onChange={e => setFilterComp(e.target.value)}>
                <option value="">All</option>
                <option value="yes">🏆 Selected</option>
                <option value="no">Not selected</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginBottom: 3, fontWeight: 700 }}>Training Freq</div>
              <select style={{ ...s.select, fontSize: 12 }} value={filterFreq} onChange={e => setFilterFreq(e.target.value)}>
                <option value="">All</option>
                <option value="0">Haven't trained</option>
                <option value="0-1">{"< 1x/wk"}</option>
                <option value="1-2">1-2x/wk</option>
                <option value="2-3">2-3x/wk</option>
                <option value="3+">3+/wk</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", marginTop: 10, marginBottom: 5, fontWeight: 700 }}>Sort by</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { field: "name", label: "Name" },
              { field: "age", label: "Age" },
              { field: "weight", label: "Weight" },
              { field: "belt", label: "Belt" },
              { field: "score", label: "Score" },
              { field: "training", label: "Training" },
            ].map(({ field, label }) => {
              const base = sortBy.replace(/_asc|_desc/, "");
              const isActive = base === field || sortBy === field;
              const isDesc = sortBy === `${field}_desc` || (sortBy === field && field === "name");
              const arrow = isActive ? (isDesc ? " ↓" : " ↑") : "";
              return (
                <button key={field} onClick={() => {
                  if (!isActive) {
                    const defaultDesc = ["score", "training", "belt"].includes(field);
                    setSortBy(defaultDesc ? `${field}_desc` : (field === "name" ? "name" : `${field}_asc`));
                  } else {
                    if (sortBy.endsWith("_desc")) setSortBy(`${field}_asc`);
                    else if (sortBy.endsWith("_asc")) setSortBy(`${field}_desc`);
                    else if (field === "name") setSortBy("name_asc");
                    else setSortBy(`${field}_desc`);
                  }
                }} style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${isActive ? C.red : C.border}`,
                  background: isActive ? C.red + "22" : "transparent",
                  color: isActive ? C.red : C.textDim,
                }}>{label}{arrow}</button>
              );
            })}
          </div>
          {hasFilters && (
            <button onClick={clearFilters} style={{ ...s.btnSm, marginTop: 8, fontSize: 11, color: C.red }}>✕ Clear filters</button>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>
        {filtered.length} kids{overdueCount > 0 && filterActive !== "overdue" ? ` · ${overdueCount} overdue` : ""}
      </div>

      {/* ── LIST VIEW ── */}
      {rosterView === "list" && filtered.map(kid => {
        const age = ageAt(kid.dob, today());
        const st = kidStatus[kid.id] || {};
        const wk = weeklyAvg[kid.id] || 0;
        const isComp = compIds.has(kid.id);
        return (
          <div key={kid.id} style={{ ...s.card, opacity: kid.active ? 1 : 0.5, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            onClick={() => setSelectedKidId(kid.id)}>
            <KidAvatar kid={kid} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
                {kid.name}
                {isComp && <span style={{ fontSize: 10 }}>🏆</span>}
                <span style={{ color: C.textDim, fontWeight: 400, fontSize: 12 }}>{kid.id}</span>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
                {age}y · {kid.weight}kg · {kidGymsStr(kid)}
              </div>
              <div style={{ fontSize: 11, marginTop: 2, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                {st.score > 0 && <span style={{ fontWeight: 700, color: st.score >= 4 ? "#4CAF50" : st.score >= 3 ? "#ff9800" : C.red }}>{fmt(st.score)}</span>}
                <span style={{ color: wk >= 3 ? "#4CAF50" : wk >= 2 ? "#ff9800" : C.textDim, fontWeight: 600, fontSize: 10 }}>{wk}/wk</span>
                {st.trend && <span style={{ color: st.trend === "\u2191" ? C.green : st.trend === "\u2193" ? "#f44" : C.textDim, fontWeight: 700 }}>{st.trend}</span>}
                {!st.hasCurrent && kid.active && <span style={{ color: "#f44", fontWeight: 600, fontSize: 10, background: "#f4422a22", padding: "1px 5px", borderRadius: 4 }}>OVERDUE</span>}
                {!st.latest && <span style={{ color: "#f44", fontSize: 10, fontWeight: 600 }}>No assessments</span>}
              </div>
            </div>
            <BeltBadge belt={kid.belt} />
            <button style={{ ...s.btnSm, padding: "4px 8px" }} onClick={e => { e.stopPropagation(); setModal(kid); }}>Edit</button>
            <button style={{ ...s.btnSm, padding: "4px 8px", fontSize: 11, color: kid.active ? C.textDim : "#4CAF50" }} onClick={e => {
              e.stopPropagation();
              setRoster(prev => prev.map(k => k.id === kid.id ? { ...k, active: !k.active } : k));
            }}>{kid.active ? "⏸" : "▶"}</button>
            <button style={{ ...s.btnSm, padding: "4px 8px", fontSize: 11, color: "#f44" }} onClick={e => {
              e.stopPropagation();
              if (confirm(`Delete ${kid.name}? This will also remove all their assessments.`)) {
                setRoster(prev => prev.filter(k => k.id !== kid.id));
              }
            }}>🗑</button>
          </div>
        );
      })}

      {/* ── GALLERY VIEW ── */}
      {rosterView === "gallery" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {filtered.map(kid => (
            <div key={kid.id} onClick={() => setDetailKid(kid)} style={{
              background: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
              overflow: "hidden", cursor: "pointer", opacity: kid.active ? 1 : 0.5,
              position: "relative", transition: "border-color 0.15s",
            }}>
              <div style={{ width: "100%", aspectRatio: "1", background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                {kid.photoUrl
                  ? <img src={kid.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <KidAvatar kid={kid} size={56} rounded={true} />
                }
                <button onClick={e => { e.stopPropagation(); setGalleryMenu(galleryMenu === kid.id ? null : kid.id); }} style={{
                  position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none",
                  borderRadius: 4, color: "#fff", fontSize: 14, cursor: "pointer", padding: "1px 5px", lineHeight: 1,
                }}>⋮</button>
                {galleryMenu === kid.id && (
                  <div style={{ position: "absolute", top: 24, right: 4, zIndex: 10, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4, minWidth: 110, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setGalleryMenu(null); setModal(kid); }} style={{ display: "block", width: "100%", padding: "8px 10px", background: "none", border: "none", color: C.text, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", borderRadius: 4 }}>✏️ Edit</button>
                    <button onClick={() => { setGalleryMenu(null); setRoster(prev => prev.map(k => k.id === kid.id ? { ...k, active: !k.active } : k)); }} style={{ display: "block", width: "100%", padding: "8px 10px", background: "none", border: "none", color: C.orange, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", borderRadius: 4 }}>{kid.active ? "⏸ Pause" : "▶ Activate"}</button>
                    <button onClick={() => { setGalleryMenu(null); if (confirm(`Delete ${kid.name}?`)) setRoster(prev => prev.filter(k => k.id !== kid.id)); }} style={{ display: "block", width: "100%", padding: "8px 10px", background: "none", border: "none", color: "#e74c3c", fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer", borderRadius: 4 }}>🗑 Delete</button>
                  </div>
                )}
              </div>
              <div style={{ padding: "8px 8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 4 }}>{kid.name.split(/\s(?=[^\s]*$)/)[0]}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 20, height: 6, borderRadius: 2, background: BELT_HEX[kid.belt] || "#888", border: kid.belt === "White" ? "1px solid #555" : "none" }} />
                    {[...Array(4)].map((_, i) => <div key={i} style={{ width: 3, height: 3, borderRadius: 1, background: i < (kid.stripes || 0) ? "#fff" : "#333" }} />)}
                  </div>
                  <span style={{ fontSize: 9, color: C.textDim, fontWeight: 600 }}>{kidGymsStr(kid)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery click-away */}
      {galleryMenu && <div onClick={() => setGalleryMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 5 }} />}

      {/* ── DETAIL POPUP (gallery tap) ── */}
      {detailKid && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 24 }} onClick={() => setDetailKid(null)}>
          <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, maxWidth: 380, width: "92%", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: "100%", aspectRatio: "3/4", background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `3px solid ${BELT_HEX[detailKid.belt] || "#888"}` }}>
              {detailKid.photoUrl
                ? <img src={detailKid.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <KidAvatar kid={detailKid} size={90} rounded={true} />
              }
            </div>
            <div style={{ padding: "16px 20px 20px" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>{detailKid.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 28, height: 8, borderRadius: 2, background: BELT_HEX[detailKid.belt] || "#888", border: detailKid.belt === "White" ? "1px solid #555" : "none" }} />
                  {[...Array(4)].map((_, i) => <div key={i} style={{ width: 4, height: 4, borderRadius: 1, background: i < (detailKid.stripes || 0) ? "#fff" : "#333" }} />)}
                </div>
                <span style={{ fontSize: 11, color: C.textDim }}>{detailKid.belt}</span>
              </div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Gym", value: kidGymsStr(detailKid) },
                  { label: "Weight", value: `${detailKid.weight}kg` },
                  { label: "Age", value: detailKid.dob ? `${ageAt(detailKid.dob, today())}y · ${ageCat(ageAt(detailKid.dob, today()))}` : "—" },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, background: C.card2, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.value}</div>
                    <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setSelectedKidId(detailKid.id); setDetailKid(null); }} style={{
                width: "100%", padding: "11px 0", background: C.red, color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
              }}>View Full Profile</button>
              <button onClick={() => setDetailKid(null)} style={{
                width: "100%", padding: "9px 0", background: "none", color: C.textDim,
                border: "none", fontSize: 12, cursor: "pointer", marginTop: 6,
              }}>Close</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Kid" : "Edit Kid"}>
        {modal && <KidForm kid={modal === "add" ? { id: nextId(), name: "", dob: "", belt: "White", weight: 25, gyms: [defaultGym || config.gyms[0] || ""], active: true, stripes: 0, classCountOffset: 0, parentName: "", parentPhone: "", parentLang: "en", isNew: true } : modal} config={config} onSave={saveKid} onCancel={() => setModal(null)} />}
      </Modal>
    </div>
  );
}
