# SEDA Skill Analytics

ระบบแยกหน้า Admin และ User สำหรับจัดการกิจกรรม ทำแบบประเมิน และดูผลการพัฒนา เชื่อมต่อ Node.js API และ MariaDB ที่ทำงานใน Docker

## โครงสร้าง Frontend

```text
src/
├─ admin/          หน้าและ components สำหรับผู้ดูแล
├─ user/           หน้าและ components สำหรับนักศึกษา/ผู้สแกน QR
├─ shared/         UI และ routing ที่ใช้ร่วมกัน
├─ lib/            API client และ utility กลาง
└─ data/           ข้อมูลตัวเลือกกลาง
```

คำสั่งพัฒนาและ build แยกจากกัน:

```powershell
npm run dev:admin
npm run dev:user
npm run build:admin
npm run build:user
```

ไฟล์ build จะอยู่ใน `dist/admin` และ `dist/user` ตามลำดับ

## คู่มือแบ่งงานตามหน้า

ก่อนเพิ่มฟีเจอร์หรือเปิด Pull Request ให้อ่าน [คู่มือพัฒนา SEDA แยกตามหน้า](<./docs/PAGE_DEVELOPMENT_GUIDE.md>) ซึ่งระบุ route, ไฟล์, API, ฐานข้อมูล และเกณฑ์รับงานของแต่ละหน้า

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/olay6767/match-skill?quickstart=1)

## เปิดเขียนออนไลน์ด้วย GitHub Codespaces

1. กดปุ่ม **Open in GitHub Codespaces** ด้านบน
2. เลือก **Create codespace on main**
3. รอระบบเตรียมโปรเจกต์และติดตั้งแพ็กเกจ
4. ตั้งค่าฐานข้อมูลและ Backend สำหรับ Codespace ก่อนเปิดระบบ
5. เปิด Terminal แล้วรัน Frontend และ API

ผู้ร่วมงานแต่ละคนควรสร้าง Codespace ของตัวเอง แล้วสร้าง branch ก่อนแก้ไขงาน เพื่อป้องกันการเขียนทับกัน

## เปิดบนเครื่อง

```powershell
npm install
docker compose --env-file .env.database up -d
```

เปิด Terminal ที่ 1 สำหรับ API:

```powershell
npm run dev:api
```

เปิด Terminal ที่ 2 สำหรับหน้าเว็บ:

เปิดแต่ละส่วนใน PowerShell คนละหน้าต่าง:

```powershell
npm run dev:api
npm run dev:admin
npm run dev:user
```

- Admin ทำงานที่ `http://localhost:5173`
- User และหน้าสแกน QR ทำงานที่ `http://localhost:5174`
- API ทำงานที่ `http://localhost:3001`

### ใช้ QR Code บนโทรศัพท์

ในโหมดพัฒนา ระบบจะใช้ IP เครือข่ายของเครื่องโดยอัตโนมัติใน QR Code แทน `localhost` เพื่อให้โทรศัพท์ที่อยู่ Wi-Fi เดียวกันสแกนและเข้าแบบประเมินได้ ให้เริ่มทั้งหน้าเว็บและ API ใหม่หลังแก้โค้ด และอนุญาต Node.js ผ่าน Windows Firewall หากระบบถาม

หากต้องการกำหนด URL เอง หรือนำระบบขึ้นเซิร์ฟเวอร์ ให้เพิ่มค่าต่อไปนี้ใน `.env.database` แล้วเริ่ม API ใหม่:

```env
ADMIN_FRONTEND_URL=https://admin-domain.example
USER_FRONTEND_URL=https://user-domain.example
```

ลิงก์รีเซ็ตรหัสผ่านจะใช้ `ADMIN_FRONTEND_URL` ส่วน QR Code จะใช้ `USER_FRONTEND_URL`

ตรวจสอบฐานข้อมูลผ่าน API:

```text
http://localhost:3001/api/health
```

## บัญชี Admin สำหรับพัฒนา

- Email: `admin@matchskill.com`
- Password: `admin1234`

Backend จะสร้างบัญชีนี้แบบ hash ให้อัตโนมัติเฉพาะโหมดพัฒนา สามารถเปลี่ยนผ่าน `server/.env` โดยดูตัวอย่างจาก `server/.env.example`

## API หลัก

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET|POST /api/activities`
- `GET|PATCH|DELETE /api/activities/:id`
- `GET|POST /api/participants`
- `GET|PATCH|DELETE /api/participants/:id`
- `GET /api/dashboard/summary`

## ข้อมูลการใช้งานหน้า User

หน้า User ส่งสถิติผ่าน `POST /api/user-usage/events` โดยเก็บเซสชัน หน้าที่เปิด
การกดปุ่ม/ลิงก์ เวลาใช้งาน และประเภทอุปกรณ์ แต่ไม่เก็บค่าที่กรอก รหัสผ่าน
รหัสนักศึกษา IP จริง หรือโทเคนจาก URL แบบประเมิน หากผู้ใช้ยืนยันตัวตนแล้ว
ระบบจะผูกสถิติกับนักศึกษาให้อัตโนมัติ

ผู้ดูแลที่เข้าสู่ระบบแล้วเรียกดูสรุปย้อนหลัง 30 วันได้ที่
`GET /api/user-usage/summary` และระบุช่วงวันที่ด้วย `from`/`to`
ในรูปแบบ `YYYY-MM-DD`
