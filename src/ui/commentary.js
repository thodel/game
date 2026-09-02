// src/ui/commentary.js
// Rich German basketball play-by-play commentary — Epic #53/#54

// ── Public exports ────────────────────────────────────────────────────────

/**
 * Distribute a total score across 4 quarters with realistic variance.
 * The four quarter values always sum to `total`.
 * @param {number} total — total points for one team
 * @param {{ randInt:(a:number,b:number)=>number }} rng — seeded RNG
 * @returns {number[]} four quarter scores
 */
export function generateQuarterScores(total, rng) {
  const quarters = [0, 0, 0, 0];
  let remaining  = total;
  for (let i = 0; i < 3; i++) {
    const avg      = remaining / (4 - i);
    const variance = Math.max(2, Math.round(avg * 0.25));
    const lo       = Math.max(10, Math.round(avg - variance));
    const hi       = Math.min(remaining - (3 - i) * 10, Math.round(avg + variance));
    quarters[i]    = lo <= hi ? rng.randInt(lo, hi) : Math.max(10, Math.round(avg));
    remaining     -= quarters[i];
  }
  quarters[3] = Math.max(10, remaining);
  return quarters;
}

/**
 * Generate rich German play-by-play HTML for a basketball match.
 * @param {Array<{text:string,minute:number,type:string}>} events
 * @param {{playerGoals:number,oppGoals:number,result:string,opponent:string,personal:number,assists:number}} matchResult
 * @param {{player:{name:string},career:{teamName:string}}} state
 * @param {{randInt:(a:number,b:number)=>number}} rng — seeded display RNG
 * @param {number[]} [homeQs] — optional pre-computed home quarter scores
 * @param {number[]} [awayQs] — optional pre-computed away quarter scores
 * @returns {{ html: string, lastPlayerEventText: string }}
 */
