const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Match index in your bracket → team names to look for in ESPN data
const MATCHES = {
  "0-0": ["Germany", "Paraguay"],
  "0-1": ["France", "Sweden"],
  "0-2": ["Canada", "South Africa"],
  "0-3": ["Netherlands", "Morocco"],
  "0-4": ["Portugal", "Croatia"],
  "0-5": ["Spain", "Austria"],
  "0-6": ["United States", "Bosnia"],
  "0-7": ["Belgium", "Senegal"],
  "0-8": ["Brazil", "Japan"],
  "0-9": ["Ivory Coast", "Norway"],
  "0-10": ["Mexico", "Ecuador"],
  "0-11": ["England", "Congo"],
  "0-12": ["Argentina", "Cape Verde"],
  "0-13": ["Australia", "Egypt"],
  "0-14": ["Switzerland", "Algeria"],
  "0-15": ["Colombia", "Ghana"],
};

let results = {};

// Fetch scores from ESPN
async function fetchScores() {
  try {
    const today = new Date();
    const yest = new Date(today.getTime() - 86400000);
    const fmt = (d) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    
    const dates = [fmt(today), fmt(yest)];
    const allEvents = [];
    
    for (const dt of dates) {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dt}`);
      const data = await r.json();
      (data.events || []).forEach(ev => {
        const comp = ev.competitions[0];
        const cs = comp.competitors;
        if (cs.length < 2) return;
        allEvents.push({
          t1: cs[0].team.displayName,
          s1: Number(cs[0].score),
          t2: cs[1].team.displayName,
          s2: Number(cs[1].score),
          state: comp.status.type.state,
          completed: comp.status.type.completed,
          clock: comp.status.displayClock || '',
        });
      });
    }
    
    // Match against our bracket
    const newResults = {};
    Object.entries(MATCHES).forEach(([key, [teamA, teamB]]) => {
      const match = allEvents.find(ev => {
        const t1 = ev.t1.toLowerCase();
        const t2 = ev.t2.toLowerCase();
        const a = teamA.toLowerCase();
        const b = teamB.toLowerCase();
        return (t1.includes(a) && t2.includes(b)) || (t1.includes(b) && t2.includes(a));
      });
      if (!match) return;
      const aIsT1 = match.t1.toLowerCase().includes(teamA.toLowerCase());
      newResults[key] = {
        a: aIsT1 ? match.s1 : match.s2,
        b: aIsT1 ? match.s2 : match.s1,
        status: match.completed ? 'finished' : match.state === 'in' ? 'live' : 'upcoming',
      };
    });
    
    results = newResults;
    console.log(`Updated ${Object.keys(newResults).length} matches at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}

// Fetch every 2 minutes
fetchScores();
setInterval(fetchScores, 2 * 60 * 1000);

app.get('/api/results', (req, res) => {
  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
