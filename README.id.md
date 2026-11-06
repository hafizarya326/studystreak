# StudyStreak 🔥

[English](README.md) · **Bahasa Indonesia**

Aplikasi produktivitas belajar yang tenang dan berkelas, menggabungkan **timer
belajar Pomodoro** dengan **sistem streak harian ala TikTok**, pencapaian, dan
statistik yang jujur. Dibuat supaya belajar terasa cukup memuaskan untuk
dikembali setiap hari.

Bahasa desain: **Warm Minimalist + Modern Productivity** — permukaan putih hangat,
hijau sage lembut untuk aksi utama dan progres, oranye coral khusus untuk streak
dan pencapaian spesial.

---

## ✨ Fitur

### Timer belajar
- Durasi **Pomodoro** (25/5), **Short Break**, **Long Break**, dan **Custom**.
- Start / pause / resume / reset / skip, suara notifikasi, dan **Focus Mode**
  layar penuh.
- Hitung mundur melingkar besar dengan progress ring halus dan label sesi.
- **Waktu akurat, tahan refresh** — timer menyimpan target `endAt` dan menghitung
  ulang dari `Date.now()`, jadi tetap benar walau pindah tab atau browser
  di-restart (throttling tab background tidak bisa menggusurnya).
- Tidak ada status bar — cukup pill kecil di top bar yang menampilkan sesi aktif
  dari halaman mana pun.

### Streak harian (fitur inti)
- Satu hari streak per hari kalender dengan **minimal satu sesi fokus yang sah**
  (default ≥ 1 menit, bisa diatur).
- Beberapa sesi dalam sehari tetap dihitung **sekali**.
- Hari berurutan menambah streak; hari yang bolong penuh akan me-reset.
- Memakai **timezone lokal pengguna** — tidak pernah UTC.
- Streak terpanjang dan total hari belajar dilacak terpisah.
- **Streak Freeze**: dapat satu freeze setiap 7 hari berurutan (maksimal 3
  tersimpan). Freeze dipakai otomatis untuk melindungi tepat satu hari bolong, dan
  hari bolong yang sama tidak akan pernah menghabiskan dua freeze.
- Milestone: 1 / 3 / 7 / 14 / 30 hari, masing-masing dengan pesannya sendiri.

### Dashboard, statistik & kalender
- Ringkasan streak, timer besar, progres hari ini, grafik mingguan, heatmap
  aktivitas, sesi terbaru, dan pratinjau pencapaian.
- **Heatmap kontribusi** ala GitHub dan **kalender streak** bulanan dengan
  intensitas warna sage, penanda freeze, navigasi bulan, dan detail per hari.
- Tren mingguan (area chart) dan progres 6 bulan (bar chart), donut mata
  pelajaran, persen konsistensi, hari terbaik, total dan rata-rata.

### Riwayat, pencapaian, target & lainnya
- Riwayat belajar lengkap dengan pencarian, filter mata pelajaran/tipe, rentang
  tanggal, pengelompokan per hari, catatan per sesi, penghapusan, dan **ekspor
  CSV / JSON**.
- 10 **pencapaian** dengan status terkunci/terbuka, indikator progres, animasi
  unlock, dan toast perayaan.
- **Target** harian / mingguan / jumlah sesi dengan progress bar dan notifikasi
  saat tercapai.
- Kutipan motivasi harian, **ambient soundscape** yang di-generate (tanpa file
  audio), opsi **musik custom** (file atau URL audio milikmu sendiri, di-loop dan
  tersinkron dengan timer), plus **embed Spotify** opsional untuk playlist
  milikmu (hanya tampil — playback Spotify tidak bisa dikendalikan dari kode),
  notifikasi browser, manajemen mata pelajaran, label sesi custom, dan profil
  belajar pribadi.
- Tema **terang & gelap** (mengikuti sistem, tanpa flash).

