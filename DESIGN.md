# Technisch Ontwerpdocument — Boekingssysteem MVP

**Project:** De Digitale Stylist — Salonboekingssysteem  
**Versie:** 1.0 MVP  
**Datum:** 10 februari 2026  
**Auteur:** Zyro (Senior Technisch Architect)  
**Domein:** `boeken.ensalabs.nl`

---

## Inhoudsopgave

1. [Systeemoverzicht](#1-systeemoverzicht)
2. [Database Schema](#2-database-schema)
3. [Supabase RLS Policies](#3-supabase-rls-policies)
4. [API Endpoints & Queries](#4-api-endpoints--queries)
5. [Slotberekening Algoritme](#5-slotberekening-algoritme)
6. [Component Structuur](#6-component-structuur)
7. [Admin Dashboard](#7-admin-dashboard)
8. [Embed Script Werking](#8-embed-script-werking)
9. [Theming Systeem](#9-theming-systeem)
10. [Email Templates](#10-email-templates)
11. [Auth Model](#11-auth-model)
12. [Error Handling](#12-error-handling)
13. [Mappenstructuur](#13-mappenstructuur)
14. [Toekomstige Uitbreidingen](#14-toekomstige-uitbreidingen)

---

## 1. Systeemoverzicht

### Architectuurdiagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SALON WEBSITES                           │
│  salon-a.nl    salon-b.nl    salon-c.nl    ...                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ <script>  │  │ <script>  │  │ <script>  │                     │
│  │ embed.js  │  │ embed.js  │  │ embed.js  │                     │
│  │ data-salon│  │ data-salon│  │ data-salon│                     │
│  │ ="salon-a"│  │ ="salon-b"│  │ ="salon-c"│                     │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                    │
│        │               │               │                         │
└────────┼───────────────┼───────────────┼─────────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   boeken.ensalabs.nl (Netlify)                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐      │
│  │              React + Vite + TypeScript                 │      │
│  │                                                       │      │
│  │  ┌─────────────────┐    ┌──────────────────────┐      │      │
│  │  │  Booking Widget  │    │   Admin Dashboard    │      │      │
│  │  │  (embed target)  │    │  /admin/*            │      │      │
│  │  └────────┬─────────┘    └──────────┬───────────┘      │      │
│  │           │                         │                  │      │
│  └───────────┼─────────────────────────┼──────────────────┘      │
│              │                         │                         │
│  ┌───────────┼─────────────────────────┼──────────────────┐      │
│  │           ▼                         ▼                  │      │
│  │              Supabase JS Client                        │      │
│  └───────────────────────┬────────────────────────────────┘      │
│                          │                                       │
│  ┌───────────────────────┼────────────────────────────────┐      │
│  │     Netlify Functions │ (serverless)                   │      │
│  │  ┌────────────────────┴───────────┐                    │      │
│  │  │  /api/send-email               │                    │      │
│  │  │  (nodemailer → SMTP)           │                    │      │
│  │  └────────────────────────────────┘                    │      │
│  └────────────────────────────────────────────────────────┘      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase Cloud                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────┐  ┌─────────────────────┐       │
│  │  PostgreSQL   │  │   Auth   │  │  Storage (foto's)   │       │
│  │  + RLS        │  │          │  │                     │       │
│  └──────────────┘  └──────────┘  └─────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    mail.ensalabs.nl (SMTP)                       │
│           afzender: "Salonnaam <boekingen@ensalabs.nl>"          │
└─────────────────────────────────────────────────────────────────┘
```

### Dataflow klantboeking

```
Klant kiest dienst → kiest medewerker → kiest datum/slot
    │
    ▼
Supabase: INSERT booking (status='confirmed')
    │
    ├──▶ Netlify Function: email naar klant (bevestiging)
    └──▶ Netlify Function: email naar salon (notificatie)
```

---

## 2. Database Schema

### Tabel: `salons`

| Kolom | Type | Constraints | Beschrijving |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | |
| `slug` | `text` | UNIQUE, NOT NULL | URL-slug, bijv. `salon-bella` |
| `name` | `text` | NOT NULL | Weergavenaam |
| `email` | `text` | NOT NULL | Contactemail salon |
| `phone` | `text` | | Telefoonnummer |
| `owner_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | Eigenaar account |
| `timezone` | `text` | NOT NULL, DEFAULT `'Europe/Amsterdam'` | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:** `idx_salons_slug` ON `slug`, `idx_salons_owner` ON `owner_id`

---

### Tabel: `staff`

| Kolom | Type | Constraints | Beschrijving |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | |
| `salon_id` | `uuid` | FK → `salons(id)` ON DELETE CASCADE, NOT NULL | |
| `name` | `text` | NOT NULL | |
| `photo_url` | `text` | | Supabase Storage URL |
| `is_active` | `boolean` | DEFAULT `true` | Soft delete |
| `sort_order` | `integer` | DEFAULT `0` | Volgorde in widget |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:** `idx_staff_salon` ON `salon_id`

---

### Tabel: `staff_schedules`

Weekrooster per medewerker. Eén rij per dag.

| Kolom | Type | Constraints | Beschrijving |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | |
| `staff_id` | `uuid` | FK → `staff(id)` ON DELETE CASCADE, NOT NULL | |
| `day_of_week` | `smallint` | NOT NULL, CHECK `0-6` | 0=maandag, 6=zondag |
| `start_time` | `time` | NOT NULL | Bijv. `09:00` |
| `end_time` | `time` | NOT NULL | Bijv. `17:00` |
| `is_working` | `boolean` | DEFAULT `true` | Vrije dag = false |

**Indexes:** `idx_schedule_staff` ON `staff_id`  
**Unique:** `(staff_id, day_of_week)`

---

### Tabel: `staff_blocks`

Blokkades (vakantie, ziekte, pauze).

| Kolom | Type | Constraints | Beschrijving |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | |
| `staff_id` | `uuid` | FK → `staff(id)` ON DELETE CASCADE, NOT NULL | |
| `start_at` | `timestamptz` | NOT NULL | |
| `end_at` | `timestamptz` | NOT NULL | |
| `reason` | `text` | | Optionele notitie |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:** `idx_blocks_staff_time` ON `(staff_id, start_at, end_at)`

---

### Tabel: `services`

| Kolom | Type | Constraints | Beschrijving |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | |
| `salon_id` | `uuid` | FK → `salons(id)` ON DELETE CASCADE, NOT NULL | |
| `name` | `text` | NOT NULL | Bijv. "Knippen dames" |
| `duration_min` | `integer` | NOT NULL, CHECK `> 0` | Duur in minuten |
| `price_cents` | `integer` | NOT NULL, CHECK `>= 0` | Prijs in centen |
| `is_active` | `boolean` | DEFAULT `true` | |
| `sort_order` | `integer` | DEFAULT `0` | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:** `idx_services_salon` ON `salon_id`

---

### Tabel: `bookings`

| Kolom | Type | Constraints | Beschrijving |
|-------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `gen_random_uuid()` | |
| `salon_id` | `uuid` | FK → `salons(id)`, NOT NULL | |
| `service_id` | `uuid` | FK → `services(id)`, NOT NULL | |
| `staff_id` | `uuid` | FK → `staff(id)`, NOT NULL | Altijd ingevuld (ook bij "geen voorkeur") |
| `start_at` | `timestamptz` | NOT NULL | |
| `end_at` | `timestamptz` | NOT NULL | `start_at + duration` |
| `customer_name` | `text` | NOT NULL | |
| `customer_email` | `text` | NOT NULL | |
| `customer_phone` | `text` | NOT NULL | |
| `status` | `text` | NOT NULL, DEFAULT `'confirmed'`, CHECK IN (`'confirmed'`, `'cancelled'`) | |
| `cancelled_at` | `timestamptz` | | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:**
- `idx_bookings_salon_date` ON `(salon_id, start_at)`
- `idx_bookings_staff_date` ON `(staff_id, start_at, end_at)` WHERE `status = 'confirmed'`
- `idx_bookings_customer_email` ON `(salon_id, customer_email)`

---

### ER Diagram (compact)

```
salons 1──* staff 1──* staff_schedules
  │           │──* staff_blocks
  │──* services
  │──* bookings *──1 staff
              *──1 services
```

---

## 3. Supabase RLS Policies

### Uitgangspunt

- **Anonieme gebruikers** (widget-bezoekers): kunnen alleen lezen wat nodig is voor de boekingsflow + INSERT van bookings.
- **Authenticated salon-eigenaar**: volledige CRUD op eigen salon-data.

### `salons`

```sql
-- Iedereen mag salons lezen (nodig voor widget)
CREATE POLICY "salons_select_public" ON salons
  FOR SELECT USING (true);

-- Alleen eigenaar mag updaten
CREATE POLICY "salons_update_owner" ON salons
  FOR UPDATE USING (auth.uid() = owner_id);
```

### `services`

```sql
-- Publiek: actieve services van een salon lezen
CREATE POLICY "services_select_public" ON services
  FOR SELECT USING (is_active = true);

-- Eigenaar: volledige CRUD
CREATE POLICY "services_all_owner" ON services
  FOR ALL USING (
    salon_id IN (SELECT id FROM salons WHERE owner_id = auth.uid())
  );
```

### `staff`

```sql
-- Publiek: actieve medewerkers lezen
CREATE POLICY "staff_select_public" ON staff
  FOR SELECT USING (is_active = true);

-- Eigenaar: volledige CRUD
CREATE POLICY "staff_all_owner" ON staff
  FOR ALL USING (
    salon_id IN (SELECT id FROM salons WHERE owner_id = auth.uid())
  );
```

### `staff_schedules`

```sql
-- Publiek: lezen (nodig voor slotberekening)
CREATE POLICY "schedules_select_public" ON staff_schedules
  FOR SELECT USING (true);

-- Eigenaar: volledige CRUD
CREATE POLICY "schedules_all_owner" ON staff_schedules
  FOR ALL USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN salons sa ON sa.id = s.salon_id
      WHERE sa.owner_id = auth.uid()
    )
  );
```

### `staff_blocks`

```sql
-- Publiek: lezen (nodig voor slotberekening)
CREATE POLICY "blocks_select_public" ON staff_blocks
  FOR SELECT USING (true);

-- Eigenaar: volledige CRUD
CREATE POLICY "blocks_all_owner" ON staff_blocks
  FOR ALL USING (
    staff_id IN (
      SELECT s.id FROM staff s
      JOIN salons sa ON sa.id = s.salon_id
      WHERE sa.owner_id = auth.uid()
    )
  );
```

### `bookings`

```sql
-- Publiek: alleen SELECT van confirmed bookings (start_at, end_at, staff_id)
-- Gevoelige klantdata NIET blootgesteld — gebruik een VIEW
CREATE POLICY "bookings_select_public" ON bookings
  FOR SELECT USING (status = 'confirmed');

-- Publiek: INSERT (nieuwe boeking maken)
CREATE POLICY "bookings_insert_public" ON bookings
  FOR INSERT WITH CHECK (true);

-- Eigenaar: alles lezen + updaten (annuleren)
CREATE POLICY "bookings_all_owner" ON bookings
  FOR ALL USING (
    salon_id IN (SELECT id FROM salons WHERE owner_id = auth.uid())
  );
```

### View voor publieke booking data

```sql
CREATE VIEW public_bookings AS
  SELECT id, salon_id, staff_id, start_at, end_at
  FROM bookings
  WHERE status = 'confirmed';
```

De widget gebruikt deze view voor slotberekening, zodat klantgegevens nooit naar de client gaan.

---

## 4. API Endpoints & Queries

### Widget (Supabase Client — anon key)

| Actie | Query |
|-------|-------|
| Salon ophalen | `supabase.from('salons').select('*').eq('slug', slug).single()` |
| Services laden | `supabase.from('services').select('*').eq('salon_id', salonId).eq('is_active', true).order('sort_order')` |
| Medewerkers laden | `supabase.from('staff').select('*').eq('salon_id', salonId).eq('is_active', true).order('sort_order')` |
| Roosters laden | `supabase.from('staff_schedules').select('*').in('staff_id', staffIds)` |
| Blokkades laden (datum) | `supabase.from('staff_blocks').select('*').in('staff_id', staffIds).lte('start_at', dayEnd).gte('end_at', dayStart)` |
| Bestaande boekingen (datum) | `supabase.from('public_bookings').select('*').in('staff_id', staffIds).gte('start_at', dayStart).lt('start_at', dayEnd)` |
| Boeking aanmaken | `supabase.from('bookings').insert({...}).select().single()` |

### Netlify Functions

#### `POST /.netlify/functions/send-email`

**Body:**
```json
{
  "type": "confirmation" | "notification" | "cancellation",
  "bookingId": "uuid",
  "salonId": "uuid"
}
```

**Werking:**
1. Haalt booking + salon + service + staff data op via Supabase service role key
2. Rendert de juiste email template
3. Verstuurt via SMTP (`mail.ensalabs.nl`)
4. Retourneert `{ success: true }`

**Beveiliging:** Functie valideert dat de booking bestaat. Gebruikt Supabase service role key (server-side only). Optioneel: een shared secret header.

---

## 5. Slotberekening Algoritme

```pseudocode
function getAvailableSlots(date, serviceId, staffId?, salonId):
    service = getService(serviceId)
    duration = service.duration_min

    if staffId == null:  // "geen voorkeur"
        allStaff = getActiveStaff(salonId)
        allSlots = {}
        for each staff in allStaff:
            slots = calculateSlotsForStaff(staff, date, duration)
            for each slot in slots:
                if slot.time NOT IN allSlots:
                    allSlots[slot.time] = staff.id  // wijs eerste beschikbare toe
        return allSlots  // { time → staffId }
    else:
        staff = getStaff(staffId)
        return calculateSlotsForStaff(staff, date, duration)

function calculateSlotsForStaff(staff, date, durationMin):
    dayOfWeek = getDayOfWeek(date)  // 0=ma, 6=zo
    schedule = getSchedule(staff.id, dayOfWeek)

    if schedule == null OR schedule.is_working == false:
        return []

    workStart = schedule.start_time  // bijv. 09:00
    workEnd   = schedule.end_time    // bijv. 17:00

    // Haal blokkades op die overlappen met deze dag
    blocks = getBlocks(staff.id, date)

    // Haal bestaande confirmed boekingen op voor deze dag
    bookings = getConfirmedBookings(staff.id, date)

    // Combineer tot lijst van bezette intervallen
    occupied = merge(
        blocks.map(b => { start: b.start_at, end: b.end_at }),
        bookings.map(b => { start: b.start_at, end: b.end_at })
    )

    // Genereer slots in stappen van 15 minuten
    slots = []
    cursor = workStart

    while cursor + durationMin <= workEnd:
        slotStart = cursor
        slotEnd   = cursor + durationMin

        // Check of dit slot overlapt met een bezet interval
        hasConflict = occupied.any(o =>
            slotStart < o.end AND slotEnd > o.start
        )

        if NOT hasConflict:
            slots.append({ time: slotStart, staffId: staff.id })

        cursor += 15 minutes

    return slots
```

### Belangrijk: race conditions

Bij het INSERT van een booking wordt een database-functie aangeroepen die **atomair** checkt of het slot nog vrij is:

```sql
CREATE OR REPLACE FUNCTION create_booking(
  p_salon_id uuid, p_service_id uuid, p_staff_id uuid,
  p_start_at timestamptz, p_end_at timestamptz,
  p_name text, p_email text, p_phone text
) RETURNS uuid AS $$
DECLARE
  v_conflict_count integer;
  v_booking_id uuid;
BEGIN
  -- Lock: voorkom concurrent inserts voor dezelfde medewerker
  PERFORM pg_advisory_xact_lock(hashtext(p_staff_id::text));

  SELECT count(*) INTO v_conflict_count
  FROM bookings
  WHERE staff_id = p_staff_id
    AND status = 'confirmed'
    AND start_at < p_end_at
    AND end_at > p_start_at;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'SLOT_TAKEN';
  END IF;

  INSERT INTO bookings (salon_id, service_id, staff_id, start_at, end_at,
    customer_name, customer_email, customer_phone)
  VALUES (p_salon_id, p_service_id, p_staff_id, p_start_at, p_end_at,
    p_name, p_email, p_phone)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;
```

Aangeroepen via: `supabase.rpc('create_booking', { ... })`

---

## 6. Component Structuur

### Widget (booking flow)

```
<BookingWidget salon={slug}>
  ├── <ThemeProvider variables={dataAttributes}>
  │
  ├── <StepIndicator currentStep={1..4} />
  │
  ├── <ServicePicker>                    // Stap 1
  │     └── <ServiceCard name duration price />
  │
  ├── <StaffPicker>                      // Stap 2
  │     ├── <StaffCard name photo />
  │     └── <NoPreferenceOption />
  │
  ├── <DateTimePicker>                   // Stap 3
  │     ├── <CalendarGrid />
  │     └── <TimeSlotList>
  │           └── <TimeSlot time />
  │
  ├── <CustomerForm>                     // Stap 4
  │     ├── <Input label="Naam" />
  │     ├── <Input label="Telefoon" />
  │     └── <Input label="E-mail" />
  │
  └── <Confirmation>                     // Stap 5 (bevestiging)
        ├── <BookingSummary />
        └── <SuccessMessage />
```

### Shared / UI

```
<Button />
<Input />
<Spinner />
<ErrorBanner />
<Modal />
```

---

## 7. Admin Dashboard

**URL:** `boeken.ensalabs.nl/admin`

### Pagina's

| Route | Pagina | Functionaliteit |
|-------|--------|-----------------|
| `/admin/login` | Login | Email + wachtwoord via Supabase Auth |
| `/admin` | Dashboard | Overzicht van vandaag: boekingen, omzet |
| `/admin/bookings` | Boekingen | Dag/week weergave, lijst met boekingen, annuleerknop |
| `/admin/services` | Diensten | CRUD tabel: naam, duur, prijs, actief toggle |
| `/admin/staff` | Medewerkers | Lijst, toevoegen/bewerken, foto uploaden |
| `/admin/staff/:id/schedule` | Rooster | Weekrooster instellen per dag |
| `/admin/staff/:id/blocks` | Blokkades | Blokkades toevoegen/verwijderen |
| `/admin/settings` | Instellingen | Salonnaam, email, telefoon wijzigen |

### Component structuur admin

```
<AdminLayout>
  ├── <Sidebar>
  │     ├── <NavItem to="/admin" icon="dashboard" />
  │     ├── <NavItem to="/admin/bookings" icon="calendar" />
  │     ├── <NavItem to="/admin/services" icon="scissors" />
  │     ├── <NavItem to="/admin/staff" icon="users" />
  │     └── <NavItem to="/admin/settings" icon="settings" />
  │
  ├── <Header>
  │     ├── <SalonName />
  │     └── <LogoutButton />
  │
  └── <Outlet />   // React Router
        ├── <DashboardPage />
        ├── <BookingsPage>
        │     ├── <DateNavigator />
        │     ├── <ViewToggle day|week />
        │     └── <BookingList>
        │           └── <BookingRow onCancel />
        ├── <ServicesPage>
        │     ├── <ServiceTable />
        │     └── <ServiceFormModal />
        ├── <StaffPage>
        │     ├── <StaffList />
        │     └── <StaffFormModal />
        ├── <SchedulePage staffId />
        │     └── <WeekScheduleEditor />
        ├── <BlocksPage staffId />
        │     ├── <BlockList />
        │     └── <AddBlockModal />
        └── <SettingsPage />
```

---

## 8. Embed Script Werking

### `embed.js`

```javascript
(function() {
  // 1. Vind het huidige script-element
  const script = document.currentScript;
  const salon = script.getAttribute('data-salon');

  // 2. Maak container
  const container = document.createElement('div');
  container.id = 'dds-booking-widget';
  script.parentNode.insertBefore(container, script.nextSibling);

  // 3. Zet CSS custom properties op container
  const props = {
    '--dds-color-primary': script.getAttribute('data-color-primary') || '#8B5CF6',
    '--dds-color-bg':      script.getAttribute('data-color-bg')      || '#FFFFFF',
    '--dds-color-text':    script.getAttribute('data-color-text')    || '#1F2937',
    '--dds-font':          script.getAttribute('data-font')          || 'system-ui, sans-serif',
    '--dds-radius':        (script.getAttribute('data-radius') || '8') + 'px',
  };
  Object.entries(props).forEach(([k, v]) => container.style.setProperty(k, v));

  // 4. Laad de widget bundle
  const widgetScript = document.createElement('script');
  widgetScript.src = 'https://boeken.ensalabs.nl/widget.js';
  widgetScript.dataset.salon = salon;
  widgetScript.dataset.container = container.id;
  document.head.appendChild(widgetScript);

  // 5. Laad de widget CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://boeken.ensalabs.nl/widget.css';
  document.head.appendChild(link);
})();
```

### `widget.js` (Vite build output)

Separate Vite entry point die alleen de `<BookingWidget>` rendert in de container. Gebruikt Shadow DOM of scoped CSS om conflicten met de host-site te voorkomen.

```typescript
// src/widget-entry.tsx
import { createRoot } from 'react-dom/client';
import { BookingWidget } from './components/BookingWidget';

const script = document.querySelector('script[data-container]');
const container = document.getElementById(script!.dataset.container!);
const salon = script!.dataset.salon!;

const root = createRoot(container!);
root.render(<BookingWidget salonSlug={salon} />);
```

### Build configuratie

```typescript
// vite.config.ts — widget build
export default defineConfig({
  build: {
    lib: {
      entry: 'src/widget-entry.tsx',
      name: 'DDSWidget',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'widget.css',
      },
    },
  },
});
```

---

## 9. Theming Systeem

### CSS Custom Properties

```css
/* widget.css */
#dds-booking-widget {
  /* Defaults — overschreven door embed.js */
  --dds-color-primary: #8B5CF6;
  --dds-color-primary-hover: color-mix(in srgb, var(--dds-color-primary) 85%, black);
  --dds-color-primary-light: color-mix(in srgb, var(--dds-color-primary) 10%, white);
  --dds-color-bg: #FFFFFF;
  --dds-color-text: #1F2937;
  --dds-color-text-muted: color-mix(in srgb, var(--dds-color-text) 60%, transparent);
  --dds-color-border: color-mix(in srgb, var(--dds-color-text) 15%, transparent);
  --dds-font: system-ui, sans-serif;
  --dds-radius: 8px;
  --dds-radius-sm: calc(var(--dds-radius) * 0.5);
  --dds-radius-lg: calc(var(--dds-radius) * 1.5);

  font-family: var(--dds-font);
  color: var(--dds-color-text);
  background: var(--dds-color-bg);
}

/* Voorbeeld gebruik */
.dds-btn-primary {
  background: var(--dds-color-primary);
  color: white;
  border-radius: var(--dds-radius);
  font-family: var(--dds-font);
}

.dds-btn-primary:hover {
  background: var(--dds-color-primary-hover);
}

.dds-card {
  border: 1px solid var(--dds-color-border);
  border-radius: var(--dds-radius);
  padding: 1rem;
}

.dds-slot--selected {
  background: var(--dds-color-primary-light);
  border-color: var(--dds-color-primary);
}
```

### Alle classes prefixed met `dds-` om conflicten te voorkomen.

---

## 10. Email Templates

### 10.1 Bevestiging klant

**Onderwerp:** `Bevestiging: {service_name} bij {salon_name}`  
**Van:** `{salon_name} <boekingen@ensalabs.nl>`  
**Aan:** `{customer_email}`

```html
<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
  <h2 style="color: #8B5CF6;">Afspraak bevestigd ✓</h2>

  <p>Beste {customer_name},</p>

  <p>Je afspraak is bevestigd:</p>

  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; color: #666;">Dienst</td>
        <td style="padding: 8px 0;"><strong>{service_name}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Bij</td>
        <td style="padding: 8px 0;"><strong>{staff_name}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Datum</td>
        <td style="padding: 8px 0;"><strong>{date}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Tijd</td>
        <td style="padding: 8px 0;"><strong>{start_time} - {end_time}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Prijs</td>
        <td style="padding: 8px 0;"><strong>€{price}</strong></td></tr>
  </table>

  <p style="margin-top: 24px; color: #666; font-size: 14px;">
    Wil je annuleren? Neem contact op met {salon_name} via {salon_email}.
  </p>

  <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
  <p style="color: #999; font-size: 12px;">
    {salon_name} · Powered by De Digitale Stylist
  </p>
</div>
```

### 10.2 Notificatie salon

**Onderwerp:** `Nieuwe boeking: {customer_name} — {service_name}`  
**Van:** `Boekingssysteem <boekingen@ensalabs.nl>`  
**Aan:** `{salon_email}`

```html
<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
  <h2>Nieuwe boeking 📅</h2>

  <table style="width: 100%; border-collapse: collapse;">
    <tr><td style="padding: 8px 0; color: #666;">Klant</td>
        <td><strong>{customer_name}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Telefoon</td>
        <td><strong>{customer_phone}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Email</td>
        <td><strong>{customer_email}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Dienst</td>
        <td><strong>{service_name} ({duration} min)</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Medewerker</td>
        <td><strong>{staff_name}</strong></td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Datum/Tijd</td>
        <td><strong>{date}, {start_time} - {end_time}</strong></td></tr>
  </table>

  <p style="margin-top: 16px;">
    <a href="https://boeken.ensalabs.nl/admin/bookings" style="color: #8B5CF6;">
      Bekijk in dashboard →
    </a>
  </p>
</div>
```

### 10.3 Annulering

**Onderwerp:** `Afspraak geannuleerd: {date} {start_time}`  
**Van:** `{salon_name} <boekingen@ensalabs.nl>`  
**Aan:** `{customer_email}`

```html
<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
  <h2 style="color: #EF4444;">Afspraak geannuleerd</h2>

  <p>Beste {customer_name},</p>

  <p>Helaas is je afspraak op <strong>{date}</strong> om <strong>{start_time}</strong>
     voor <strong>{service_name}</strong> geannuleerd.</p>

  <p>Neem contact op met {salon_name} als je vragen hebt of een nieuwe afspraak wilt maken.</p>

  <hr style="margin: 24px 0; border: none; border-top: 1px solid #eee;" />
  <p style="color: #999; font-size: 12px;">
    {salon_name} · Powered by De Digitale Stylist
  </p>
</div>
```

---

## 11. Auth Model

### Rollen

| Rol | Wie | Rechten |
|-----|-----|---------|
| `anon` | Widget-bezoeker | Lees: salons, services, staff, schedules, blocks, public_bookings. Schrijf: bookings (INSERT) |
| `salon_owner` | Ingelogde eigenaar | Volledige CRUD op eigen salon-data via RLS |

### Auth Flow

1. **Salon-eigenaar registratie:** Handmatig door ons aangemaakt in Supabase Auth + `salons` record
2. **Login:** `supabase.auth.signInWithPassword({ email, password })`
3. **Session:** JWT in localStorage, automatisch meegegeven door Supabase client
4. **Logout:** `supabase.auth.signOut()`
5. **Route protection:** Admin routes checken `session` — redirect naar `/admin/login` als niet ingelogd

### Eigenaarschap bepalen

RLS policies gebruiken `auth.uid()` matched tegen `salons.owner_id`. Eén eigenaar per salon (MVP). De eigenaar ziet alleen data van zijn eigen salon(s).

---

## 12. Error Handling

### Client-side (Widget)

| Situatie | Afhandeling |
|----------|-------------|
| Salon slug niet gevonden | Toon: "Dit boekingssysteem is niet beschikbaar" |
| Geen services/medewerkers | Toon: "Er zijn momenteel geen diensten beschikbaar" |
| Slot niet meer beschikbaar (race condition) | Toon: "Dit tijdslot is zojuist geboekt. Kies een ander tijdstip." + refresh slots |
| Netwerk error | Toon: "Er ging iets mis. Probeer het opnieuw." + retry knop |
| Validatie fouten (formulier) | Inline per veld: "Vul je naam in", "Ongeldig e-mailadres", etc. |
| Email versturen mislukt | Boeking IS aangemaakt; log error server-side, toon boeking aan klant. Retry email via achtergrond job (post-MVP) |

### Server-side (Netlify Functions)

- Alle errors gelogd naar Netlify Function logs
- HTTP 400 voor validatiefouten, 500 voor onverwachte errors
- SMTP timeout: retry 1x, dan loggen

### Admin Dashboard

- Supabase errors: toast notificatie met gebruiksvriendelijke melding
- Optimistic UI: toon wijziging direct, rollback bij error
- Session expired: redirect naar login

---

## 13. Mappenstructuur

```
booking-system/
├── DESIGN.md                          # Dit document
├── netlify.toml                       # Netlify configuratie
├── vite.config.ts                     # Vite config (admin + widget builds)
├── tsconfig.json
├── package.json
├── .env.example                       # SUPABASE_URL, SUPABASE_ANON_KEY, etc.
│
├── public/
│   └── embed.js                       # Embed loader script
│
├── src/
│   ├── main.tsx                       # Admin app entry point
│   ├── widget-entry.tsx               # Widget entry point (apart build)
│   ├── App.tsx                        # Admin router
│   │
│   ├── lib/
│   │   ├── supabase.ts               # Supabase client init
│   │   ├── types.ts                  # TypeScript types (DB schema)
│   │   └── slots.ts                  # Slotberekening logica
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSalon.ts
│   │   ├── useServices.ts
│   │   ├── useStaff.ts
│   │   ├── useBookings.ts
│   │   └── useSlots.ts
│   │
│   ├── components/
│   │   ├── ui/                        # Gedeelde UI componenten
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── ErrorBanner.tsx
│   │   │
│   │   ├── widget/                    # Booking widget componenten
│   │   │   ├── BookingWidget.tsx
│   │   │   ├── StepIndicator.tsx
│   │   │   ├── ServicePicker.tsx
│   │   │   ├── ServiceCard.tsx
│   │   │   ├── StaffPicker.tsx
│   │   │   ├── StaffCard.tsx
│   │   │   ├── DateTimePicker.tsx
│   │   │   ├── CalendarGrid.tsx
│   │   │   ├── TimeSlotList.tsx
│   │   │   ├── CustomerForm.tsx
│   │   │   └── Confirmation.tsx
│   │   │
│   │   └── admin/                     # Admin componenten
│   │       ├── AdminLayout.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Header.tsx
│   │       ├── ProtectedRoute.tsx
│   │       ├── BookingList.tsx
│   │       ├── BookingRow.tsx
│   │       ├── ServiceTable.tsx
│   │       ├── ServiceFormModal.tsx
│   │       ├── StaffList.tsx
│   │       ├── StaffFormModal.tsx
│   │       ├── WeekScheduleEditor.tsx
│   │       ├── BlockList.tsx
│   │       ├── AddBlockModal.tsx
│   │       └── DateNavigator.tsx
│   │
│   ├── pages/
│   │   └── admin/
│   │       ├── LoginPage.tsx
│   │       ├── DashboardPage.tsx
│   │       ├── BookingsPage.tsx
│   │       ├── ServicesPage.tsx
│   │       ├── StaffPage.tsx
│   │       ├── SchedulePage.tsx
│   │       ├── BlocksPage.tsx
│   │       └── SettingsPage.tsx
│   │
│   └── styles/
│       ├── admin.css                  # Admin styling
│       └── widget.css                 # Widget styling (met CSS vars)
│
├── netlify/
│   └── functions/
│       └── send-email.ts             # Email verzenden via SMTP
│
└── supabase/
    └── migrations/
        ├── 001_create_tables.sql
        ├── 002_create_rls_policies.sql
        ├── 003_create_booking_function.sql
        └── 004_create_views.sql
```

---

## 14. Toekomstige Uitbreidingen

### Post-MVP hooks ingebouwd in het ontwerp

| Feature | Voorbereiding in MVP |
|---------|---------------------|
| **Online betaling (Mollie/Stripe)** | `bookings` tabel kan `payment_status` en `payment_id` kolommen krijgen. Boeking flow heeft een duidelijke stap na bevestiging. |
| **SMS herinneringen** | `customer_phone` wordt al opgeslagen. Netlify Function + Twilio/MessageBird. |
| **Wachtlijst** | Nieuw `status` type: `'waitlisted'`. Wanneer annulering → automatisch promoveren. |
| **Meerdere locaties per salon** | Voeg `locations` tabel toe, FK in `staff` en `services`. |
| **Buffer tijd tussen afspraken** | Voeg `buffer_min` toe aan `services`. Slotberekening past `duration + buffer` toe. |
| **Klant zelf annuleren** | Unieke cancel-token in email link. Nieuwe Netlify Function. |
| **Google Calendar sync** | OAuth flow voor medewerkers. Sync bestaande afspraken als blocks. |
| **Meerdere eigenaren/rollen** | Voeg `salon_members` tabel toe met `role` kolom (`owner`, `manager`, `staff`). |
| **Analytics dashboard** | Query op `bookings` voor omzet, populaire diensten, bezettingsgraad. |
| **Pauzes in rooster** | Meerdere `staff_schedules` rijen per dag of `breaks` sub-tabel. |
| **Reviews/beoordelingen** | `reviews` tabel gekoppeld aan `bookings`. Tonen in widget. |
| **Multi-language** | i18n wrapper rond alle teksten. Taal per salon configureerbaar. |
| **WhatsApp notificaties** | Zelfde trigger als email, extra kanaal via WhatsApp Business API. |

### Architecturele beslissingen die uitbreiding vergemakkelijken

- **Multi-tenant by design:** `salon_id` op elke tabel maakt isolatie triviaal.
- **RLS op database niveau:** Nieuwe features erven automatisch beveiliging.
- **Serverless functions:** Nieuwe triggers (SMS, webhook, etc.) zijn gewoon extra functions.
- **Modulaire React componenten:** Nieuwe stappen in de booking flow zijn extra componenten.
- **CSS variabelen:** Theming uitbreidbaar zonder refactor.

---

*Einde technisch ontwerpdocument. Dit document dient als blauwdruk voor de implementatie van het MVP boekingssysteem.*
