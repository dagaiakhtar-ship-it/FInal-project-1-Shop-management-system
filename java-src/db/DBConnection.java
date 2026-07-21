package db;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Handles robust connection to the local MySQL database server.
 * Implements a Singleton pattern to avoid opening redundant connections.
 */
public class DBConnection {
    private static final String URL = "jdbc:mysql://localhost:3306/smart_shop_db?useSSL=false&allowPublicKeyRetrieval=true";
    private static final String USER = "root";
    private static final String PASSWORD = "password123"; // Adjust according to local installation settings

    private static Connection connection = null;

    private DBConnection() {
        // Prevent external instantiation
    }

    /**
     * Retrieves or establishes the active JDBC connection to MySQL.
     * @return Connection object
     */
    public static synchronized Connection getConnection() {
        try {
            if (connection == null || connection.isClosed()) {
                // Register JDBC Driver
                Class.forName("com.mysql.cj.jdbc.Driver");
                // Open Connection
                connection = DriverManager.getConnection(URL, USER, PASSWORD);
                System.out.println("Database connection established successfully!");
            }
        } catch (ClassNotFoundException e) {
            System.err.println("MySQL JDBC Driver not found in classpath. Include cj-connector library.");
            e.printStackTrace();
        } catch (SQLException e) {
            System.err.println("Critical Failure connecting to MySQL at URL: " + URL);
            e.printStackTrace();
        }
        return connection;
    }

    /**
     * Safely closes the singleton database connection.
     */
    public static void closeConnection() {
        if (connection != null) {
            try {
                if (!connection.isClosed()) {
                    connection.close();
                    System.out.println("Database connection closed cleanly.");
                }
            } catch (SQLException e) {
                System.err.println("Error closing active JDBC connection.");
                e.printStackTrace();
            }
        }
    }
}
