/**
 * 数据库 schema。
 *
 * 用 PRAGMA user_version 做版本号，迁移按数组顺序只跑一次，
 * 这样后续加字段不用手工删库。
 */
export const MIGRATIONS: readonly string[] = [
  // v1：初始 schema
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE resources (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    url            TEXT NOT NULL,
    provider       TEXT NOT NULL,
    language       TEXT NOT NULL,
    difficulty     TEXT NOT NULL,
    format         TEXT NOT NULL,
    duration_hours REAL NOT NULL,
    topics         TEXT NOT NULL,
    stage          TEXT NOT NULL,
    description    TEXT NOT NULL,
    notes          TEXT NOT NULL DEFAULT '',
    verified       INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX idx_resources_stage ON resources(stage);

  CREATE TABLE quiz_questions (
    id           TEXT PRIMARY KEY,
    stage        TEXT NOT NULL,
    prompt       TEXT NOT NULL,
    choices      TEXT NOT NULL,
    answer_index INTEGER NOT NULL,
    explanation  TEXT NOT NULL,
    difficulty   TEXT NOT NULL,
    position     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_quiz_questions_stage ON quiz_questions(stage, position);

  CREATE TABLE progress (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (user_id, resource_id)
  );
  CREATE INDEX idx_progress_user ON progress(user_id, status);

  CREATE TABLE quiz_attempts (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage      TEXT NOT NULL,
    score      INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    answers    TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX idx_quiz_attempts_user_stage ON quiz_attempts(user_id, stage);
  `,
];
