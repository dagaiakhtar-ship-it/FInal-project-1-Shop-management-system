package ui;

import model.User;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;

/**
 * Main application dashboard containing responsive sidebars and sub-module navigation panels.
 */
public class MainFrame extends JFrame {
    private User currentUser;
    private JPanel contentPanel;
    private CardLayout cardLayout;

    public MainFrame(User user) {
        this.currentUser = user;
        initializeUI();
    }

    private void initializeUI() {
        setTitle("Smart Shop Management System - Session: " + currentUser.getFullName());
        setSize(1200, 800);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLocationRelativeTo(null);

        // Core Layout: Border layout with left sidebar and central content panel
        JPanel mainContainer = new JPanel(new BorderLayout());
        mainContainer.setBackground(new Color(241, 245, 249));

        // Create Left Sidebar
        JPanel sidebar = createSidebar();
        mainContainer.add(sidebar, BorderLayout.WEST);

        // Create Top Status Header
        JPanel header = createHeader();
        mainContainer.add(header, BorderLayout.NORTH);

        // Create Central Content Switcher Panel
        cardLayout = new CardLayout();
        contentPanel = new JPanel(cardLayout);
        contentPanel.setBorder(BorderFactory.createEmptyBorder(20, 20, 20, 20));
        contentPanel.setBackground(new Color(248, 250, 252));

        // Initialize and Mount Sub-panels
        contentPanel.add(createDashboardPanel(), "Dashboard");
        contentPanel.add(createPOSBillingPanel(), "POS");
        contentPanel.add(createProductPanel(), "Products");
        contentPanel.add(createCustomerPanel(), "Customers");
        contentPanel.add(createSupplierPanel(), "Suppliers");
        contentPanel.add(createReportsPanel(), "Reports");
        contentPanel.add(createSettingsPanel(), "Settings");

        mainContainer.add(contentPanel, BorderLayout.CENTER);
        add(mainContainer);
    }

