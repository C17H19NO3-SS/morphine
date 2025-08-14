-- Products schema (supports one-time and subscription products)
CREATE TABLE IF NOT EXISTS products (
  id INT(11) NOT NULL AUTO_INCREMENT,
  sku VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  type ENUM('one_time','subscription') NOT NULL,
  price_cents INT(11) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  `interval` ENUM('day','week','month','year') NULL,
  interval_count TINYINT UNSIGNED NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_products_sku (sku)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;

-- Translations for products (per-locale name/description)
CREATE TABLE IF NOT EXISTS products_i18n (
  id INT(11) NOT NULL AUTO_INCREMENT,
  product_id INT(11) NOT NULL,
  locale VARCHAR(10) NOT NULL,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_products_i18n (product_id, locale),
  CONSTRAINT fk_products_i18n_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;


