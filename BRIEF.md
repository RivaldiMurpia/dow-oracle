# DOWOracle — Project Brief

> Crypto research agent untuk Nebius x NVIDIA Global AI Hackathon (Devpost)
> Status: IDEA + NAMA LOCKED (4 Okt 2026) · Build window realistis: 15–30 Okt 2026
> Brand: DOW (DawnOfWild) — brand pribadi Rivaldi · Domain: oracle.dowproject.my.id

## 1. Ringkasan

**DOWOracle** adalah AI agent riset kripto. User kasih satu topik ("token apa yang lagi rame di ekosistem Monad?", "apakah proyek X legit?"), agent turun ke lapangan: merencanakan search query, menggali berita/forum/thread terbaru via Tavily, mengekstrak konten penuh, lalu mensintesis semuanya jadi **laporan sinyal** — skor 0–100, breakdown bullish/bearish/netral, katalis utama, dan **risk flags** — semuanya dengan sitasi link yang bisa diklik.

**Elevator pitch (EN, siap pakai untuk Devpost):**
> DOWOracle is an AI research agent for crypto. Give it a topic and it goes into the field — planning searches, digging through fresh news, forums and threads via Tavily, then synthesizing everything into a signal report: a 0–100 score, bull/bear breakdown, key catalysts and risk flags, all with clickable citations. Powered by NVIDIA Nemotron models on Nebius Token Factory.

**Track:** Best Apps and Agents — plus bidik hadiah khusus **Best Use of Tavily ($3.000)**.

**Deadline:** 30 Okt 2026, 10:00 PDT ≈ **31 Okt 2026, 00:00 WIB**.

## 2. Masalah & Audiens

**Masalah:** Kripto bergerak dalam hitungan jam. Informasi tersebar di puluhan sumber (berita, forum, thread X, Discord), berisik, dan penuh scam/shill. Trader ritel dan peneliti tidak punya waktu untuk riset manual yang benar sebelum ambil keputusan.

**Audiens:** trader ritel kripto, peneliti/analis independen, dan komunitas (mis. anggota komunitas chain seperti Monad) yang butuh "second opinion" cepat berbasis sumber nyata — bukan sekadar opini chatbot.

**Kenapa ini masalah yang tepat untuk hackathon:** nyata, spesifik, bisa didemokan dalam 3 menit, dan solusinya memamerkan kekuatan agent + grounding (bukan chatbot generik).

## 3. Cara Kerja (Pipeline)

Setiap query user melewati 6 tahap. Semua LLM call lewat **Nebius Token Factory** (OpenAI-compatible endpoint).

| # | Tahap | Komponen | Input → Output |
|---|-------|----------|----------------|
| 1 | **Planner** | Nemotron 3.5 Lightning | Topik user → 3–5 search query + jendela waktu (mis. 7 hari terakhir) |
| 2 | **Search** | Tavily Search API | Query → ~8 hasil per query. Param: `search_depth: advanced`, `time_range: week`, `include_answer: false`, filter domain untuk buang situs spam |
| 3 | **Dedup & rank** | Kode (tanpa LLM) | Gabung hasil, buang duplikat URL, ambil top ~10 unik |
| 4 | **Extract** | Tavily Extract API | 10 URL → teks bersih per sumber |
| 5 | **Summarizer** | Nemotron 3.5 Lightning | Teks sumber → 1 paragraf ringkasan + daftar klaim kunci per sumber (murah, cepat, paralel) |
| 6 | **Analyst** | Nemotron 3 Ultra | Semua ringkasan → laporan final: skor sinyal 0–100, breakdown bullish/bearish/netral, katalis utama, **risk flags** (tim anonim, belum audit, likuiditas tipis, tokenomics mencurigakan), sitasi per klaim |

**Kenapa model tiering:** Ultra dipakai sekali per laporan untuk reasoning berat; Lightning dipakai berkali-kali untuk kerja cepat. Lightning dipilih over Nano: harga SAMA ($0.06/$0.24 per 1M) tapi 5x lebih cepat (314 vs 60 tok/s) dan konteks 1M — didesain buat agentic reasoning & tool use. Super di-skip: kejepit di tengah, tidak menang di harga maupun reasoning. Estimasi cost: **~$0.013/laporan** → $25 credit ≈ 1.900 laporan. Ini hemat credit, cepat, dan jadi cerita teknis yang bagus untuk juri ("serious reasoning where it matters, fast calls everywhere else" — persis seperti yang disarankan halaman hackathon).

