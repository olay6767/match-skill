# คู่มือพัฒนา SEDA แยกตามหน้า

เอกสารนี้ใช้แบ่งงานให้ผู้ร่วมพัฒนาเพิ่มโค้ดทีละหน้า โดยอ้างอิงทั้งข้อกำหนดและโค้ดที่มีอยู่จริงใน repository นี้

เอกสารต้นทาง:

- [Product Requirement Document](<./PRD - SEDA Activity Evaluation System.txt>)
- [System Flow](<./System Flow.pdf>)
- [แบบประเมินสมรรถนะ](<./แบบประเมินสมรรถะด้านความเป็นผู้ประกอบการ.docx>)
- [System Design](<../product requirement design/System Design - SEDA Activity Evaluation System.md>)

## 1. วิธีใช้คู่มือนี้ร่วมกัน

1. เลือกหนึ่งหน้าในตารางหัวข้อ 5 และใส่ชื่อผู้รับผิดชอบใน Pull Request
2. สร้าง branch ตามชื่อที่แนะนำ เช่น `page/student-assessment`
3. อ่านหัวข้อ "งานส่วนกลางที่ต้องตกลงก่อน" ก่อนเริ่มเขียนโค้ด
4. แก้เฉพาะไฟล์ของหน้าที่รับผิดชอบและ shared component ที่จำเป็น
5. หากต้องแก้ `src/App.tsx`, `src/lib/api.ts`, `server/src/db/schema.ts` หรือไฟล์ layout กลาง ให้แจ้งทีมก่อน เพราะเป็นไฟล์ที่มีโอกาส merge conflict สูง
6. ทำ checklist ของหน้านั้นให้ครบ แล้วเปิด Pull Request เข้าสู่ `main`

คำสั่งตรวจงานขั้นต่ำก่อนเปิด Pull Request:

```powershell
npm run lint
npm run build
npm run build:api
```

ถ้าแก้ฐานข้อมูลหรือ API ให้เปิด MariaDB และตรวจ health endpoint เพิ่มเติม:

```powershell
docker compose --env-file .env.database up -d
npm run dev:api
```

```text
GET http://localhost:3001/api/health
```

## 2. สัญลักษณ์สถานะ

- `พร้อมใช้` หมายถึงมี UI และเชื่อม API หลักแล้ว
- `บางส่วน` หมายถึงมีหน้าหรือ component แล้ว แต่ยังเป็นข้อมูลจำลองหรือข้อกำหนดยังไม่ครบ
- `ยังไม่มี` หมายถึงต้องสร้างหน้า, API หรือฐานข้อมูลใหม่

## 3. ข้อตกลงผลิตภัณฑ์ที่ใช้เป็นค่าเริ่มต้น

เพื่อให้เพื่อนเริ่มพัฒนาได้โดยไม่ตีความต่างกัน ให้ใช้ข้อตกลงต่อไปนี้จนกว่า Product Owner จะยืนยันการเปลี่ยนแปลง:

1. แบบประเมินหลักใช้ 9 สมรรถนะ IMPACTS3 และแต่ละสมรรถนะเลือกระดับ 1-7 ตามไฟล์แบบประเมินจริง
2. นักศึกษาไม่มี password โดยเข้าสู่แบบประเมินผ่าน QR token แล้วระบุตัวตนด้วยรหัสนักศึกษาและอีเมล
3. รหัสนักศึกษาต้องตรงกับ `^[BMD]\d{7}$` และแปลงตัวอักษรแรกเป็นตัวพิมพ์ใหญ่ก่อนตรวจ
4. ผู้ที่มี QR ที่ยัง valid สามารถเข้าร่วมได้ โดยยังไม่บังคับ upload รายชื่อล่วงหน้า
5. เมื่อ regenerate QR ให้ปิด token เดิมทันที แต่เก็บประวัติไว้ใน audit log
6. สถานะกิจกรรมมาตรฐานใช้ `draft`, `active`, `closed`, `archived`
7. การลบกิจกรรมเป็น soft delete หรือเปลี่ยนเป็น `archived`; ห้ามลบ response ของนักศึกษา
8. เวลาเปิด-ปิด Pre-test และ Post-test ต้องแยกกัน และ backend ต้องตรวจ time-window ทุกครั้ง

> หมายเหตุ: โค้ดปัจจุบันใช้สถานะ `processing`, `completed`, `draft`, `open`, `closed` ซึ่งยังไม่ตรง System Design ผู้ที่รับงาน Foundation ต้องทำ migration และปรับ type/API ก่อนให้หน้าอื่นอ้างอิงสถานะใหม่

## 4. งานส่วนกลางที่ต้องเสร็จก่อนหรือทำร่วมกัน

### 4.1 Routing

ปัจจุบัน `src/App.tsx` เปลี่ยนหน้าด้วย state `activePage` ทำให้เปิด URL ของหน้าลึกโดยตรงไม่ได้ และรองรับ `/s/:token` ไม่ได้

งานที่ต้องทำ:

- เพิ่ม client-side router ที่รองรับ route map ในหัวข้อ 5
- สร้าง `AdminRoute` สำหรับตรวจ admin session
- แยก layout ของ Admin และ Student ออกจากกัน
- กำหนดหน้า Not Found และ Unauthorized
- หลัง refresh ต้องยังอยู่หน้าเดิม ไม่ย้อนกลับ Dashboard

เจ้าของงานแนะนำ: 1 คนเท่านั้น
Branch แนะนำ: `foundation/routing`

### 4.2 Database migration

ฐานข้อมูลปัจจุบันมีเพียง `admins`, `activities`, `participants` และ `activity_participants` เป็นหลัก แต่ System Design ต้องรองรับ student identity, QR, survey template, competency levels, responses, answers และ logs

