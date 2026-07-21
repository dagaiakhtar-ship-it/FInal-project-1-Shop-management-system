package dao;

import db.DBConnection;
import model.Sale;
import model.SaleItem;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

/**
 * Manages atomic transactions for sales chekout, invoice registration, and stock deduction.
 */
public class SaleDAO {

    /**
     * Executes atomic billing checkouts.
     * Integrates relational integrity constraints, transactional rollbacks, and stock deduction.
     */
    public boolean processCheckout(Sale sale, List<SaleItem> items) {
        Connection conn = DBConnection.getConnection();
        if (conn == null) return false;

        PreparedStatement insertSale = null;
        PreparedStatement insertItem = null;
        PreparedStatement updateStock = null;
        PreparedStatement logHistory = null;

        try {
            // Step A: Disable autocommit to ensure atomic transaction properties
            conn.setAutoCommit(false);

            // Step B: Insert Sale Header
            String sqlSale = "INSERT INTO sales (invoice_no, customer_id, user_id, subtotal, discount, tax, grand_total, paid_amount, return_amount, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            insertSale = conn.prepareStatement(sqlSale, Statement.RETURN_GENERATED_KEYS);
            insertSale.setString(1, sale.getInvoiceNo());
            if (sale.getCustomerId() > 0) {
                insertSale.setInt(2, sale.getCustomerId());
            } else {
                insertSale.setNull(2, java.sql.Types.INTEGER);
            }
            insertSale.setInt(3, sale.getUserId());
            insertSale.setDouble(4, sale.getSubtotal());
            insertSale.setDouble(5, sale.getDiscount());
            insertSale.setDouble(6, sale.getTax());
            insertSale.setDouble(7, sale.getGrandTotal());
            insertSale.setDouble(8, sale.getPaidAmount());
            insertSale.setDouble(9, sale.getReturnAmount());
            insertSale.setString(10, sale.getPaymentMethod());

            int affected = insertSale.executeUpdate();
            if (affected == 0) {
                throw new SQLException("Sale registration failed, no rows affected.");
            }

            // Get auto-generated Sale database ID
            int saleId = -1;
            try (ResultSet generatedKeys = insertSale.getGeneratedKeys()) {
                if (generatedKeys.next()) {
                    saleId = generatedKeys.getInt(1);
                } else {
                    throw new SQLException("Failed to retrieve auto-generated ID for sale transaction.");
                }
            }

            // Step C: Insert individual Sale Items, update product stock counts, and append inventory logs
            String sqlItem = "INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price, total_price) VALUES (?, ?, ?, ?, ?, ?)";
            String sqlStock = "UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?";
            String sqlLog = "INSERT INTO stock_history (product_id, change_type, quantity_changed, old_quantity, new_quantity, note) VALUES (?, 'Sale', ?, (SELECT quantity + ? FROM products WHERE id=?), (SELECT quantity FROM products WHERE id=?), ?)";

            insertItem = conn.prepareStatement(sqlItem);
            updateStock = conn.prepareStatement(sqlStock);
            logHistory = conn.prepareStatement(sqlLog);

            for (SaleItem item : items) {
                // 1. Write sale item record
                insertItem.setInt(1, saleId);
                insertItem.setInt(2, item.getProductId());
                insertItem.setInt(3, item.getQuantity());
                insertItem.setDouble(4, item.getUnitPrice());
                insertItem.setDouble(5, item.getCostPrice());
                insertItem.setDouble(6, item.getTotalPrice());
                insertItem.executeUpdate();

                // 2. Deduct item inventory stock (prevent negative values via SQL check constraint)
                updateStock.setInt(1, item.getQuantity());
                updateStock.setInt(2, item.getProductId());
                updateStock.setInt(3, item.getQuantity()); // Verify sufficient stock
                int stockAffected = updateStock.executeUpdate();
                if (stockAffected == 0) {
                    throw new SQLException("Sufficient inventory unavailable for product ID: " + item.getProductId());
                }

                // 3. Log stock transition
                logHistory.setInt(1, item.getProductId());
                logHistory.setInt(2, -item.getQuantity());
                logHistory.setInt(3, item.getQuantity());
                logHistory.setInt(4, item.getProductId());
                logHistory.setInt(5, item.getProductId());
                logHistory.setString(6, "POS Checkout Invoice " + sale.getInvoiceNo());
                logHistory.executeUpdate();
            }

            // Step D: Commit the full transaction on successful processing
            conn.commit();
            System.out.println("Atomic POS checkout completed successfully! Transaction committed.");
            return true;

        } catch (SQLException e) {
            System.err.println("Transaction rolled back due to error during checkout processing.");
            e.printStackTrace();
            try {
                conn.rollback();
            } catch (SQLException ex) {
                System.err.println("Critical failure occurred during database rollback.");
                ex.printStackTrace();
            }
            return false;
        } finally {
            try {
                conn.setAutoCommit(true); // Restore default autocommit behavior
                if (insertSale != null) insertSale.close();
                if (insertItem != null) insertItem.close();
                if (updateStock != null) updateStock.close();
                if (logHistory != null) logHistory.close();
            } catch (SQLException e) {
                e.printStackTrace();
            }
        }
    }
}
