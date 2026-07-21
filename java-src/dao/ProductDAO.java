package dao;

import db.DBConnection;
import model.Product;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Handles all database interactions for the products table.
 */
public class ProductDAO {

    /**
     * Inserts a new product record.
     */
    public boolean addProduct(Product p) {
        String sql = "INSERT INTO products (name, barcode, category_id, supplier_id, cost_price, sale_price, quantity, unit, expiry_date, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        Connection conn = DBConnection.getConnection();
        if (conn == null) return false;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, p.getName());
            stmt.setString(2, p.getBarcode());
            stmt.setInt(3, p.getCategoryId());
            stmt.setInt(4, p.getSupplierId());
            stmt.setDouble(5, p.getCostPrice());
            stmt.setDouble(6, p.getSalePrice());
            stmt.setInt(7, p.getQuantity());
            stmt.setString(8, p.getUnit());
            stmt.setDate(9, p.getExpiryDate());
            stmt.setString(10, p.getDescription());

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Updates an existing product's parameters in MySQL.
     */
    public boolean updateProduct(Product p) {
        String sql = "UPDATE products SET name=?, barcode=?, category_id=?, supplier_id=?, cost_price=?, sale_price=?, quantity=?, unit=?, expiry_date=?, description=? WHERE id=?";
        Connection conn = DBConnection.getConnection();
        if (conn == null) return false;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, p.getName());
            stmt.setString(2, p.getBarcode());
            stmt.setInt(3, p.getCategoryId());
            stmt.setInt(4, p.getSupplierId());
            stmt.setDouble(5, p.getCostPrice());
            stmt.setDouble(6, p.getSalePrice());
            stmt.setInt(7, p.getQuantity());
            stmt.setString(8, p.getUnit());
            stmt.setDate(9, p.getExpiryDate());
            stmt.setString(10, p.getDescription());
            stmt.setInt(11, p.getId());

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Delete a product record from database.
     */
    public boolean deleteProduct(int id) {
        String sql = "DELETE FROM products WHERE id=?";
        Connection conn = DBConnection.getConnection();
        if (conn == null) return false;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setInt(1, id);
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Queries a product by barcode string. Highly optimized for quick POS checkout.
     */
    public Product findByBarcode(String barcode) {
        String sql = "SELECT * FROM products WHERE barcode = ?";
        Connection conn = DBConnection.getConnection();
        if (conn == null) return null;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, barcode);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return mapRowToProduct(rs);
                }
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    /**
     * Retrieves all products registered in the database system.
     */
    public List<Product> listAll() {
        List<Product> list = new ArrayList<>();
        String sql = "SELECT * FROM products ORDER BY name ASC";
        Connection conn = DBConnection.getConnection();
        if (conn == null) return list;

        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                list.add(mapRowToProduct(rs));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    private Product mapRowToProduct(ResultSet rs) throws SQLException {
        Product p = new Product();
        p.setId(rs.getInt("id"));
        p.setName(rs.getString("name"));
        p.setBarcode(rs.getString("barcode"));
        p.setCategoryId(rs.getInt("category_id"));
        p.setSupplierId(rs.getInt("supplier_id"));
        p.setCostPrice(rs.getDouble("cost_price"));
        p.setSalePrice(rs.getDouble("sale_price"));
        p.setQuantity(rs.getInt("quantity"));
        p.setUnit(rs.getString("unit"));
        p.setExpiryDate(rs.getDate("expiry_date"));
        p.setDescription(rs.getString("description"));
        return p;
    }
}
