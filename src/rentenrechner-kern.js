// Rechenkern Rentenrechner: gesetzliche Rente, Rentenlücke netto, Renteneintritt,
// Erwerbsminderung und Hinterbliebene. Reine Funktionen ohne Oberfläche.
// Derselbe Code rechnet in https://rentenrechner.lopsticles.com/
// Keine Rechts- oder Steuerberatung; verbindlich ist die Rentenauskunft der DRV.

const C = {
  DURCHSCHNITTSENTGELT: 51944,     // SVBezGrV 2026 § 3 Abs. 2 (vorläufig)
  RENTENWERT: 42.52,               // RWBestV 2026 § 1, ab 1.7.2026
  BBG_RV_MONAT: 8450,              // SVBezGrV 2026 § 4 Abs. 1 Nr. 1
  BEITRAG_RV: 0.186,
  BEITRAG_KV: 0.175,               // 14,6 % (§ 241 SGB V) + durchschn. Zusatzbeitrag 2026 2,9 %
  BEITRAG_PV: 0.036,
  BEITRAG_PV_KINDERLOS: 0.042,     // § 55 Abs. 3 SGB XI
  BEITRAG_AV: 0.026,
  ABSCHLAG_PRO_MONAT: 0.003,       // § 77 Abs. 2 Nr. 2a SGB VI
  ZUSCHLAG_PRO_MONAT: 0.005,       // § 77 Abs. 2 Nr. 2b SGB VI
  WARTEZEIT_VORZEITIG: 35,         // § 36, § 236, § 50 Abs. 4 SGB VI
  WARTEZEIT_BESONDERS_LANG: 45,    // § 38, § 236b, § 50 Abs. 5 SGB VI
  WARTEZEIT_ALLGEMEIN: 5,          // § 43, § 46, § 48, § 50 Abs. 1 SGB VI
  WERBUNGSKOSTEN_RENTE: 102,       // § 9a Nr. 3 EStG
  SONDERAUSGABEN_PAUSCHBETRAG: 36, // § 10c EStG
  ARBEITNEHMER_PAUSCHBETRAG: 1230, // § 9a Nr. 1a EStG
  BBG_KV_MONAT: 5812.5,            // SVBezGrV 2026
  SOLI_FREIGRENZE: 20350,          // § 3 Abs. 3 SolZG, VZ 2026
  GRUNDFREIBETRAG: 12348,
  WITWENRENTE_FAKTOR: 0.55,        // § 67 Nr. 6 SGB VI
  WITWENRENTE_KLEIN_FAKTOR: 0.25,  // § 67 Nr. 5 SGB VI, längstens 24 Monate (§ 46 Abs. 1)
  WAISENRENTE_FAKTOR: 0.10,        // § 67 Nr. 7 SGB VI
  HALBWAISE_ZUSCHLAG_EP: 0.0833,   // § 78 Abs. 2 SGB VI, je Kalendermonat
  FREIBETRAG_97: 26.4,             // § 97 Abs. 2 SGB VI, × aktueller Rentenwert
  FREIBETRAG_97_KIND: 5.6,         // je waisenrentenberechtigtem Kind
  ANRECHNUNG_97: 0.40,
  PAUSCHALABZUG_ENTGELT: 0.40,     // § 18b Abs. 5 Nr. 1 SGB IV
  BEITRAG_KV_ERMAESSIGT: 0.169,    // § 243 SGB V 14,0 % + Zusatzbeitrag 2,9 % (Selbstständige ohne Krankengeld)
  SOLI_SATZ: 0.055,                // § 4 S. 1 SolZG
  SOLI_MILDERUNG: 0.119,           // § 4 S. 2 SolZG
  PLANUNGSALTER: 90,               // Rentenbezug bis 90 (Beratungsannahme, deckt Langlebigkeit ab)
};

// Rentenbezugsdauer im Kapitalbedarf: bis zum Planungsalter, unabhängig vom Geschlecht
function rentendauer(alter){
  return C.PLANUNGSALTER - alter;
}

// Nur zum Vergleich im Annahmentext: fernere Lebenserwartung, Destatis Periodensterbetafel 2023/2025 (12613-b01/-b02)
const LEBENSERWARTUNG = {
  m: {63: 19.49, 65: 17.97, 67: 16.52},
  w: {63: 22.79, 65: 21.10, 67: 19.45},
};


