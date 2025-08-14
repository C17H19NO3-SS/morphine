-- Categories schema with i18n support
CREATE TABLE IF NOT EXISTS categories (
  id INT(11) NOT NULL AUTO_INCREMENT,
  parent_id INT(11) NULL,
  slug VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  sort_order INT(11) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_categories_slug (slug),
  INDEX idx_categories_parent (parent_id),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

CREATE TABLE IF NOT EXISTS categories_i18n (
  id INT(11) NOT NULL AUTO_INCREMENT,
  category_id INT(11) NOT NULL,
  locale VARCHAR(10) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_categories_i18n (category_id, locale),
  CONSTRAINT fk_categories_i18n_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;