ตารางเป้าหมายให้อ้างอิงหัวข้อ 5 ของ System Design:

- `admin_users` หรือคง `admins` แต่ต้องเลือกชื่อเดียวทั้งระบบ
- `students`
- `activities`
- `qr_codes`
- `survey_templates`
- `competencies`
- `competency_levels`
- `questions`
- `question_options`
- `survey_responses`
- `response_answers`
- `activity_logs`
- `export_logs`

งานที่ต้องทำ:

- ห้ามแก้ production schema ด้วย `ALTER TABLE` แบบกระจายโดยไม่มีลำดับ migration
- สร้าง migration ที่รันซ้ำอย่างปลอดภัยหรือเลือก ORM/query migration tool ให้ทีมใช้เหมือนกัน
- seed 9 สมรรถนะและระดับ 1-7 จากเอกสารต้นทาง
- สร้าง unique key `(activity_id, student_id, phase)` เพื่อกันตอบซ้ำ
- ใช้ transaction ตอนบันทึก response และ answers

เจ้าของงานแนะนำ: Backend 1 คน
Branch แนะนำ: `foundation/survey-schema`

### 4.3 API และ error format

ใช้รูปแบบ response เดียวกันทุกหน้า:

```json
{
  "data": {},
  "message": "ข้อความสำหรับผู้ใช้"
}
```

รูปแบบ error:

```json
{
  "message": "ข้อมูลที่ส่งมายังไม่ถูกต้อง",
  "issues": [
    { "field": "studentCode", "message": "รูปแบบรหัสนักศึกษาไม่ถูกต้อง" }
  ]
}
```

กฎร่วม:

- Admin endpoint ทุกตัวต้องใช้ `requireAdmin`
- Public endpoint ต้องมี rate limit และ validation
- Frontend ต้องมี loading, empty, error และ success state
- ห้ามแสดง stack trace, SQL หรือข้อมูลลับให้ผู้ใช้
- ห้ามคำนวณสิทธิ์, time-window หรือ duplicate check เฉพาะ frontend

## 5. แผนที่หน้าทั้งระบบ

โค้ดจริงต้องเขียนใน `src/` สำหรับหน้าเว็บ และ `server/src/` สำหรับ API/ฐานข้อมูล ส่วน `docs/` และ `product requirement design/` เป็นเอกสารอ้างอิง ไม่ใช่ที่วาง component หรือ API

| ลำดับ | Route | หน้า | จุดเขียน Frontend หลัก | จุดเขียน Backend หลัก | สถานะ | Branch แนะนำ |
|---|---|---|---|---|---|---|
| 1 | `/admin/login` | Admin Login | `src/components/AdminLogin.tsx` | `server/src/routes/auth.ts` | บางส่วน | `page/admin-login` |
| 2 | `/admin/dashboard` | Dashboard ภาพรวม | `src/components/dashboard/Dashboard.tsx` | `server/src/routes/dashboard.ts` | บางส่วน | `page/admin-dashboard` |
| 3 | `/admin/activities` | รายการกิจกรรม | `src/components/dashboard/ActivitiesPanel.tsx` หรือสร้าง `src/components/activities/ActivitiesPage.tsx` | `server/src/routes/activities.ts` | บางส่วน | `page/activity-list` |
| 4 | `/admin/activities/new` | สร้างกิจกรรม | `src/components/dashboard/ActivityCreatePage.tsx` | `server/src/routes/activities.ts` | บางส่วน | `page/activity-create` |
| 5 | `/admin/activities/:activityId` | รายละเอียดกิจกรรมและ QR | สร้าง `src/components/activities/ActivityDetailPage.tsx` | สร้าง `server/src/routes/qr.ts` | ยังไม่มี | `page/activity-detail` |
| 6 | `/admin/assessments` | คลังแบบประเมินมาตรฐาน | `src/components/assessment/AssessmentSetupPage.tsx` | สร้าง `server/src/routes/surveyTemplates.ts` | บางส่วน | `page/assessment-template` |
| 7 | `/admin/participants` | นักศึกษา/ผู้เข้าร่วม | สร้าง `src/components/participants/ParticipantsPage.tsx` | ปรับ `server/src/routes/participants.ts` | ยังไม่มี UI | `page/participants` |
| 8 | `/admin/analytics` | Analytics | สร้าง `src/components/analytics/AnalyticsPage.tsx` | สร้าง `server/src/routes/analytics.ts` | ข้อมูลจำลอง | `page/analytics` |
| 9 | `/admin/reports` | Export และรายงาน | สร้าง `src/components/reports/ReportsPage.tsx` | สร้าง `server/src/routes/reports.ts` | ยังไม่มี | `page/reports` |
| 10 | `/admin/staff` | บัญชี Staff | สร้าง `src/components/staff/StaffPage.tsx` | สร้าง `server/src/routes/staff.ts` | ยังไม่มี | `page/admin-staff` |
| 11 | `/s/:token` | ตรวจ QR และข้อมูลนักศึกษา | สร้าง `src/components/student/StudentEntryPage.tsx` | สร้าง `server/src/routes/publicSurvey.ts` | ยังไม่มี | `page/student-entry` |
| 12 | `/s/:token/assessment` | แบบประเมินนักศึกษา | สร้าง `src/components/student/StudentAssessmentPage.tsx` | เพิ่ม endpoint ใน `server/src/routes/publicSurvey.ts` | ยังไม่มี | `page/student-assessment` |
| 13 | `/s/:token/result` | ผลหลังส่ง/คำตอบเดิม | สร้าง `src/components/student/StudentResultPage.tsx` | เพิ่ม endpoint ใน `server/src/routes/publicSurvey.ts` | ยังไม่มี | `page/student-result` |
| 14 | `/student/history` | ประวัติการตอบ | สร้าง `src/components/student/StudentHistoryPage.tsx` | สร้าง `server/src/routes/studentHistory.ts` | ยังไม่มี | `page/student-history` |