const r2 = (x) => Math.round(x * 100) / 100;
const r1 = (x) => Math.round(x * 10) / 10;
const fmtEuro = (n) => (n).toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
const fmtInt  = (n) => Math.round(n).toLocaleString('de-DE');
function fmtAlterMonate(m){
  return m % 12 ? `${Math.floor(m/12)} J. ${m % 12} Mon.` : `${m/12} J.`;
}

// Besteuerungsanteil nach Jahr des Rentenbeginns, § 22 Nr. 1 S. 3 a aa EStG: bis 2005 50 %, bis 2020 +2 Punkte,
// 2021 81 %, 2022 82 %, ab 2023 82,5 % und +0,5 Punkte je Jahr bis 100 % (2058)
function besteuerungsanteil(jahr){
  if (jahr <= 2005) return 0.5;
  if (jahr <= 2020) return 0.5 + (jahr - 2005) * 0.02;
  if (jahr <= 2022) return 0.8 + (jahr - 2020) * 0.01;
  return Math.min(1, 0.825 + (jahr - 2023) * 0.005);
}

// Regelaltersgrenze in Monaten: § 235 Abs. 2 SGB VI, ab Jahrgang 1964 67 Jahre (§ 35).
// Die Altersgrenzen der §§ 236 (langjährig Versicherte) folgen für 1949-1963 derselben Staffel.
function regelaltersgrenzeMonate(geburtsjahr){
  if (geburtsjahr >= 1964) return 67 * 12;
  if (geburtsjahr < 1947) return 65 * 12;
  if (geburtsjahr <= 1958) return 65 * 12 + (geburtsjahr - 1946);
  return 66 * 12 + (geburtsjahr - 1958) * 2;
}

// Zugangsfaktor nach § 77 Abs. 2 Nr. 2 SGB VI: 0,3 % Abschlag je Monat vor, 0,5 % Zuschlag je Monat nach der Regelaltersgrenze
function zugangsfaktor(geburtsjahr, alter){
  const diff = alter * 12 - regelaltersgrenzeMonate(geburtsjahr);
  return diff < 0 ? 1 - Math.min(-diff * C.ABSCHLAG_PRO_MONAT, 0.144) : 1 + diff * C.ZUSCHLAG_PRO_MONAT;
}

// Altersgrenze der Altersrente für besonders langjährig Versicherte (45 J. Wartezeit, abschlagsfrei): § 38, § 236b SGB VI
function altersgrenze45Monate(geburtsjahr){
  if (geburtsjahr >= 1964) return 65 * 12;
  if (geburtsjahr <= 1952) return 63 * 12;
  return 63 * 12 + (geburtsjahr - 1952) * 2;
}

// Ende der Zurechnungszeit in Monaten: § 253a Abs. 3 (Beginn bzw. Tod 2020-2030), ab 2031 67 Jahre (§ 59 Abs. 2),
// höchstens die Regelaltersgrenze (§ 253a Abs. 4)
function zurechnungszeitEndeMonate(jahr, geburtsjahr){
  const anhebung = {2020:9, 2021:10, 2022:11, 2023:12, 2024:13, 2025:14, 2026:15, 2027:16, 2028:18, 2029:20, 2030:22};
  const ende = jahr >= 2031 ? 67 * 12 : 65 * 12 + (anhebung[jahr] !== undefined ? anhebung[jahr] : 9);
  return Math.min(ende, regelaltersgrenzeMonate(geburtsjahr));
}

// Zugangsfaktor bei EM- und Hinterbliebenenrenten, § 77 Abs. 2 Nr. 3 und 4 SGB VI: 0,3 % je Monat vor Vollendung
// des 65. Lebensjahres, vor 62 wird 62 zugrunde gelegt (höchstens 10,8 %). Mit 40 Jahren Wartezeit-45-Zeiten 63/60 (Abs. 4).
function zugangsfaktorEM(alter_monate, jahre40){
  const ref = (jahre40 ? 63 : 65) * 12, boden = (jahre40 ? 60 : 62) * 12;
  return 1 - Math.max(0, ref - Math.max(alter_monate, boden)) * C.ABSCHLAG_PRO_MONAT;
}

