package model;

import java.sql.Timestamp;

/**
 * Represents a compiled Sales transaction header.
 */
public class Sale {
    private int id;
    private String invoiceNo;
    private int customerId;
    private int userId;
    private double subtotal;
    private double discount;
    private double tax;
    private double grandTotal;
    private double paidAmount;
    private double returnAmount;
    private String paymentMethod;
    private Timestamp saleDate;

    public Sale() {}

    public Sale(int id, String invoiceNo, int customerId, int userId, double subtotal, 
                double discount, double tax, double grandTotal, double paidAmount, 
                double returnAmount, String paymentMethod, Timestamp saleDate) {
        this.id = id;
        this.invoiceNo = invoiceNo;
        this.customerId = customerId;
        this.userId = userId;
        this.subtotal = subtotal;
        this.discount = discount;
        this.tax = tax;
        this.grandTotal = grandTotal;
        this.paidAmount = paidAmount;
        this.returnAmount = returnAmount;
        this.paymentMethod = paymentMethod;
        this.saleDate = saleDate;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getInvoiceNo() { return invoiceNo; }
    public void setInvoiceNo(String invoiceNo) { this.invoiceNo = invoiceNo; }

    public int getCustomerId() { return customerId; }
    public void setCustomerId(int customerId) { this.customerId = customerId; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public double getSubtotal() { return subtotal; }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public double getDiscount() { return discount; }
    public void setDiscount(double discount) { this.discount = discount; }

    public double getTax() { return tax; }
    public void setTax(double tax) { this.tax = tax; }

    public double getGrandTotal() { return grandTotal; }
    public void setGrandTotal(double grandTotal) { this.grandTotal = grandTotal; }

    public double getPaidAmount() { return paidAmount; }
    public void setPaidAmount(double paidAmount) { this.paidAmount = paidAmount; }

    public double getReturnAmount() { return returnAmount; }
    public void setReturnAmount(double returnAmount) { this.returnAmount = returnAmount; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public Timestamp getSaleDate() { return saleDate; }
    public void setSaleDate(Timestamp saleDate) { this.saleDate = saleDate; }
}