ไฟล์ส่วนกลางต่อไปนี้ให้ Integration Owner เป็นผู้แก้ หรือให้เพื่อนแจ้งทีมก่อนแก้:

- `src/App.tsx` สำหรับประกาศ route และเชื่อม page component
- `src/lib/api.ts` สำหรับเพิ่ม function เรียก API หรือแยกเป็นไฟล์ตาม domain
- `src/components/layout/DashboardSidebar.tsx` สำหรับเพิ่ม/เชื่อมเมนู
- `server/src/index.ts` สำหรับ mount router ใหม่
- `server/src/db/schema.ts` และไฟล์ migration สำหรับเปลี่ยนฐานข้อมูล
- `package.json` สำหรับเพิ่ม dependency หรือ script

ถ้าเพื่อนรับผิดชอบเฉพาะหนึ่งหน้า ให้เขียน component และ route API ของหน้านั้นก่อน แล้วระบุใน Pull Request ว่าต้องการให้ Integration Owner เชื่อมไฟล์ส่วนกลางรายการใด หลีกเลี่ยงการแก้ไฟล์ส่วนกลางพร้อมกันหลาย branch

## 6. แนวทางพัฒนาแต่ละหน้า

### หน้า 1: Admin Login

สถานะ: `บางส่วน`

ไฟล์ปัจจุบัน:

- `src/components/AdminLogin.tsx`
- `src/App.css`
- `src/lib/api.ts`
- `server/src/routes/auth.ts`
- `server/src/middleware/auth.ts`

สิ่งที่มีแล้ว:

- ตรวจรูปแบบอีเมลและ required password
- Login ผ่าน API และเก็บ JWT ใน HttpOnly cookie
- Remember email ใน localStorage
- Logout และตรวจ session ด้วย `/api/auth/me`

งานที่ต้องเพิ่ม:

- ย้ายหน้าไป route `/admin/login`
- ถ้ามี session แล้วให้ redirect ไป `/admin/dashboard`
- ถ้า API ตอบ `401` ให้ล้าง state และกลับหน้า Login
- ทำหน้า/flow ลืมรหัสผ่านจริง ไม่ใช้ demo notice
- เพิ่มเปลี่ยนรหัสผ่านและ reset token ที่มีวันหมดอายุ
- บันทึก login success/failure ที่เหมาะสมโดยไม่เก็บ password
- ลบ demo credential ออกจาก UI ใน production

