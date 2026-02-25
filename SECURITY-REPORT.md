# Security Audit Rapport — Boekingssysteem MVP

**Datum:** 10 februari 2026  
**Auditor:** Senior Security Auditor  
**Scope:** Volledige security audit van het boekingssysteem  
**Classificatie:** CRITICAL / HIGH / MEDIUM / LOW / INFO

---

## Executive Summary

Het boekingssysteem heeft een solide security-basis met RLS policies, atomaire booking-creatie en rate limiting. Er zijn echter **2 HIGH** en **4 MEDIUM** bevindingen die aandacht vereisen vóór productie-deployment.

---

## 1. Supabase RLS Policies — Salon Isolatie

### 1.1 Kan salon A data van salon B zien?

**LEZEN:** ⚠️ HIGH — SEC-001

De volgende policies zijn **te permissief** voor anonieme lezers:

| Tabel | Policy | Probleem |
|-------|--------|----------|
| `salons` | `FOR SELECT USING (true)` | Alle salons zichtbaar — acceptabel voor slug lookup |
| `staff` | `FOR SELECT USING (is_active = true)` | **Alle actieve medewerkers van ALLE salons** zichtbaar |
| `services` | `FOR SELECT USING (is_active = true)` | **Alle actieve diensten van ALLE salons** zichtbaar |
| `staff_schedules` | `FOR SELECT USING (true)` | **Alle roosters van ALLE medewerkers** zichtbaar |
| `staff_blocks` | `FOR SELECT USING (true)` | **Alle blokkades van ALLE medewerkers** zichtbaar |
| `bookings` | `FOR SELECT USING (status = 'confirmed')` | **Alle bevestigde boekingen** zichtbaar (alleen via directe query, niet via public_bookings view) |

**Impact:** Een kwaadwillende kan met de anon key alle salon data enumereren. De app filtert op `salon_id` in de frontend, maar de database dwingt dit niet af.

**Aanbeveling:** Voeg `salon_id`-gebaseerde filtering toe aan RLS policies. Alternatief: accepteer dit voor MVP, aangezien de data niet gevoelig is (namen, tijden) — behalve bookings die klantdata bevatten (zie SEC-008).

**SCHRIJVEN:** ✅ OK  
Owner-policies filteren correct op `auth.uid() = owner_id` chain. Salon A eigenaar kan geen data van salon B wijzigen.

---

### 1.2 Public Bookings View

**Risico:** ⚠️ MEDIUM — SEC-002

De view `public_bookings` bevat alleen `staff_id, start_at, end_at` — **geen klantdata**. Goed.

**MAAR:** De directe `bookings` tabel heeft RLS policy `bookings_select_public` met `USING (status = 'confirmed')`. Dit betekent dat een anonieme gebruiker met:
```
supabase.from('bookings').select('customer_name, customer_email, customer_phone')
```
**alle klantdata van bevestigde boekingen kan ophalen!**

De `public_bookings` view is slechts een convenience — het voorkomt niet dat de onderliggende tabel direct bevraagd wordt.

**Impact:** CRITICAL data exposure van klant-PII.

**Aanbeveling:** Wijzig de bookings SELECT policy:
```sql
CREATE POLICY "bookings_select_public" ON bookings
  FOR SELECT USING (false);  -- Geen directe public reads
```
En gebruik `SECURITY DEFINER` functies of grant access alleen via de view.

**Herclassificatie:** → **HIGH** (SEC-002)

---

## 2. SQL Injection

**Risico:** ✅ LOW — SEC-003

Alle database interacties verlopen via de Supabase JS client die parameterized queries gebruikt. De `create_booking` functie ontvangt parameters als typed PL/pgSQL parameters, niet als string concatenatie.

De email function gebruikt ook `supabase.from('...').select('*').eq('id', bookingId)` — geparameteriseerd.

**Geen SQL injection risico gevonden.**

---

## 3. XSS (Cross-Site Scripting)

