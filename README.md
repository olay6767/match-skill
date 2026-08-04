# Skill Analytics Admin

เว็บ Admin Login และ Dashboard สำหรับดูข้อมูลกิจกรรมและผลประเมินทักษะ เชื่อมต่อ Node.js API และ MariaDB ที่ทำงานใน Docker

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

```powershell
npm run dev
```

หน้าเว็บทำงานที่ `http://localhost:5173` และ API ทำงานที่ `http://localhost:3001`

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