### Auth & penyimpanan
- Registrasi email/password lokal, login, logout, edit profil, hapus akun, plus
  **akun demo** sekali klik.
- Password di-hash (SHA-256 + salt per pengguna); hanya hash yang disimpan.
- Semua progres tersimpan di `localStorage`, per pengguna.

---

## 🧱 Teknologi

| Area | Pilihan |
| --- | --- |
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS (design token CSS variable) |
| Ikon | lucide-react |
| Chart | Recharts |
| Routing | React Router |
| Penyimpanan | localStorage (repository modular — lihat di bawah) |

---

## 🚀 Memulai

```bash
npm install
npm run dev        # jalankan dev server
npm run build      # type-check + build produksi
npm run preview    # sajikan hasil build produksi
npm run typecheck  # hanya TypeScript
npm run verify     # 61 asersi logika inti (streak, freeze, statistik, kripto, ekspor)
npm run smoke      # uji render end-to-end + penyelesaian timer di jsdom
```

Buka URL lokal yang muncul, pilih **Try the demo account**, lalu selesaikan satu
sesi fokus (pakai Custom timer yang singkat) untuk menyalakan api streak.

---

## ▲ Deploy (Vercel)

Repo ini menyertakan `vercel.json` yang:

- **me-rewrite** path tak dikenal ke `index.html`, sehingga deep link BrowserRouter
  tetap hidup setelah refresh (tanpa ini, refresh di `/history` menghasilkan 404),
- memasang **security header** (CSP, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `frame-ancestors`),
- meng-cache aset ber-hash secara immutable.

Import repo di Vercel dengan preset Vite (Build `npm run build`, Output `dist`).
Tidak ada environment variable yang dibutuhkan.

---

## 🔐 Catatan keamanan

- **Password** di-hash dengan PBKDF2-SHA256 (210k iterasi, salt per pengguna);
  hash single-pass lama masih bisa diverifikasi. Hanya hash yang disimpan.
- **Threat model**: ini aplikasi client-only. Semua data ada di `localStorage`
  (dan track yang diunggah di IndexedDB) pada perangkat pengguna — siapa pun yang
  bisa mengakses profil browser dapat membacanya. Jangan simpan data sensitif;
  pindah ke backend sungguhan (lihat swap `Repository`) adalah jalan menuju
  keamanan akun yang sebenarnya.
- Link Spotify **di-parse dan di-whitelist** sebelum di-embed, jadi sumber iframe
  sembarangan ditolak.
- Ekspor CSV **menetralkan formula injection** spreadsheet.

---

## 🗂 Struktur proyek

```
src/
  components/
    achievements/  AchievementCard
    calendar/      MonthCalendar, Heatmap, level intensitas
    charts/        chart mingguan / tren / bulanan / mata pelajaran
    layout/        AppLayout, Sidebar, Topbar, BottomNav, MobileDrawer
    streak/        Flame, StreakCard
    timer/         TimerPanel, CompletionModal, SoundCard
    ui/            Button, Card, Modal, ProgressBar/Ring, Toggle, Segmented...
  context/
    AuthContext      akun, login/register/logout
    SettingsContext  preferensi per pengguna + penerapan tema
    DataContext      sesi, statistik/streak/pencapaian turunan + notifikasi
    TimerContext     state machine timer, persistensi, penanganan completion
    ToastContext     antrian toast global
  hooks/            useCurrentDay, useMediaQuery, useIsDark
  lib/
    date.ts         helper tanggal berbasis timezone lokal
    streak.ts       engine streak + freeze murni & deterministik
    stats.ts        agregasi statistik
    achievements.ts definisi + evaluasi
    repository.ts   interface persistensi + LocalRepository + penyimpanan timer
    music.ts        engine audio custom + parsing link Spotify
    audio-library.ts penyimpanan IndexedDB untuk track yang diunggah
    crypto.ts, sound.ts, quotes.ts, export.ts, defaults.ts
  pages/            Dashboard, Timer, Calendar, History, Achievements, Settings, Auth
  types/            tipe domain bersama
scripts/
  verify.ts         tes logika inti yang bisa dijalankan
  smoke.tsx         uji render end-to-end jsdom + timer
  jsdom-setup.mjs   preload environment browser untuk smoke test
```

