# App Quiz (Next.js + Supabase)

Aplicație de chestionare cu:

- Next.js 15 (TypeScript, App Router)
- Supabase (Auth, Postgres, RLS)
- Editor admin, runner public, submissions + export CSV
- Analytics (Recharts) peste view-uri SQL

---

## 🧰 Tehnologii

- Next.js 15
- Supabase JS (browser + SSR)
- Recharts
- RLS + profiluri (`profiles`)

---

## 🚀 Pornire rapidă

### 1) Clonare & instalare

```bash
git clone <REPO_URL> app_quiz
cd app_quiz
npm i
```

2. Variabile de mediu (NU se comit în git)
   Creează .env.local:

# Public (browser OK)

NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...

# Doar server (NU în client)

SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI... # service_role

3. Rulare
   npm run dev

# http://localhost:3000

# http://localhost:3000

Rute:

Admin: /admin/quizzes

Runner: /quiz/:id

Thanks: /quiz/:id/thanks

Submissions: /admin/quizzes/:id/submissions

Analytics: /admin/quizzes/:id/analytics

👤 Setare admin (o singură dată)

În Supabase SQL Editor, setează userul tău ca admin (schimbă emailul):
-- vezi userii recenți
select id, email from auth.users order by created_at desc limit 20;

-- promovează la admin
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'user@domeniu.tld');

-- verifică
select id, role
from public.profiles
where id = (select id from auth.users where email = 'user@domeniu.tld');

🧪 Seed (reset + import din JSON)

Ruta dev: POST /api/dev/reset-and-seed
Face:

Ștergere în lanț: answers → submissions → options → questions → quizzes

Inseră un quiz nou din payload JSON

Setează created_by = user logat (trebuie să fii admin)

Format JSON (exemplu complet)

Salvează ca chestionar.json (îl poți folosi și în scripturi):
{
"title": "Test — Declaratii de avere",
"description": "Chestionar demonstrativ",
"questions": [
{
"text": "Când se depune declarația de avere?",
"multiple": false,
"points": 1,
"choices": [
{ "text": "Ultimele 3 luni înainte de depunere", "correct": false },
{ "text": "Situația la 31 decembrie a anului anterior", "correct": true },
{ "text": "Orice dată aleasă de persoană", "correct": false }
]
},
{
"text": "Cum se corectează o eroare după depunere?",
"multiple": false,
"points": 1,
"choices": [
{ "text": "Nu se poate corecta", "correct": false },
{ "text": "Se revine cu o nouă declarație/anexă conform instrucțiunilor instituției", "correct": true },
{ "text": "Se trimite un mesaj verbal către secretariat", "correct": false }
]
},
{
"text": "Publicarea declarațiilor se face, de regulă, de către:",
"multiple": false,
"points": 1,
"choices": [
{ "text": "Orice terț interesat", "correct": false },
{ "text": "Instituția/angajatorul, conform legii aplicabile", "correct": true },
{ "text": "Exclusiv ANI", "correct": false }
]
},
{
"text": "Nedeclararea sau declararea neconformă poate atrage:",
"multiple": false,
"points": 1,
"choices": [
{ "text": "Nicio consecință", "correct": false },
{ "text": "Sancțiuni disciplinare/contravenționale conform legii", "correct": true },
{ "text": "Doar o atenționare verbală", "correct": false }
]
}
]
}

▶️ Cum rulezi seed-ul (3 variante)
A) cURL (macOS/Linux)
curl -X POST http://localhost:3000/api/dev/reset-and-seed \
 -H "Content-Type: application/json" \
 --data @chestionar.json

B) PowerShell (Windows)

Salvează conținutul de mai jos ca scripts/seed.ps1 sau rulează direct în PowerShell:

# scripts/seed.ps1

Param(
[string]$JsonPath = ".\chestionar.json",
  [string]$Endpoint = "http://localhost:3000/api/dev/reset-and-seed"
)
if (!(Test-Path $JsonPath)) {
  Write-Error "Nu găsesc $JsonPath"; exit 1
}
$payload = Get-Content -Raw -Path $JsonPath
try {
  $res = Invoke-RestMethod -Method Post -Uri $Endpoint -ContentType "application/json" -Body $payload
  $res | ConvertTo-Json -Depth 6
} catch {
  Write-Error $_.Exception.Message
  if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
$reader = New-Object System.IO.StreamReader($\_.Exception.Response.GetResponseStream())
$reader.ReadToEnd() | Write-Host
}
exit 1
}

Rulează:
pwsh ./scripts/seed.ps1 -JsonPath .\chestionar.json

# sau

./scripts/seed.ps1

C) Bash (Linux/macOS)
Salvează ca scripts/seed.sh (executabil: chmod +x scripts/seed.sh):
#!/usr/bin/env bash
set -euo pipefail
JSON_PATH="${1:-./chestionar.json}"
URL="${2:-http://localhost:3000/api/dev/reset-and-seed}"

if [[! -f "$JSON_PATH"]]; then
echo "Nu găsesc $JSON_PATH" >&2
exit 1
fi

curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  --data @"$JSON_PATH" | jq .
Rulează:
./scripts/seed.sh ./chestionar.json

🔐 Verificări de securitate (ENV & Git)

.env, .env.*, .env.local sunt în .gitignore.
Verifică rapid că nu există în repo:

PowerShell (repo tracked files)
$hits = git ls-files | Select-String -Pattern '(^|[\\/])\.?env(\.|$)'
if ($hits) { $hits } else { "OK: niciun .env în repo" }

PowerShell (working tree)
Get-ChildItem -Recurse -Force -File -Include .env,'.env.*','.env.local' | Select-Object FullName

🧷 Troubleshooting

405 Method Not Allowed la /api/dev/reset-and-seed
Folosește POST și rulează local (ruta e dev-only).

500 null value in column "created_by"
Trebuie să fii logat și userul tău să fie profiles.role='admin'.

Analytics goale
Creează întăi submissions (rulează chestionarul).

Grafice invizibile
E normal dacă view-urile nu întorc rânduri.

📦 Build & producție
npm run build
npm start
