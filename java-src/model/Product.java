package model;

import java.sql.Date;

/**
 * Represents a product model stored in the inventory.
 */
public class Product {
    private int id;
    private String name;
    private String barcode;
    private int categoryId;
    private int supplierId;
    private double costPrice;
    private double salePrice;
    private int quantity;
    private String unit;
    private Date expiryDate;
    private String description;

    // Constructors
    public Product() {}

    public Product(int id, String name, String barcode, int categoryId, int supplierId, 
                   double costPrice, double salePrice, int quantity, String unit, 
                   Date expiryDate, String description) {
        this.id = id;
        this.name = name;
        this.barcode = barcode;
        this.categoryId = categoryId;
        this.supplierId = supplierId;
        this.costPrice = costPrice;
        this.salePrice = salePrice;
        this.quantity = quantity;
        this.unit = unit;
        this.expiryDate = expiryDate;
        this.description = description;
    }

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getBarcode() { return barcode; }
    public void setBarcode(String barcode) { this.barcode = barcode; }

    public int getCategoryId() { return categoryId; }
    public void setCategoryId(int categoryId) { this.categoryId = categoryId; }

    public int getSupplierId() { return supplierId; }
    public void setSupplierId(int supplierId) { this.supplierId = supplierId; }

    public double getCostPrice() { return costPrice; }
    public void setCostPrice(double costPrice) { this.costPrice = costPrice; }

    public double getSalePrice() { return salePrice; }
    public void setSalePrice(double salePrice) { this.salePrice = salePrice; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public Date getExpiryDate() { return expiryDate; }
    public void setExpiryDate(Date expiryDate) { this.expiryDate = expiryDate; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
