# Testrapport — Boekingssysteem MVP

**Datum:** 10 februari 2026  
**Auditor:** QA Engineer / Security Auditor  
**Scope:** Volledige code review van het boekingssysteem

---

## 1. FASE 1: CODE REVIEW

### 1.1 Ontwerp vs. Implementatie

| Onderdeel | Status | Opmerkingen |
|-----------|--------|-------------|
| Database schema | ✅ Compleet | Alle tabellen conform DESIGN.md |
| RLS policies | ✅ Compleet | Alle policies aanwezig |
| Booking function (create_booking) | ✅ Compleet | Race condition + rate limiting aanwezig |
| Public bookings view | ✅ Compleet | Beperkt tot staff_id, start_at, end_at — geen id kolom |
| Widget componenten | ✅ Compleet | Alle 8 componenten aanwezig |
| Admin componenten | ✅ Compleet | Alle 12 componenten + 8 pagina's |
| UI componenten | ✅ Compleet | Button, Input, Modal, Spinner, Toast, ErrorBanner |
| Hooks | ✅ Compleet | useAuth, useSalon, useServices, useStaff, useBookings, useSlots |
| Email function | ✅ Compleet | 3 templates: confirmation, notification, cancellation |
| Embed script | ✅ Compleet | Container + CSS vars + widget laden |
| Theming (CSS vars) | ✅ Compleet | dds- prefix consistent |
| Slotberekening | ✅ Compleet | Met timezone support |

**Conclusie:** De implementatie komt volledig overeen met het ontwerp. Alle componenten uit DESIGN.md §13 zijn aanwezig.

---

### 1.2 TypeScript & Logische Fouten

#### ⚠️ BUG-001: `useSlots` berekent dag verkeerd bij timezone conversie

In `slots.ts`, `getAvailableSlots()`:
```typescript
const targetDate = toZonedTime(date, timezone);
const dow = getDayOfWeek(targetDate);
```
De `date` parameter wordt als `Date` doorgegeven vanuit `useSlots`. In `useSlots` wordt `date` doorgegeven vanuit de kalender (een lokale datum). De `toZonedTime` roept verwarring op: als `date` al een lokale datum is (bijv. geselecteerd in CalendarGrid), dan is de extra conversie naar zoned time onnodig en kan het zelfs de dag verschuiven rond middernacht UTC. 

**Risico:** MEDIUM — Kan verkeerde dag-van-week tonen bij bepaalde timezones.

#### ⚠️ BUG-002: `useSlots` dependency array incompleet

```typescript
const fetch = useCallback(async () => { ... }, [date, durationMin, staffList, selectedStaffId, timezone]);
```
`staffList` is een array — React vergelijkt deze referentieel. Elke re-render van de parent (BookingWidget) creëert een nieuwe `staffList` array referentie, waardoor `useSlots` onnodig opnieuw fetcht. 

**Risico:** LOW — Performance issue, geen functionele fout.

#### ⚠️ BUG-003: `public_bookings` view mist `id` kolom

De view `public_bookings` bevat geen `id`. De `PublicBooking` type in `types.ts` bevat ook geen `id`. Dit is correct en gewenst (privacy). **Geen bug, maar bevestiging.**

#### ⚠️ BUG-004: `useBookings` dependency op `dateRange` object

```typescript
}, [salonId, dateRange?.start, dateRange?.end]);
```
Dit is correct — de individuele string properties worden vergeleken, niet het object. **Geen bug.**

#### ⚠️ BUG-005: Admin `useServices` haalt ook inactieve services op

In `useServices.ts`:
```typescript
const { data } = await supabase.from('services').select('*').eq('salon_id', salonId).order('sort_order');
```
Geen `.eq('is_active', true)` filter. Dit is **correct** voor admin (die wil alle services zien), maar de RLS policy `services_select_public` filtert op `is_active = true` voor anonieme gebruikers. 

**Potentieel probleem:** De `services_all_owner` policy gebruikt `FOR ALL` — dit overschrijft de `services_select_public` voor eigenaren, waardoor eigenaren ook inactieve services zien. **Correct gedrag.**

#### ⚠️ BUG-006: Widget `BookingWidget` — "Geen voorkeur" logica

Bij "Geen voorkeur" (staffId = null), wordt `staffConfirmed` op `true` gezet en `selectedStaffId` op `null`. In `useSlots`:
```typescript
staffConfirmed ? selectedStaffId : null
```
Dit geeft `null` door aan `useSlots`, wat correct is — `getAvailableSlots` behandelt `null` als "alle medewerkers".

Na boeking: `selectedSlot.staffId` bevat de toegewezen medewerker. **Correct.**

---

### 1.3 Slotberekening — Edge Cases

| Edge Case | Afhandeling | Status |
|-----------|-------------|--------|
| Middernacht crossing (werkdag 22:00-02:00) | ❌ Niet ondersteund | `workEnd` wordt op dezelfde dag gezet als `workStart`. Een `end_time` van `02:00` zou vóór `09:00` vallen → 0 slots. **DESIGN BEPERKING** — niet een bug want het ontwerp specificeert geen nachtdiensten. |
| Lege roosters (geen schedule rij) | ✅ Correct | `schedule === undefined` → return `[]` |
| Overlappende blokkades | ✅ Correct | Elke slot wordt gecheckt tegen alle blokkades via `overlaps()` |
| Blokkade midden in slot | ✅ Correct | `overlaps()` checkt `slotStart < block.end && slotEnd > block.start` |
| Slots in het verleden | ✅ Correct | `isAfter(utcSlotStart, now)` filtert verlopen slots |
| Service langer dan werkdag | ✅ Correct | `addMinutes(cursor, durationMin) > workEnd` → while-loop stopt direct → 0 slots |

