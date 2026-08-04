import { pool } from './pool.js'

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
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
]

export async function ensureSchema() {
  for (const statement of schemaStatements) {
    await pool.query(statement)
  }
}