**Contoh query demo:**
- "What's heating up in the Monad ecosystem this week?"
- "Is project X legit? Give me the bull and bear case."
- "Any fresh exploits or security incidents in the last 7 days?"

## 4. Arsitektur

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Dashboard  │────▶│  Next.js API routes  │────▶│ Tavily Search   │
│  (Next.js)  │◀────│  + Agent orchestrator│◀────│ Tavily Extract  │
└─────────────┘ SSE └──────────────────────┘     └─────────────────┘
       │                      │                           │
       │                      ▼                           │
       │            ┌──────────────────────┐              │
       └────────────│  Supabase (Postgres) │              │
                    │  reports, queries,   │     ┌─────────────────┐
                    │  sources             │────▶│ Nebius Token    │
                    └──────────────────────┘     │ Factory         │
                                                 │ (Nemotron 3    │
                                                 │  Ultra / Nano)  │
                                                 └─────────────────┘
```

**Komponen:**
- **Frontend:** Next.js App Router (stack yang dikuasai), deploy di Vercel. Query bar + preset topik, live agent feed via SSE, kartu laporan.
- **Agent orchestrator:** state machine sederhana di TypeScript (plan → search → extract → summarize → analyze → persist). Tanpa framework agent yang berat — lebih mudah di-debug dan dijelaskan ke juri.
- **LLM:** 100% via Nebius Token Factory (memenuhi syarat "must run on Token Factory or AI Cloud" + "use at least one NVIDIA open source model").
- **Search/grounding:** Tavily Search + Extract.
- **DB:** Supabase Postgres (sudah dikenal dari Contex Arena): tabel `queries`, `reports`, `sources`.
- **Observability (opsional, pakai credit $100 LangSmith):** trace tiap tahap agent — berguna untuk demo "Quality of Idea" dan debugging.

**Phase 2 (di luar v1, hanya jika sempat):** bot Telegram untuk alert ("kirim laporan tiap ada skor > 80 untuk topik yang gua follow").

## 5. UI/UX

1. **Home / query:** input topik + 3 preset chip ("Monad ecosystem", "Fresh exploits", "New listings"). Tombol "Research".
2. **Live agent feed:** langkah agent tampil real-time — "🔍 Merencanakan 4 search query…", "📰 Menemukan 31 sumber, mengekstrak 10…", "🧠 Menganalisis dengan Nemotron 3 Ultra…". Ini bagian paling "wow" untuk demo.
3. **Laporan:** gauge skor 0–100 + verdict satu kalimat, kartu katalis, kartu risk flags (merah), daftar sumber dengan link + ringkasan per sumber.
4. **History:** daftar laporan sebelumnya, bisa dibuka ulang.

Desain: dark, rapi, satu aksen warna. Tidak perlu seambisius Contex Arena — konten laporannya yang jadi bintang.

## 6. Integrasi Tavily (bidik Best Use of Tavily)

Juri hadiah khusus ini adalah engineer Tavily — integrasinya harus dalam, bukan tempelan:
- **Search:** multi-query planning, `time_range` dinamis, `search_depth: advanced`, exclude domain spam.
- **Extract:** konten penuh (bukan snippet), bukan sekadar hasil search.
- **Grounding:** setiap klaim di laporan wajib punya sitasi URL; skor dihitung dari bukti, bukan dari ingatan model.
- Cerita demo: tunjukkan agent menemukan info yang model tidak mungkin tahu dari training data-nya (berita 2 hari lalu) — ini bukti grounding bekerja.

## 7. Mapping ke Kriteria Juri

| Kriteria | Cara DOWOracle memenuhinya |
|----------|------------------------|
| **Technological Implementation** | Agent multi-step nyata + model tiering (Ultra/Nano) + grounding Tavily dengan sitasi. Semua inference di Nebius Token Factory. |
| **Design** | Produk lengkap: query → live progress → laporan → history. Bukan proof-of-concept. |
| **Potential Impact** | Audiens nyata (trader/peneliti kripto), masalah nyata (info overload + scam), solusi yang benar-benar menjawab. |
| **Quality of the Idea** | Signal scoring yang freshness-aware + risk flags — non-obvious, bukan chatbot generik. |

## 8. Naskah Demo Video (≤ 3 menit)

| Waktu | Adegan |
|-------|--------|
| 0:00–0:20 | Hook: kripto bergerak cepat, info berisik, scam di mana-mana. Riset manual butuh berjam-jam. |
| 0:20–0:50 | Ketik query di dashboard → tunjukkan live agent feed (planning → searching → extracting → analyzing). |
| 0:50–1:50 | Laporan keluar: skor, verdict, katalis, **risk flags**, semua ada sitasi yang diklik. Tunjukkan satu temuan yang benar-benar fresh (bukti grounding). |
| 1:50–2:30 | Query kedua yang kontras (mis. "is X legit?" → keluar red flags) untuk tunjukkan kedalaman analisis. |
| 2:30–3:00 | Arsitektur 10 detik: Nemotron 3 Ultra + Nano via Nebius Token Factory, Tavily Search + Extract. Tutup dengan ajakan coba. |

**Yang direkam:** screen recording dashboard + voiceover. Tidak perlu tampil muka.

## 9. Checklist Submission (Devpost)

- [ ] Working demo (URL aplikasi live)
- [ ] Video demo ≤ 3 menit di YouTube (public), menunjukkan pemakaian Nebius Token Factory + model NVIDIA
- [ ] Repo publik (GitHub) dengan lisensi open source (MIT/Apache 2.0) + README berisi setup instructions
- [ ] Di README: highlight pemakaian Nemotron, peran Token Factory, dan tools Nebius lain
- [ ] Feedback tentang Token Factory / tools NVIDIA (wajib di form)
- [ ] Pilih track: Best Apps and Agents (+ otomatis dipertimbangkan untuk Best Use of Tavily)

## 10. Timeline (15–30 Okt 2026)

| Periode | Milestone |
|---------|-----------|
| 15–18 Okt | Scaffold repo + orchestrator + tahap 1–4 (planner, search, extract) jalan via CLI |
| 19–21 Okt | Tahap 5–6 (summarizer + analyst), prompt tuning, simpan ke Supabase |
| 22–24 Okt | Dashboard Next.js: query, SSE live feed, kartu laporan |
| 25–27 Okt | Polish UI, history, uji 5–10 query nyata, perbaiki edge case |
| 28 Okt | Rekam demo video |
| 29 Okt | README + repo publik + lisensi |
| 30 Okt | Submit (sebelum 31 Okt 00:00 WIB), sisakan buffer |

**Yang bisa dicicil SEKARANG (tanpa ganggu Metropolis):** buat akun Token Factory + ambil API key; ambil Tavily API key; verifikasi model Nemotron 3 Ultra & Nano tersedia di Token Factory.

## 11. Scope v1 vs Dipotong

**Wajib v1:** pipeline 6 tahap, dashboard (query + live feed + laporan + history), deploy live, video, README.

**Dipotong jika kepepet (tanpa mengurangi nilai juri):** bot Telegram, LangSmith tracing, multi-bahasa, auth/user accounts, preset topik > 3.

## 12. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Tavily return sampah / situs spam | Filter domain + `search_depth: advanced`; fallback: kurangi ke top 5 sumber |
| Nemotron 3 Ultra lambat/mahal per laporan | Hanya 1 call Ultra per laporan; ringkasan per sumber pakai Nano; batasi extract 10 URL |
| Credit $25 Token Factory habis saat dev | Dev dengan Nano (murah), Ultra hanya untuk tuning final + rekaman demo |
| Waktu kepotong Metropolis | Scope v1 sudah minimal; Telegram & LangSmith opsional |
| Query demo tidak menghasilkan temuan menarik saat rekaman | Siapkan 3–5 query cadangan yang sudah diuji; rekam yang terbaik |

## 13. Budget Perk

- **$25 Token Factory credit** — inference dev + demo. Strategi: dev pakai Nano, Ultra untuk final.
- **$25 Tavily credit** — jauh lebih dari cukup untuk dev + demo (ratusan search).
- **$100 LangSmith credit** — opsional, untuk tracing/eval jika sempat.
- **$100 Toloka / course / sertifikasi** — tidak dipakai untuk proyek ini.

## 14. Keputusan untuk Rivaldi

1. ~~Nama final~~ — **LOCKED 4 Okt 2026: DOWOracle** (dari brand DOW / DawnOfWild milik Rivaldi; "oracle" = penyedia data terpercaya, crypto-native). **Domain: `oracle.dowproject.my.id`** (subdomain dari dowproject.my.id).
2. Perlu user accounts, atau single-user demo cukup? (Rekomendasi: single-user, tanpa auth — lebih cepat)
3. Bahasa UI: Inggris saja (juri internasional) atau bilingual? (Rekomendasi: Inggris)
4. Bot Telegram masuk v1 atau phase 2? (Rekomendasi: phase 2)
