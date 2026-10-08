// Khe chạy e2e (docs/BA.md mục 18.1): mỗi agent một khe để cổng, DB, thư mục kết quả không đụng nhau.
const SLOT = process.env.E2E_SLOT ? Number(process.env.E2E_SLOT) : 0
const sfx = SLOT ? `_${SLOT}` : ''

export const BE_PORT = 8100 + SLOT
export const FE_PORT = 5180 + SLOT
export const FB_FAKE_PORT = 8700 + SLOT   // Graph API giả cho e2e đăng Facebook
export const E2E_DB_NAME = `tiktok_to_text_e2e${sfx}`
export const OUT = `../output/e2e${sfx}`
