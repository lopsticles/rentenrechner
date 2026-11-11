// Soll-Testmatrix Rentenrechner (Rechtspruefung 2026-09).
// Aufruf: node test/testmatrix.js
// Die Soll-Werte werden hier unabhaengig vom App-Code direkt nach Normtext gerechnet
// und gegen die Funktionen aus index.html verglichen.
const fs = require("fs");
const path = require("path");
const file = process.argv[2] || path.join(__dirname, "../src/rentenrechner-kern.js");
const quelle = fs.readFileSync(file, "utf8").replace(/^if \(typeof module[^\n]*$/m, "");
const APP = new Function(quelle + `
  return {C, einkommensteuer, schätzeRente, berechneEMRenteNetto,
    schaetzeNettoLohn: typeof schaetzeNettoLohn === "function" ? schaetzeNettoLohn : null,
    altersgrenze45Monate: typeof altersgrenze45Monate === "function" ? altersgrenze45Monate : null,
    zurechnungszeitEndeMonate: typeof zurechnungszeitEndeMonate === "function" ? zurechnungszeitEndeMonate : null,
    witwenAltersgrenzeMonate: typeof witwenAltersgrenzeMonate === "function" ? witwenAltersgrenzeMonate : null,
    rentendauer: typeof rentendauer === "function" ? rentendauer : null,
    LEBENSERWARTUNG: typeof LEBENSERWARTUNG === "object" ? LEBENSERWARTUNG : null,
    kostenWarten: typeof kostenWarten === "function" ? kostenWarten : null,
    monateBisRente: typeof monateBisRente === "function" ? monateBisRente : null,
    regelaltersgrenzeMonate: typeof regelaltersgrenzeMonate === "function" ? regelaltersgrenzeMonate : null,
    berechneHinterbliebene: typeof berechneHinterbliebene === "function" ? berechneHinterbliebene : null};`)();

// ---------- Soll nach Normtext ----------
const RW = 42.52;                 // RWBestV 2026 § 1
const DE = 51944;                 // SVBezGrV 2026 § 3 Abs. 2
const BBG = 8450;                 // SVBezGrV 2026 § 4 Abs. 1 Nr. 1
const KV_HALB = (0.146 + 0.029) / 2;  // § 241, § 249a SGB V, Zusatzbeitrag 2,9 % (BMG)
const pv = (kinder) => kinder > 0 ? 0.036 : 0.042;  // § 55 Abs. 3 SGB XI, § 59 Abs. 1
// § 22 Nr. 1 S. 3 a aa EStG, Tabelle
const BA = {2020:80,2021:81,2022:82,2023:82.5};
for (let j = 2024; j <= 2058; j++) BA[j] = 83 + (j - 2024) * 0.5;
const ba = (j) => (j >= 2058 ? 100 : BA[j]) / 100;
// § 235 Abs. 2 SGB VI
function ragSoll(jg){
  const t = {1947:1,1948:2,1949:3,1950:4,1951:5,1952:6,1953:7,1954:8,1955:9,1956:10,1957:11,1958:12,1959:14,1960:16,1961:18,1962:20,1963:22};
  if (jg < 1947) return 65*12;
  if (jg >= 1964) return 67*12;
  return 65*12 + t[jg];
}
// § 32a EStG 2026
function estSoll(zvE){
  const x = Math.floor(zvE);
  let s;
  if (x <= 12348) s = 0;
  else if (x <= 17799){ const y = (x - 12348)/10000; s = (914.51*y + 1400)*y; }
  else if (x <= 69878){ const z = (x - 17799)/10000; s = (173.10*z + 2397)*z + 1034.87; }
  else if (x <= 277825) s = 0.42*x - 11135.63;
  else s = 0.45*x - 19470.38;
  return Math.floor(s);
}
const cent = (x) => Math.round(x*100)/100;
// Netto einer gesetzlichen Rente: KV/PV nach § 249a SGB V / § 59 SGB XI,
// zvE = Besteuerungsanteil − 102 € (§ 9a Nr. 3) − 36 € (§ 10c) − KV/PV (§ 10 Abs. 1 Nr. 3)
// Steuer je Jahr: ESt + Soli (§ 3 Abs. 3 Nr. 2, § 4 SolZG: 5,5 %, Freigrenze 20.350 €, Milderung 11,9 %) + KiSt (8/9 % der ESt)
function steuerSoll(zvE, kist = 0){
  const est = estSoll(zvE);
  const soli = est > 20350 ? Math.min(est*0.055, (est - 20350)*0.119) : 0;
  return est + soli + est*kist;
}
function nettoSoll(brutto, beginnjahr, kinder, kist = 0){
  const sv = brutto * (KV_HALB + pv(kinder));
  const zvE = Math.max(0, brutto*12*ba(beginnjahr) - 102 - 36 - sv*12);
  return cent(brutto - steuerSoll(zvE, kist)/12 - sv);
}
// § 38, § 236b Abs. 2 SGB VI (Tabelle woertlich: Anhebung in Monaten)
function ag45Soll(jg){
  const t = {1953:2,1954:4,1955:6,1956:8,1957:10,1958:12,1959:14,1960:16,1961:18,1962:20,1963:22};
  if (jg >= 1964) return 65*12;
  if (jg < 1953) return 63*12;
  return 63*12 + t[jg];
}
// § 253a Abs. 3 (Tabelle woertlich: Alter Jahre/Monate), § 59 Abs. 2 ab 2031, Abs. 4 hoechstens RAG
function zzSoll(jahr, jg){
  const t = {2020:[65,9],2021:[65,10],2022:[65,11],2023:[66,0],2024:[66,1],2025:[66,2],2026:[66,3],
             2027:[66,4],2028:[66,6],2029:[66,8],2030:[66,10]};
  const e = jahr >= 2031 ? 67*12 : t[jahr][0]*12 + t[jahr][1];
  return Math.min(e, ragSoll(jg));
}
// § 242a Abs. 5 (Tabelle woertlich), § 46 Abs. 2 Nr. 2 ab 2029: 47
function witwenGrenzeSoll(todesjahr){
  const t = {2012:[45,1],2013:[45,2],2014:[45,3],2015:[45,4],2016:[45,5],2017:[45,6],2018:[45,7],2019:[45,8],
             2020:[45,9],2021:[45,10],2022:[45,11],2023:[46,0],2024:[46,2],2025:[46,4],2026:[46,6],2027:[46,8],2028:[46,10]};
  if (todesjahr >= 2029) return 47*12;
  return t[todesjahr][0]*12 + t[todesjahr][1];
}
// Altersrente, Schaetzpfad
function renteSoll({brutto, bb, jg, gm = 1, alter, kinder}){
  const m = ragSoll(jg), am = alter*12;
  const jahre = alter - bb;
  if (am < m && jahre < 35) return {anspruch:false, brutto:0, netto:0};  // § 36 / § 236, § 50 Abs. 4
  const ep = Math.min(brutto, BBG)*12/DE * jahre;                        // § 157 SGB VI
  const b45 = jahre >= 45 && am >= ag45Soll(jg) && am < m;               // § 38 / § 236b: abschlagsfrei
  const zf = b45 ? 1 : 1 - 0.003*Math.max(0, m - am) + 0.005*Math.max(0, am - m);  // § 77 Abs. 2 Nr. 1/2
  const br = cent(ep * RW * zf);
  const beginn = jg + alter + (gm === 12 ? 1 : 0);                       // § 99 Abs. 1
  return {anspruch:true, brutto:br, netto:nettoSoll(br, beginn, kinder), zfProzent: Math.round((1-zf)*1000)/10};
}

// ---------- Vergleich ----------
let ok = 0, fail = 0;
function check(name, ist, soll, tol = 0.005){
  const good = (typeof soll === "number") ? (typeof ist === "number" && Math.abs(ist - soll) <= tol) : ist === soll;
  good ? ok++ : fail++;
  console.log(`${good ? "OK  " : "FAIL"}  ${name.padEnd(58)} ist=${ist}  soll=${soll}`);
}

console.log("== § 235 Regelaltersgrenze (Monate)");
for (const jg of [1946,1947,1957,1958,1959,1962,1963,1964,1990])
  check(`RAG Jg ${jg}`, APP.regelaltersgrenzeMonate ? APP.regelaltersgrenzeMonate(jg) : "fehlt", ragSoll(jg));

console.log("== Altersrente Schaetzpfad (brutto/netto/Abschlag)");
const faelle = [
  {t:"3500 Beginn18 Jg1985 kinderlos", brutto:3500, bb:18, jg:1985, kinder:0},
  {t:"3500 Beginn18 Jg1985 1 Kind",    brutto:3500, bb:18, jg:1985, kinder:1},
  {t:"8450 (=BBG)",                    brutto:8450, bb:18, jg:1985, kinder:1},
  {t:"8451 (BBG+1)",                   brutto:8451, bb:18, jg:1985, kinder:1},
  {t:"20000 (weit ueber BBG)",         brutto:20000,bb:18, jg:1985, kinder:1},
  {t:"Beginn28 (63: genau 35 J.)",     brutto:3500, bb:28, jg:1985, kinder:1},
  {t:"Beginn29 (63: 34 J.)",           brutto:3500, bb:29, jg:1985, kinder:1},
  {t:"Beginn45 (63/65 < 35 J.)",       brutto:3500, bb:45, jg:1985, kinder:1},
  {t:"Jg1964",                         brutto:3500, bb:18, jg:1964, kinder:1},
  {t:"Jg1963 (§236: 66J10M)",          brutto:3500, bb:18, jg:1963, kinder:1},
  {t:"Jg1962 (66J8M)",                 brutto:3500, bb:18, jg:1962, kinder:1},
  {t:"Jg1961 (66J6M, Zuschlag bei 67)",brutto:3500, bb:18, jg:1961, kinder:1},
  {t:"Jg1985 Dez (Beginnjahr+1)",      brutto:3500, bb:18, jg:1985, gm:12, kinder:1},
  {t:"Beginn20 (65: genau 45 J.)",     brutto:3500, bb:20, jg:1985, kinder:1},
  {t:"Beginn21 (65: 44 J.)",           brutto:3500, bb:21, jg:1985, kinder:1},
  {t:"Jg1958 Beginn16 (§236b 64J0M)",  brutto:3500, bb:16, jg:1958, kinder:1},
];
for (const f of faelle){
  for (const a of [63,65,67]){
    const s = renteSoll({...f, alter:a});
    const i = APP.schätzeRente(f.brutto*12, 0, a, f.jg, null, f.bb, f.kinder, f.gm || 1);
    const tag = `${f.t} @${a}`;
    check(tag + " brutto", i.brutto, s.brutto);
    check(tag + " netto",  i.netto,  s.netto);
    if (s.anspruch) check(tag + " Abschlag%", i.abschlag_prozent, s.zfProzent, 0.05);
    else check(tag + " Anspruch", i.anspruch, false);
  }
}

console.log("== Altersrente Pfad Renteninformation");
for (const [jg, a] of [[1985,63],[1985,67],[1963,67],[1963,63]]){
  const info = 1200, br = 3500, kinder = 1;
  const m = ragSoll(jg), am = a*12;
  const epj = Math.min(br, BBG)*12/DE;
  const ep = Math.max(0, info/RW - (m - am)/12*epj);
  const zf = 1 - 0.003*Math.max(0, m - am) + 0.005*Math.max(0, am - m);
  const sb = cent(ep*RW*zf);
  const i = APP.schätzeRente(br*12, 0, a, jg, info, 18, kinder, 1);
  check(`Info 1200 Jg${jg} @${a} brutto`, i.brutto, sb);
  check(`Info 1200 Jg${jg} @${a} netto`, i.netto, nettoSoll(sb, jg + a, kinder));
}

console.log("== § 236b Altersgrenze 45 J. (Monate)");
for (const jg of [1952,1953,1958,1963,1964,1990])
  check(`AG45 Jg ${jg}`, APP.altersgrenze45Monate ? APP.altersgrenze45Monate(jg) : "fehlt", ag45Soll(jg));

console.log("== § 253a Ende Zurechnungszeit (Monate)");
for (const [j, jg] of [[2020,1985],[2023,1985],[2026,1985],[2028,1985],[2030,1985],[2031,1985],[2040,1985],[2026,1958],[2026,1960]])
  check(`ZZ ${j} Jg ${jg}`, APP.zurechnungszeitEndeMonate ? APP.zurechnungszeitEndeMonate(j, jg) : "fehlt", zzSoll(j, jg));

console.log("== § 242a Altersgrenze grosse Witwenrente (Monate)");
for (const j of [2012,2023,2024,2026,2028,2029,2035])
  check(`Witwe groß ab, Tod ${j}`, APP.witwenAltersgrenzeMonate ? APP.witwenAltersgrenzeMonate(j) : "fehlt", witwenGrenzeSoll(j));

// EM-Rente bei Eintritt/Tod im Jahr `jahr` mit Alter `am` (Monate): bisherige Jahre + Zurechnungszeit (§ 59, § 253a),
// Zugangsfaktor § 77 Abs. 2 Nr. 3/4 (Referenz 65, Untergrenze 62; mit 40 Jahren 63/60, Abs. 4), Wartezeit § 43/§ 53 Abs. 2
function emSoll({brutto, bb, am, jg, jahr, kinder, einsteiger = false}){
  const bj = Math.max(0, am/12 - bb);
  // § 43 Abs. 1 Nr. 2-3, § 50 Abs. 1: 5 Jahre (bei Beschaeftigung durchgehend Pflichtbeitraege);
  // darunter nur § 53 Abs. 2 (Berufseinsteiger, >= 1 Jahr Pflichtbeitraege) und nur volle EM-Rente
  if (bj < 5 && !(einsteiger && bj >= 1)) return {anspruch:false, brutto:0, netto:0, halb:0, waise:0};
  const vierzig = bj >= 40;
  const ref = (vierzig ? 63 : 65)*12, unten = (vierzig ? 60 : 62)*12;
  const zf = 1 - 0.003*Math.max(0, ref - Math.max(am, unten));
  const zz = Math.max(0, zzSoll(jahr, jg) - am);
  const br = cent(Math.min(brutto, BBG)*12/DE * (bj + zz/12) * zf * RW);
  const zuschlagMonate = Math.round(bj*12) + zz;                        // § 78 Abs. 1, lueckenlose Belegung
  return {anspruch:true, brutto:br, zf, netto:nettoSoll(br, jahr, kinder),
    halb: bj >= 5 ? nettoSoll(br*0.5, jahr, kinder) : 0,
    waise: cent(br*0.10 + zuschlagMonate*0.0833*zf*RW*0.10)};          // § 67 Nr. 7, § 78 Abs. 2
}

console.log("== EM-Rente mit Zurechnungszeit (§ 43, § 59, § 77, § 253a SGB VI)");
const emFaelle = [
  {t:"3500 bb18 41J8M k0",   brutto:3500, bb:18, am:500, jg:1985, jahr:2026, kinder:0},
  {t:"3500 bb18 41J8M k1",   brutto:3500, bb:18, am:500, jg:1985, jahr:2026, kinder:1},
  {t:"6000 bb22 35J k1",     brutto:6000, bb:22, am:420, jg:1991, jahr:2026, kinder:1},
  {t:"12000 (BBG) bb25 45J", brutto:12000,bb:25, am:540, jg:1981, jahr:2026, kinder:0},
  {t:"3500 bb18 61J (40 J.)",brutto:3500, bb:18, am:732, jg:1965, jahr:2026, kinder:0},
  {t:"3500 bb18 63J6M",      brutto:3500, bb:18, am:762, jg:1963, jahr:2026, kinder:0},
  {t:"3500 bb18 Beginn 2031",brutto:3500, bb:18, am:500, jg:1990, jahr:2031, kinder:0},
  {t:"2500 bb24 26J (2 J.) Angestellt",     brutto:2500, bb:24, am:312, jg:2000, jahr:2026, kinder:0},
  {t:"2500 bb24 26J (2 J.) Einsteiger",     brutto:2500, bb:24, am:312, jg:2000, jahr:2026, kinder:0, einsteiger:true},
  {t:"2500 bb18 18J6M (<1J) Einsteiger",    brutto:2500, bb:18, am:222, jg:2008, jahr:2026, kinder:0, einsteiger:true},
  {t:"3000 bb35 39J11M (4,9 J.) Angestellt",brutto:3000, bb:35, am:479, jg:1986, jahr:2026, kinder:0},
  {t:"3000 bb35 40J (5 J.) Angestellt",     brutto:3000, bb:35, am:480, jg:1986, jahr:2026, kinder:0},
];
for (const f of emFaelle){
  const s = emSoll(f);
  const i = APP.berechneEMRenteNetto(f.brutto, false, null, f.kinder, f.jahr, f.am, f.bb, f.jg, {berufseinsteiger: !!f.einsteiger});
  check(`EM ${f.t} brutto`, i.brutto, s.brutto);
  check(`EM ${f.t} netto`, i.netto, s.netto);
  check(`EM ${f.t} halb netto`, i.netto_halb, s.halb);
}
check("EM aus Renteninfo 1800", APP.berechneEMRenteNetto(3500, false, 1800, 1, 2026, 500, 18, 1985).netto, nettoSoll(1800, 2026, 1));
check("EM Selbststaendig ohne Renteninfo", APP.berechneEMRenteNetto(3500, true, null, 1, 2026, 500, 18, 1985).netto, 0);
check("EM Selbststaendig mit Renteninfo 900", APP.berechneEMRenteNetto(3500, true, 900, 1, 2026, 500, 18, 1985).netto, nettoSoll(900, 2026, 1));
for (const k of [0.08, 0.09])
  check(`EM Renteninfo 1800 KiSt ${k}`, APP.berechneEMRenteNetto(3500, false, 1800, 0, 2026, 500, 18, 1985, {kist:k}).netto, nettoSoll(1800, 2026, 0, k));
// Soli greift erst bei ESt > 20.350 €, also nur bei sehr hohen Renten; Grenzfaelle ueber die Renteninformation
for (const b of [5800, 6500, 7500, 9000])
  check(`EM Renteninfo ${b} Soli`, APP.berechneEMRenteNetto(3500, false, b, 1, 2026, 500, 18, 1985, {kist:0.09}).netto, nettoSoll(b, 2026, 1, 0.09));

console.log("== Hinterbliebene (§ 46, § 67, § 78, § 97 SGB VI; Steuer § 22 EStG; Halbwaise beitragsfrei)");
// § 97: Arbeitsentgelt − 40 % (§ 18b Abs. 5 Nr. 1 SGB IV), Freibetrag 26,4 aRW + 5,6 aRW je Kind, davon 40 %
const anr97 = (witwe, partnerBrutto, kinder) => partnerBrutto > 0
  ? cent(Math.min(witwe, Math.max(0, partnerBrutto*0.6 - (26.4 + 5.6*kinder)*RW) * 0.4)) : 0;
if (APP.berechneHinterbliebene){
  const basisF = {brutto:3500, bb:18, am:500, jg:1985, jahr:2026};
  const altF = renteSoll({brutto:3500, bb:18, jg:1985, alter:67, kinder:0});
  const hbFaelle = [
    {t:"k0 ohne Partnerangaben", kinder:0, pa:null, pb:0},
    {t:"k2 ohne Partnerangaben", kinder:2, pa:null, pb:0},
    {t:"k0 Partner 40 (klein)",  kinder:0, pa:40,  pb:0},
    {t:"k1 Partner 40 (groß)",   kinder:1, pa:40,  pb:0},
    {t:"k0 Partner 46 (klein)",  kinder:0, pa:46,  pb:0},
    {t:"k0 Partner 47 (groß)",   kinder:0, pa:47,  pb:0},
    {t:"k0 Partner 50, 3000 €",  kinder:0, pa:50,  pb:3000},
    {t:"k2 Partner 50, 3000 €",  kinder:2, pa:50,  pb:3000},
    {t:"k0 Partner 50, 9000 €",  kinder:0, pa:50,  pb:9000},
  ];
  for (const f of hbFaelle){
    const em = APP.berechneEMRenteNetto(basisF.brutto, false, null, f.kinder, 2026, basisF.am, basisF.bb, basisF.jg);
    const es = emSoll({...basisF, kinder:f.kinder});
    const rb = 1985 + 67;   // Geburtsmonat 1
    const jbr = 305/12;
    const h = APP.berechneHinterbliebene({em, basis_rente: altF.brutto, kinder: f.kinder, partner_alter: f.pa,
      partner_brutto: f.pb, jahr_heute: 2026, rentenbeginn_jahr: rb, jahre_bis_rente: jbr});
    const grossH = f.kinder > 0 || !f.pa || f.pa*12 >= witwenGrenzeSoll(2026);
    const grossR = !f.pa || (f.pa + jbr)*12 >= witwenGrenzeSoll(rb);
    const wVoll = cent(es.brutto * (grossH ? 0.55 : 0.25));
    const wH = cent(wVoll - anr97(wVoll, f.pb, f.kinder));
    const wR = cent(altF.brutto * (grossR ? 0.55 : 0.25));
    check(`HB ${f.t} Witwe heute netto`, h.witwe_heute_netto, nettoSoll(wH, 2026, f.kinder));
    check(`HB ${f.t} Witwe Rente netto`, h.witwe_rente_netto, nettoSoll(wR, rb, f.kinder));
    check(`HB ${f.t} Sterbevierteljahr heute`, h.sterbe_heute_netto, nettoSoll(es.brutto, 2026, f.kinder));
    check(`HB ${f.t} Halbwaise netto`, h.waise_heute_netto, es.waise);
  }
} else check("berechneHinterbliebene", "fehlt", "vorhanden");

console.log("== Netto-Vorbelegung (StKl I, ohne KiSt; SV-AN-Anteile, § 32a, § 9a, § 10c, § 10 Abs. 1 Nr. 2/3, SolZG)");
const BBG_KV = 5812.5;
function nettoLohnSoll(b, kinder, kist = 0, selbst = false){
  const rvb = Math.min(b, BBG), kvb = Math.min(b, BBG_KV);
  if (selbst){
    // freiwillig versichert: KV ermaessigt 14,0 % (§ 243 SGB V) + 2,9 %, PV voll, alles selbst; keine RV/AV
    const kv = kvb*(0.140 + 0.029), pvS = kvb*(kinder > 0 ? 0.036 : 0.042);
    const zvE = Math.max(0, 12*(b - kv - pvS) - 36);
    return Math.round(b - kv - pvS - steuerSoll(zvE, kist)/12);
  }
  const rv = rvb*0.093, av = rvb*0.013, kv = kvb*(0.146 + 0.029)/2;
  const pvA = kvb*(0.018 + (kinder > 0 ? 0 : 0.006));                    // § 58 Abs. 1, § 55 Abs. 3 SGB XI
  const zvE = Math.max(0, 12*(b - rv - kv*0.96 - pvA) - 1230 - 36);
  return Math.round(b - rv - av - kv - pvA - steuerSoll(zvE, kist)/12);
}
for (const [b, k, kist, selbst] of [[2000,0,0,false],[3500,0,0,false],[3500,1,0,false],[6000,1,0,false],[9000,0,0,false],[15000,0,0,false],[25000,1,0,false],
    [3500,0,0.09,false],[6000,1,0.08,false],[15000,0,0.09,false],[3500,0,0,true],[6000,1,0.09,true],[12000,0,0,true]])
  check(`Netto ${b} k${k} KiSt${kist}${selbst ? " selbst." : ""}`, APP.schaetzeNettoLohn ? APP.schaetzeNettoLohn(b, k, kist, selbst) : "fehlt", nettoLohnSoll(b, k, kist, selbst), 0);

console.log("== Selbststaendige: Altersrente passend zur EM-Rente (keine Pflichtbeitraege)");
for (const a of [63, 67]){
  const ohne = APP.schätzeRente(3500*12, 41, a, 1985, null, 18, 0, 1, 0, true);
  check(`Selbst. ohne Info @${a} brutto`, ohne.brutto, 0);
  // Renteninformation ohne weitere Beitraege: EP = Info / aRW, nur Zugangsfaktor
  const m = ragSoll(1985), am = a*12;
  const zf = 1 - 0.003*Math.max(0, m - am);
  const sb = cent(1100/RW*RW*zf);
  const mit = APP.schätzeRente(3500*12, 41, a, 1985, 1100, 18, 0, 1, 0, true);
  check(`Selbst. Info 1100 @${a} brutto`, mit.brutto, sb);
  check(`Selbst. Info 1100 @${a} netto`, mit.netto, nettoSoll(sb, 1985 + a, 0));
}

console.log("== Kirchensteuer auf die Altersrente");
for (const kist of [0.08, 0.09]){
  const s = renteSoll({brutto:5000, bb:18, jg:1985, alter:67, kinder:0});
  const i = APP.schätzeRente(5000*12, 41, 67, 1985, null, 18, 0, 1, kist, false);
  check(`Rente 5000 @67 KiSt ${kist}`, i.netto, nettoSoll(s.brutto, 1985 + 67, 0, kist));
}

console.log("== Rentenbezugsdauer bis Planungsalter 90; Vergleichswerte Destatis-Sterbetafel 2023/2025 (12613-b01/-b02)");
const LE = {m:{63:19.488242865395293, 65:17.974645137784975, 67:16.517088889971905},
            w:{63:22.791240290701545, 65:21.100266082940671, 67:19.448286328030477}};
if (APP.rentendauer){
  for (const a of [63, 65, 67]){
    check(`Dauer @${a}`, APP.rentendauer(a), 90 - a);
    check(`Lebenserwartung @${a} m (Anzeige)`, APP.LEBENSERWARTUNG.m[a], LE.m[a], 0.005);
    check(`Lebenserwartung @${a} w (Anzeige)`, APP.LEBENSERWARTUNG.w[a], LE.w[a], 0.005);
  }
} else check("rentendauer", "fehlt", "vorhanden");

console.log("== Kosten des Wartens (gleicher Kapitalbedarf, 12 Monate weniger)");
for (const [K, r, n] of [[321296.28, 0.04, 305],[100000, 0.05, 13],[100000, 0.05, 12],[50000, 0.04, 6]]){
  const rm = r/12;
  const sr = (N) => K*rm/(Math.pow(1+rm, N) - 1);
  // Bei hoechstens 12 Monaten Restlaufzeit ist "ein Jahr warten" nicht moeglich -> null
  const soll = n <= 12 ? null : cent(Math.max(0, sr(n - 12) - sr(n)));
  const ist = APP.kostenWarten ? APP.kostenWarten(K, rm, n) : "fehlt";
  if (soll === null) check(`Warten K=${K} n=${n}`, ist, null);
  else check(`Warten K=${K} n=${n}`, typeof ist === "number" ? cent(ist) : ist, soll, 0.01);
}

console.log("== Monate bis Rente (§ 99 Abs. 1: Monat nach Geburtstag), heute = 09/2026");
for (const [gj, gm, a, soll] of [[1985,1,67,305],[1985,12,67,316],[1985,9,67,313],[1960,1,63,0]])
  check(`${gm}/${gj} @${a}`, APP.monateBisRente ? APP.monateBisRente(gj, gm, a, 2026, 9) : "fehlt", soll);

console.log("== § 32a Stichproben");
for (const z of [12348,12349,17799,17800,69878,69879,277825,277826]) check(`ESt ${z}`, APP.einkommensteuer(z), estSoll(z));

console.log(`\nERGEBNIS: ${ok} OK, ${fail} FAIL`);
process.exitCode = fail ? 1 : 0;
