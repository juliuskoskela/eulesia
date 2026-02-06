# National & EU Content - Eulesia Bot

## Ongelma
- National ja EU-tason feedit ovat tyhjiä ilman sisältöä
- Tarvitaan automaattista sisältöä ministeriöiltä ja EU-instituutioilta

## Ratkaisu: Eulesia Bot
Botti joka importtaa ja tiivistää virallisia asiakirjoja threadseiksi.

## Sisältölähteet

### Suomen ministeriöt (national scope)
- Valtioneuvosto (vn.fi) - tiedotteet, päätökset
- Eduskunta - lakialoitteet, valiokuntien mietinnöt
- Ministeriöiden RSS-syötteet
- Finlex - uudet lait ja asetukset

### EU-instituutiot (european scope)
- EUR-Lex - EU-lainsäädäntö
- European Commission - tiedotteet
- European Parliament - päätöslauselmat
- Council of the EU - päätökset

## Toteutus
1. Laajennetaan nykyistä minutes-import -logiikkaa
2. Luodaan ministry-import ja eu-import palvelut
3. Scheduler ajaa importit päivittäin
4. AI tiivistää asiakirjat keskustelunavauksiksi

## Prioriteetti
- Korkea - tarvitaan testisisältöä ja oikeaa arvoa käyttäjille

---
*Luotu: 2026-02-05*