// Altersgrenze der großen Witwenrente nach dem Todesjahr (§ 46 Abs. 2 Nr. 2, § 242a Abs. 5 SGB VI)
function witwenAltersgrenzeMonate(todesjahr){
  if (todesjahr >= 2029) return 47 * 12;
  if (todesjahr <= 2023) return 45 * 12 + Math.max(0, todesjahr - 2011);
  return 46 * 12 + (todesjahr - 2023) * 2;
}

function kvpvSatz(kinder){
  return C.BEITRAG_KV/2 + (kinder > 0 ? C.BEITRAG_PV : C.BEITRAG_PV_KINDERLOS);
}

// Entgeltpunkte je Jahr, Einkommen nur bis zur Beitragsbemessungsgrenze (§ 157 SGB VI)
function epProJahr(brutto_jahr){
  return Math.min(brutto_jahr, C.BBG_RV_MONAT * 12) / C.DURCHSCHNITTSENTGELT;
}

function berechneEntgeltpunkte(brutto_jahr, beitragsjahre){
  return epProJahr(brutto_jahr) * beitragsjahre;
}

// Progressiver Einkommensteuertarif nach §32a EStG, Fassung ab VZ 2026
// (Quelle: gesetze-im-internet.de/estg/__32a.html). Einzelveranlagung, kein Splitting.
function einkommensteuer(zvE){
  zvE = Math.floor(zvE); // zvE auf vollen Euro abrunden
  if (zvE <= C.GRUNDFREIBETRAG) return 0;          // bis 12.348 €
  let st;
  if (zvE <= 17799){
    const y = (zvE - C.GRUNDFREIBETRAG) / 10000;
    st = (914.51 * y + 1400) * y;
  } else if (zvE <= 69878){
    const z = (zvE - 17799) / 10000;
    st = (173.10 * z + 2397) * z + 1034.87;
  } else if (zvE <= 277825){
    st = 0.42 * zvE - 11135.63;
  } else {
    st = 0.45 * zvE - 19470.38;
  }
  return Math.floor(st); // Steuerbetrag auf vollen Euro abrunden (§32a EStG)
}

// Netto einer gesetzlichen Rente: KV/PV (§ 249a SGB V, § 59 SGB XI) und Einkommensteuer auf den
// Besteuerungsanteil (§ 22 EStG), abzüglich 102 € (§ 9a Nr. 3), 36 € (§ 10c) und KV/PV-Beiträge (§ 10 Abs. 1 Nr. 3)
// Jahressteuer: Einkommensteuer, Soli (§ 3 Abs. 3, § 4 SolZG, Einzelveranlagung) und Kirchensteuer (Landesrecht:
// 8 % in BY/BW, sonst 9 % der Einkommensteuer; ohne Kappung und ohne Sonderausgabenabzug der Kirchensteuer)
function jahressteuer(zvE, kist){
  const est = einkommensteuer(zvE);
  const soli = est > C.SOLI_FREIGRENZE ? Math.min(est * C.SOLI_SATZ, (est - C.SOLI_FREIGRENZE) * C.SOLI_MILDERUNG) : 0;
  return est + soli + est * (kist || 0);
}

// Netto einer gesetzlichen Rente: KV/PV (§ 249a SGB V, § 59 SGB XI) und Steuer auf den Besteuerungsanteil
// (§ 22 EStG), abzüglich 102 € (§ 9a Nr. 3), 36 € (§ 10c) und KV/PV-Beiträge (§ 10 Abs. 1 Nr. 3)
function nettoGesetzlicheRente(brutto, beginnjahr, kinder, kist){
  const sozialabgaben = brutto * kvpvSatz(kinder);
  const zvE = Math.max(0, brutto * 12 * besteuerungsanteil(beginnjahr)
    - C.WERBUNGSKOSTEN_RENTE - C.SONDERAUSGABEN_PAUSCHBETRAG - sozialabgaben * 12);
  const steuer_monat = jahressteuer(zvE, kist) / 12;
  return r2(Math.max(0, brutto - steuer_monat - sozialabgaben));
}

