# Scalev Claude Connector

Remote MCP server untuk Scalev Nexus API v3, di-host di:

```text
https://mcp.scalev.com/mcp
```

Origin browser bawaan mengizinkan Claude, ChatGPT, dan OpenAI. Request MCP
server-to-server tanpa header `Origin` tetap diizinkan.

Worker ini hanya membungkus protokol MCP. Worker tidak memeriksa claim token,
tidak menyimpan pilihan bisnis, dan tidak memberi izin akses bisnis secara
lokal. Worker meneruskan OAuth bearer token merchant ke Nexus `/v3`. Nexus yang
memvalidasi token, memilih bisnis, memeriksa scope, mencatat audit log,
menerapkan rate limit, dan menjalankan perilaku endpoint.

## Pasang Di Claude

1. Buka Claude settings.
2. Masuk ke Connectors.
3. Tambahkan custom connector dengan `https://mcp.scalev.com/mcp`.
4. Selesaikan alur OAuth Scalev.
5. Di chat, aktifkan Scalev dari menu tools/connectors.

OAuth memakai Dynamic Client Registration sebagai jalur utama. Scalev juga
mengiklankan Client ID Metadata Document untuk klien MCP yang mendukungnya.
Token harus terikat ke protected resource:

```text
https://mcp.scalev.com/mcp
```

## Alur Data

```text
Claude -> mcp.scalev.com/mcp -> api.scalev.com/v3 -> data bisnis Scalev
```

- Claude membaca protected-resource metadata dari `/.well-known/oauth-protected-resource/mcp`.
- Nexus menerbitkan OAuth authorization-server metadata di `/v3/oauth/.well-known/oauth-authorization-server`.
- Health check publik untuk monitoring uptime/status tersedia di `https://mcp.scalev.com/health`.
- Claude memperoleh OAuth token merchant dari Nexus.
- Worker menerima token dan meneruskannya apa adanya ke Nexus `/v3`.
- Untuk tool yang membutuhkan bisnis, `business_unique_id` diteruskan ke Nexus sebagai `b_uid`.

Panggil `get_me` terlebih dahulu. Jika `connected_businesses` berisi lebih dari
satu bisnis, pilih salah satu `connected_businesses[].unique_id` dan kirim
sebagai `business_unique_id` tingkat atas ke tool bisnis.

## Tool

| Tool | Jenis | Ringkasan |
| --- | --- | --- |
| `get_me` | Baca | Mengambil identitas token dan bisnis yang terhubung. |
| `get_docs` | Baca lokal | Membaca dokumentasi developer Scalev yang dibundel. |
| `search` | Baca lokal | Mencari katalog endpoint `/v3` yang bisa dipakai. |
| `get` | Baca | Menjalankan satu operasi GET dari katalog. |
| `execute_safe` | Tulis non-destruktif | Menjalankan operasi non-GET yang tidak destruktif. |
| `execute_destructive` | Tulis destruktif | Menjalankan operasi seperti delete, cancel, revoke, remove, atau disconnect. |
| `list_landing_pages` | Baca | Melihat daftar landing page bisnis. |
| `get_landing_page` | Baca | Mengambil satu landing page. |
| `create_landing_page` | Tulis non-destruktif | Membuat landing page. Untuk publish HTML Mode dalam satu panggilan, kirim `is_published: true` dengan `page_display`. |
| `update_landing_page` | Tulis non-destruktif | Mengubah metadata atau status publish landing page. |
| `delete_landing_page` | Tulis destruktif | Menghapus landing page secara soft-delete. |
| `list_orders` | Baca | Melihat daftar order dengan filter dan cursor pagination. |
| `get_order` | Baca | Mengambil satu order. |
| `create_order` | Tulis non-destruktif | Membuat order bisnis. |
| `update_order` | Tulis non-destruktif | Mengubah satu order. |
| `change_order_status` | Tulis non-destruktif | Mengubah status order atau pembayaran setelah ada instruksi eksplisit. |
| `cancel_order_awb` | Tulis destruktif | Membatalkan AWB order. |

`search` mengembalikan `execution_tool` berupa `get`, `execute_safe`, atau
`execute_destructive`. Gunakan nilai itu. Worker akan menolak jika tool aman dan
destruktif tertukar.
Endpoint OAuth flow, storefront browser, OAuth billing, developer payout, dan
direct payment-gateway sengaja dikeluarkan dari katalog MCP yang dihasilkan.

## Scope Dalam Bahasa Sederhana

- `page:list` dan `page:read`: melihat landing page.
- `page:create`, `page:update`, dan `page:delete`: membuat, mengubah, publish,
  unpublish, atau menghapus landing page.
- `order:list` dan `order:read`: melihat order.
- `order:create` dan `order:update`: membuat atau mengubah order.
- `order:change_status`: mengubah status order atau pembayaran.
- `order:create_awb`: membuat atau membatalkan AWB pengiriman.

Connector tidak memberi akses melebihi persetujuan merchant di Scalev. Nexus
memeriksa scope per bisnis yang dipilih pada setiap request.

## Prompt Reviewer

Gunakan bisnis review yang berisi minimal 30 order, 5 landing page, 5 customer,
dan 10 produk.

1. "Gunakan Scalev untuk menampilkan bisnis saya yang terhubung, pilih bisnis review, lalu ringkas landing page saya."
2. "Buat draft HTML Mode landing page bernama Claude Review Draft, publish dengan `is_published: true`, ambil lagi datanya, lalu hapus."
3. "Cari order review yang pending, ambil satu order, ubah catatannya, ubah statusnya menjadi confirmed, dan cancel AWB hanya untuk seeded safe AWB test order."

Pemeriksaan negatif:

- Minta Claude menjalankan operasi destruktif dengan `execute_safe`; tool harus menolak atau mengembalikan wrong-tool error.
- Hilangkan `business_unique_id` saat beberapa bisnis terhubung; Nexus harus mengembalikan error pemilihan bisnis yang jelas.
- Revoke OAuth grant di Scalev, sambungkan ulang, lalu ulangi alur identitas dan daftar data.

## Pemeriksaan Lokal

Sebelum merge atau submit:

```bash
pnpm check:submission-local
```

Preflight ini menjalankan pemeriksaan katalog, pemindaian risiko katalog,
pemeriksaan laporan surface katalog, privasi logging, teks/package submission,
workspace lintas repo, typecheck TypeScript, test Vitest, dan Wrangler dry-run.

## Legal Dan Dukungan

- Privacy Policy: https://scalev.com/privacy
- Terms: https://scalev.com/terms
- Support: https://scalev.com/contact-us
- Security Contact: https://mcp.scalev.com/.well-known/security.txt