API ที่เกี่ยวข้อง:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password` ใหม่
- `POST /api/auth/reset-password` ใหม่

เกณฑ์รับงาน:

- [ ] Login สำเร็จและ redirect ถูกต้อง
- [ ] Login ผิดแสดงข้อความโดยไม่เปิดเผยว่าพบบัญชีหรือไม่
- [ ] Refresh แล้วยังคง session ได้
- [ ] Cookie เป็น HttpOnly, SameSite และ Secure ใน production
- [ ] กด Logout แล้ว route ที่ป้องกันไว้เปิดไม่ได้
- [ ] ใช้งานด้วย keyboard และมี label/error ที่ screen reader อ่านได้

### หน้า 2: Admin Dashboard

สถานะ: `บางส่วน`

ไฟล์ปัจจุบัน:

- `src/components/dashboard/Dashboard.tsx`
- `src/components/dashboard/SummaryCards.tsx`
- `src/components/dashboard/AnalyticsPanels.tsx`
- `src/components/dashboard/SkillGrowthChart.tsx`
- `src/components/dashboard/TopSkillsCard.tsx`
- `server/src/routes/dashboard.ts`

สิ่งที่มีแล้ว:

- โหลดจำนวนกิจกรรมและผู้เข้าร่วมจาก MariaDB
- แสดงรายการกิจกรรมล่าสุด
- ค้นหากิจกรรมฝั่ง client
- การ์ดสรุป 4 รายการ

งานที่ต้องเพิ่ม:

- แยก Activities table ไปหน้า `/admin/activities` หรือแสดงเฉพาะ 5 รายการล่าสุดบน Dashboard
- เปลี่ยนกราฟและ Top Skills จาก `dashboardData.ts` เป็นข้อมูล API จริง
- ลบข้อความคงที่ `+12%` และ `92% Completion` หากยังไม่มีข้อมูลคำนวณรองรับ
- เพิ่ม filter ช่วงวันที่และกิจกรรม
- แสดงจำนวน Pre, Post, paired response และ completion rate ให้ความหมายชัดเจน
- เพิ่ม empty state เมื่อยังไม่มีกิจกรรมและ CTA ไปหน้าสร้างกิจกรรม

API เป้าหมาย:

- `GET /api/dashboard/summary?from=&to=&activityId=`
- `GET /api/dashboard/competency-growth?from=&to=&activityId=`
- `GET /api/dashboard/recent-activities?limit=5`

กติกาการคำนวณ:

- `preCount` = จำนวน response phase `pre`
- `postCount` = จำนวน response phase `post`
- `pairedCount` = นักศึกษาที่มีทั้ง Pre และ Post ในกิจกรรมเดียวกัน
- `completionRate` = `pairedCount / preCount * 100` โดยป้องกันหารศูนย์
- `growth` = ค่าเฉลี่ย Post - ค่าเฉลี่ย Pre และควรระบุว่าเป็น paired หรือ unpaired aggregation

เกณฑ์รับงาน:

- [ ] ไม่มีตัวเลขหรือกราฟจำลองใน production
- [ ] Filter เปลี่ยนทุก card/chart จาก query ชุดเดียวกัน
- [ ] Loading และ API error ไม่ทำให้ layout พัง
- [ ] กราฟมี legend, label และคำอธิบายสำหรับผู้ใช้ที่มองสีไม่ชัด
- [ ] Desktop, tablet และ mobile อ่านข้อมูลหลักได้

### หน้า 3: รายการกิจกรรม

สถานะ: `บางส่วน`

ไฟล์ที่ควรใช้หรือแยกต่อ:

- `src/components/dashboard/ActivitiesPanel.tsx`
- `src/components/dashboard/ActivityRow.tsx`
- `src/components/dashboard/ActivityFilters.tsx`
- `src/components/dashboard/Pagination.tsx`
- `server/src/routes/activities.ts`

งานที่ต้องเพิ่ม:

- สร้าง page component สำหรับ `/admin/activities`
- ย้าย search/filter/pagination ไป query ฝั่ง server
- Filter ตามสถานะ, วันที่ และกลุ่มเป้าหมาย
- ปุ่ม View ต้องไป `/admin/activities/:activityId` แทน demo notice
- เปลี่ยน delete จาก `DELETE` จริงเป็น archive/soft delete
- ทำ pagination จากจำนวนข้อมูลจริง ไม่แสดงหน้า 1, 2, 3, 40 แบบคงที่
- ทำ status transition ตามกฎ `draft -> active -> closed -> archived`
- แสดง Pre/Post เป็นจำนวนผู้ตอบและเปอร์เซ็นต์ที่คำนวณจาก response จริง

API เป้าหมาย:

- `GET /api/activities?q=&status=&from=&to=&page=&pageSize=`
- `PATCH /api/activities/:id/status`
- `DELETE /api/activities/:id` ให้หมายถึง archive หรือใช้ `POST /archive` ให้ชัดเจน

เกณฑ์รับงาน:

- [ ] URL เก็บค่า filter/page เพื่อแชร์และ refresh ได้
- [ ] ผลลัพธ์และจำนวนหน้ามาจาก backend
- [ ] ลบกิจกรรมแล้ว response เดิมยังอยู่
- [ ] เปิด/ปิดกิจกรรมที่ผิดลำดับไม่ได้
- [ ] ตารางบนมือถือเปลี่ยนเป็น card/list ที่อ่านและกด action ได้

### หน้า 4: สร้างและแก้ไขกิจกรรม

สถานะ: `บางส่วน`

ไฟล์ปัจจุบัน:

- `src/components/dashboard/ActivityCreatePage.tsx`
- `src/components/dashboard/EditActivityModal.tsx`
- `src/components/dashboard/types.ts`
- `server/src/routes/activities.ts`
- `server/src/db/schema.ts`

ฟิลด์เป้าหมาย:

- รหัสกิจกรรม `code`
- ชื่อ `name`
- รายละเอียด `description`
- สถานที่ `location`
- วันที่เริ่มและสิ้นสุดกิจกรรม
- เวลาเปิดและปิด Pre-test
- เวลาเปิดและปิด Post-test
- กลุ่มเป้าหมายและจำนวนรองรับ ถ้ายังใช้ในรายงาน
- สถานะ โดยการสร้างครั้งแรกเป็น `draft`

งานที่ต้องแก้จากโค้ดปัจจุบัน:

- `preTestDurationMinutes` และ `postTestDurationMinutes` ไม่ใช่ time-window ตาม PRD ต้องเพิ่ม open/close datetime แยกกัน
- `Save Draft` กับ `Save & Continue` ปัจจุบัน submit แบบเดียวกัน ต้องแยก behavior
- `Save Draft` บันทึกแล้วอยู่หน้าเดิมหรือกลับรายการ พร้อมข้อความสำเร็จ
- `Save & Continue` บันทึกแล้วไปหน้ารายละเอียดเพื่อสร้าง QR
- แยก create page กับ edit pageให้ใช้ form/schema ชุดเดียวกัน ลด validation ซ้ำ
- Backend ต้องตรวจ open < close และ Pre/Post window สอดคล้องกับวันที่กิจกรรม

API เป้าหมาย:

- `POST /api/activities`
- `GET /api/activities/:id`
- `PATCH /api/activities/:id`

เกณฑ์รับงาน:

- [ ] Required field และวันเวลาแสดง inline error
- [ ] Frontend และ backend ใช้กฎ validation ตรงกัน
- [ ] Draft บันทึกข้อมูลไม่ครบเฉพาะฟิลด์ที่อนุญาตได้
- [ ] Active activity ต้องมี time-window ครบและ template ที่ active
- [ ] แก้ไขแล้วข้อมูล Dashboard/รายการกิจกรรมอัปเดตจาก API
- [ ] ก่อนออกจากหน้าที่แก้แล้วยังไม่บันทึก มีคำเตือน

### หน้า 5: รายละเอียดกิจกรรมและ QR

สถานะ: `ยังไม่มี`

ไฟล์ที่แนะนำ:

- `src/components/activities/ActivityDetailPage.tsx`
- `src/components/activities/ActivityOverview.tsx`
- `src/components/activities/ActivityQrPanel.tsx`
- `server/src/routes/qr.ts`

ส่วนประกอบของหน้า:

- ข้อมูลกิจกรรมและสถานะ
- ช่วงเวลา Pre/Post พร้อมสถานะ `ยังไม่เปิด`, `กำลังเปิด`, `ปิดแล้ว`
- จำนวนผู้ตอบ Pre, Post และ paired
- QR Pre-test และ QR Post-test แยกกัน
- ปุ่ม Generate, Regenerate, Copy Link และ Download PNG
- ประวัติการสร้าง/ยกเลิก token
- ปุ่มแก้ไขกิจกรรม, ปิดกิจกรรม และไป Analytics รายกิจกรรม

API เป้าหมาย:

- `GET /api/activities/:id`
- `GET /api/activities/:id/qr`
- `POST /api/activities/:id/qr` body `{ "phase": "pre" }`
- `POST /api/activities/:id/qr/:qrId/regenerate`
- `GET /api/activities/:id/qr/:qrId/png`

กฎสำคัญ:

- token ใช้ UUID/random ที่เดาไม่ได้ ห้ามใช้ activity id ตรง ๆ
- QR Pre ต้อง resolve เป็น phase `pre`; QR Post ต้อง resolve เป็น `post`
- Regenerate ต้องทำใน transaction: ปิด token เดิม, สร้างใหม่, เขียน audit log
- ห้ามให้ QR endpoint ส่งข้อมูลส่วนตัวหรือข้อมูล response

เกณฑ์รับงาน:

- [ ] QR ที่ดาวน์โหลดสแกนแล้วเปิด URL ถูกต้อง
- [ ] token เก่าใช้ไม่ได้หลัง regenerate
- [ ] token ที่ยังไม่เปิด/ปิดแล้วแสดงหน้าสถานะ ไม่แสดงแบบประเมิน
- [ ] Staff ที่ไม่ได้ login เปิดหน้า admin detail ไม่ได้
- [ ] refresh หน้าแล้ว QR และสถิติยังอยู่ครบ

### หน้า 6: คลังแบบประเมินมาตรฐาน

สถานะ: `บางส่วน`

ไฟล์ปัจจุบัน:

- `src/components/assessment/AssessmentSetupPage.tsx`
- `src/components/assessment/assessmentData.ts`

ปัญหาปัจจุบัน:

- หน้าแสดง 9 card แต่ชื่อยังไม่ตรง 9 สมรรถนะในเอกสารจริง
- ข้อความ `18 Total` และคำอธิบายหลายจุดเป็นข้อมูลคงที่
- ปุ่มบันทึกยังไม่เรียก API
- Sidebar เรียก demo action สำหรับ Assessments จึงยังเข้า page นี้จากเมนูไม่ได้

9 สมรรถนะที่ต้องใช้:

1. ความซื่อสัตย์และความเป็นผู้นำที่มีจริยธรรม
2. ทัศนคติเพื่อการเติบโตและความสามารถในการเรียนรู้อย่างคล่องตัว
3. ความสามารถในการแก้ปัญหาและการคิดเชิงวิพากษ์
4. ความสามารถในการปรับตัว ความว่องไว และความยืดหยุ่น
5. ความคิดสร้างสรรค์และการสร้างนวัตกรรมที่มีคุณค่า
6. การทำงานเป็นทีมและความเข้าอกเข้าใจ
7. การคิดเชิงระบบเพื่อความยั่งยืน
8. นวัตกรรมเพื่อสังคมและความเข้าใจผู้อื่น
9. การคิดเชิงกลยุทธ์ การบริหารความเสี่ยง และการมองการณ์ไกล

งานที่ต้องเพิ่ม:

- โหลด template, competency และ level จาก API
- แสดงคำจำกัดความและระดับ 1-7 ของแต่ละสมรรถนะ
- แก้ไขข้อมูลผ่าน modal/page ย่อย พร้อม preview แบบที่นักศึกษาจะเห็น
- ใช้ versioning: เมื่อ template มี response แล้ว ห้ามแก้ทับ ให้ clone เป็น version ใหม่
- มี active template ได้หนึ่งชุดในเวลาเดียวกัน
- แสดง draft/published/archived และผู้แก้ล่าสุด

API เป้าหมาย:

- `GET /api/survey-templates`
- `GET /api/survey-templates/:id`
- `POST /api/survey-templates/:id/clone`
- `PATCH /api/competencies/:id`
- `PATCH /api/competencies/:id/levels/:level`
- `POST /api/survey-templates/:id/activate`

เกณฑ์รับงาน:

- [ ] ชื่อ คำนิยาม ระดับ และตัวอย่างตรงเอกสารต้นทาง
- [ ] มี 9 สมรรถนะและแต่ละด้านมีระดับ 1-7 ครบ
- [ ] แก้ published template ที่มี response โดยตรงไม่ได้
- [ ] Preview ใช้ component เดียวกับ Student Assessment เพื่อลด UI ต่างกัน
- [ ] เมนู Assessments เปิดหน้าจริงได้

### หน้า 7: นักศึกษาและผู้เข้าร่วม

สถานะ: `ยังไม่มี UI` และ backend ปัจจุบันรองรับเพียง `name`, `email`

ไฟล์ปัจจุบัน:

- `server/src/routes/participants.ts`
- `server/src/db/schema.ts`

ไฟล์ที่แนะนำเพิ่ม:

- `src/components/participants/ParticipantsPage.tsx`
- `src/components/participants/ParticipantDetailDrawer.tsx`

ข้อมูลเป้าหมาย:

- `studentCode`
- ชื่อและนามสกุลแยก field
- email
- คณะ, สาขา และเบอร์โทรถ้าจำเป็น
- เวลายินยอม PDPA
- กิจกรรมที่เข้าร่วมและสถานะ Pre/Post

งานที่ต้องทำ:

- ปรับแนวคิดจาก generic participant เป็น student master ตาม System Design
- ทำ search/filter ตามรหัส, ชื่อ, คณะ และกิจกรรม
- แสดงประวัติการตอบโดยไม่เปิดคำตอบส่วนบุคคลเกินสิทธิ์
- ทำ pagination ฝั่ง server
- ถ้าจะรองรับ upload รายชื่อ ให้ทำเป็นงานแยกหลัง Product Owner ยืนยัน

API เป้าหมาย:

- `GET /api/students?q=&faculty=&activityId=&page=&pageSize=`
- `GET /api/students/:id`
- `PATCH /api/students/:id`
- `GET /api/students/:id/responses`

เกณฑ์รับงาน:

- [ ] รหัสนักศึกษาห้ามซ้ำและผ่าน regex
- [ ] Search/filter ทำงานกับ pagination จริง
- [ ] ข้อมูลส่วนบุคคลไม่ถูก log ใน browser console
- [ ] การแก้ student master ไม่ทำให้ response เดิมหลุดการเชื่อมโยง
- [ ] มี empty/error/loading state

### หน้า 8: ตรวจ QR และยืนยันข้อมูลนักศึกษา

สถานะ: `ยังไม่มี`

ไฟล์ที่แนะนำ:

- `src/components/student/StudentEntryPage.tsx`
- `src/components/student/StudentIdentityForm.tsx`
- `src/components/student/SurveyWindowState.tsx`
- `server/src/routes/publicSurvey.ts`

ลำดับการทำงาน:

1. เปิด `/s/:token`
2. Frontend เรียก API resolve token
3. Backend ตรวจ token, phase และ time-window
4. ถ้า valid แสดงชื่อกิจกรรม, phase และฟอร์มข้อมูลนักศึกษา
5. นักศึกษากรอกชื่อ, นามสกุล, รหัสนักศึกษา, email และ consent
6. Backend lookup/create student และตรวจ duplicate response
7. ถ้ายังไม่ตอบ ออก short-lived survey session แล้วไปหน้า Assessment
8. ถ้าเคยตอบแล้ว ไปหน้าผลเดิมโดยไม่อนุญาตให้ส่งซ้ำ

API เป้าหมาย:

- `GET /api/public/surveys/:token`
- `POST /api/public/surveys/:token/identify`

สถานะที่ UI ต้องรองรับ:

- token ไม่ถูกต้อง
- token ถูกยกเลิก
- ยังไม่ถึงเวลาเปิด
- ปิดรับแล้ว
- กิจกรรมถูก archive
- เคยตอบ phase นี้แล้ว
- API/network error

เกณฑ์รับงาน:

- [ ] Mobile-first และ input มี font size อย่างน้อย 16px
- [ ] touch target อย่างน้อย 44px
- [ ] student code normalize เป็น uppercase และตรวจทั้ง frontend/backend
- [ ] email และ required field มี inline error
- [ ] ต้องยอมรับ PDPA ก่อนดำเนินการ
- [ ] response API ไม่เปิดเผยว่ารหัสนักศึกษาอื่นมีข้อมูลอะไร
- [ ] refresh ระหว่าง flow มีวิธีกู้ session หรือเริ่ม identify ใหม่อย่างปลอดภัย

### หน้า 9: แบบประเมินนักศึกษา

สถานะ: `ยังไม่มี`

ไฟล์ที่แนะนำ:

- `src/components/student/StudentAssessmentPage.tsx`
- `src/components/student/CompetencyQuestion.tsx`
- `src/components/student/LevelOptionCard.tsx`
- `src/components/student/AssessmentProgress.tsx`

พฤติกรรมของหน้า:

- แสดงครั้งละหนึ่งสมรรถนะจากทั้งหมด 9 ด้าน
- แสดงชื่อ, คำนิยาม และระดับ 1-7 พร้อมคำอธิบาย/ตัวอย่าง
- นักศึกษาเลือกระดับเดียวต่อสมรรถนะ
- มี Previous/Next และ progress `ข้อ X จาก 9`
- ก่อนส่งแสดง summary ว่าตอบครบทุกด้าน
- ปุ่ม Submit ต้องป้องกัน double click
- หลัง submit สำเร็จแทนที่ form ด้วย redirect ไป Result

การเก็บ state:

- ใช้ object keyed ด้วย `questionId` หรือ `competencyId`
- ห้ามอ้างอิง array index เป็น identity ของคำตอบ
- เก็บ draft เฉพาะใน session/local storage โดยไม่เก็บชื่อหรือ email ถ้าไม่จำเป็น
- ล้าง draft หลังส่งสำเร็จ

API เป้าหมาย:

- `GET /api/public/surveys/:token/questions`
- `POST /api/public/surveys/:token/responses`

ตัวอย่าง request:

```json
{
  "surveySession": "short-lived-token",
  "answers": [
    { "questionId": 101, "competencyId": 1, "levelValue": 4 }
  ]
}
```

Backend ต้องทำใน transaction:

1. ตรวจ survey session และ token
2. ตรวจ time-window อีกครั้ง
3. ตรวจครบทุก required question
4. ตรวจ level อยู่ระหว่าง 1-7
5. insert `survey_responses`
6. insert `response_answers`
7. ถ้า unique key ชน ให้ตอบ conflict และส่งไปดูผลเดิม

เกณฑ์รับงาน:

- [ ] คำถามครบ 9 และเลือกได้เฉพาะ 1-7
- [ ] Reload แล้วไม่เกิด response ซ้ำ
- [ ] Submit ซ้ำหรือยิง API พร้อมกันสร้าง response ได้หนึ่งชุดเท่านั้น
- [ ] ใช้ keyboard เลือกระดับและเลื่อนไปข้อถัดไปได้
- [ ] ข้อความยาวไม่ล้นบนหน้าจอ 360px
- [ ] แสดงคำอธิบายและตัวอย่างโดยไม่ทำให้ผู้ใช้สับสนว่าตัวอย่างคือคำตอบบังคับ

### หน้า 10: ผลการประเมินและคำตอบเดิม

สถานะ: `ยังไม่มี`

ไฟล์ที่แนะนำ:

- `src/components/student/StudentResultPage.tsx`
- `src/components/student/PersonalSkillChart.tsx`

ส่วนประกอบ:

- ข้อความบันทึกสำเร็จ
- ชื่อกิจกรรมและ phase Pre/Post
- สรุประดับ 9 สมรรถนะ
- Radar/bar chart รายบุคคลที่อ่านได้ทั้งจากภาพและข้อความ
- ถ้ามีทั้ง Pre/Post ให้แสดงการเปลี่ยนแปลง โดยไม่สรุปเกินข้อมูลจริง
- ถ้าเปิดจาก duplicate response ให้แสดงว่าเคยตอบแล้วและเป็นผลเดิม

API เป้าหมาย:

- `GET /api/public/surveys/:token/result` โดยใช้ survey session ที่พิสูจน์ตัวตนแล้ว

เกณฑ์รับงาน:

- [ ] ไม่สามารถเปลี่ยน response หลัง submit
- [ ] ห้ามเข้าผลของบุคคลอื่นด้วยการเดา response id
- [ ] กราฟมีรายการตัวเลขแบบข้อความเสมอ
- [ ] refresh แล้วเปิดผลเดิมได้ตราบที่ session ยัง valid
- [ ] ไม่มีข้อมูลเปรียบเทียบ Post ถ้ายังไม่มี paired Pre/Post

### หน้า 11: ประวัติการตอบของนักศึกษา

สถานะ: `ยังไม่มี`

ข้อควรระวัง: การใช้เพียง student code + email เพื่อเปิดประวัติทั้งหมดมีความเสี่ยงต่อข้อมูลส่วนบุคคล ควรใช้ OTP, magic link หรือ session ที่มีอายุสั้นก่อนเปิดรายละเอียด

ไฟล์ที่แนะนำ:

- `src/components/student/StudentHistoryPage.tsx`
- `server/src/routes/studentHistory.ts`

งานที่ต้องทำ:

- ทำหน้า request OTP/magic link
- แสดงรายการกิจกรรม, วันที่, phase และสถานะ
- เปิดผลรายกิจกรรมหลังยืนยัน session
- ไม่แสดงประวัติใน response ของ endpoint lookup ธรรมดา

เกณฑ์รับงาน:

- [ ] ผู้ใช้ต้องยืนยันสิทธิ์ก่อนดูประวัติ
- [ ] OTP/token มีวันหมดอายุและใช้ซ้ำตามนโยบายที่กำหนดไม่ได้
- [ ] rate limit การขอ OTP และการลองรหัส
- [ ] ไม่เปิดเผยว่า email ใดมีบัญชีหรือประวัติหรือไม่

### หน้า 12: Analytics

สถานะ: `บางส่วน` เฉพาะ UI กราฟจำลองใน Dashboard

ไฟล์ที่แนะนำ:

- `src/components/analytics/AnalyticsPage.tsx`
- `src/components/analytics/CompetencyComparisonChart.tsx`
- `src/components/analytics/ParticipationBreakdown.tsx`
- `src/components/analytics/StudentGrowthTable.tsx`
- `server/src/routes/analytics.ts`

ส่วนประกอบ:

- Filter ช่วงวันที่, กิจกรรม, คณะ และระดับการศึกษา
- Bar chart Pre vs Post แยก 9 สมรรถนะ
- Radar chart Pre vs Post
- สัดส่วนผู้เข้าร่วมตามข้อมูลที่มีจริง
- ตารางรายบุคคลที่จำกัดสิทธิ์และรองรับ pagination
- คำอธิบายสูตรและจำนวน sample ของกราฟ

API เป้าหมาย:

- `GET /api/analytics/overview`
- `GET /api/analytics/competencies`
- `GET /api/analytics/participants`
- `GET /api/analytics/students`

กฎข้อมูล:

- แสดง `n` ของ Pre, Post และ paired ทุกครั้ง
- ใช้ null เมื่อไม่มีข้อมูล ห้ามแทนด้วย 0 แล้วทำให้เข้าใจว่าคะแนนเป็นศูนย์
- กำหนดจำนวนทศนิยมให้เหมือนกันทั้ง API และ UI
- Query ต้อง group ตาม competency และ phase โดยไม่ทำให้ student ที่ตอบซ้ำถูกนับเกิน

เกณฑ์รับงาน:

- [ ] ตัวเลขใน card, chart และตารางตรงกันเมื่อใช้ filter เดียวกัน
- [ ] Filter อยู่ใน URL และ refresh ได้
- [ ] ไม่มีข้อมูลจำลอง
- [ ] กราฟแสดง sample size และสูตร growth
- [ ] Query ข้อมูลจำนวนมากมี index และ pagination ที่เหมาะสม

### หน้า 13: Reports และ Export

สถานะ: `ยังไม่มี`

ไฟล์ที่แนะนำ:

- `src/components/reports/ReportsPage.tsx`
- `server/src/routes/reports.ts`
- `server/src/services/exportService.ts`

รูปแบบ Export:

- Raw Data `.xlsx`: student identifier, activity, phase, submitted time และคำตอบรายข้อ
- Summary `.xlsx`: จำนวนผู้ตอบ, ค่าเฉลี่ย Pre/Post และ growth ต่อสมรรถนะ

งานที่ต้องทำ:

- เลือกกิจกรรมและช่วงวันที่ก่อน export
- แสดงชนิดข้อมูลและคำเตือน PDPA
- สร้างไฟล์ฝั่ง backend
- บันทึก `export_logs` ว่าใคร export อะไร เมื่อใด
- ตั้งชื่อไฟล์ที่มี activity code และวันที่
- ป้องกัน formula injection ใน cell ที่เริ่มด้วย `=`, `+`, `-`, `@`

API เป้าหมาย:

- `POST /api/reports/raw-export`
- `POST /api/reports/summary-export`
- `GET /api/reports/export-history`

เกณฑ์รับงาน:

- [ ] Excel เปิดได้และหัวคอลัมน์มีความหมาย
- [ ] Pre/Post เชื่อมด้วย student code และ activity ถูกต้อง
- [ ] Filter ในไฟล์ตรงกับค่าที่เลือกใน UI
- [ ] ทุก export มี audit record
- [ ] Staff ที่ไม่ได้รับสิทธิ์ export ถูกปฏิเสธ
- [ ] ข้อมูล text ป้องกัน spreadsheet formula injection

### หน้า 14: จัดการบัญชี Staff

สถานะ: `ยังไม่มี`

หน้านี้ทำหลัง core survey flow ใช้งานได้ โดยจำกัดเฉพาะ Super Admin

ไฟล์ที่แนะนำ:

- `src/components/staff/StaffPage.tsx`
- `server/src/routes/staff.ts`

งานที่ต้องทำ:

- list/create/disable Staff
- กำหนด role `super_admin` และ `staff`
- reset password โดยไม่แสดง password เดิม
- บันทึก audit log
- ป้องกัน Super Admin ปิดบัญชีตัวเองโดยไม่ตั้งใจ

เกณฑ์รับงาน:

- [ ] Staff เปิดหน้านี้ไม่ได้
- [ ] Password hash ด้วย Argon2 และไม่เคยส่งกลับ frontend
- [ ] Disable แล้ว session เดิมถูกยกเลิกตามนโยบาย
- [ ] การเปลี่ยน role และสถานะมี audit log

## 7. Shared component ที่ควรใช้ร่วมกัน

ก่อนสร้าง component ใหม่ ให้ตรวจ `src/components/ui` และ layout ที่มีอยู่ก่อน

ควรใช้ร่วมกัน:

- `Button`, `IconButton`, `TextField`, `Card`, `Notice`
- loading indicator/skeleton กลาง
- empty state กลาง
- confirm dialog กลาง แทน `window.confirm` ในระยะถัดไป
- date/time field กลาง
- chart color/legend tokens กลาง
- `CompetencyQuestion` ร่วมกันระหว่าง Admin Preview และ Student Assessment

กฎ component:

- page component ทำหน้าที่โหลดข้อมูลและประสาน action
- presentational component รับข้อมูลผ่าน props และไม่เรียก API โดยตรง
- API function รวมไว้ใน `src/lib/api.ts` หรือแยกเป็น module ตาม domain เมื่อไฟล์เริ่มใหญ่
- type ที่ใช้ร่วมกับ API ห้ามซ้ำหลายไฟล์โดยมี field ไม่ตรงกัน
- หลีกเลี่ยง hardcoded demo data ใน component; test fixture แยกไฟล์และไม่ถูกใช้ใน production

## 8. ลำดับ merge ที่แนะนำ

1. `foundation/routing`
2. `foundation/survey-schema`
3. `page/admin-login` และ `page/activity-list`
4. `page/activity-create`
5. `page/assessment-template`
6. `page/activity-detail`
7. `page/student-entry`
8. `page/student-assessment`
9. `page/student-result`
10. `page/participants`
11. `page/admin-dashboard` และ `page/analytics`
12. `page/reports`
13. `page/student-history` และ `page/admin-staff`

หน้า Student Entry, Assessment และ Result ควรมี integration owner คนเดียว หรือ merge ต่อเนื่องตามลำดับ เพราะใช้ token/session และ response contract ชุดเดียวกัน

## 9. Definition of Done ร่วมทุกหน้า

- [ ] ตรง PRD และข้อตกลงในหัวข้อ 3
- [ ] ไม่มีปุ่มที่กดแล้วขึ้นเพียงข้อความ "ขั้นถัดไป" โดยไม่มี label ว่าเป็น disabled/coming soon
- [ ] มี loading, empty, validation error, server error และ success state
- [ ] รองรับ keyboard และ focus ที่มองเห็นได้
- [ ] form control มี label และ error เชื่อมด้วย ARIA ที่เหมาะสม
- [ ] Mobile 360px, tablet และ desktop ใช้งานได้
- [ ] API ตรวจ validation และ authorization ฝั่ง server
- [ ] ไม่ log password, token, email หรือคำตอบส่วนตัวโดยไม่จำเป็น
- [ ] ไม่ใช้ข้อมูลจำลองใน production path
- [ ] `npm run lint`, `npm run build`, `npm run build:api` ผ่าน
- [ ] Pull Request อธิบาย route, API, migration และวิธีทดสอบ
- [ ] ถ้ามี migration ต้องมีวิธี rollback หรือ recovery ที่ระบุชัดเจน

## 10. Pull Request template แบบสั้น

คัดลอกส่วนนี้ไปใส่คำอธิบาย Pull Request:

```markdown
## หน้าที่พัฒนา

- Route:
- Branch:
- ผู้รับผิดชอบ:

## สิ่งที่ทำ

-

## API / Database ที่เปลี่ยน

-

## วิธีทดสอบ

1.

## Checklist

- [ ] lint ผ่าน
- [ ] frontend build ผ่าน
- [ ] API build ผ่าน
- [ ] ทดสอบ mobile
- [ ] ทดสอบ error/empty/loading
- [ ] ไม่มี secret หรือข้อมูลส่วนตัวใน commit
```