// Rente ab dem Monat nach dem Geburtstag (§ 99 Abs. 1 SGB VI): Dezember-Geborene beginnen im Folgejahr
function rentenbeginnJahr(geburtsjahr, geburtsmonat, alter){
  return geburtsjahr + alter + (geburtsmonat === 12 ? 1 : 0);
}

function berechneRenteNetto(brutto, geburtsjahr, alter, kinder, geburtsmonat, kist){
  return nettoGesetzlicheRente(brutto, rentenbeginnJahr(geburtsjahr, geburtsmonat || 1, alter), kinder, kist);
}

// Selbstständige gelten als nicht rentenversicherungspflichtig: ohne Renteninformation keine gesetzliche Rente,
// mit Renteninformation deren Wert ohne weitere Beiträge (passend zur EM-Rente, die ebenfalls entfällt)
function schätzeRente(brutto_jahr, alter_aktuell, renteneintritt_alter, geburtsjahr, info_brutto, berufsbeginn, kinder, geburtsmonat, kist, selbststaendig){
  if (selbststaendig && !(info_brutto > 0)){
    return {brutto:0, netto:0, entgeltpunkte:0, abschlag_prozent:0, anspruch:true, keine_grv:true,
      quelle:"Keine Pflichtbeiträge (Selbstständige/r) – Renteninformation eintragen"};
  }
  if (selbststaendig) brutto_jahr = 0;
  const beitragsjahre = Math.max(0, renteneintritt_alter - (berufsbeginn || 18));
  const rag_monate = regelaltersgrenzeMonate(geburtsjahr);
  // Mit 45 Jahren Wartezeit ab der Altersgrenze des § 236b abschlagsfrei (Näherung: Wartezeit = Jahre seit Berufsbeginn)
  const besonders_lang = beitragsjahre >= C.WARTEZEIT_BESONDERS_LANG
    && renteneintritt_alter * 12 >= altersgrenze45Monate(geburtsjahr) && renteneintritt_alter * 12 < rag_monate;
  const zf = besonders_lang ? 1 : zugangsfaktor(geburtsjahr, renteneintritt_alter);
  const abschlag_prozent = r1((1 - zf) * 100); // negativ = Zuschlag
  // Vor der Regelaltersgrenze nur als Altersrente für langjährig Versicherte: 35 Jahre Wartezeit (§ 36, § 236 SGB VI)
  if (renteneintritt_alter * 12 < rag_monate && beitragsjahre < C.WARTEZEIT_VORZEITIG){
    return {brutto:0, netto:0, entgeltpunkte:0, abschlag_prozent, anspruch:false,
      quelle:"Kein Anspruch (Wartezeit 35 J. nicht erfüllt)"};
  }
  let ep, quelle;
  if (info_brutto && info_brutto > 0){
    // Die Renteninformation rechnet bis zur Regelaltersgrenze hoch; Differenz mit dem aktuellen Einkommen
    const fehlende_jahre = (rag_monate - renteneintritt_alter * 12) / 12;
    ep = Math.max(0, info_brutto / C.RENTENWERT - fehlende_jahre * epProJahr(brutto_jahr));
    quelle = selbststaendig ? "Renteninformation (ohne weitere Beiträge)" : "Renteninformation";
  } else {
    ep = berechneEntgeltpunkte(brutto_jahr, beitragsjahre);
    quelle = "Schätzung";
  }
  const rente_brutto = r2(ep * C.RENTENWERT * zf);
  return {
    brutto: rente_brutto,
    netto: berechneRenteNetto(rente_brutto, geburtsjahr, renteneintritt_alter, kinder, geburtsmonat, kist),
    entgeltpunkte: r2(ep),
    abschlag_prozent,
    anspruch: true,
    besonders_lang,
    quelle,
  };
}