export function generatePlayByPlay(events, matchResult, state, rng, homeQs, awayQs) {
  const playerName = (state.player && state.player.name)  || 'Spieler';
  const teamName   = (state.career && state.career.teamName) || 'Heim';
  const oppName    = matchResult.opponent || 'Gast';

  // Opponent star name
  const oppFirsts = ['K.', 'J.', 'M.', 'A.', 'D.', 'R.', 'T.', 'L.', 'B.', 'C.'];
  const oppLasts  = ['Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Thompson', 'Anderson', 'Jackson', 'Harris'];
  const oppStar   = `${oppFirsts[rng.randInt(0, oppFirsts.length - 1)]} ${oppLasts[rng.randInt(0, oppLasts.length - 1)]}`;

  // Quarter scores for running-score display in quarter markers
  const homeTotal = matchResult.playerGoals || 0;
  const awayTotal = matchResult.oppGoals    || 0;
  const hQs = homeQs || generateQuarterScores(homeTotal, rng);
  const aQs = awayQs || generateQuarterScores(awayTotal, rng);

  // Bucket events into quarters. Game minutes run 0-48 (overtime past 48 lands
  // in the fourth); anything that is not a number goes to the first quarter
  // rather than off the end of the array.
  const buckets = [[], [], [], []];
  for (const e of events) {
    const m = Number(e.minute);
    buckets[Number.isFinite(m) ? Math.min(3, Math.max(0, Math.floor(m / 12))) : 0].push(e);
  }

  const lines = [];
  let homeRunning = 0;
  let awayRunning = 0;
  let lastPlayerLine = '';

  for (let q = 0; q < 4; q++) {
    homeRunning += hQs[q];
    awayRunning += aQs[q];

    let consecutive  = 0;
    let runAnnounced = false;

    for (const e of buckets[q]) {
      const { label } = _formatQTime(e.minute, rng);
      const cls       = _classifyEvent(e.text);
      const name      = e.type === 'player' ? playerName : oppStar;
      const pool      = TPLS[cls] || TPLS.generic;
      const line      = pool[rng.randInt(0, pool.length - 1)](name, label);

      const pbpCls = e.type === 'player'   ? 'pbp-line player'
                   : e.type === 'opponent' ? 'pbp-line opponent'
                                           : 'pbp-line special';

      lines.push(`<div class="${pbpCls}">${line}</div>`);

      if (e.type === 'player') {
        lastPlayerLine = line;
        consecutive++;
        // Run detection: 3+ consecutive player events
        if (consecutive >= 3 && !runAnnounced) {
          lines.push(`<div class="pbp-line special">🔥 ${consecutive}:0-Lauf! Die ${teamName} laufen heiß – Timeout der Gäste!</div>`);
          runAnnounced = true;
        }
        // Crowd response for key events
        if (KEY_EVENTS.has(cls)) {
          lines.push(`<div class="pbp-line crowd">${CROWD_HOME[rng.randInt(0, CROWD_HOME.length - 1)]}</div>`);
        }
      } else if (e.type === 'opponent') {
        consecutive  = 0;
        runAnnounced = false;
        if (KEY_EVENTS.has(cls)) {
          lines.push(`<div class="pbp-line crowd">${CROWD_AWAY[rng.randInt(0, CROWD_AWAY.length - 1)]}</div>`);
        }
      } else {
        // neutral
        consecutive  = 0;
        runAnnounced = false;
      }
    }

    // Quarter-end marker
    const leader = homeRunning > awayRunning
      ? `${teamName} führt +${homeRunning - awayRunning}`
      : awayRunning > homeRunning
        ? `${oppName} führt +${awayRunning - homeRunning}`
        : 'Gleichstand';
    lines.push(`<div class="pbp-line quarter-break">--- Ende ${Q_LABELS[q]} Viertel (${teamName} ${homeRunning} – ${oppName} ${awayRunning}) · ${leader} ---</div>`);
  }

  return { html: lines.join(''), lastPlayerEventText: lastPlayerLine };
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _classifyEvent(text) {
  if (text.includes('3-Pointer'))                              return 'three_pointer';
  if (text.includes('Slam Dunk') || text.includes('Dunk'))     return 'slam_dunk';
  if (text.includes('No-Look Pass'))                           return 'assist';
  if (text.includes('Steal'))                                  return 'steal';
  if (text.includes('And-One') || text.includes('AND ONE'))    return 'and_one';
  if (text.includes('Game-Winner'))                            return 'game_winner';
  if (text.includes('Triple-Double'))                          return 'triple_double';
  if (text.includes('Block'))                                  return 'block';
  if (text.includes('Turnover'))                               return 'turnover';
  if (text.includes('Technical'))                              return 'tech_foul';
  if (text.includes('Foul'))                                   return 'foul';
  if (text.includes('Buzzer-Beater'))                          return 'buzzer_beater';
  if (text.includes('Timeout') || text.includes('Overtime'))   return 'timeout';
  return 'generic';
}

function _formatQTime(minute, rng) {
  const m        = Number.isFinite(Number(minute)) ? Number(minute) : 0;
  const qi       = Math.min(3, Math.max(0, Math.floor(m / 12)));
  const minsLeft = Math.max(0, Math.floor(12 - (m - qi * 12)));
  const secs     = rng.randInt(0, 59).toString().padStart(2, '0');
  return { qi, label: `Q${qi + 1} ${minsLeft}:${secs}` };
}

// ── Constants ─────────────────────────────────────────────────────────────

const Q_LABELS = ['1.', '2.', '3.', '4.'];

const KEY_EVENTS = new Set(['three_pointer', 'slam_dunk', 'and_one', 'game_winner', 'buzzer_beater', 'triple_double']);

const CROWD_HOME = [
  '🏟️ Die Arena explodiert! Ohrenbetäubender Lärm!',
  '🏟️ Standing Ovations! Die Fans sind außer sich!',
  '🏟️ Das Dach droht zu fliegen! Unglaubliche Atmosphäre!',
  '🏟️ Die Heimfans kochen – das Stadion bebt!',
  '🏟️ LAUTESTER MOMENT DES ABENDS! Die Halle brennt!',
];

const CROWD_AWAY = [
  '🏟️ Stille im Stadion – die Gästefans klatschen vereinzelt.',
  '🏟️ Ein paar Gästefans jubeln – der Rest hält den Atem an.',
  '🏟️ Die Heimfans sind verstummt. Uncomfortable.',
];

// ── Template pools (min. 5 variants each) ────────────────────────────────

const TPLS = {
  // 3-Pointer: normal, clutch, heat-check, off-the-dribble, stepback, logo, corner
  three_pointer: [
    (n, t) => `${t} — ${n} nimmt den Dreier... DRIN! Dreipunkte-Spiel! 🎯`,
    (n, t) => `${t} — Clutch! ${n} mit dem Corner-Three – NICHTS ALS NETZ! 🎯`,
    (n, t) => `${t} — Off-the-Dribble! ${n} schüttelt den Defender ab – DRIN!`,
    (n, t) => `${t} — Stepback-Dreier! ${n} zieht zurück... schaut kurz... ZACK! 🎯`,
    (n, t) => `${t} — Von der Logo-Linie! ${n} von weit draußen – BINGO!`,
    (n, t) => `${t} — Heat-Check! ${n} ist am Brennen – Dreier! Unaufhaltbar! 🔥`,
    (n, t) => `${t} — Drei Punkte zurück: ${n} nimmt den Dreier... DRIN! Feuer! 🔥`,
  ],

  // Slam Dunk: poster, transition, alley-oop, tip-slam, powerslam
  slam_dunk: [
    (n, t) => `${t} — POSTER DUNK! ${n} legt den Defender auf die Karte! 💥`,
    (n, t) => `${t} — Transition Slam! ${n} prescht den Court hoch und hämmert es rein! 💥`,
    (n, t) => `${t} — ALLEY-OOP! Perfekte Lob-Vorlage – ${n} schlägt ein wie ein Blitz! 💥`,
    (n, t) => `${t} — TIP SLAM! ${n} greift das Offensivrebound und stopft es durch! 💥`,
    (n, t) => `${t} — ${n} zieht durch die Zone – SLAM! Das Backboard zittert!`,
    (n, t) => `${t} — Beidarmiger Powerslam! ${n} dominiert – die Bank dreht durch! 💥`,
    (n, t) => `${t} — ${n} fliegt über den Gegner – Windmühle! Das Publikum tobt!`,
  ],

  // Assist/pass: no-look, behind-back, lob, kick-out, pocket
  assist: [
    (n, t) => `${t} — No-Look-Pass! ${n} sieht die Lücke – Basket! Traumvorlage! 😎`,
    (n, t) => `${t} — ${n} mit dem Behind-the-Back-Pass – einfach brillant! 😎`,
    (n, t) => `${t} — Lob-Assist! ${n} hebt den Ball perfekt hoch – Dunk! Spektakulär!`,
    (n, t) => `${t} — Kick-out-Pass von ${n} – freistehend aus der Ecke – DRIN!`,
    (n, t) => `${t} — ${n} findet den Offenen wie ein Radar – Assist und Basket!`,
    (n, t) => `${t} — ${n} zieht in die Zone und legt quer – einfacher Korb!`,
  ],

  // Defense: steal/layup
  steal: [
    (n, t) => `${t} — STEAL! ${n} klaut den Ball und zieht durch – Korb! ⚡`,
    (n, t) => `${t} — ${n} antizipiert den Pass – abgefangen! Schnell-Break-Layup! ⚡`,
    (n, t) => `${t} — Saubere Balleroberung von ${n} – 2 Punkte auf der anderen Seite!`,
    (n, t) => `${t} — Steal + Layup! ${n} liest das Spiel perfekt – einfaches Geld! ⚡`,
    (n, t) => `${t} — ${n} greift im richtigen Moment – abgelenkt, gewonnen, erzielt! ⚡`,
  ],

  // And-One
  and_one: [
    (n, t) => `${t} — ${n} zieht durch die Zone – AND ONE! Foulspiel! 🔥`,
    (n, t) => `${t} — ${n} schlägt durch den Kontakt – Korb zählt und Foul! AND ONE! 🔥`,
    (n, t) => `${t} — Foulspiel und Korb! ${n} lässt sich nicht aufhalten – AND ONE!`,
    (n, t) => `${t} — ${n} erzwingt den Kontakt – Korb und Freiwurf! Die Menge tobt!`,
    (n, t) => `${t} — Aggressiv durch die Zone! ${n} – Foul, Korb, Freiwurf! Wow! 🔥`,
  ],

  // Game-winner
  game_winner: [
    (n, t) => `${t} — GAME WINNER! ${n} mit dem entscheidenden Korb! 🚨`,
    (n, t) => `${t} — ${n} übernimmt Verantwortung – GAME-WINNING SHOT! Legende! 🚨`,
    (n, t) => `${t} — Last-Second-Heroics! ${n} mit dem Sieger – das ist Geschichte!`,
    (n, t) => `${t} — ${n} im entscheidenden Moment – der Sieg ist sicher! 🚨`,
    (n, t) => `${t} — CLUTCH! ${n} behält die Nerven und versenkt den Game-Winner!`,
  ],

  // Milestone: triple-double
  triple_double: [
    (n, t) => `${t} — Triple-Double erreicht! ${n} dominiert in allen Bereichen! 📊`,
    (n, t) => `${t} — ${n} schreibt Geschichte – Triple-Double-Nacht! Dreifach dominant! 📊`,
    (n, t) => `${t} — Was für eine Leistung! ${n} mit Triple-Double – unglaublich!`,
    (n, t) => `${t} — Triple-Double für ${n}! Punkte, Assists, Rebounds – alles da! 📊`,
    (n, t) => `${t} — ${n} ist eine Klasse für sich – Triple-Double bestätigt! 📊`,
  ],

  // Defense: block
  block: [
    (n, t) => `${t} — GEBLOCKT! Perfekte Defensive – der Angriff abgewiesen! 🛡️`,
    (n, t) => `${t} — Monsterblock! Vollständige Ablehnung an der Zone! 🛡️`,
    (n, t) => `${t} — Die Defense hält! Block an der Line – kein einfaches Geld hier!`,
    (n, t) => `${t} — In die Tribüne geblockt! Perfekter Zeitpunkt – Defensivkunst! 🛡️`,
    (n, t) => `${t} — Mauer! Block im letzten Moment – das Publikum explodiert! 🛡️`,
  ],

  // Defense: charge drawn (mapped from foul events)
  foul: [
    (n, t) => `${t} — Foulärger! In der Bedrängnis – das könnte zum Problem werden. ⚠️`,
    (n, t) => `${t} — Persönliches Foul – nicht gut. Der Coach denkt über Wechsel nach.`,
    (n, t) => `${t} — Foul! Zu aggressiv in der Defense – das kann nicht gut ausgehen.`,
    (n, t) => `${t} — Foulproblem wächst! Immer mehr Druck auf der Defensive.`,
    (n, t) => `${t} — Charge drawn! Foul in der Zone – Freiwürfe für den Gegner. ⚠️`,
  ],

  // Turnover
  turnover: [
    (n, t) => `${t} — Ballverlust! Unkonzentriert – der Gegner übernimmt das Kommando.`,
    (n, t) => `${t} — Turnover! Schlechter Pass – der Gegner kontertert sofort! 😤`,
    (n, t) => `${t} — Unangenehmer Moment: Ballverlust mitten im Aufbau.`,
    (n, t) => `${t} — Fahrlässig! Turnover im Angriff – Gegner in der Offensive. 😤`,
    (n, t) => `${t} — Ballverlust – der Gegner freut sich über das Geschenk. 😤`,
  ],

  // Buzzer-beater
  buzzer_beater: [
    (n, t) => `${t} — BUZZER BEATER! In letzter Sekunde – die Arena explodiert! 🚨`,
    (n, t) => `${t} — Die Uhr läuft ab... BUZZER BEATER! Unglaublich! Das gibt es nicht! 🚨`,
    (n, t) => `${t} — NERVEN AUS STAHL! Buzzer-Beater beim letzten Tick der Uhr! 🚨`,
    (n, t) => `${t} — Letzte Sekunde... der Ball fliegt... DRIN BEI DER SIRENE! 🚨`,
    (n, t) => `${t} — BUZZER BEATER! Das Wunderglück schlägt zu – reiner Wahnsinn!`,
  ],

  // Timeout / overtime
  timeout: [
    (n, t) => `${t} — Auszeit! Der Coach unterbricht – Taktikbesprechung.`,
    (n, t) => `${t} — Timeout! Wichtige Atempause – beide Teams formieren sich neu.`,
    (n, t) => `${t} — Auszeit genommen – das Spiel atmet kurz durch.`,
    (n, t) => `${t} — Time-out! Der Coach hat genug gesehen – Korrekturen folgen.`,
    (n, t) => `${t} — Auszeit! Taktik wird neu justiert – entscheidende Minuten.`,
  ],

  // Technical foul
  tech_foul: [
    (n, t) => `${t} — Technisches Foul! Die Nerven liegen blank – Protest zahlt sich nicht aus.`,
    (n, t) => `${t} — Tech Foul! Diskussion mit dem Schiedsrichter – kostspieliger Fehler.`,
    (n, t) => `${t} — Technisches Foul verhängt – das ist pure Disziplinlosigkeit.`,
    (n, t) => `${t} — Tech Foul! Emotionen kochen über – Freiwurf für den Gegner.`,
    (n, t) => `${t} — Technisches Foul! Das muss nicht sein – Kopf kühlen!`,
  ],

  // Fallback
  generic: [
    (n, t) => `${t} — Spielzug! Das Spiel entwickelt sich weiter.`,
    (n, t) => `${t} — Aktion auf dem Parkett – spannend!`,
    (n, t) => `${t} — Das Tempo ist hoch – die Arena in Aufruhr.`,
    (n, t) => `${t} — Basketball auf höchstem Niveau – diese Begegnung hat es in sich.`,
    (n, t) => `${t} — Beide Teams kämpfen verbissen – jeder einzelne Punkt zählt.`,
  ],
};
