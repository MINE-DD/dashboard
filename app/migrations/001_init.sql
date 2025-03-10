-- Up Migration

-- Create auth tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  "emailVerified" TIMESTAMPTZ,
  image TEXT,
  role VARCHAR(50)
);

-- Insert sample admin user (password: password)
INSERT INTO users (name, email, password, "emailVerified", image, role) VALUES
('Alice Doe', 'alice@ctwhome.com', '$2a$12$qZNxIFh/Yayqshdz.3ZH2Oy2uORW/MqDS9NlfkIZsm6xnK5ZtCyJG', '2023-10-10', 'https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp', 'admin'),
('Bob Sponge', 'bob@ctwhome.com', '$2a$12$qZNxIFh/Yayqshdz.3ZH2Oy2uORW/MqDS9NlfkIZsm6xnK5ZtCyJG', '2023-10-10', '/images/profile.avif', 'user');

-- Create indexes
CREATE INDEX users_email_idx ON users (email);

-- Down Migration
DROP TABLE users;