// Volle EM-Rente bei Eintritt heute (§ 43, § 59, § 64 SGB VI). Ohne Renteninformation: bisherige Jahre plus
// Zurechnungszeit, bewertet mit den EP des aktuellen Einkommens (Gesamtleistungsbewertung bei gleichbleibendem
// Einkommen), Zugangsfaktor nach § 77 Abs. 2 Nr. 3. Dieselbe Rechnung ergibt die Basis der Hinterbliebenenrenten
// bei Tod heute (§ 77 Abs. 2 Nr. 4, § 253a). Steuer mit dem Besteuerungsanteil des Beginnjahres (§ 22 Nr. 1 S. 3 a aa EStG).
// Wartezeit: 5 Jahre, davon 3 Jahre Pflichtbeiträge in den letzten 5 Jahren (§ 43 Abs. 1 Nr. 2-3, § 50 Abs. 1);
// bei durchgehender Beschäftigung ab 5 Jahren erfüllt. Darunter nur für Berufseinsteiger die volle EM-Rente über
// § 53 Abs. 2 (Erwerbsminderung binnen 6 Jahren nach der Ausbildung, mind. 1 Jahr Pflichtbeiträge in den letzten 2 Jahren).
// Selbstständige ohne Pflichtbeiträge haben keinen Anspruch; eine EM-Rente aus der Renteninformation zählt trotzdem.
// opt: {kist, berufseinsteiger}
function berechneEMRenteNetto(brutto_monat, selbststaendig, em_brutto_direkt, kinder, beginnjahr, alter_monate, berufsbeginn, geburtsjahr, opt){
  const {kist = 0, berufseinsteiger = false} = opt || {};
  const leer = {brutto:0, netto:0, netto_halb:0, anspruch:false, halb_anspruch:false, zugangsfaktor:1, zuschlag_monate:0};
  const hat_info = em_brutto_direkt && em_brutto_direkt > 0;
  if (selbststaendig && !hat_info) return {...leer, quelle:"Keine (Selbstständig, keine Pflichtbeiträge)"};
  const jahr = beginnjahr || new Date().getFullYear();
  const bb = berufsbeginn || 18;
  const beitragsjahre = Math.max(0, alter_monate / 12 - bb);
  const zf = zugangsfaktorEM(alter_monate, beitragsjahre >= 40);
  const zz_ende = zurechnungszeitEndeMonate(jahr, geburtsjahr);
  const zz_monate = Math.max(0, zz_ende - alter_monate);
  const wartezeit = beitragsjahre >= C.WARTEZEIT_ALLGEMEIN;
  if (!hat_info && !wartezeit && !(berufseinsteiger && beitragsjahre >= 1)){
    return {...leer, quelle: berufseinsteiger
      ? "Kein Anspruch (weniger als 1 Jahr Pflichtbeiträge, § 53 Abs. 2 SGB VI)"
      : "Kein Anspruch (Wartezeit 5 J. nicht erfüllt, § 43 SGB VI)"};
  }
  const halb_anspruch = hat_info || wartezeit;
  let em_brutto, quelle;
  if (hat_info){
    em_brutto = em_brutto_direkt;
    quelle = "Renteninformation";
  } else {
    em_brutto = r2(epProJahr(brutto_monat * 12) * (beitragsjahre + zz_monate / 12) * zf * C.RENTENWERT);
    quelle = `Schätzung mit Zurechnungszeit bis ${fmtAlterMonate(zz_ende)}, ${r1((1 - zf) * 100).toLocaleString('de-DE')} % Abschlag`
      + (halb_anspruch ? "" : "; unter 5 J. Wartezeit nur volle EM-Rente (§ 53 Abs. 2 SGB VI)");
  }
  return {
    brutto: r2(em_brutto),
    netto: nettoGesetzlicheRente(em_brutto, jahr, kinder, kist),
    netto_halb: halb_anspruch ? nettoGesetzlicheRente(em_brutto * 0.5, jahr, kinder, kist) : 0,
    anspruch: true, halb_anspruch,
    zugangsfaktor: zf,
    // § 78 Abs. 1: Monate mit Beitragszeiten plus Zurechnungszeit (bei lückenloser Belegung voll angerechnet)
    zuschlag_monate: Math.round(beitragsjahre * 12) + zz_monate,
    quelle,
  };
}

