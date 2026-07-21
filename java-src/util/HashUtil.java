package util;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Utility class to securely hash raw user passwords using SHA-256 algorithm.
 */
public class HashUtil {

    /**
     * Hashes a raw password string with SHA-256.
     * @param password raw input password
     * @return hex representation of hashed string
     */
    public static String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(password.getBytes());
            StringBuilder hexString = new StringBuilder();
            
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            System.err.println("Critical Error: SHA-256 Algorithm not found.");
            e.printStackTrace();
            return null;
        }
    }
}
