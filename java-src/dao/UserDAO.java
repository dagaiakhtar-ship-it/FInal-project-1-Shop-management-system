package dao;

import db.DBConnection;
import model.User;
import util.HashUtil;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object for users, managing roles and credentials.
 */
public class UserDAO {

    /**
     * Authenticates username and password securely against stored SHA-256 hashes.
     * Prevents SQL Injection through PreparedStatements.
     */
    public User authenticate(String username, String rawPassword) {
        String query = "SELECT * FROM users WHERE username = ?";
        Connection conn = DBConnection.getConnection();
        
        if (conn == null) return null;

        try (PreparedStatement stmt = conn.prepareStatement(query)) {
            stmt.setString(1, username);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    String storedHash = rs.getString("password_hash");
                    String inputHash = HashUtil.hashPassword(rawPassword);

                    if (storedHash.equals(inputHash)) {
                        User user = new User();
                        user.setId(rs.getInt("id"));
                        user.setUsername(rs.getString("username"));
                        user.setFullName(rs.getString("full_name"));
                        user.setRole(rs.getString("role"));
                        user.setCreatedAt(rs.getTimestamp("created_at"));
                        return user;
                    }
                }
            }
        } catch (SQLException e) {
            System.err.println("Database query error in login authentication.");
            e.printStackTrace();
        }
        return null;
    }

    /**
     * Registers a new user inside the system.
     */
    public boolean registerUser(User user, String rawPassword) {
        String sql = "INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)";
        Connection conn = DBConnection.getConnection();
        
        if (conn == null) return false;

        try (PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, user.getUsername());
            stmt.setString(2, HashUtil.hashPassword(rawPassword));
            stmt.setString(3, user.getFullName());
            stmt.setString(4, user.getRole());
            
            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error saving user profile to MySQL database.");
            e.printStackTrace();
            return false;
        }
    }

    /**
     * Lists all registered user accounts.
     */
    public List<User> listAllUsers() {
        List<User> list = new ArrayList<>();
        String sql = "SELECT id, username, full_name, role, created_at FROM users";
        Connection conn = DBConnection.getConnection();

        if (conn == null) return list;

        try (PreparedStatement stmt = conn.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {
            while (rs.next()) {
                User u = new User();
                u.setId(rs.getInt("id"));
                u.setUsername(rs.getString("username"));
                u.setFullName(rs.getString("full_name"));
                u.setRole(rs.getString("role"));
                u.setCreatedAt(rs.getTimestamp("created_at"));
                list.add(u);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }
}
