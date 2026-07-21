package model;

/**
 * General store properties and invoice variables model.
 */
public class Settings {
    private int id;
    private String shopName;
    private String shopAddress;
    private String phone;
    private double taxPercentage;
    private String currencySymbol;
    private String receiptFooter;

    public Settings() {}

    public Settings(int id, String shopName, String shopAddress, String phone, 
                    double taxPercentage, String currencySymbol, String receiptFooter) {
        this.id = id;
        this.shopName = shopName;
        this.shopAddress = shopAddress;
        this.phone = phone;
        this.taxPercentage = taxPercentage;
        this.currencySymbol = currencySymbol;
        this.receiptFooter = receiptFooter;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getShopName() { return shopName; }
    public void setShopName(String shopName) { this.shopName = shopName; }

    public String getShopAddress() { return shopAddress; }
    public void setShopAddress(String shopAddress) { this.shopAddress = shopAddress; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public double getTaxPercentage() { return taxPercentage; }
    public void setTaxPercentage(double taxPercentage) { this.taxPercentage = taxPercentage; }

    public String getCurrencySymbol() { return currencySymbol; }
    public void setCurrencySymbol(String currencySymbol) { this.currencySymbol = currencySymbol; }

    public String getReceiptFooter() { return receiptFooter; }
    public void setReceiptFooter(String receiptFooter) { this.receiptFooter = receiptFooter; }
}