### 3.1 React componenten
**Risico:** ✅ LOW — SEC-004

React escaped standaard alle string interpolatie in JSX. Nergens wordt `dangerouslySetInnerHTML` gebruikt. Gebruikersinput (naam, email, telefoon) wordt veilig gerenderd.

### 3.2 Email templates
**Risico:** ⚠️ MEDIUM — SEC-005

Email templates gebruiken **string interpolatie** zonder escaping:
```typescript
html = confirmationTemplate({
  customerName: booking.customer_name,  // Niet ge-escaped!
  ...
});
```

In de template:
```html
<p>Beste ${data.customerName},</p>
```

Als een klant als naam invoert: `<script>alert('xss')</script>`, wordt dit onge-escaped in de HTML email geplaatst. De meeste email clients blokkeren scripts, maar er zijn mogelijkheden voor HTML injection (phishing links, misleidende content).

**Aanbeveling:** Voeg HTML entity escaping toe:
```typescript
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```
Pas toe op alle dynamische waarden in email templates.

---

## 4. Rate Limiting

**Risico:** ⚠️ MEDIUM — SEC-006

### Huidige implementatie
- `create_booking` functie: max 5 boekingen per email per uur
- Honeypot op het formulier (client-side only)

### Zwaktes

1. **Rate limit per email:** Een aanvaller kan eindeloos variëren met email adressen (`a1@test.com`, `a2@test.com`, ...) om de rate limit te omzeilen.
2. **Geen IP-based rate limiting:** De database kent geen IP-adressen.
3. **Geen rate limit op de email function:** De `send-email` endpoint kan herhaaldelijk aangeroepen worden met willekeurige bookingIds.

**Aanbeveling:**
- Voeg Netlify/Cloudflare rate limiting toe op IP-niveau
- Overweeg captcha (reCAPTCHA v3) voor het boekingsformulier
- Voeg rate limiting toe aan de email function (bijv. max 10 calls per minuut per IP via Netlify Edge Functions)

---

## 5. Email Function Authenticatie

**Risico:** ⚠️ HIGH — SEC-007

### Huidige implementatie
```typescript
const secret = event.headers['x-email-secret'] || event.headers['X-Email-Secret'];
if (process.env.EMAIL_SECRET && secret !== process.env.EMAIL_SECRET) {
  console.warn('Email function called without valid secret');
  // MAAR: de functie GAAT GEWOON DOOR!
}
```

De secret check **logt alleen een warning** maar blokkeert het request niet! Dit betekent:

1. **Iedereen** kan `POST /.netlify/functions/send-email` aanroepen
2. Met een willekeurige `bookingId` (die ze kunnen raden of enumereren)
3. En herhaaldelijk emails laten versturen naar klanten (spam)
4. Of emails laten sturen over annuleringen die niet plaatsvonden

**Impact:** Spam-mogelijkheid, reputatieschade voor salons, verwarring bij klanten.

**Aanbeveling:** Blokkeer het request als het secret niet klopt:
```typescript
if (!secret || secret !== process.env.EMAIL_SECRET) {
  return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
}
```
En zorg dat het widget en admin dashboard dit secret meesturen. Of gebruik een andere authenticatie (bijv. Supabase JWT verificatie).

---

## 6. CORS

**Risico:** ✅ INFO — SEC-008

### Widget bestanden
`widget.js`, `widget.css`, en `embed.js` hebben `Access-Control-Allow-Origin: *` in `netlify.toml`. Dit is **correct** — deze bestanden moeten op elke salon-website geladen kunnen worden.

### Supabase
Supabase configureert CORS op project-niveau. Met de anon key kan elke website queries uitvoeren. Dit is inherent aan het Supabase client-model en wordt gemitigeerd door RLS policies.

### Netlify Functions
Geen expliciete CORS headers op `send-email`. Browsers blokkeren dit (same-origin policy), maar server-side requests (curl, bots) omzeilen dit. **Niet relevant** aangezien de functie sowieso onbeschermd is (zie SEC-007).

