import db.DBConnection;
import ui.LoginFrame;

import javax.swing.*;
import java.sql.Connection;

/**
 * Main entrance executable for the Smart Shop Management Desktop Application.
 */
public class Main {

    public static void main(String[] args) {
        System.out.println("==============================================");
        System.out.println("Initializing Smart Shop Management System...");
        System.out.println("==============================================");

        // 1. Validate JDBC Driver and Connection to MySQL
        try {
            Connection testConn = DBConnection.getConnection();
            if (testConn != null) {
                System.out.println("Status: ONLINE. Connected securely to MySQL schema.");
            } else {
                System.err.println("Status: OFFLINE. MySQL instance is unreachable. Check port 3306 or 'schema.sql'.");
                System.err.println("Running application on offline/fallback simulation mode...");
            }
        } catch (Exception e) {
            System.err.println("Database verification threw an exception: " + e.getMessage());
        }

        // 2. Configure Modern UI Appearance
        // Configures Nimbus or System Native styling instead of the ancient standard Metal LookAndFeel
        try {
            for (UIManager.LookAndFeelInfo info : UIManager.getInstalledLookAndFeels()) {
                if ("Nimbus".equals(info.getName())) {
                    UIManager.setLookAndFeel(info.getClassName());
                    break;
                }
            }
        } catch (Exception e) {
            try {
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception ex) {
                System.err.println("Failed to override default look and feel theme.");
            }
        }

        // 3. Fire up login GUI frame on Swing Event Dispatch Thread (EDT)
        SwingUtilities.invokeLater(() -> {
            LoginFrame loginFrame = new LoginFrame();
            loginFrame.setVisible(true);
            System.out.println("Swing login workspace window loaded successfully.");
        });
    }
}
