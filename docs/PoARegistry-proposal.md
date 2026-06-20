# PoARegistry — voorstel voor een losse iCt Horse dienst

> Geschreven tijdens v0.25.0-Shamir release; **out-of-scope voor PDFHorse**. Bedoeld als input voor evaluatie binnen `Meta_iCt_Horse_Diensten`.

## Probleem dat dit oplost

Met v0.25.0-Shamir heeft PDFHorse identity binding via OpenPGP. Een PoA-claim is nu self-contained verifieerbaar: de envelope bevat publieke sleutel + sig + anchor. Maar er blijft één gat:

**Wie heeft het claim als eerste gemaakt?**

Twee partijen kunnen dezelfde PDF claimen op verschillende tijden onder verschillende fingerprints. Anchor-tijd (Bitcoin block timestamp) is bewijs *dat* een hash op tijd T bestond — maar tussen aanvang van het document en de OTS-anchor zit een venster (~10 min Bitcoin block-tijd, eventueel langer) waarin een snelle aanvaller een eerdere claim kan injecteren.

Een **publiek registry** dat (hash, signature, fingerprint, timestamp) opslaat met `first-write-wins` semantiek lost dit op: de eerste schrijver wint en is publiek aantoonbaar.

## Waarom uit-scope voor PDFHorse

- PDFHorse is **anoniem-bruikbaar, geen server-account, geen logs**. Een registry-laag inbouwen breekt deze ontwerpkeuze.
- PDFHorse is **PUBLIC AGPL-3.0 client**. Een registry is een **dienst** die hosting + uptime + DoS-mitigatie + (op termijn) moderatie vereist. Dat hoort in een aparte deployable.
- Andere iCt Horse diensten kunnen het registry ook gebruiken (foto's, contracten, gebruikt buiten PDFHorse-context).

Daarom hoort dit in **`Meta_iCt_Horse_Diensten`**, niet in dit ecosysteem.

## Schets — minimum viable PoARegistry

**API (REST, anonymous-by-default):**

| Endpoint | Doel |
|---|---|
| `POST /claim` | Registreer een claim. Body = `{ sha256, signature_armored, public_key_armored, fingerprint, claim_ts, optional_meta }`. Server zet `received_ts`, ondertekent met server-key, persisteert. |
| `GET /claim/{sha256}` | Eerste-claim opzoeken op file-hash. Returnt `{ first_received_ts, fingerprint, signature, ... }` of 404. |
| `GET /fingerprint/{fp}` | Alle claims van een specifieke fingerprint (transparantie + revocation-tooling). |
| `GET /health` | Status. |
| `POST /revoke` | Owner kan z'n eigen claim revoken met een OpenPGP revocation-cert; toont REVOKED-marker in lookups. |

**Storage:** SQLite of Postgres, append-only (geen update/delete behalve revoke-flag).

**Identity:** **Anoniem voor de claimer** — de fingerprint is identiteit, niet email. Geen account-systeem. Optionele DoS-mitigatie via cookie-rate-limit / proof-of-work / iCt Horse SMS-OTP.

**Auditability:** Periodiek (bv. dagelijks) Merkle-root van alle claims publiceren op Bitcoin via OpenTimestamps. Geeft een tweede laag tegen "registry herschrijft history".

**Federation (toekomst):** Meerdere PoARegistry-instances kunnen elkaars claims spiegelen. First-write-wins blijft semantiek; conflict op hash → toon beide met respective `received_ts`.

## Hoe PDFHorse er aan koppelt (later, optioneel)

In een toekomstige PDFHorse-versie (geen `v0.25.0-Shamir` afhankelijkheid):

1. Sign-modus krijgt extra checkbox "Registreer publiek bij PoARegistry" (default uit).
2. Bij sign post de client `{ sha256, signature, pubkey, fingerprint }` naar registry.
3. Bij verify checkt de client `/claim/{sha256}` → toont "Registered as first claim by fingerprint X on Y" of "Niet geregistreerd; later geregistreerd door fingerprint Z op tijd T (mogelijk dispute)".

PDFHorse client blijft 100% werken zonder registry (registry-call is optioneel).

## Open vragen voor evaluatie

- **Hosting:** HC55 (3.964) of separate Hetzner-machine?
- **Anti-spam:** PoW (Hashcash-style) of SMS-OTP via SMSRelay?
- **Privacy:** alleen hash registreren of ook bron-filename? Filename leakt info.
- **Federation:** vanaf dag-1 of pas wanneer een tweede partij meedoet?
- **Revocation:** alleen owner-revoke of ook gerechtelijke takedown (escrow van takedown-key)?
- **Mobile:** native iCt Horse Companion app voor scan + claim, of alleen via web?

## Beslismoment

Geen beslissing in deze release. Bewust geparkeerd. Bij goedkeuring in `Meta_iCt_Horse_Diensten` → eigen repo, eigen versionering (codenaam-thema: "register-pioniers"?).