// Anrechnung eigenen Einkommens auf die Witwenrente (§ 97 SGB VI, § 18b Abs. 5 Nr. 1 SGB IV):
// Arbeitsentgelt − 40 % pauschal, Freibetrag 26,4 × aRW + 5,6 × aRW je waisenberechtigtem Kind, davon 40 %
function anrechnung97(witwe_brutto, partner_brutto, waisen){
  if (!partner_brutto || partner_brutto <= 0) return 0;
  const einkommen = partner_brutto * (1 - C.PAUSCHALABZUG_ENTGELT);
  const freibetrag = (C.FREIBETRAG_97 + C.FREIBETRAG_97_KIND * waisen) * C.RENTENWERT;
  return r2(Math.min(witwe_brutto, Math.max(0, einkommen - freibetrag) * C.ANRECHNUNG_97));
}

// Hinterbliebenenrenten für zwei Zeitpunkte: Tod heute (Basis: EM-Rente, s. o.) und Tod bei Rentenbeginn (Basis: Altersrente).
// Große Witwenrente 55 % bei Kindererziehung (< 18) oder ab der Altersgrenze des § 242a Abs. 5, sonst kleine 25 % für
// 24 Monate (§ 46, § 67). Im Sterbevierteljahr volle Rente ohne Einkommensanrechnung (§ 67 Nr. 5/6, § 97 Abs. 1 S. 2).
// Witwenrente mit KV/PV und Einkommensteuer; Besteuerungsanteil bei Folgerenten nach dem Beginn der Vorrente
// (§ 22 Nr. 1 S. 3 a aa S. 8 EStG). Halbwaisenrente beitragsfrei (§ 237 S. 2 SGB V, § 57 Abs. 1 SGB XI) mit Zuschlag nach § 78.
function berechneHinterbliebene(p){
  const {em, basis_rente, kinder, partner_alter, partner_brutto, jahr_heute, rentenbeginn_jahr, jahre_bis_rente} = p;
  const kist = p.kist || 0;
  const basis_heute = em.brutto;
  const gross_heute = kinder > 0 || !partner_alter || partner_alter * 12 >= witwenAltersgrenzeMonate(jahr_heute);
  const gross_rente = !partner_alter
    || (partner_alter + jahre_bis_rente) * 12 >= witwenAltersgrenzeMonate(rentenbeginn_jahr);
  const f_heute = gross_heute ? C.WITWENRENTE_FAKTOR : C.WITWENRENTE_KLEIN_FAKTOR;
  const f_rente = gross_rente ? C.WITWENRENTE_FAKTOR : C.WITWENRENTE_KLEIN_FAKTOR;

  const witwe_heute_voll = r2(basis_heute * f_heute);
  const witwe_heute_anrechnung = anrechnung97(witwe_heute_voll, partner_brutto, kinder);
  const witwe_heute_brutto = r2(witwe_heute_voll - witwe_heute_anrechnung);
  const witwe_rente_brutto = r2(basis_rente * f_rente);

  const waise_heute_brutto = em.anspruch
    ? r2(basis_heute * C.WAISENRENTE_FAKTOR
      + em.zuschlag_monate * C.HALBWAISE_ZUSCHLAG_EP * em.zugangsfaktor * C.RENTENWERT * C.WAISENRENTE_FAKTOR)
    : 0;
  return {
    gross_heute, gross_rente, faktor_heute: f_heute, faktor_rente: f_rente,
    witwe_heute_voll, witwe_heute_anrechnung,
    witwe_heute_brutto, witwe_heute_netto: nettoGesetzlicheRente(witwe_heute_brutto, jahr_heute, kinder, kist),
    witwe_rente_brutto, witwe_rente_netto: nettoGesetzlicheRente(witwe_rente_brutto, rentenbeginn_jahr, kinder, kist),
    sterbe_heute_netto: nettoGesetzlicheRente(basis_heute, jahr_heute, kinder, kist),
    sterbe_rente_netto: nettoGesetzlicheRente(basis_rente, rentenbeginn_jahr, kinder, kist),
    waise_heute_brutto, waise_heute_netto: waise_heute_brutto,
  };
}

