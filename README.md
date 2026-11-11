# Rentenrechner – Rechenkern

Hochrechnung der gesetzlichen Rente, Rentenlücke netto, Vergleich Renteneintritt 63/65/67, Erwerbsminderung und Hinterbliebene.

👉 **Zum Rechner mit Oberfläche:** <https://rentenrechner.lopsticles.com/>
(kostenlos, ohne Anmeldung, rechnet komplett im Browser)

Derselbe Code rechnet auch im Online-Rechner. Hier liegt er ohne Oberfläche, damit
die Rechnung nachvollzogen und geprüft werden kann.

## Grundlagen

| Thema | Grundlage |
|---|---|
| Entgeltpunkte, aktueller Rentenwert 2026, Durchschnittsentgelt | §§ 63, 68, 70 SGB VI; RWBestV 2026, SVBezGrV 2026 |
| Regelaltersgrenze, Rente für besonders langjährig Versicherte (45 Jahre) | §§ 35, 38, 235, 236b SGB VI |
| Zugangsfaktor, Abschläge 0,3 % je Monat | § 77 SGB VI |
| Erwerbsminderungsrente, Zurechnungszeit | §§ 43, 59, 253a SGB VI |
| Witwen-/Waisenrente, Einkommensanrechnung | §§ 46, 48, 97, 242a SGB VI |
| Kranken-/Pflegeversicherung der Rentner | §§ 241, 247, 249a SGB V; § 55 SGB XI |
| Besteuerungsanteil, Einkommensteuer | § 22 Nr. 1 S. 3 a aa EStG, § 32a EStG 2026 |

## Tests

```sh
node test/testmatrix.js   # Node.js >= 20, keine Abhängigkeiten
```

## Grenzen

Schätzung aus Eingaben, keine Kontenklärung. Verbindlich ist die Renteninformation bzw. Rentenauskunft der Deutschen Rentenversicherung.

Fehler gefunden oder neue Rechengrößen? Gern als Issue melden.

## Weitere Rechner

Pension (NRW), Rente, Krankenversicherung im Alter, Pflege, Risiko, Bausparen und
geförderte Altersvorsorge: <https://lopsticles.com/> · alle Rechenkerne: <https://github.com/lopsticles>

## Lizenz

MIT – siehe [LICENSE](LICENSE).
