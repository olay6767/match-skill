import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

export function isMailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM)
}

export async function sendPasswordResetEmail(recipient: string, resetUrl: string) {
  if (!isMailConfigured()) throw new Error('SMTP is not configured')

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  })

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: recipient,
    subject: 'ตั้งรหัสผ่านใหม่สำหรับ SEDA Skill Analytics',
    text: `มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ\n\nเปิดลิงก์นี้ภายใน 30 นาที:\n${resetUrl}\n\nหากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้`,
    html: `<p>มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ</p><p><a href="${resetUrl}">ตั้งรหัสผ่านใหม่</a> (ลิงก์หมดอายุใน 30 นาที)</p><p>หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้</p>`,
  })
}

export async function sendStudentHistoryOtpEmail(recipient: string, otp: string) {
  if (!isMailConfigured()) throw new Error('SMTP is not configured')

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  })

  await transport.sendMail({
    from: env.SMTP_FROM,
    to: recipient,
    subject: 'รหัสยืนยันเพื่อดูประวัติการประเมิน SEDA',
    text: `รหัสยืนยันของคุณคือ ${otp}\n\nรหัสนี้ใช้ได้ครั้งเดียวและหมดอายุใน 10 นาที\nหากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้`,
    html: `<p>รหัสยืนยันของคุณคือ <strong>${otp}</strong></p><p>รหัสนี้ใช้ได้ครั้งเดียวและหมดอายุใน 10 นาที</p><p>หากคุณไม่ได้เป็นผู้ขอ สามารถละเว้นอีเมลนี้ได้</p>`,
  })
}