    private JPanel createHeader() {
        JPanel header = new JPanel(new BorderLayout());
        header.setBackground(Color.WHITE);
        header.setPreferredSize(new Dimension(1200, 60));
        header.setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, new Color(226, 232, 240)));

        JLabel lblStore = new JLabel("  SMART SHOP WORKSPACE  ");
        lblStore.setFont(new Font("SansSerif", Font.BOLD, 14));
        lblStore.setForeground(new Color(30, 41, 59));
        header.add(lblStore, BorderLayout.WEST);

        JPanel rightBar = new JPanel(new FlowLayout(FlowLayout.RIGHT, 15, 15));
        rightBar.setOpaque(false);

        JLabel lblUser = new JLabel("Logged in as: " + currentUser.getFullName() + " (" + currentUser.getRole() + ")");
        lblUser.setFont(new Font("SansSerif", Font.BOLD, 12));
        lblUser.setForeground(new Color(71, 85, 105));
        rightBar.add(lblUser);

        JButton btnLogout = new JButton("Logout");
        btnLogout.setFont(new Font("SansSerif", Font.PLAIN, 11));
        btnLogout.setBackground(new Color(239, 68, 68));
        btnLogout.setForeground(Color.WHITE);
        btnLogout.addActionListener(e -> {
            this.dispose();
            SwingUtilities.invokeLater(() -> new LoginFrame().setVisible(true));
        });
        rightBar.add(btnLogout);

        header.add(rightBar, BorderLayout.EAST);
        return header;
    }

    private JPanel createSidebar() {
        JPanel sidebar = new JPanel();
        sidebar.setLayout(new BoxLayout(sidebar, BoxLayout.Y_AXIS));
        sidebar.setBackground(new Color(15, 23, 42)); // Midnight Slate Theme
        sidebar.setPreferredSize(new Dimension(220, 800));
        sidebar.setBorder(BorderFactory.createEmptyBorder(15, 10, 15, 10));

        // Brand banner
        JLabel lblBrand = new JLabel("Smart Mart");
        lblBrand.setFont(new Font("SansSerif", Font.BOLD, 18));
        lblBrand.setForeground(Color.WHITE);
        lblBrand.setAlignmentX(Component.CENTER_ALIGNMENT);
        sidebar.add(lblBrand);
        sidebar.add(Box.createRigidArea(new Dimension(0, 30)));

        // Define Navigation Sidebar items dynamically based on roles
        addSidebarButton(sidebar, "Dashboard", "Dashboard");
        addSidebarButton(sidebar, "Billing / POS", "POS");
        addSidebarButton(sidebar, "Products Manager", "Products");
        addSidebarButton(sidebar, "Customers", "Customers");

        if (currentUser.getRole().equals("Admin") || currentUser.getRole().equals("Manager")) {
            addSidebarButton(sidebar, "Suppliers", "Suppliers");
            addSidebarButton(sidebar, "Reports & Profit", "Reports");
        }

        if (currentUser.getRole().equals("Admin")) {
            addSidebarButton(sidebar, "System Settings", "Settings");
        }

        return sidebar;
    }

    private void addSidebarButton(JPanel sidebar, String label, String cardName) {
        JButton btn = new JButton(label);
        btn.setMaximumSize(new Dimension(200, 40));
        btn.setAlignmentX(Component.CENTER_ALIGNMENT);
        btn.setBackground(new Color(30, 41, 59));
        btn.setForeground(new Color(148, 163, 184));
        btn.setFont(new Font("SansSerif", Font.BOLD, 12));
        btn.setFocusPainted(false);
        btn.setBorder(BorderFactory.createEmptyBorder(10, 15, 10, 15));
        btn.addActionListener(e -> cardLayout.show(contentPanel, cardName));

        sidebar.add(btn);
        sidebar.add(Box.createRigidArea(new Dimension(0, 10)));
    }

    // ==========================================
    // MODULE PANEL STUBS & swing structures
    // ==========================================

    private JPanel createDashboardPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(Color.WHITE);
        panel.setBorder(BorderFactory.createLineBorder(new Color(226, 232, 240)));

        JLabel lblTitle = new JLabel("Dashboard Overview", JLabel.CENTER);
        lblTitle.setFont(new Font("SansSerif", Font.BOLD, 20));
        lblTitle.setForeground(new Color(15, 23, 42));
        panel.add(lblTitle, BorderLayout.NORTH);

        JTextArea txtDesc = new JTextArea("\n\n" +
                "  ⭐ Total Sales Volume: Rs. 145,290.00\n\n" +
                "  📈 Estimated Profits: Rs. 29,058.00\n\n" +
                "  📦 Active Catalog Products: 34 Items\n\n" +
                "  🚨 Critical Low Stock Warning: 3 Products require replenishment (Stock <= 10)\n\n" +
                "  Use the navigation sidebar to open POS billing terminals or update catalog files.");
        txtDesc.setFont(new Font("SansSerif", Font.PLAIN, 14));
        txtDesc.setEditable(false);
        panel.add(txtDesc, BorderLayout.CENTER);

        return panel;
    }

    private JPanel createPOSBillingPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(Color.WHITE);
        panel.add(new JLabel("POS Billing Terminal - Search by Barcode & Add to Cart", JLabel.CENTER), BorderLayout.NORTH);

        // Simple mock POS grid
        String[] columns = {"Barcode", "Product Name", "Qty", "Sale Price", "Total"};
        Object[][] data = {
                {"8881230", "Nestle Milkpak 1 Liter", "2", "260.00", "520.00"},
                {"1234002", "Pepsi 1.5L soft drink", "1", "130.00", "130.00"}
        };
        JTable table = new JTable(data, columns);
        panel.add(new JScrollPane(table), BorderLayout.CENTER);

        JPanel checkoutBar = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        checkoutBar.add(new JLabel("Subtotal: Rs. 650.00 | Tax (5%): Rs. 32.50 | Grand Total: Rs. 682.50"));
        JButton btnPay = new JButton("Proceed and Print Receipt");
        btnPay.setBackground(new Color(79, 70, 229));
        btnPay.setForeground(Color.WHITE);
        checkoutBar.add(btnPay);
        panel.add(checkoutBar, BorderLayout.SOUTH);

        return panel;
    }

    private JPanel createProductPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(Color.WHITE);
        panel.add(new JLabel("Product Catalog List (CRUD Mode Enabled)", JLabel.CENTER), BorderLayout.NORTH);

        String[] columns = {"ID", "Name", "Barcode", "Qty", "Cost Price", "Sale Price", "Expiry"};
        Object[][] data = {
                {"1", "Pepsi 1.5L soft drink", "1234002", "12", "110.00", "130.00", "2026-12-01"},
                {"2", "Nestle Milkpak 1 Liter", "8881230", "44", "230.00", "260.00", "2026-08-15"}
        };
        JTable table = new JTable(data, columns);
        panel.add(new JScrollPane(table), BorderLayout.CENTER);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT));
        actions.add(new JButton("Add New Product"));
        actions.add(new JButton("Edit Selected"));
        actions.add(new JButton("Delete Product"));
        panel.add(actions, BorderLayout.SOUTH);

        return panel;
    }

    private JPanel createCustomerPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.add(new JLabel("Customers Directory Profiles & Store Credit Accounts", JLabel.CENTER), BorderLayout.NORTH);
        return panel;
    }

    private JPanel createSupplierPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.add(new JLabel("Registered Distributors & Suppliers Logs", JLabel.CENTER), BorderLayout.NORTH);
        return panel;
    }

    private JPanel createReportsPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.add(new JLabel("Financial Performance & Profit-and-Loss Statement Reports", JLabel.CENTER), BorderLayout.NORTH);
        return panel;
    }

    private JPanel createSettingsPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.add(new JLabel("Store Settings, Receipt Configuration, & Database Backup Utilities", JLabel.CENTER), BorderLayout.NORTH);
        return panel;
    }
}
