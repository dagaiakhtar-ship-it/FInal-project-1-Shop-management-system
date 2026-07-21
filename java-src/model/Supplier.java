package model;

/**
 * Represents a Supplier catalog record.
 */
public class Supplier {
    private int id;
    private String name;
    private String companyName;
    private String phone;
    private String email;
    private String address;
    private String productType;

    public Supplier() {}

    public Supplier(int id, String name, String companyName, String phone, String email, String address, String productType) {
        this.id = id;
        this.name = name;
        this.companyName = companyName;
        this.phone = phone;
        this.email = email;
        this.address = address;
        this.productType = productType;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getProductType() { return productType; }
    public void setProductType(String productType) { this.productType = productType; }
}
