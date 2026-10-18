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
2. Normalisasi sama seperti web: ubah jadi huruf kecil, hapus tanda baca/simbol, rapikan spasi berulang menjadi satu spasi, lalu hapus spasi di awal/akhir. Untuk contoh itu teks normalisasinya `kita berdua`.
3. Hitung SHA-256 dari teks normalisasi UTF-8 dengan alat lokal yang dipercaya (contoh di Termux: `printf 'kita berdua' | sha256sum`). Salin 64 karakter heksadesimal hasilnya.
4. Ganti nilai di `riddles[0].acceptedHashes` dengan hash baru. Untuk beberapa jawaban valid, masukkan beberapa hash dalam array yang sama.

Hash di sini hanya mengurangi spoiler kasual. Karena pengecekan berjalan di browser, ini **bukan pengamanan sungguhan**; seseorang yang memeriksa source tetap dapat memodifikasi permainan.

## Menambahkan foto dan lagu

Upload foto dengan nama persis `assets/photos/foto-01.jpg`, `foto-02.jpg`, dan seterusnya. Disarankan JPG lebar maksimal sekitar 1000 px dan ukuran file ringan. Untuk mengubah jumlah foto, tambahkan/hapus item pada array `photos` di `js/content.js`.

Upload file lagu ke `assets/audio/monokrom-tulus.mp3`. File tidak disertakan karena hak cipta dan perlu kamu sediakan sendiri. Lagu tidak autoplay: pengguna memulai pengalaman dengan tap; lagu dimulai/fade-in saat masuk ke scene ulang tahun. Bila file tidak ditemukan, situs tetap berjalan tanpa playback.

## Menjalankan lokal

Buka folder ini di editor lalu jalankan server statis sederhana, misalnya VS Code Live Server. Alternatif dengan Python di komputer: `python -m http.server 8000`, lalu buka `http://localhost:8000`. Fitur WebCrypto untuk hash memerlukan secure context; `localhost` memenuhi syarat itu di browser modern.

## Deploy Cloudflare Pages

1. Repo **private** bernama `kejutan-18` berada di GitHub.
2. Proyek Cloudflare Pages `kejutan-18` terhubung ke repo ini pada branch `main`.
3. Pengaturan: Framework preset **None**, build command kosong, output directory `/`.
4. Setiap commit ke `main` akan memicu deploy ulang otomatis setelah integrasi GitHub aktif.

## Privasi dan tes

Meta robots dan `robots.txt` memblokir crawling biasa tetapi **tidak membuat URL privat**. Siapa pun yang memiliki URL tetap bisa membukanya. Jangan simpan hal sensitif dalam konten. Tidak ada analytics/tracker; hanya GSAP versi dipin dari cdnjs dan aset lokal.

Sebelum mengirim link, tes di Chrome Android dan Safari iOS: tombol mulai; jawaban salah dan benar; petunjuk setelah dua kali salah; audio dan mute bila MP3 sudah diupload; balon bisa selesai manual dan otomatis; tahan lilin; swipe galeri; surat; buka hadiah; rotasi portrait; serta mode tanpa foto/audio. Cek lebar 360, 390, dan 430 px.