---

## 7. Auth — Admin Login

**Risico:** ✅ LOW — SEC-009

| Check | Status |
|-------|--------|
| Supabase Auth (bcrypt) | ✅ Veilig |
| Session in JWT (localStorage) | ✅ Standaard Supabase |
| Auto-refresh tokens | ✅ Via `onAuthStateChange` |
| ProtectedRoute check | ✅ Redirect naar login |
| CSRF | ✅ N.v.t. — geen server-side sessions, JWT-based |
| Brute force | ⚠️ Supabase heeft ingebouwde rate limiting op auth endpoints |

**Opmerking:** Er is geen "wachtwoord vergeten" functionaliteit. Dit is acceptabel voor MVP (handmatige reset).

---

## 8. Data Exposure via Anon Key

**Risico:** 🔴 HIGH — (zie SEC-002)

Via de anon key kan een anonieme gebruiker:

| Query | Data geëxposeerd | Risico |
|-------|-------------------|--------|
| `from('salons').select('*')` | Alle salons, emails, telefoon, owner_ids | MEDIUM |
| `from('bookings').select('*').eq('status','confirmed')` | **Klantnamen, emails, telefoonnummers** | **HIGH** |
| `from('staff_blocks').select('*')` | Vakanties/ziektedagen alle medewerkers | LOW |
| `from('staff_schedules').select('*')` | Werkroosters alle medewerkers | LOW |

**Kritiekste punt:** De `bookings` tabel lekt PII via de anon key. De `public_bookings` view was bedoeld om dit te voorkomen, maar de RLS policy op de onderliggende tabel staat SELECT toe.

---

## 9. Embed Script Security

**Risico:** ⚠️ MEDIUM — SEC-010

| Check | Status |
|-------|--------|
| SRI (Subresource Integrity) | ❌ Niet aanwezig |
| CSP (Content Security Policy) | ❌ Niet geconfigureerd |
| HTTPS only | ✅ Hardcoded `https://boeken.ensalabs.nl/` |
| Hijacking via CDN | ⚠️ Als Netlify account compromised wordt, kan widget.js vervangen worden |

**Aanbeveling:**
- Voeg SRI hash toe aan de embed instructies:
  ```html
  <script src="https://boeken.ensalabs.nl/embed.js" integrity="sha384-..." crossorigin="anonymous" data-salon="..."></script>
  ```
- Documenteer dit in de setup-instructies voor salons
- Overweeg versioning in de URL: `/v1/embed.js`

---

## 10. Input Validatie

### Client-side (CustomerForm)

