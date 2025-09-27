import type { Request, Response, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { User } from "../schema/user.js";

// Extend the Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        isVerified: boolean;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    isVerified: boolean;
  };
}

/**
 * JWT Authentication Middleware
 * Verifies JWT token from httpOnly cookie or Authorization header
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // First, try to get token from httpOnly cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // If no cookie token, try Authorization header (for API clients)
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET environment variable is not set");
      res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
      return;
    }

    // Check if user is verified
    if (!user.isVerified) {
      res.status(401).json({
        success: false,
        message: "Please verify your email to access this resource.",
        requiresVerification: true,
      });
      return;
    }

    // Attach user to request
    req.user = {
      userId: (user._id as any).toString(),
      email: user.email,
      isVerified: user.isVerified,
    };

    next();
  } catch (error: any) {
    console.error("Authentication error:", error);

    if (error.name === "JsonWebTokenError") {
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
      return;
    }

    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        success: false,
        message: "Token expired",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Server error during authentication",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Optional Authentication Middleware
 * Adds user info to request if token is valid, but doesn't block if not
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Try to get token from httpOnly cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // If no cookie token, try Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET environment variable is not set");
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    
    // Find user
    const user = await User.findById(decoded.userId);
    if (user && user.isVerified) {
      req.user = {
        userId: (user._id as any).toString(),
        email: user.email,
        isVerified: user.isVerified,
      };
    }

    next();
  } catch (error) {
    // Token verification failed, continue without authentication
    console.log("Optional auth failed, continuing without user context:", error);
    next();
  }
};

/**
 * Admin Authentication Middleware
 * Extends basic auth to check for admin privileges
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // First check regular authentication
    await authenticateToken(req, res, () => {});
    
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // Check for admin role (you can extend User schema to include role)
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // For now, we'll use email-based admin check
    // You can extend this to use role-based permissions
    const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
    if (!adminEmails.includes(user.email)) {
      res.status(403).json({
        success: false,
        message: "Admin privileges required",
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error("Admin authentication error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin authentication",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Resource ownership middleware
 * Ensures user can only access their own resources
 */
export const requireOwnership = (resourceUserField: string = "userId") => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      // For routes with user ID in params
      if (req.params.userId && req.params.userId !== req.user.userId) {
        res.status(403).json({
          success: false,
          message: "Access denied. You can only access your own resources.",
        });
        return;
      }

      // For routes where user ID should be in body
      if (req.body && req.body[resourceUserField] && req.body[resourceUserField] !== req.user.userId) {
        res.status(403).json({
          success: false,
          message: "Access denied. You can only modify your own resources.",
        });
        return;
      }

      next();
    } catch (error: any) {
      console.error("Ownership verification error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during ownership verification",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  };
};

/**
 * Rate limiting middleware for sensitive operations
 */
export const sensitiveOperationLimiter = (
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  max: number = 3 // 3 attempts
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Implementation would depend on your rate limiting strategy
    // This is a placeholder for demonstration
    next();
  };
};