import nodemailer from "nodemailer";
import crypto from "crypto";

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private fromEmail: string;
  private baseUrl: string;

  constructor() {
    // Get email configuration from environment variables
    const emailConfig: EmailConfig = {
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER || "",
        pass: process.env.EMAIL_PASS || "",
      },
    };

    this.fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || "";
    this.baseUrl = process.env.BASE_URL || "http://localhost:3001";

    // Create transporter
    this.transporter = nodemailer.createTransport(emailConfig);
  }

  /**
   * Generate a secure verification token
   */
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${this.baseUrl}/api/auth/verify-email?token=${token}`;
    
    const mailOptions = {
      from: {
        name: "ETH Global Authentication",
        address: this.fromEmail,
      },
      to: email,
      subject: "Verify Your Email Address",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .button:hover {
              background-color: #0056b3;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verify Your Email Address</h1>
            </div>
            
            <p>Thank you for registering with ETH Global! To complete your registration, please verify your email address by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${verificationUrl}
            </p>
            
            <p><strong>Important:</strong> This verification link will expire in 24 hours for security reasons.</p>
            
            <p>If you didn't create an account with us, please ignore this email.</p>
            
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; 2025 ETH Global. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Verify Your Email Address
        
        Thank you for registering with ETH Global! To complete your registration, please verify your email address by visiting the following link:
        
        ${verificationUrl}
        
        Important: This verification link will expire in 24 hours for security reasons.
        
        If you didn't create an account with us, please ignore this email.
        
        This is an automated message, please do not reply to this email.
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Verification email sent to ${email}`);
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw new Error("Failed to send verification email");
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/api/auth/reset-password?token=${token}`;
    
    const mailOptions = {
      from: {
        name: "ETH Global Authentication",
        address: this.fromEmail,
      },
      to: email,
      subject: "Reset Your Password",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background-color: #dc3545;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .button:hover {
              background-color: #c82333;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Reset Your Password</h1>
            </div>
            
            <p>You have requested to reset your password. Click the button below to set a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            
            <p><strong>Important:</strong> This reset link will expire in 1 hour for security reasons.</p>
            
            <p>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
            
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; 2025 ETH Global. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Reset Your Password
        
        You have requested to reset your password. Visit the following link to set a new password:
        
        ${resetUrl}
        
        Important: This reset link will expire in 1 hour for security reasons.
        
        If you didn't request a password reset, please ignore this email and your password will remain unchanged.
        
        This is an automated message, please do not reply to this email.
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw new Error("Failed to send password reset email");
    }
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log("Email service connection verified successfully");
      return true;
    } catch (error) {
      console.error("Email service connection failed:", error);
      return false;
    }
  }
}

// Create and export a singleton instance
export const emailService = new EmailService();