| Veld | Validatie | Status |
|------|-----------|--------|
| Naam | `!name.trim()` (verplicht) | ⚠️ Geen max lengte |
| Email | Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` | ✅ Basis check |
| Telefoon | Regex: `/^[\d\s\-+()]{7,}$/` | ✅ Redelijk |

### Server-side (create_booking)

| Check | Status |
|-------|--------|
| Parameter types | ✅ PL/pgSQL typed parameters |
| Lege strings | ❌ Niet gecheckt — `p_name` kan `''` zijn |
| Max lengte | ❌ Niet gecheckt — geen `CHECK` constraints op text kolommen |
| Email format | ❌ Niet gecheckt server-side |

**SEC-011:** ⚠️ MEDIUM — Gebrek aan server-side validatie. Een directe RPC call kan lege of extreem lange strings invoegen.

**Aanbeveling:** Voeg CHECK constraints toe:
```sql
ALTER TABLE bookings ADD CONSTRAINT check_name CHECK (length(customer_name) BETWEEN 1 AND 200);
ALTER TABLE bookings ADD CONSTRAINT check_email CHECK (customer_email ~* '^[^@]+@[^@]+\.[^@]+$');
ALTER TABLE bookings ADD CONSTRAINT check_phone CHECK (length(customer_phone) BETWEEN 7 AND 30);
```

---

## Samenvattende Risicotabel

| ID | Bevinding | Risico | Prioriteit | Status |
|----|-----------|--------|------------|--------|
| SEC-002 | Klant-PII leesbaar via anon key (bookings tabel) | **HIGH** | Fix vóór launch | ✅ **FIXED** — RLS policy changed to `USING (false)`, view uses `security_barrier` |
| SEC-007 | Email function onbeschermd (secret niet afgedwongen) | **HIGH** | Fix vóór launch | ✅ **FIXED** — Returns 401 without valid secret. Widget uses server-side `create-booking` function; secret never exposed to client |
| SEC-005 | XSS/HTML injection in email templates | **MEDIUM** | Fix vóór launch | ✅ **FIXED** — `escapeHtml()` applied to all dynamic values in templates |
| SEC-006 | Rate limiting te omzeilen (email variatie) | **MEDIUM** | Fix voor launch | ✅ **MITIGATED** — IP-based rate limiting added in `create-booking` Netlify Function + server-side honeypot check |
| SEC-010 | Geen SRI op embed script | **MEDIUM** | Aanbevolen | ✅ **FIXED** — `npm run build:sri` generates hashes; documented in SETUP.md |
| SEC-011 | Geen server-side input validatie | **MEDIUM** | Fix vóór launch | ✅ **FIXED** — `create_booking` validates name length (2-200), email format, phone length (7-30) |
| SEC-001 | RLS te permissief (alle salons data leesbaar) | **MEDIUM** | Acceptabel voor MVP* | ⚠️ Acceptabel voor MVP |
| SEC-003 | SQL injection | **LOW** | Geen actie | ✅ N.v.t. |
| SEC-004 | XSS in React | **LOW** | Geen actie | ✅ N.v.t. |
| SEC-009 | Admin auth | **LOW** | Geen actie | ✅ N.v.t. |
| SEC-008 | CORS | **INFO** | Geen actie | ✅ N.v.t. |

*\* Acceptabel mits SEC-002 wordt opgelost — de overige tabellen bevatten geen PII.*

### Test Report Fixes

| ID | Bevinding | Status |
|----|-----------|--------|
| BUG-001 | Timezone conversie kan dag verschuiven | ✅ **FIXED** — Removed double `toZonedTime` conversion in `getAvailableSlots` |
| BUG-002 | useSlots onnodig re-fetchen door array referentie | ✅ **FIXED** — Stabilized staffList dependency via memoized ID string |
| BUG-007 | Meerdere widgets op 1 pagina conflicteren | ✅ **FIXED** — Unique container IDs generated per widget instance |
| BUG-008 | Honeypot alleen client-side | ✅ **FIXED** — Honeypot value passed to server-side `create_booking` function |

---

## Aanbevolen Acties (Prioriteit)

### Must Fix (vóór productie)

1. **SEC-002:** Verwijder publieke SELECT op `bookings` tabel. Gebruik alleen `public_bookings` view. Pas RLS aan:
   ```sql
   DROP POLICY "bookings_select_public" ON bookings;
   CREATE POLICY "bookings_select_public" ON bookings FOR SELECT USING (false);
   -- Geef anon alleen toegang tot de view
   GRANT SELECT ON public_bookings TO anon;
   ```

2. **SEC-007:** Maak email secret verplicht:
   ```typescript
   if (secret !== process.env.EMAIL_SECRET) {
     return { statusCode: 401, body: 'Unauthorized' };
   }
   ```
   En stuur het secret mee vanuit widget/admin via environment variable.

3. **SEC-005:** Escape HTML in email templates.

4. **SEC-011:** Voeg database CHECK constraints toe voor input lengte/format.

### Should Fix (voor launch of kort erna)

5. **SEC-006:** Implementeer IP-based rate limiting via Netlify Edge/Cloudflare.
6. **SEC-010:** Voeg SRI toe aan embed instructies.
7. **SEC-001:** Overweeg salon_id filtering in RLS voor staff/schedules/blocks.

---

*Einde security audit rapport.*
