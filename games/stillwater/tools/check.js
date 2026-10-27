// Content check: every stone has an answer and a why; split stones have both parts. Writes tools/answers.md for review.
const SW = require('../logic.js'), fs = require('fs');
const v = SW.validate(); let md = '# Stillwater answer key\n\nRight = keep (mine), left = release (not mine), up = split.\n';
SW.PONDS.forEach((P, i) => { md += `\n## ${i + 1}. ${P.name} (${P.lens})\n\n`; P.stones.forEach(s => { md += `- **${s.t}** → ${s.a === 'k' ? 'KEEP' : s.a === 'r' ? 'RELEASE' : `SPLIT (keep: ${s.k} / release: ${s.r})`}. ${s.w}\n`; }); md += `\nLesson: ${P.lesson}\n`; });
fs.writeFileSync(__dirname + '/answers.md', md);
const c = { k: 0, r: 0, s: 0 }; SW.PONDS.forEach(P => P.stones.forEach(s => c[s.a]++));
console.log(`${v.n} stones in ${SW.PONDS.length} ponds · keep ${c.k} · release ${c.r} · split ${c.s}`, v.errs.length ? v.errs : 'OK');
process.exit(v.errs.length ? 1 : 0);
