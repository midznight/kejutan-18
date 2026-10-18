# Kejutan ulang tahun ke-18

Web kejutan statis untuk Nor. Tidak ada backend, form server, analytics, atau tracker. File ini bisa langsung dipublish dari root repo di Cloudflare Pages dengan preset **None**, build command kosong, dan output directory `/`.

## Isi folder

- `index.html` — shell situs, meta privasi, dan CDN GSAP versi dipin.
- `css/style.css` — visual, responsif, gerakan, safe-area, dan mode reduced-motion.
- `js/content.js` — seluruh teks dan konfigurasi yang biasanya ingin diedit.
- `js/app.js` — alur scene, hash jawaban, galeri, audio opsional, dan canvas 2D.
- `assets/photos/foto-01.jpg` sampai `foto-10.jpg` — foto kenangan (opsional; jumlah mengikuti `photos` di `content.js`).
- `assets/audio/monokrom-tulus.mp3` — lagu (opsional; file harus kamu sediakan sendiri).
- `assets/img/heart.svg` dan `assets/img/noise.png` — aset dekoratif lokal.
- `robots.txt` — `Disallow: /`.

## Mengganti tulisan

Buka `js/content.js` di GitHub, klik ikon pensil, cari `// GANTI:`, ubah teksnya, lalu klik **Commit changes**. Jangan mengedit `js/app.js` untuk mengganti isi cerita. Nama panggilan utama ada di `name`; alasan ada di `reasons`; surat di `letter`; daftar foto di `photos`; audio di `music`; hadiah di `finale`.

## Mengganti jawaban tebak-tebakan

Jawaban tidak disimpan dalam bentuk teks biasa. Untuk menggantinya:

1. Tentukan jawaban baru, misalnya `kita berdua`.
2. Normalisasi sama seperti web: huruf dibuat kecil, aksen dilebur, tanda baca/simbol diubah menjadi spasi, spasi berulang dijadikan satu, lalu spasi awal/akhir dibuang. Untuk contoh itu hasil normalisasinya `kita berdua`.
3. Hitung SHA-256 dari teks normalisasi UTF-8 dengan alat lokal yang dipercaya (contoh di Termux: `printf 'kita berdua' | sha256sum`). Salin 64 karakter heksadesimal hasilnya.
4. Ganti nilai di `riddles[0].acceptedHashes` dengan hash baru. Untuk beberapa jawaban valid pada level yang sama, masukkan semua hash ke array itu. Kalau ingin 2 atau 3 level, tambahkan objek baru ke array `riddles` dan isi `question`, `acceptedHashes`, `hint`, serta `wrongMessages` masing-masing. Pemain harus menyelesaikan level secara berurutan; maksimal 3 level.

Hash di sini hanya mengurangi spoiler kasual. Karena pengecekan berjalan di browser, ini **bukan pengamanan sungguhan**; seseorang yang memeriksa source tetap dapat memodifikasi permainan.

## Menambahkan foto dan lagu

Upload foto dengan nama persis `assets/photos/foto-01.jpg`, `foto-02.jpg`, dan seterusnya. Disarankan JPG lebar maksimal sekitar 1000 px dan ukuran file ringan. Untuk mengubah jumlah foto, tambahkan/hapus item pada array `photos` di `js/content.js`.

Upload file lagu ke `assets/audio/monokrom-tulus.mp3`. File tidak disertakan karena hak cipta dan perlu kamu sediakan sendiri. Lagu tidak autoplay: pengguna memulai pengalaman dengan tap; lagu dimulai/fade-in saat masuk ke scene ulang tahun. Bila file tidak ditemukan, situs tetap berjalan tanpa playback.

## Menjalankan lokal

Buka folder ini di editor lalu jalankan server statis sederhana, misalnya VS Code Live Server. Alternatif dengan Python di komputer: `python -m http.server 8000`, lalu buka `http://localhost:8000`. Fitur WebCrypto untuk hash memerlukan secure context; `localhost` memenuhi syarat itu di browser modern.

## Deployment yang sudah aktif

- Repo GitHub private: https://github.com/midznight/kejutan-18
- Situs: https://kejutan-18.pages.dev/
- Cloudflare Pages terhubung ke branch `main`, Framework preset **None**, build command kosong, output directory `/`.
- Setiap commit ke `main` memicu deployment ulang otomatis. Setelah upload foto, audio, atau edit `js/content.js`, tunggu deployment terbaru berstatus **Success** sebelum mengirim link.

### Upload aset lewat GitHub web

1. Buka repo, masuk ke folder `assets/photos/`, lalu pilih **Add file → Upload files**.
2. Upload JPG bernama `foto-01.jpg`, `foto-02.jpg`, dan seterusnya, lalu klik **Commit changes**.
3. Masuk ke `assets/audio/`, pilih **Add file → Upload files**, lalu upload `monokrom-tulus.mp3` dan commit.
4. Pantau tab **Actions** atau Cloudflare Pages untuk memastikan deployment otomatis selesai.

## Privasi dan tes

Repo GitHub sudah dibuat private dan Cloudflare Pages terhubung ke branch `main`: https://github.com/midznight/kejutan-18. URL situs: https://kejutan-18.pages.dev/. Framework preset **None**, build command kosong, output directory `/`. Setiap commit pada `main` memicu deployment otomatis.

Meta robots dan `robots.txt` memblokir crawling biasa tetapi **tidak membuat URL situs privat**. Siapa pun yang memiliki URL tetap bisa membukanya. Jangan simpan hal sensitif dalam konten. Tidak ada analytics/tracker; hanya GSAP versi dipin dari cdnjs dan aset lokal.

Sebelum mengirim link, tes di Chrome Android dan Safari iOS: tombol mulai; jawaban salah dan benar; petunjuk setelah dua kali salah; audio dan mute bila MP3 sudah diupload; balon bisa selesai manual dan otomatis; tahan lilin; swipe galeri; surat; buka hadiah; rotasi portrait; serta mode tanpa foto/audio. Cek lebar 360, 390, dan 430 px.
