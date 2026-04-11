# 📚 Oefensessie Tracker

Een eenvoudige webapplicatie om je voortgang bij het oefenen van examenvragen bij te houden.  
Ontworpen voor studenten die zich voorbereiden op toelatingsexamens (bv. ingenieurswetenschappen) met ondersteuning voor **vragenreeksen**, **statusregistratie** (Goed / Fout / Blanco / Nog niet gezien), **automatische herhalingsdata** en **import/export** van je gegevens.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## ✨ Functionaliteiten

- **Vragenreeksen aanmaken** – Geef elke reeks een naam en het totaal aantal vragen.
- **Resultaten invoeren** – Per vraag noteer je datum, vraag-ID, status en (optioneel) doorlooptijd in minuten.
- **Automatische herhaling** – Bij status *Fout*, *Blanco* of *Nog niet gezien* wordt een herhalingsdatum (3 dagen later) berekend.
- **Voortgangsstatistieken** – Overzicht van ingevoerde vragen, percentage goed/fout, gemiddelde tijd, nog te doen, enz.
- **Import / Export** – Maak een back-up van al je series en vragen (JSON) of herstel een eerdere back-up.
- **Mobiel‑vriendelijk** – De zijbalk verdwijnt op kleine schermen; de app blijft goed bruikbaar.

## 🖥️ Demo / Gebruik

Kloon de repository en open `index.html` in een moderne browser (Chrome, Firefox, Edge, Safari).  
De app werkt volledig in de browser via **IndexedDB** – er is geen backend of internetverbinding nodig (behalve voor de links naar YouTube).

## 📖 Handleiding

### 1. Vragenreeksen aanmaken
- Vul een naam in (bijv. “Juli 2025”) en het totaal aantal vragen van die reeks.
- Klik op **Vragenreeks Toevoegen**. De reeks verschijnt nu in de dropdown.

### 2. Actieve reeks selecteren
- Kies een reeks uit de dropdown **Selecteer actieve reeks**.
- De statistieken en het invoerformulier worden automatisch geladen.

### 3. Vraagresultaten invoeren
- **Datum** – standaard vandaag, maar je kunt elke datum kiezen (wordt onthouden voor de volgende invoer).
- **Vraag‑ID** – een unieke aanduiding (bv. “Vraag 12” of “2024‑Q7”).
- **Status** – *Goed*, *Fout*, *Blanco* of *Nog niet gezien*.
- **Tijd (min)** – optioneel, bijvoorbeeld hoe lang je over de vraag deed.
- Klik op **Resultaat Toevoegen**. De tabel en statistieken worden bijgewerkt.

> Bij *Fout*, *Blanco* of *Nog niet gezien* wordt automatisch een herhalingsdatum (3 dagen later) toegevoegd. Je ziet die in de kolom “Herhaling”.

### 4. Resultaten bekijken en verwijderen
- Alle ingevoerde vragen verschijnen in de tabel, gesorteerd van nieuw naar oud.
- Klik op **Verwijderen** naast een rij om dat resultaat te wissen.

### 5. Statistieken
Het statistiekenblok toont:
- Totaal aantal vragen in de reeks
- Aantal ingevoerde vragen (% voltooid)
- Nog te doen (niet ingevoerde vragen)
- Aantal en percentage Goed / Fout / Blanco (berekend op basis van ingevoerde pogingen)
- Aantal “Nog niet gezien” (apart)
- Gemiddelde tijd per ingevoerde vraag (alleen als je tijd hebt ingevuld)

### 6. Exporteren / Importeren
- **Exporteer gegevens** – Maakt een JSON‑bestand van al je series en vragen. Je kunt een bestandsnaam kiezen.
- **Importeer gegevens** – Laad een eerder geëxporteerd bestand. **Waarschuwing:** dit overschrijft alle bestaande data! Bevestig daarom zorgvuldig.

Je kunt dit bestand eventueel op een shared drive of in de wolk zetten, zodat je het kunt delen met je andere toestellen. Zo krijg je hetzelfde op je pc en je tablet, bijvoorbeeld. 

## 🛠️ Technische details

- **HTML5, CSS3, Vanilla JavaScript** – Geen frameworks.
- **IndexedDB** – Lokale opslag in de browser.
- **SessionStorage** – Onthoudt de laatst gebruikte datum.
- **HTML5 `<dialog>`** – Voor de handleiding.
- **Responsive grid layout** – Zijbalk van 220px, hoofdkolom flexibel.

## 📁 Bestanden

- `index.html` – Structuur en dialog.
- `style.css` – Alle opmaak (originele kleuren: lightcoral / lightblue).
- `app.js` – Volledige applicatielogica (IndexedDB, invoer, statistieken, import/export, helpdialog).

## 🚀 Aan de slag

1. Download of clone de repository.
2. Open `index.html` in je browser.
3. Begin met het aanmaken van een vragenreeks.

## 📄 Licentie

Dit project is vrij te gebruiken voor persoonlijke doeleinden.  
Voor vragen of suggesties kun je terecht op de [contactpagina van Den Ingenieur](https://www.deningenieur.be/mijngedacht/contact).

---

Veel succes met je voorbereiding! 🍀  
*Rudy – Den Ingenieur*
