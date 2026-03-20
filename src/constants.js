/* ━━━ CONSTANTS & STATIC DATA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export const BELT_HEX = {White:"#e0e0e0","Grey-White":"#b8b8b8",Grey:"#808080","Grey-Black":"#505050","Yellow-White":"#e8d888",Yellow:"#d4a818","Yellow-Black":"#a07808"};
export const CATEGORY_COLORS = {BJJ:"#C41E3A",Athletic:"#2196F3",Commitment:"#4CAF50",Competition:"#FF9800"};

/* ━━━ DEFAULT CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export const DEFAULT_CONFIG = {
  coaches:[{name:"Saulo",gym:"Jing'An",pin:"bushido"},{name:"Ahmet",gym:"Xuhui",pin:"bushido"},{name:"Gui",gym:"Minhang",pin:"bushido"},{name:"Jadson",gym:"Jing'An",pin:"bushido"}],
  gyms:["Jing'An","Xuhui","Minhang"],
  belts:["White","Grey-White","Grey","Grey-Black","Yellow-White","Yellow","Yellow-Black"],
  cycles:["2025 Q1","2025 Q2","2025 Q3","2025 Q4","2026 Q1","2026 Q2","2026 Q3","2026 Q4","2027 Q1","2027 Q2","2027 Q3","2027 Q4"],
  scoringWeights:{BJJ:0.4,Athletic:0.2,Commitment:0.2,Competition:0.2},
  promotionRules: { stripeClasses: 10, beltClasses: 40, beltMonths: 9, stripesForBelt: 4 },
  retentionRules: { coldAfterDays: 14, churnAfterDays: 60, coolingFromWeekly: 2, coolingToWeekly: 1, newWindowDays: 60, newMinWeekly: 2, contactSnoozeDays: 14 },
  contactLog: [],
  classTypes:[
    {id:"group1",name:"Kids Fundamentals",category:"group",color:"#4CAF50"},
    {id:"group2",name:"Kids Advanced",category:"group",color:"#2196F3"},
    {id:"comp",name:"Competition Training",category:"competition",color:"#FF9800"},
    {id:"pt",name:"Private / PT",category:"private",color:"#9C27B0"},
  ],
  weeklySchedule:[],
  criteria:{
    BJJ:["Standup","Top Game","Bottom Game","Submission","Defense"],
    Athletic:["Strength","Cardio","Coordination"],
    Commitment:["Attendance","Attitude"],
    Competition:["Participation","Performance"],
  },
  weightRules:{
    U8:{Light:[0,23],Medium:[23,28],Heavy:[28,999]},
    U10:{Light:[0,28],Medium:[28,34],Heavy:[34,999]},
    U12:{Light:[0,32],Medium:[32,40],Heavy:[40,999]},
    U14:{Light:[0,38],Medium:[38,48],Heavy:[48,999]},
  },
};

/* ━━━ SCORING RUBRIC HINTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export const RUBRIC_HINTS = {
  "Standup": [
    "Knows 1 takedown but only works with a partner who doesn\u2019t resist. No grip fighting. Loses balance easily.",
    "Can do 1\u20132 takedowns in sparring sometimes. Starts to use grips but doesn\u2019t fight for them. Keeps balance under light pressure. Easy to predict.",
    "Does 2\u20133 takedowns with one clear favorite. Fights for grips and breaks opponent\u2019s grips. Keeps balance under pressure. Starts to read opponent\u2019s movement.",
    "Connects 2+ takedowns together (if first one fails, goes to the next). Good grip fighting both ways. Hard to take down. Works from both sides.",
    "Controls the standup. Uses grips to create openings. Chains 3+ attacks. Defends takedowns and counters right away. Best standup in their bracket.",
  ],
  "Top Game": [
    "Can hold side control or mount if partner stays still. No guard passing. No pressure. Gets reversed easily.",
    "Holds top positions under some resistance. Knows 1 guard pass but doesn\u2019t finish it often. Starting to use body weight.",
    "Can finish 1\u20132 guard passes regularly. Holds top positions under resistance. Moves to a better position when the chance is there (e.g. side control \u2192 mount).",
    "Passes guard consistently with 2\u20133 techniques. Moves between positions smoothly. Uses pressure well. Starts attacking from top.",
    "Very hard to escape from. Reacts to escapes quickly. Multiple ways to pass. Controls the pace from top. Best top game in their bracket.",
  ],
  "Bottom Game": [
    "Lies flat with no movement. No frames, no guard. Gets passed and held down with no response.",
    "Can hold closed guard. Starting to use hips to move. Knows 1 sweep or submission from bottom but rarely finishes. Tries to recover guard when passed but usually too late.",
    "Has 1\u20132 sweeps and 1\u20132 submissions from guard. Uses frames and hip escapes. Recovers guard sometimes after being passed.",
    "Has a preferred guard with 2\u20133 options (sweeps and submissions). Recovers guard quickly when passed. Starting to chain attacks together.",
    "Plays 2\u20133 guards well. Chains attacks constantly. Strong guard retention. Dangerous with both sweeps and submissions, attacks both sides. Best bottom game in their bracket.",
  ],
  "Submission": [
    "Knows 1\u20132 submissions but can\u2019t finish them in sparring. No control before attacking. Telegraphs everything.",
    "Can finish 1\u20132 submissions against similar-level partners. Needs a good position first. Doesn\u2019t try again if the first attempt fails.",
    "Finishes 2\u20133 submissions from different positions. Starting to recognize when a submission is available. Tries again if the first attempt fails.",
    "Attacks submissions in combinations. Good control before finishing. Moves to the next option when one fails.",
    "Submits from anywhere (top, bottom, back). Reads opponent\u2019s reactions and adjusts. Chains 3+ attacks together. Best finisher in their bracket.",
  ],
  "Defense": [
    "Panics under pressure. No escapes. Taps to positions instead of submissions. Doesn\u2019t try to improve position.",
    "Knows 1 escape but timing is usually wrong. Stays calm enough to try but rarely gets out. Recognizes bad positions.",
    "Escapes most bad positions against similar-level partners. Recognizes submission danger early. Stays calm under pressure.",
    "Hard to submit. Escapes and moves to a better position right away. Comfortable even in bad spots. Rarely makes the same mistake twice.",
    "Turns defense into offense. Escapes lead directly into attacks or better positions. Very hard to hold down or submit. Best defensive game in their bracket.",
  ],
  "Strength": [
    "Much weaker than others in their age/weight. Can\u2019t hold frames or resist pressure. Gets moved around easily.",
    "Below average for their age/weight. Holds positions briefly but loses them under pressure. Struggles to create space.",
    "Average strength for their age/weight. Can hold positions and apply decent pressure. Holds frames when needed.",
    "Above average. Strong frames, heavy pressure, hard to move. Creates problems with physicality.",
    "Strongest in their age/weight bracket. Clear physical advantage in most exchanges. Explosive when needed.",
  ],
  "Cardio": [
    "Gets tired in the first minute. Stops trying when tired. Technique disappears quickly.",
    "Can keep going for one round but slows down a lot. Technique gets worse when tired. Needs long breaks between rounds.",
    "Keeps a good pace for a full round. Some drop-off in the second or third round but still tries.",
    "Strong across multiple rounds. Technique stays solid when tired. Can push the pace on others.",
    "Outlasts everyone. No visible drop-off across a full session. Can increase intensity late in rounds. Best engine in their bracket.",
  ],
  "Coordination": [
    "Movements are awkward and disconnected. Poor balance. Can\u2019t combine two movements together (e.g. shrimp then turn to knees). Falls over easily during transitions.",
    "Basic movements are okay but slow. Can follow a technique step by step but not smoothly. Loses balance during fast exchanges.",
    "Moves well for their age. Connects movements together without stopping. Good balance during sparring. Learns new techniques at a normal pace.",
    "Smooth and controlled movements. Good body awareness \u2014 knows where they are in space. Picks up new techniques quickly. Rarely off-balance.",
    "Moves like a natural athlete. Everything looks effortless. Excellent balance and body awareness. Learns new movements faster than anyone in their bracket.",
  ],
  "Attendance": [
    "Comes less than once a week. Misses many weeks entirely. No consistency.",
    "Comes about once a week. Often skips weeks. Hard to build on previous classes.",
    "Comes 2 times a week consistently. Rarely misses without a reason.",
    "Comes 3+ times a week. Very consistent. Does PT sessions on top of group classes.",
    "Never misses. Comes to everything \u2014 group classes, PT, extra sessions, open mats. Best attendance in the team.",
  ],
  "Attitude": [
    "Doesn\u2019t listen. Distracted or disruptive during class. Negative energy that affects training partners.",
    "Listens but passive. Low energy. Needs to be reminded often to focus. Does the minimum.",
    "Good training partner. Follows instructions. Positive attitude. Tries hard during drills and sparring.",
    "Enthusiastic and focused. Asks questions. Encourages teammates. Applies corrections right away.",
    "Model student. Helps younger or newer kids. Brings energy to every session. Embodies martial arts values on and off the mat.",
  ],
  "Participation": [
    "Refuses to compete or gets very upset about it. No competition experience.",
    "Has competed 1\u20132 times but needs a lot of encouragement. Very nervous before and during matches.",
    "Willing to compete when asked. Has done 3\u20135 competitions. Manages nerves okay.",
    "Wants to compete. Signs up without being asked. Competes regularly. Handles the pressure well.",
    "Loves competing. Seeks out tournaments and travels to compete. Always ready mentally. Best competitor mindset in the team.",
  ],
  "Performance": [
    "Freezes during matches. Can\u2019t do any of the techniques they know in training. Big gap between training and competition.",
    "Competes but goes into survival mode. Forgets gameplan. Only uses strength or instinct, not technique.",
    "Can execute a basic gameplan. Wins some, loses some. Performs at about 60\u201370% of their training level.",
    "Performs close to training level. Follows gameplan consistently. Wins most matches. Stays composed when losing.",
    "Elevates under pressure. Adapts mid-match to the opponent. Podiums consistently. Best performer in their bracket.",
  ],
};

/* ━━━ MOCK DATA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export const SEED_ROSTER = [];

export function generateSeedAssessments(){ return []; }

/* ━━━ PAGE HELP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export const PAGE_HELP = {
  home: {
    en: "Your launchpad. Tile shortcuts to every module with live badges showing pending actions (unrecorded classes, overdue assessments, promotion-ready kids, outreach needed). Below: quick pulse metrics and recent activity feed.",
    zh: "快捷入口。每个模块的磁贴显示待处理事项（未记录的课程、逾期评估、可晋级学员、需联系家长）。下方：关键指标概览及近期活动。",
  },
  roster: {
    en: "Manage all kids in the academy. Add kids manually or bulk import from CSV. Edit belt, weight, gym, or set inactive. Cards show last assessment date, score trend (↑↓→), and overdue status. Gym filter: admins can toggle between gyms or view all; coaches/community see their assigned gym only.",
    zh: "管理学院所有学员。可手动添加或CSV批量导入。编辑腰带、体重、道馆或设为不活跃。卡片显示上次评估日期、趋势及逾期状态。道馆筛选：管理员可切换或查看全部，教练/社区仅显示所属道馆。",
  },
  score: {
    en: "Score assessments across 12 criteria in 4 categories: BJJ (40%), Athletic (20%), Commitment (20%), Competition (20%). Tap ? next to each criterion for guidelines. Score one kid or use 'Score multiple kids' to queue them. Kid list is filtered to the selected coach's gym. Coach assessments are submitted as 'Pending' for Master Coach/Admin approval before appearing in rankings and reports. Master Coach and Admin assessments are auto-approved.",
    zh: "12项标准评分，4个类别：柔术(40%)、体能(20%)、投入度(20%)、比赛(20%)。点击?查看评分指南。可逐个或批量评分。学员列表按教练所属道馆筛选。教练评估需主教练/管理员审批后才会显示在排名和报告中。主教练和管理员评估自动通过。",
  },
  rankings: {
    en: "Ranked kids by cycle, age, weight, and gym. Based on latest assessment score per kid per cycle. Tap circle to select for competition team. Admin can filter across all gyms; coaches see their gym. Export as CSV for Excel.",
    zh: "按周期、年龄、体重和道馆排名。基于每周期最新评估成绩。点击圆圈选择参赛队员。管理员可跨道馆筛选，教练仅查看本道馆。可导出CSV。",
  },
  reports: {
    en: "Three report views. OVERVIEW: academy-wide KPIs, gym comparison table, and weekly attendance trend. GYM: deep dive into one location — roster composition, class fill rates, score distribution, category strengths, assessment coverage, and competition team. OUTREACH: actionable retention lists — gone cold (14+ days), cooling off (declining attendance), new & fragile (recent joiners not yet consistent), plus positive outreach triggers (promotions ready, big score jumps).",
    zh: "三个报告视图。概览：全校关键指标、道馆对比表、每周出勤趋势。道馆：单个校区深度分析——学员构成、课程出勤率、成绩分布、类别优劣势、评估覆盖率及竞赛队。外展：可操作的留存清单——流失风险（14天以上未到）、降温（出勤下降）、新生脆弱期（近期加入但不稳定），以及正面沟通触发（晋级就绪、成绩大幅提升）。",
  },
  profile: {
    en: "Full kid profile: info, belt & stripes, latest assessment radar chart, score trend, goals, attendance stats, promotion history, and assessment comparison overlay. Use 'Export PDF' for printable parent progress report (includes stripes & promotion history). Admin can switch gyms; coaches/community search within their gym.",
    zh: "完整学员档案：信息、腰带与条纹、雷达图、趋势、目标、出勤统计、晋级记录及评估对比。PDF报告可打印（含条纹和晋级记录）。管理员可切换道馆，教练/社区在本道馆内搜索。",
  },
  settings: {
    en: "Configure coaches, community members, gyms, belts, cycles, scoring weights, weight brackets, and promotion rules (classes for stripe/belt, months required). Admin pin and settings pin. Factory Reset returns to demo data.",
    zh: "配置教练、社区成员、道馆、腰带、周期、评分权重、体重分级及晋级规则（条纹/腰带所需课时、月数）。管理员密码和设置密码。恢复出厂设置将还原演示数据。",
  },
  attendance: {
    en: "Manage class attendance with 3 sub-tabs. SCHEDULE: View the weekly class timetable. RECORD: Select date and gym, see scheduled classes auto-populated. Tap a class card to mark attendance. Group: tap to toggle Absent ↔ Present. Competition: Absent → Present → Missed. Use '+ PT' for ad-hoc sessions. HISTORY: Browse past sessions with creator/editor info. Class analytics are in the Reports tab.",
    zh: "管理课程出勤，包含3个子标签。课表：查看每周课程安排。记录：选择日期和道馆，查看自动填充的课程。点击课程卡标记出勤。小组课：切换缺席↔出勤。竞赛课：缺席→出勤→缺课。使用「+ PT」添加临时课程。历史：浏览历史记录及创建/编辑者信息。课程分析在报告标签中。",
  },
  promotion: {
    en: "View kids eligible for stripe or belt promotion. Stripe: requires configured number of classes since last promotion. Belt: requires all stripes + class count + time at current belt. Only eligible kids are shown, grouped by belt and stripe sections (collapsible). Admin toggles gyms; coaches/community see their gym. Tap to award — logged with date and coach name.",
    zh: "查看符合条纹或腰带晋级条件的学员。条纹：需达到上次晋级后的规定课时。腰带：需满条纹+课时+在当前腰带的时间。仅显示符合条件的学员，按腰带和条纹分组（可折叠）。管理员切换道馆，教练/社区查看本馆。点击授予——记录日期和教练姓名。",
  },
  admin: {
    en: "Admin dashboard: activity log showing all logins, assessments, and data changes with timestamps. Visible to admin only.",
    zh: "管理员仪表盘：活动日志，显示所有登录、评估和数据变更的时间记录。仅管理员可见。",
  },
};

/* ━━━ NAVIGATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export const NAV_PRIMARY = [
  { key: "home", icon: "🏠", label: "Home" },
  { key: "roster", icon: "👥", label: "Students" },
  { key: "classes", icon: "📋", label: "Classes" },
  { key: "score", icon: "📝", label: "Score" },
  { key: "more", icon: "☰", label: "More" },
];
export const NAV_MORE = [
  { key: "rankings", icon: "🏆", label: "Rankings & Teams" },
  { key: "promotion", icon: "⭐", label: "Promotions" },
  { key: "reports", icon: "📊", label: "Reports" },
  { key: "settings", icon: "🔧", label: "Settings", adminOnly: true },
  { key: "admin", icon: "👑", label: "Admin Log", adminOnly: true },
];
