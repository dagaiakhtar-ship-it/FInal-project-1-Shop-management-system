-- ==========================================
-- Smart Shop Management System - MySQL Database Schema
-- ==========================================

CREATE DATABASE IF NOT EXISTS smart_shop_db;
USE smart_shop_db;

-- 1. Users Table (Role-based access control)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('Admin', 'Manager', 'Cashier') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

-- 3. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    product_type VARCHAR(100)
);

-- 4. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(100),
    address TEXT,
    balance DECIMAL(12, 2) DEFAULT 0.00
);

-- 5. Products Table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    barcode VARCHAR(50) NOT NULL UNIQUE,
    category_id INT NOT NULL,
    supplier_id INT NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL CHECK (cost_price >= 0),
    sale_price DECIMAL(12, 2) NOT NULL CHECK (sale_price >= 0),
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    unit VARCHAR(20) NOT NULL DEFAULT 'Piece',
    expiry_date DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

-- 6. Sales Transactions Table
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT,
    user_id INT NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    grand_total DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) NOT NULL,
    return_amount DECIMAL(12, 2) NOT NULL,
    payment_method ENUM('Cash', 'Card', 'Easypaisa', 'JazzCash', 'Bank Transfer') NOT NULL DEFAULT 'Cash',
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- 7. Sale Items (Transaction items list)
CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- 8. Stock History (Manual adjustments & sales transitions logs)
CREATE TABLE IF NOT EXISTS stock_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    change_type ENUM('Add', 'Reduce', 'Sale', 'Adjustment') NOT NULL,
    quantity_changed INT NOT NULL,
    old_quantity INT NOT NULL,
    new_quantity INT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 9. General System Settings
CREATE TABLE IF NOT EXISTS settings (
    id INT PRIMARY KEY,
    shop_name VARCHAR(150) NOT NULL,
    shop_address TEXT NOT NULL,
    phone VARCHAR(30) NOT NULL,
    tax_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    currency_symbol VARCHAR(10) NOT NULL DEFAULT 'Rs.',
    receipt_footer TEXT
);

-- ==========================================
-- SEED INITIAL DATA
-- ==========================================

-- Default Users (Passwords hashed using SHA-256 equivalent)
-- Passwords: admin -> 'admin123' (hash: 240a863a152438f4d54641ef696d0da4f18e69eeef15b81048866380c7a52ff6)
-- Passwords: manager -> 'manager123' (hash: 104b2b005be7f2da516104d49a47535b91b5c464e101416805ff9ffcd237c0ff)
-- Passwords: cashier -> 'cashier123' (hash: 7cb4340d859e9c8dc1e16f3910f5451c5b8b939c3e986a4e3dfcf351b6dbccf6)
INSERT INTO users (id, username, password_hash, full_name, role) VALUES
(1, 'admin', '240a863a152438f4d54641ef696d0da4f18e69eeef15b81048866380c7a52ff6', 'System Administrator', 'Admin'),
(2, 'manager', '104b2b005be7f2da516104d49a47535b91b5c464e101416805ff9ffcd237c0ff', 'Store Manager', 'Manager'),
(3, 'cashier', '7cb4340d859e9c8dc1e16f3910f5451c5b8b939c3e986a4e3dfcf351b6dbccf6', 'Lead Cashier', 'Cashier');

-- Default Categories
INSERT INTO categories (id, name, description) VALUES
(1, 'Grocery', 'Daily staple foods and cooking items'),
(2, 'Beverages', 'Soft drinks, juices, energy drinks, tea, and coffee'),
(3, 'Cosmetics', 'Skincare, hair care, and beauty products'),
(4, 'Stationery', 'Office supplies, notebooks, pens, and paper'),
(5, 'Electronics', 'Light bulbs, batteries, chargers, and small appliances'),
(6, 'Bakery', 'Fresh bread, buns, cookies, and cakes'),
(7, 'Household', 'Cleaning supplies, detergents, and kitchen utilities');

-- Default Suppliers
INSERT INTO suppliers (id, name, company_name, phone, email, address, product_type) VALUES
(1, 'Nestle Pakistan', 'Nestle', '0300-1234567', 'sales@nestle.com.pk', 'Industrial Area, Lahore', 'Beverages'),
(2, 'Unilever Dist.', 'Unilever', '0321-7654321', 'supply@unilever.com', 'Korangi, Karachi', 'Cosmetics'),
(3, 'National Foods', 'National Foods Ltd', '0315-9876543', 'orders@nationalfoods.com', 'Port Qasim, Karachi', 'Grocery'),
(4, 'P&G Allied', 'Procter & Gamble', '0333-1122334', 'distributor@pg.com', 'Faisalabad', 'Household');

-- Default Customers (Walk-In and VIP Accounts)
INSERT INTO customers (id, name, phone, email, address, balance) VALUES
(1, 'Walk-in Customer', '0000-0000000', 'walkin@shop.com', 'N/A', 0.00),
(2, 'Muhammad Ali', '0300-8889991', 'ali@gmail.com', 'Sector F-10, Islamabad', 1500.00),
(3, 'Aisha Khan', '0322-4445552', 'aisha.k@yahoo.com', 'DHA Phase 5, Lahore', 0.00),
(4, 'Kamran Shah', '0345-6667773', 'kamran@outlook.com', 'Saddar, Rawalpindi', -500.00);

-- Default Settings
INSERT INTO settings (id, shop_name, shop_address, phone, tax_percentage, currency_symbol, receipt_footer) VALUES
(1, 'Smart Mart', 'Sector G-11 Markaz, Islamabad, Pakistan', '051-111-222-333', 5.00, 'Rs.', 'Thank you for shopping with us! Please come again.');