---

## 🔌 Menukar ke Supabase (atau backend apa pun)

Semua persistensi mengalir lewat interface `Repository` di
`src/lib/repository.ts`. Untuk pindah ke cloud:

1. Implementasikan `SupabaseRepository` dengan signature method yang sama
   (async, jadi tidak ada UI yang perlu berubah).
2. Arahkan `export const repository` ke implementasi baru.
3. Opsional, ganti pemanggilan kredensial di `AuthContext` dengan Supabase Auth —
   sisa aplikasi hanya memakai `user` / `login` / `register` / `logout`.

State timer yang bertahan antar-refresh diisolasi di `timerStorage` di bagian
bawah file yang sama.

---

## 🧠 Cara kerja logika rumitnya

- **Engine streak** (`lib/streak.ts`) bersifat *murni dan turunan*: setiap kali
  dihitung ulang dari hari-hari sesi yang sah, maju dari hari belajar pertama
  sampai hari ini. Itu membuat pencegahan hari ganda dan jaminan satu-freeze-per-
  hari-bolong menjadi otomatis dan idempoten — tidak ada counter streak mutable
  yang bisa rusak.
- **Hari ini tidak pernah "bolong"** sampai harinya benar-benar berakhir, jadi
  streak tampak hidup (dan "berisiko") bahkan sebelum kamu belajar hari ini.
- **Akurasi timer**: state berjalan menyimpan `endAt`; sisa waktu selalu dihitung
  dari jam, tidak pernah diakumulasi per tick. Completion dideteksi dengan
  membandingkan `now` dengan `endAt`, dan ref guard mencegah pencatatan ganda.
- **Aman timezone**: semua perhitungan kalender memakai komponen `Date` lokal
  (`YYYY-MM-DD`), tidak pernah `toISOString()`.
- **Musik custom**: audio milik pengguna (URL atau file yang diunggah ke
  IndexedDB) diputar lewat satu elemen `<audio>` yang loop dan di-drive oleh
  status timer, jadi ikut play/pause bersama sesi fokus.

---

## ✅ Verifikasi

Proyek ini menyertakan dua suite tes yang bisa dijalankan.

**`npm run verify`** — 61 asersi logika murni yang mencakup day key timezone
lokal, pertumbuhan/reset/pelacakan streak terpanjang, pencegahan hari ganda,
ambang kualifikasi, perolehan + pemakaian freeze + larangan pemakaian ganda,
deteksi perfect week, agregasi statistik, unlock pencapaian, parsing link Spotify,
hashing password PBKDF2 (termasuk kompatibilitas hash lama), keamanan formulir
CSV, dan kasus tepi sesi tengah malam.

**`npm run smoke`** — merender aplikasi *asli* (semua provider + router) di dalam
jsdom, menyemai user dan sesi lewat repository asli, lalu memastikan bahwa:

- aplikasi boot dan mengarahkan user yang sudah login ke dashboard,
- timer yang sudah lewat dan tersimpan terdeteksi lalu sesi fokusnya tercatat
  dengan durasi, subject, dan label yang benar,
- modal completion muncul,
- hari-hari yang memenuhi syarat teragregasi dengan benar untuk streak,
- state bertahan setelah unmount/remount penuh, dan
- **tidak ada sesi duplikat** yang tercatat pada mount kedua (guard completion
  bekerja).

Kedua suite keluar dengan kode non-nol saat gagal, jadi bisa dipakai untuk
menggating build.

---

## 📄 Lisensi

Proyek pribadi untuk belajar dan portofolio. Bebas dipakai dan dimodifikasi.
