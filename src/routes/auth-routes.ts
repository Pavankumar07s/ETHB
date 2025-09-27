import { Router, type Request, type Response } from "express";
import jwt from 'jsonwebtoken';
import rateLimit from "express-rate-limit";
import { User, type IUser } from "../schema/user.js";
import { emailService } from "../utilities/email.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs (increased for development)
  message: {
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 verification email requests per hour
  message: {
    error: "Too many verification email requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper function to generate JWT token
const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return jwt.sign({ userId }, secret, {
    expiresIn: "7d",
  } as any);
};

// Helper function to set JWT cookie
const setTokenCookie = (res: Response, token: string): void => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  };

  res.cookie("token", token, cookieOptions);
};

// Helper function to clear JWT cookie
const clearTokenCookie = (res: Response): void => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
};

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, confirmPassword } = req.body;

    // Validation
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and password confirmation are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Generate verification token
    const verificationToken = emailService.generateVerificationToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user
    const user = new User({
      email: email.toLowerCase(),
      password,
      verificationToken,
      verificationTokenExpires,
    });

    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error("Error sending verification email:", emailError);
      // Delete the user if email sending fails
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again.",
      });
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email to verify your account.",
      data: {
        email: user.email,
        isVerified: user.isVerified,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: "Please verify your email before logging in",
        requiresVerification: true,
      });
    }

    // Generate JWT token
    const token = generateToken((user._id as any).toString());

    // Set token in httpOnly cookie
    setTokenCookie(res, token);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          email: user.email,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   GET /auth/verify-email
 * @desc    Verify user email
 * @access  Public
 */
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // Find user with matching verification token
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    }).select("+verificationToken +verificationTokenExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // Verify the user
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    // Generate JWT token for immediate login
    const jwtToken = generateToken((user._id as any).toString());
    setTokenCookie(res, jwtToken);

    // Send HTML response for better UX
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: #28a745; }
          .button { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1 class="success">Email Verified Successfully!</h1>
        <p>Your email has been verified and you are now logged in.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="button">Go to Dashboard</a>
        <script>
          setTimeout(() => {
            window.location.href = "${process.env.FRONTEND_URL || 'http://localhost:3000'}";
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post("/resend-verification", verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "User is already verified",
      });
    }

    // Generate new verification token
    const verificationToken = emailService.generateVerificationToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.verificationToken = verificationToken;
    user.verificationTokenExpires = verificationTokenExpires;
    await user.save();

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken);

    res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error: any) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while sending verification email",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post("/logout", (req: Request, res: Response) => {
  clearTokenCookie(res);
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * @route   GET /auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get("/me", authenticateToken, async (req: Request, res: Response) => {
  try {
    // This route is protected by auth middleware
    // The user ID will be available in req.user
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post("/forgot-password", verificationLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = emailService.generateVerificationToken();
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();

    // Send password reset email
    await emailService.sendPasswordResetEmail(email, resetToken);

    res.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing password reset",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * @route   POST /auth/reset-password
 * @desc    Reset password
 * @access  Public
 */
router.post("/reset-password", authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Token, password, and password confirmation are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Find user with matching reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Generate JWT token for immediate login
    const jwtToken = generateToken((user._id as any).toString());
    setTokenCookie(res, jwtToken);

    res.json({
      success: true,
      message: "Password reset successfully",
      data: {
        user: {
          id: user._id,
          email: user.email,
          isVerified: user.isVerified,
        },
      },
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resetting password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;