// Nettolohn-Schätzung für die Vorbelegung: Steuerklasse I/IV. SV-Arbeitnehmeranteile (RV/AV bis BBG RV, KV/PV bis
// BBG KV, PV-Kinderlosenzuschlag § 55 Abs. 3 SGB XI), Steuer nach § 32a mit Arbeitnehmer-Pauschbetrag, § 10c und
// Vorsorgeaufwand (§ 10 Abs. 1 Nr. 2, 3; KV ohne Krankengeldanteil 4 %), Soli und Kirchensteuer.
// Selbstständige: Einkommen = Gewinn, keine RV/AV, freiwillige KV zum ermäßigten Satz und PV voll selbst getragen.
function schaetzeNettoLohn(brutto_monat, kinder, kist, selbststaendig){
  const rv_basis = Math.min(brutto_monat, C.BBG_RV_MONAT), kv_basis = Math.min(brutto_monat, C.BBG_KV_MONAT);
  const pv_satz = kinder > 0 ? C.BEITRAG_PV : C.BEITRAG_PV_KINDERLOS;
  let rv, av, kv, pv, zvE;
  if (selbststaendig){
    rv = 0; av = 0;
    kv = kv_basis * C.BEITRAG_KV_ERMAESSIGT;
    pv = kv_basis * pv_satz;
    zvE = Math.max(0, 12 * (brutto_monat - kv - pv) - C.SONDERAUSGABEN_PAUSCHBETRAG);
  } else {
    rv = rv_basis * C.BEITRAG_RV / 2; av = rv_basis * C.BEITRAG_AV / 2;
    kv = kv_basis * C.BEITRAG_KV / 2;
    pv = kv_basis * (C.BEITRAG_PV / 2 + pv_satz - C.BEITRAG_PV);
    zvE = Math.max(0, 12 * (brutto_monat - rv - kv * 0.96 - pv) - C.ARBEITNEHMER_PAUSCHBETRAG - C.SONDERAUSGABEN_PAUSCHBETRAG);
  }
  return Math.round(brutto_monat - rv - av - kv - pv - jahressteuer(zvE, kist) / 12);
}

function sparrate(kapital, r_m, n){
  n = Math.max(1, n);
  return r_m > 0 ? kapital * r_m / (Math.pow(1 + r_m, n) - 1) : kapital / n;
}

// Mehrbedarf je Monat bei Start 12 Monate später: gleicher Kapitalbedarf, gleicher Rentenbeginn, kürzere Laufzeit.
// null, wenn bis zum Rentenbeginn höchstens 12 Monate bleiben (ein Jahr Warten ist dann nicht mehr möglich).
function kostenWarten(kapital, r_m, n){
  if (n <= 12) return null;
  return Math.max(0, sparrate(kapital, r_m, n - 12) - sparrate(kapital, r_m, n));
}

// Monate bis Rentenbeginn; die Rente beginnt im Monat nach dem Geburtstag (§ 99 Abs. 1 SGB VI)
function monateBisRente(geburtsjahr, geburtsmonat, alter, jahr_heute, monat_heute){
  return Math.max(0, (geburtsjahr + alter - jahr_heute) * 12 + (geburtsmonat + 1 - monat_heute));
}

function berechneBuLuecke(netto_monat, em_netto, bu_vers){
  const luecke = Math.max(0, netto_monat - em_netto);
  const luecke_mit_bu = Math.max(0, netto_monat - em_netto - bu_vers);
  const versorgungsquote = netto_monat > 0 ? r1((em_netto + bu_vers) / netto_monat * 100) : 0;
  return {em_rente_netto:r2(em_netto), bu_versicherung:r2(bu_vers), luecke:r2(luecke), luecke_mit_bu:r2(luecke_mit_bu), versorgungsquote};
}


if (typeof module !== 'undefined') module.exports = { C, rentendauer, LEBENSERWARTUNG, r2, besteuerungsanteil, regelaltersgrenzeMonate, zugangsfaktor, altersgrenze45Monate, zurechnungszeitEndeMonate, zugangsfaktorEM, witwenAltersgrenzeMonate, kvpvSatz, epProJahr, berechneEntgeltpunkte, einkommensteuer, jahressteuer, nettoGesetzlicheRente, rentenbeginnJahr, berechneRenteNetto, schätzeRente, berechneEMRenteNetto, anrechnung97, berechneHinterbliebene, schaetzeNettoLohn, sparrate, kostenWarten, monateBisRente, berechneBuLuecke };
