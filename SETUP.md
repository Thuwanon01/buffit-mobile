# BUFFIT Mobile — Setup & Status

> Last updated: 2026-06-09

---

## สถานะโปรเจกต์

| Phase | รายละเอียด | สถานะ |
|-------|-----------|--------|
| Phase 1 | Walking skeleton (Expo + Convex + Expo Router) | ✅ เสร็จ |
| Phase 2 | Authentication (login / signup / setup + Google OAuth) | ✅ เสร็จ |
| Phase 3 | Navigation shell (tab bar, header, sign-out) | ✅ เสร็จ |
| Phase 4 | Port ทุก screen (dashboard, log, leaderboard, history) | ✅ เสร็จ |
| Phase 5 | Chart, Share, Toast, Header bar, Admin panel | ✅ เสร็จ |
| Phase 6 | Push Notifications (expo-notifications + APNs/FCM) | ⏳ รอ Apple Developer Account activate |
| Phase 7 | App Store submission (EAS Build + EAS Submit) | ⏳ รอ Apple Developer Account activate |

---

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Expo SDK 56 (managed workflow) |
| Language | TypeScript |
| Routing | Expo Router (file-based, คล้าย Next.js App Router) |
| Backend | Convex — shared deployment กับ web app |
| Convex deployment prod | `upbeat-grouse-644` |
| Convex deployment dev | `strong-chameleon-407` |
| Build/Submit | EAS Build + EAS Submit |
| Bundle ID | `com.buffit.app` (iOS & Android) |
| App version | 1.0.0 (build 1) |

---

## ไฟล์ที่มีอยู่

```
app/
  (auth)/
    _layout.tsx       — auth route group layout
    login.tsx         — หน้า login (email / Google)
    signup.tsx        — หน้า signup
    setup.tsx         — หน้ากรอกโปรไฟล์ครั้งแรก
  (app)/
    _layout.tsx       — tab bar + header bar (BUFFIT logo, Lv badge, Admin button, sign-out)
    dashboard.tsx     — หน้าหลัก (round status, coins, feed)
    log.tsx           — บันทึก workout
    leaderboard.tsx   — อันดับ
    history.tsx       — ประวัติ + chart
    admin.tsx         — Admin panel (Round tab + Users tab) — เข้าถึงจาก header ADMIN ⚙️
```

---

## สิ่งที่ทำไปแล้ว (เรียงตาม commit)

### Phase 1–3 (Auth + Navigation)
- Expo Router file-based routing พร้อม route groups `(auth)` และ `(app)`
- `ConvexAuthProvider` + `@convex-dev/auth`
- Google OAuth ผ่าน `expo-web-browser` + `expo-linking`
- Auto redirect: authenticated → app, unauthenticated → login, profile incomplete → setup
- Auto sign-out เมื่อ token หมดอายุบน server

### Phase 4 (Screens)
- Dashboard: แสดง active round, coins (weight/cardio), activity feed, round progress bar
- Log: ฟอร์มบันทึก weight + cardio + notes, เลือก activity
- Leaderboard: อันดับผู้ใช้พร้อม coins และ level badge
- History: ประวัติ workout log + chart แสดงความก้าวหน้า (Victory Native)

### Phase 5 (Polish + Admin)
- Chart ใน History ด้วย `victory-native`
- Share workout ด้วย `expo-sharing` + `react-native-view-shot`
- Toast notifications ด้วย `react-native-toast-message`
- Header bar: BUFFIT logo + Level badge + Admin button + Sign-out
- Admin panel (`app/(app)/admin.tsx`):
  - **Round tab**: ดู/สร้าง/ปิด round, จัดการ participants
  - **Users tab**: รายชื่อสมาชิก, promote to admin, revoke workout log

### Phase 7 Prep (EAS Config)
- `app.json`: ชื่อ BUFFIT, `bundleIdentifier: com.buffit.app`, `newArchEnabled: true`, splash screen plugin
- `eas.json`: profiles development / preview / production

---

## สิ่งที่ต้องทำต่อ

### เมื่อ Apple Developer Account activate แล้ว

#### 1. EAS Setup (ทำครั้งเดียว)
```bash
cd /Users/tuwanon/Documents/EzProject/buffit-mobile

# Login EAS (ใช้ Expo account)
eas login

# เชื่อม project กับ EAS + ลงทะเบียน bundle ID กับ Apple
eas build:configure
```

#### 2. Phase 6 — Push Notifications
```bash
# Install package
npx expo install expo-notifications

# สร้าง APNs key ใน Apple Developer Console:
# Certificates, IDs & Profiles → Keys → (+) → Apple Push Notifications service (APNs)
# Download .p8 file

# Upload APNs key ไปที่ Expo
eas credentials
# เลือก iOS → Add Push Notifications Key → อัปโหลด .p8
```

แล้วค่อยเพิ่ม push notification code ใน app (ดู expo-notifications docs)

#### 3. Phase 7 — Build + Submit ไป App Store

**Build:**
```bash
eas build --platform ios --profile production
# EAS จัดการ code signing / provisioning profiles อัตโนมัติ
# ใช้เวลา ~15-30 นาที (build บน cloud)
```

**Submit:**
```bash
eas submit --platform ios
# EAS จะ upload .ipa ไป App Store Connect โดยอัตโนมัติ
```

**สิ่งที่ต้องเตรียมใน App Store Connect:**
- [ ] App description (ไทย + อังกฤษ)
- [ ] Screenshots จาก iPhone 16 Plus (6.9") — ขนาด 1320×2868 px
- [ ] Privacy Policy URL (ต้องมีก่อน submit)
- [ ] App category: Health & Fitness
- [ ] Age rating: 4+

#### 4. Google OAuth — เพิ่ม redirect URI สำหรับ production
ใน Google Cloud Console → Credentials → OAuth 2.0 Client ID ของ iOS:
- เพิ่ม `com.buffit.app:/oauth2redirect/google` เป็น authorized redirect URI
- (ปัจจุบันมีแค่ `exp://` สำหรับ Expo Go)

---

## ข้อมูลสำคัญ

| รายการ | ค่า |
|--------|-----|
| Apple Bundle ID | `com.buffit.app` |
| Android Package | `com.buffit.app` |
| EAS CLI version | 20.1.0 |
| Expo account | ลือกิน eas login ด้วย Expo account ของคุณ |
| GitHub repo | `github.com/Thuwanon01/buffit-mobile` |
| Web app repo | `github.com/Bingza/buffit` |

---

## หมายเหตุ

- **Expo SDK 56** — App Store Expo Go รองรับเฉพาะ SDK 54 ดังนั้นไม่สามารถทดสอบผ่าน Expo Go บน iPhone ได้ ต้องใช้ EAS Build (development client หรือ production)
- **Convex directory** — `convex/` ใน mobile เป็น copy จาก web app ถ้า backend มีการเปลี่ยนแปลง ต้อง sync และรัน `npx convex codegen` ใหม่
- **LINE notifications** — ทำงานอยู่แล้วฝั่ง server (web app) โดยไม่ต้องใช้ APNs
