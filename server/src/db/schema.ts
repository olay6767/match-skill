import { pool } from './pool.js'
import { ensureAssessmentSeed } from './assessmentSeed.js'

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'staff',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    session_version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER role`,
  `ALTER TABLE admins ADD COLUMN IF NOT EXISTS session_version INT UNSIGNED NOT NULL DEFAULT 1 AFTER is_active`,
  `UPDATE admins SET role = 'super_admin' WHERE role = 'admin'`,
  `CREATE TABLE IF NOT EXISTS activities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    detail VARCHAR(255),
    activity_date DATE,
    participant_limit INT UNSIGNED NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'draft',
    pre_test_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    post_test_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_by BIGINT UNSIGNED,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_activities_admin FOREIGN KEY (created_by)
      REFERENCES admins(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS admin_password_reset_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_reset_admin FOREIGN KEY (admin_id)
      REFERENCES admins(id) ON DELETE CASCADE,
    INDEX idx_password_reset_expiry (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS admin_auth_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NULL,
    email VARCHAR(255) NOT NULL,
    action ENUM('login_success','login_failure','password_reset_requested','password_reset_completed','password_changed') NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_log_admin FOREIGN KEY (admin_id)
      REFERENCES admins(id) ON DELETE SET NULL,
    INDEX idx_auth_log_created (created_at),
    INDEX idx_auth_log_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS start_time TIME NULL AFTER activity_date`,
  `ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS end_time TIME NULL AFTER start_time`,
  `ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS target_group VARCHAR(120) NULL AFTER end_time`,
  `ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS pre_test_duration_minutes INT UNSIGNED NOT NULL DEFAULT 15 AFTER target_group`,
  `ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS post_test_duration_minutes INT UNSIGNED NOT NULL DEFAULT 15 AFTER pre_test_duration_minutes`,
  `ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS pre_test_enabled BOOLEAN NULL AFTER post_test_duration_minutes`,
  `ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS post_test_enabled BOOLEAN NULL AFTER pre_test_enabled`,
  `UPDATE activities
    SET pre_test_enabled = TRUE, post_test_enabled = TRUE
    WHERE status = 'active' AND pre_test_enabled IS NULL AND post_test_enabled IS NULL`,
  `UPDATE activities
    SET pre_test_enabled = COALESCE(pre_test_enabled, FALSE), post_test_enabled = COALESCE(post_test_enabled, FALSE)`,
  `ALTER TABLE activities
    MODIFY COLUMN pre_test_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    MODIFY COLUMN post_test_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE activities
    ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL AFTER status`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS code VARCHAR(50) NULL AFTER id`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_activities_code ON activities (code)`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS location VARCHAR(255) NULL AFTER detail`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS cover_image_data LONGTEXT NULL AFTER detail`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS assessment_image_data LONGTEXT NULL AFTER cover_image_data`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS form_theme_json LONGTEXT NULL AFTER assessment_image_data`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_date DATE NULL AFTER location`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_date DATE NULL AFTER start_date`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS pre_open_at DATETIME NULL AFTER end_date`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS pre_close_at DATETIME NULL AFTER pre_open_at`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS post_open_at DATETIME NULL AFTER pre_close_at`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS post_close_at DATETIME NULL AFTER post_open_at`,
  `UPDATE activities SET status = 'active' WHERE status IN ('open', 'processing')`,
  `UPDATE activities SET status = 'closed' WHERE status = 'completed'`,
  `CREATE TABLE IF NOT EXISTS participants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS activity_participants (
    activity_id BIGINT UNSIGNED NOT NULL,
    participant_id BIGINT UNSIGNED NOT NULL,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (activity_id, participant_id),
    CONSTRAINT fk_activity_participants_activity FOREIGN KEY (activity_id)
      REFERENCES activities(id) ON DELETE CASCADE,
    CONSTRAINT fk_activity_participants_participant FOREIGN KEY (participant_id)
      REFERENCES participants(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS students (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_code VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_students_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL AFTER student_code`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL AFTER first_name`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS faculty VARCHAR(150) NULL AFTER email`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS major VARCHAR(150) NULL AFTER faculty`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS education_level VARCHAR(80) NULL AFTER major`,
  `UPDATE students
    SET education_level = CASE UPPER(LEFT(TRIM(student_code), 1))
      WHEN 'B' THEN 'ปริญญาตรี'
      WHEN 'M' THEN 'ปริญญาโท'
      WHEN 'D' THEN 'ปริญญาเอก'
      ELSE education_level
    END
    WHERE UPPER(LEFT(TRIM(student_code), 1)) IN ('B', 'M', 'D')`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS study_year TINYINT UNSIGNED NULL AFTER education_level`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL AFTER major`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS pdpa_consented_at DATETIME NULL AFTER phone`,
  `ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`,
  `CREATE TABLE IF NOT EXISTS competencies (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    display_order TINYINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS survey_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    status ENUM('draft','active','archived') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `ALTER TABLE survey_templates ADD COLUMN IF NOT EXISTS version INT UNSIGNED NOT NULL DEFAULT 1 AFTER name`,
  `ALTER TABLE survey_templates ADD COLUMN IF NOT EXISTS cloned_from_id BIGINT UNSIGNED NULL AFTER version`,
  `ALTER TABLE survey_templates ADD COLUMN IF NOT EXISTS updated_by BIGINT UNSIGNED NULL AFTER status`,
  `INSERT INTO survey_templates (name, status)
   SELECT 'Standard 9-Skill Assessment', 'active'
   WHERE NOT EXISTS (SELECT 1 FROM survey_templates WHERE status = 'active')`,
  `ALTER TABLE activities ADD COLUMN IF NOT EXISTS survey_template_id BIGINT UNSIGNED NULL AFTER post_close_at`,
  `ALTER TABLE competencies ADD COLUMN IF NOT EXISTS template_id BIGINT UNSIGNED NULL AFTER id`,
  `ALTER TABLE competencies ADD COLUMN IF NOT EXISTS definition TEXT NULL AFTER name`,
  `ALTER TABLE competencies ADD COLUMN IF NOT EXISTS updated_by BIGINT UNSIGNED NULL AFTER display_order`,
  `CREATE TABLE IF NOT EXISTS competency_levels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    competency_id BIGINT UNSIGNED NOT NULL,
    level TINYINT UNSIGNED NOT NULL,
    title VARCHAR(60) NOT NULL,
    description TEXT NOT NULL,
    example TEXT NULL,
    updated_by BIGINT UNSIGNED NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_level_competency FOREIGN KEY (competency_id) REFERENCES competencies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_competency_level (competency_id, level)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS questions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT UNSIGNED NOT NULL,
    competency_id BIGINT UNSIGNED NOT NULL,
    display_order TINYINT UNSIGNED NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_questions_template FOREIGN KEY (template_id) REFERENCES survey_templates(id),
    CONSTRAINT fk_questions_competency FOREIGN KEY (competency_id) REFERENCES competencies(id),
    UNIQUE KEY uq_questions_template_competency (template_id, competency_id),
    UNIQUE KEY uq_questions_template_order (template_id, display_order)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS survey_responses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    activity_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    phase ENUM('pre','post') NOT NULL,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_responses_activity FOREIGN KEY (activity_id) REFERENCES activities(id),
    CONSTRAINT fk_responses_student FOREIGN KEY (student_id) REFERENCES students(id),
    UNIQUE KEY uq_activity_student_phase (activity_id, student_id, phase),
    INDEX idx_responses_submitted (submitted_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE INDEX IF NOT EXISTS idx_students_analytics_filter ON students (faculty, education_level, id)`,
  `CREATE INDEX IF NOT EXISTS idx_responses_analytics_activity_date ON survey_responses (activity_id, submitted_at, student_id, phase)`,
  `CREATE TABLE IF NOT EXISTS response_answers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    response_id BIGINT UNSIGNED NOT NULL,
    competency_id BIGINT UNSIGNED NOT NULL,
    score TINYINT UNSIGNED NOT NULL,
    CONSTRAINT chk_answer_score CHECK (score BETWEEN 1 AND 7),
    CONSTRAINT fk_answers_response FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
    CONSTRAINT fk_answers_competency FOREIGN KEY (competency_id) REFERENCES competencies(id),
    UNIQUE KEY uq_response_competency (response_id, competency_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS qr_codes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    activity_id BIGINT UNSIGNED NOT NULL,
    phase ENUM('pre','post') NOT NULL,
    token CHAR(64) NOT NULL UNIQUE,
    created_by BIGINT UNSIGNED NULL,
    revoked_at DATETIME NULL,
    replaced_by_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_qr_activity FOREIGN KEY (activity_id) REFERENCES activities(id),
    CONSTRAINT fk_qr_admin FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
    INDEX idx_qr_activity_phase (activity_id, phase, revoked_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS survey_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_hash CHAR(64) NOT NULL UNIQUE,
    qr_code_id BIGINT UNSIGNED NOT NULL,
    activity_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NOT NULL,
    phase ENUM('pre','post') NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_survey_sessions_qr FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id),
    CONSTRAINT fk_survey_sessions_activity FOREIGN KEY (activity_id) REFERENCES activities(id),
    CONSTRAINT fk_survey_sessions_student FOREIGN KEY (student_id) REFERENCES students(id),
    INDEX idx_survey_sessions_lookup (activity_id, student_id, phase, expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS survey_session_answers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    survey_session_id BIGINT UNSIGNED NOT NULL,
    question_id BIGINT UNSIGNED NOT NULL,
    competency_id BIGINT UNSIGNED NOT NULL,
    score TINYINT UNSIGNED NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_survey_session_answer_score CHECK (score BETWEEN 1 AND 7),
    CONSTRAINT fk_survey_session_answers_session FOREIGN KEY (survey_session_id)
      REFERENCES survey_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_survey_session_answers_question FOREIGN KEY (question_id)
      REFERENCES questions(id) ON DELETE CASCADE,
    CONSTRAINT fk_survey_session_answers_competency FOREIGN KEY (competency_id)
      REFERENCES competencies(id) ON DELETE CASCADE,
    UNIQUE KEY uq_survey_session_question (survey_session_id, question_id),
    INDEX idx_survey_session_answers_session (survey_session_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS student_history_otp_challenges (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT UNSIGNED NOT NULL,
    otp_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    used_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_otp_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX idx_history_otp_lookup (student_id, used_at, expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS student_history_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    student_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_session_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX idx_history_session_lookup (student_id, expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS export_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NOT NULL,
    export_type ENUM('raw','summary','final','combined_analysis') NOT NULL,
    activity_id BIGINT UNSIGNED NULL,
    filters_json JSON NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_export_log_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE RESTRICT,
    CONSTRAINT fk_export_log_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL,
    INDEX idx_export_logs_admin_created (admin_id, created_at),
    INDEX idx_export_logs_activity_created (activity_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `ALTER TABLE export_logs MODIFY COLUMN export_type ENUM('raw','summary','final','combined_analysis') NOT NULL`,
  `CREATE TABLE IF NOT EXISTS staff_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_admin_id BIGINT UNSIGNED NOT NULL,
    target_admin_id BIGINT UNSIGNED NOT NULL,
    action ENUM('created','role_changed','enabled','disabled','password_reset') NOT NULL,
    details_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_audit_actor FOREIGN KEY (actor_admin_id) REFERENCES admins(id) ON DELETE RESTRICT,
    CONSTRAINT fk_staff_audit_target FOREIGN KEY (target_admin_id) REFERENCES admins(id) ON DELETE RESTRICT,
    INDEX idx_staff_audit_created (created_at),
    INDEX idx_staff_audit_target_created (target_admin_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS user_usage_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_session_id CHAR(36) NOT NULL UNIQUE,
    anonymous_id CHAR(36) NOT NULL,
    student_id BIGINT UNSIGNED NULL,
    entry_path VARCHAR(255) NOT NULL,
    last_path VARCHAR(255) NOT NULL,
    referrer_host VARCHAR(255) NULL,
    device_category VARCHAR(20) NOT NULL DEFAULT 'unknown',
    browser_name VARCHAR(40) NOT NULL DEFAULT 'unknown',
    operating_system VARCHAR(40) NOT NULL DEFAULT 'unknown',
    language_code VARCHAR(20) NULL,
    screen_width SMALLINT UNSIGNED NULL,
    screen_height SMALLINT UNSIGNED NULL,
    timezone_name VARCHAR(80) NULL,
    ip_hash CHAR(64) NULL,
    page_view_count INT UNSIGNED NOT NULL DEFAULT 0,
    interaction_count INT UNSIGNED NOT NULL DEFAULT 0,
    event_count INT UNSIGNED NOT NULL DEFAULT 0,
    active_seconds INT UNSIGNED NOT NULL DEFAULT 0,
    started_at DATETIME(3) NOT NULL,
    last_seen_at DATETIME(3) NOT NULL,
    ended_at DATETIME(3) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_usage_session_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    INDEX idx_user_usage_sessions_started (started_at),
    INDEX idx_user_usage_sessions_student_started (student_id, started_at),
    INDEX idx_user_usage_sessions_anonymous_started (anonymous_id, started_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS user_usage_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usage_session_id BIGINT UNSIGNED NOT NULL,
    student_id BIGINT UNSIGNED NULL,
    event_type VARCHAR(30) NOT NULL,
    event_name VARCHAR(80) NOT NULL,
    page_path VARCHAR(255) NOT NULL,
    duration_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    metadata_json JSON NULL,
    occurred_at DATETIME(3) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_usage_event_session FOREIGN KEY (usage_session_id) REFERENCES user_usage_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_usage_event_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    INDEX idx_user_usage_events_occurred (occurred_at),
    INDEX idx_user_usage_events_type_occurred (event_type, occurred_at),
    INDEX idx_user_usage_events_path_occurred (page_path, occurred_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    activity_id BIGINT UNSIGNED NOT NULL,
    admin_id BIGINT UNSIGNED NULL,
    action VARCHAR(60) NOT NULL,
    detail VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activity_log_activity FOREIGN KEY (activity_id) REFERENCES activities(id),
    CONSTRAINT fk_activity_log_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    INDEX idx_activity_log_activity_created (activity_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `INSERT IGNORE INTO competencies (code, name, display_order) VALUES
    ('innovation', 'Innovation', 1),
    ('management', 'Management', 2),
    ('proactiveness', 'Proactiveness', 3),
    ('achievement', 'Achievement Orientation', 4),
    ('communication', 'Communication', 5),
    ('teamwork', 'Teamwork', 6),
    ('self-confidence', 'Self-confidence', 7),
    ('systematic-thinking', 'Systematic Thinking', 8),
    ('sustainability', 'Sustainability', 9)`,
]

export async function ensureSchema() {
  for (const statement of schemaStatements) {
    await pool.query(statement)
  }
  await ensureAssessmentSeed()
}
