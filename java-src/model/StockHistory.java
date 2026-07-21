package model;

import java.sql.Timestamp;

/**
 * Represents a logged stock change event in the system.
 */
public class StockHistory {
    private int id;
    private int productId;
    private String changeType; // 'Add', 'Reduce', 'Sale', 'Adjustment'
    private int quantityChanged;
    private int oldQuantity;
    private int newQuantity;
    private String note;
    private Timestamp createdAt;

    public StockHistory() {}

    public StockHistory(int id, int productId, String changeType, int quantityChanged, 
                        int oldQuantity, int newQuantity, String note, Timestamp createdAt) {
        this.id = id;
        this.productId = productId;
        this.changeType = changeType;
        this.quantityChanged = quantityChanged;
        this.oldQuantity = oldQuantity;
        this.newQuantity = newQuantity;
        this.note = note;
        this.createdAt = createdAt;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getProductId() { return productId; }
    public void setProductId(int productId) { this.productId = productId; }

    public String getChangeType() { return changeType; }
    public void setChangeType(String changeType) { this.changeType = changeType; }

    public int getQuantityChanged() { return quantityChanged; }
    public void setQuantityChanged(int quantityChanged) { this.quantityChanged = quantityChanged; }

    public int getOldQuantity() { return oldQuantity; }
    public void setOldQuantity(int oldQuantity) { this.oldQuantity = oldQuantity; }

    public int getNewQuantity() { return newQuantity; }
    public void setNewQuantity(int newQuantity) { this.newQuantity = newQuantity; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}