---

### 1.4 Widget CSS

| Check | Status |
|-------|--------|
| Alle classes dds- prefix | ✅ Consistent |
| CSS custom properties | ✅ Alle --dds- prefixed |
| Honeypot verborgen | ✅ `.dds-form-hp { position: absolute; left: -9999px; }` |
| Responsive design | ✅ Grid met auto-fill/minmax |
| Animaties | ✅ Alle dds- prefixed keyframes |
| Host site conflicten | ⚠️ Geen Shadow DOM gebruikt (ontwerp noemt dit als optie). CSS classes zijn geprefixt, wat voldoende is voor MVP. |

---

### 1.5 Embed Script

| Check | Status |
|-------|--------|
| `document.currentScript` | ✅ Correct |
| data-salon validatie | ✅ Console error bij ontbreken |
| CSS vars doorsturen | ✅ 5 properties |
| Widget.js + widget.css laden | ✅ Beide geladen |
| Meerdere widgets op één pagina | ❌ Bug — `container.id = 'dds-booking-widget'` is hardcoded. Bij meerdere embeds krijgen alle containers hetzelfde ID. |

**BUG-007:** Meerdere widgets op dezelfde pagina conflicteren door hardcoded ID. **Risico: LOW** — MVP ondersteunt waarschijnlijk maar 1 widget per pagina.

---

### 1.6 Email Templates

| Template | Status | Opmerkingen |
|----------|--------|-------------|
| Bevestiging klant | ✅ Compleet | Alle velden uit ontwerp aanwezig |
| Notificatie salon | ✅ Compleet | Inclusief dashboard link |
| Annulering klant | ✅ Compleet | Contactinfo salon vermeld |

---

### 1.7 Honeypot

| Check | Status |
|-------|--------|
| Verborgen veld aanwezig | ✅ `dds-form-hp` class |
| CSS verberging | ✅ `position: absolute; left: -9999px; opacity: 0; height: 0; overflow: hidden` |
| `aria-hidden="true"` | ✅ Aanwezig |
| `tabIndex={-1}` | ✅ Voorkomt tab-focus |
| `autoComplete="off"` | ✅ Voorkomt browser autofill |
| Server-side check | ❌ Ontbreekt — honeypot wordt alleen client-side gecheckt in `handleSubmit`. De `create_booking` RPC stuurt geen honeypot veld mee. |

**BUG-008:** Honeypot is puur client-side. Een bot die direct de Supabase RPC aanroept omzeilt de honeypot volledig. **Risico: MEDIUM** — Rate limiting in create_booking biedt nog enige bescherming.

---

## 2. FASE 3: EDGE CASES

### 2.1 Boeking op dag waar medewerker niet werkt

**Afhandeling:** ✅ CORRECT  
`calculateSlotsForStaff()` checkt `if (!schedule || !schedule.is_working) return []`. Geen slots worden getoond.

### 2.2 Twee klanten boeken exact hetzelfde slot tegelijk

**Afhandeling:** ✅ CORRECT  
`create_booking()` SQL functie gebruikt `pg_advisory_xact_lock(hashtext(p_staff_id::text))` — atomic lock per medewerker. Tweede boeking krijgt `SLOT_TAKEN` exception. Widget vangt dit op en toont "Dit tijdslot is zojuist geboekt."

### 2.3 Medewerker met geen rooster ingesteld

**Afhandeling:** ✅ CORRECT  
Geen `staff_schedules` rijen → `schedule = undefined` → return `[]` → geen slots.

### 2.4 Service langer dan werkdag

**Afhandeling:** ✅ CORRECT  
While-loop conditie: `!isAfter(addMinutes(cursor, durationMin), workEnd)`. Als `durationMin > (workEnd - workStart)`, begint de loop nooit → leeg resultaat.

### 2.5 Blokkade midden in potentieel slot

**Afhandeling:** ✅ CORRECT  
De `overlaps()` functie checkt bidirectionele overlap. Een blokkade van 10:30-11:00 blokkeert correct slots als 10:00 (bij 60 min duur) en 10:15, 10:30, 10:45, maar niet 11:00.

### 2.6 "Geen voorkeur" wanneer alle medewerkers vol zitten

**Afhandeling:** ✅ CORRECT  
`getAvailableSlots()` itereert alle medewerkers. Als elke medewerker `[]` retourneert, is `allSlots` Map leeg → widget toont "Geen beschikbare tijden op deze dag."

### 2.7 Salon zonder medewerkers of diensten

**Afhandeling:** ✅ CORRECT  
`BookingWidget` checkt `if (!services.length || !staff.length)` → toont "Er zijn momenteel geen diensten beschikbaar".

### 2.8 Ongeldige salon slug in embed script

**Afhandeling:** ✅ CORRECT  
Supabase query met `.single()` retourneert error → `setError('Dit boekingssysteem is niet beschikbaar')`.

---

## 3. SAMENVATTING BEVINDINGEN

| ID | Beschrijving | Ernst | Type |
|----|-------------|-------|------|
| BUG-001 | Timezone conversie kan dag verschuiven | MEDIUM | Logica |
| BUG-002 | useSlots onnodig re-fetchen door array referentie | LOW | Performance |
| BUG-007 | Meerdere widgets op 1 pagina conflicteren | LOW | Functioneel |
| BUG-008 | Honeypot alleen client-side | MEDIUM | Anti-spam |

**Totaal:** 0 CRITICAL, 0 HIGH, 2 MEDIUM, 2 LOW

De code is over het algemeen van goede kwaliteit, goed gestructureerd en volgt het ontwerp nauwkeurig. De slotberekening is robuust met correcte overlap-detectie en race condition preventie.
