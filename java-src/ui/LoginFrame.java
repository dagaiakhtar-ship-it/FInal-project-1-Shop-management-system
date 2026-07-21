package ui;

import dao.UserDAO;
import model.User;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;

/**
 * Swing frame for secure user authentication.
 */
public class LoginFrame extends JFrame {
    private JTextField txtUsername;
    private JPasswordField txtPassword;
    private JCheckBox chkShowPassword;
    private JButton btnLogin;
    private UserDAO userDAO;

    public LoginFrame() {
        userDAO = new UserDAO();
        initializeUI();
    }

    private void initializeUI() {
        setTitle("Smart Shop Management System - Login");
        setSize(400, 300);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLocationRelativeTo(null);
        setResizable(false);

        // Styling elements
        JPanel mainPanel = new JPanel(new GridBagLayout());
        mainPanel.setBackground(new Color(15, 23, 42)); // Midnight Slate Theme
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new java.awt.Insets(10, 10, 10, 10);
        gbc.fill = GridBagConstraints.HORIZONTAL;

        // Header Title
        JLabel lblTitle = new JLabel("SECURE LOGIN", JLabel.CENTER);
        lblTitle.setFont(new Font("SansSerif", Font.BOLD, 18));
        lblTitle.setForeground(new Color(99, 102, 241)); // Purple Indigo accent
        gbc.gridx = 0; gbc.gridy = 0; gbc.gridwidth = 2;
        mainPanel.add(lblTitle, gbc);

        // Username
        JLabel lblUser = new JLabel("Username:");
        lblUser.setForeground(Color.WHITE);
        lblUser.setFont(new Font("SansSerif", Font.PLAIN, 12));
        gbc.gridx = 0; gbc.gridy = 1; gbc.gridwidth = 1;
        mainPanel.add(lblUser, gbc);

        txtUsername = new JTextField(15);
        txtUsername.setBackground(new Color(30, 41, 59));
        txtUsername.setForeground(Color.WHITE);
        txtUsername.setCaretColor(Color.WHITE);
        txtUsername.setBorder(BorderFactory.createLineBorder(new Color(71, 85, 105)));
        gbc.gridx = 1; gbc.gridy = 1;
        mainPanel.add(txtUsername, gbc);

        // Password
        JLabel lblPass = new JLabel("Password:");
        lblPass.setForeground(Color.WHITE);
        lblPass.setFont(new Font("SansSerif", Font.PLAIN, 12));
        gbc.gridx = 0; gbc.gridy = 2;
        mainPanel.add(lblPass, gbc);

        txtPassword = new JPasswordField(15);
        txtPassword.setBackground(new Color(30, 41, 59));
        txtPassword.setForeground(Color.WHITE);
        txtPassword.setCaretColor(Color.WHITE);
        txtPassword.setBorder(BorderFactory.createLineBorder(new Color(71, 85, 105)));
        gbc.gridx = 1; gbc.gridy = 2;
        mainPanel.add(txtPassword, gbc);

        // Show Password checkbox
        chkShowPassword = new JCheckBox("Show Password");
        chkShowPassword.setForeground(Color.LIGHT_GRAY);
        chkShowPassword.setBackground(new Color(15, 23, 42));
        chkShowPassword.setFocusPainted(false);
        chkShowPassword.setFont(new Font("SansSerif", Font.PLAIN, 10));
        chkShowPassword.addActionListener(e -> {
            if (chkShowPassword.isSelected()) {
                txtPassword.setEchoChar((char) 0);
            } else {
                txtPassword.setEchoChar('•');
            }
        });
        gbc.gridx = 1; gbc.gridy = 3;
        mainPanel.add(chkShowPassword, gbc);

        // Login Button
        btnLogin = new JButton("Login");
        btnLogin.setBackground(new Color(79, 70, 229)); // Indigo button
        btnLogin.setForeground(Color.WHITE);
        btnLogin.setFont(new Font("SansSerif", Font.BOLD, 12));
        btnLogin.setFocusPainted(false);
        btnLogin.setBorder(BorderFactory.createEmptyBorder(8, 20, 8, 20));
        btnLogin.addActionListener(this::handleLogin);
        gbc.gridx = 0; gbc.gridy = 4; gbc.gridwidth = 2;
        mainPanel.add(btnLogin, gbc);

        add(mainPanel);
    }

    private void handleLogin(ActionEvent e) {
        String username = txtUsername.getText().trim();
        String password = new String(txtPassword.getPassword()).trim();

        if (username.isEmpty() || password.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Please enter both username and password.", 
                    "Validation Error", JOptionPane.WARNING_MESSAGE);
            return;
        }

        // Authenticate via database
        User authenticatedUser = userDAO.authenticate(username, password);

        if (authenticatedUser != null) {
            JOptionPane.showMessageDialog(this, "Welcome back, " + authenticatedUser.getFullName() + "!", 
                    "Login Successful", JOptionPane.INFORMATION_MESSAGE);
            
            // Dispose Login frame and open Main system frame
            this.dispose();
            SwingUtilities.invokeLater(() -> {
                MainFrame mainFrame = new MainFrame(authenticatedUser);
                mainFrame.setVisible(true);
            });
        } else {
            JOptionPane.showMessageDialog(this, "Invalid credentials. Please try again.", 
                    "Authentication Failed", JOptionPane.ERROR_MESSAGE);
        }
    }
}
