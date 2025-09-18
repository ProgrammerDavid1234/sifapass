import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

/* ===============================
   ADMIN AUTHENTICATION
================================= */
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ msg: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select("-password");
    
    if (!admin) {
      return res.status(401).json({ msg: "Invalid token, admin not found" });
    }

    if (!admin.isVerified) {
      return res.status(401).json({ msg: "Email not verified" });
    }

    if (!admin.isActive || admin.accountSuspended) {
      return res.status(401).json({ msg: "Account is suspended or inactive" });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ msg: "Token is not valid" });
  }
};

/* ===============================
   USER AUTHENTICATION
================================= */
export const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized. Token missing." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info to request
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token." });
  }
};

/* ===============================
   AUTHORIZATION MIDDLEWARES
================================= */
export const authorizeAdminAccess = (req, res, next) => {
  try {
    const { adminId } = req.params;
    const currentAdminId = req.admin.id;
    
    // Admin can only access their own data unless they're super admin
    if (adminId !== currentAdminId && req.admin.role !== "super_admin") {
      return res.status(403).json({ msg: "Access denied. You can only access your own data." });
    }

    next();
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).json({ msg: "Authorization check failed" });
  }
};

// Role-based access control
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!allowedRoles.includes(req.admin.role)) {
        return res.status(403).json({ 
          msg: `Access denied. Required role: ${allowedRoles.join(" or ")}` 
        });
      }
      next();
    } catch (error) {
      console.error("Role check error:", error);
      res.status(500).json({ msg: "Role check failed" });
    }
  };
};

// Permission-based access control
export const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.admin.hasPermission(permission)) {
        return res.status(403).json({ 
          msg: `Access denied. Required permission: ${permission}` 
        });
      }
      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ msg: "Permission check failed" });
    }
  };
};

/* ===============================
   RATE LIMITING
================================= */
export const rateLimitSensitive = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map(); // In production, use Redis or database

  return (req, res, next) => {
    const key = `${req.ip}-${req.admin?.id || req.user?.id}`;
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const attemptData = attempts.get(key);
    
    if (now > attemptData.resetTime) {
      attemptData.count = 1;
      attemptData.resetTime = now + windowMs;
      return next();
    }

    if (attemptData.count >= maxAttempts) {
      return res.status(429).json({
        msg: "Too many attempts. Please try again later.",
        retryAfter: Math.ceil((attemptData.resetTime - now) / 1000)
      });
    }

    attemptData.count++;
    next();
  };
};

/* ===============================
   ACTIVITY LOGGING
================================= */
export const logActivity = (action) => {
  return async (req, res, next) => {
    try {
      // Store original send function
      const originalSend = res.send;
      
      // Override send to capture response
      res.send = function(data) {
        // Log activity after successful response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`Activity Log: ${action} by ${req.admin?.email || req.user?.email || "unknown"} at ${new Date().toISOString()}`);
        }
        
        // Call original send
        originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error("Activity logging error:", error);
      next(); // Continue even if logging fails
    }
  };
};

/* ===============================
   INPUT VALIDATION
================================= */
export const validateInput = (schema) => {
  return (req, res, next) => {
    try {
      const { error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          msg: "Validation error",
          details: error.details.map(detail => detail.message)
        });
      }
      next();
    } catch (error) {
      console.error("Validation error:", error);
      res.status(500).json({ msg: "Validation failed" });
    }
  };
};

/* ===============================
   SESSION TIMEOUT
================================= */
export const checkSessionTimeout = async (req, res, next) => {
  try {
    const admin = req.admin;
    
    if (admin?.lastLoginAt && admin?.sessionTimeout) {
      const sessionExpiry = new Date(admin.lastLoginAt.getTime() + (admin.sessionTimeout * 60 * 1000));
      
      if (new Date() > sessionExpiry) {
        return res.status(401).json({ 
          msg: "Session expired. Please login again.",
          code: "SESSION_EXPIRED"
        });
      }
    }

    // Update last activity time
    if (admin) {
      await Admin.findByIdAndUpdate(admin._id, { lastActivity: new Date() });
    }

    next();
  } catch (error) {
    console.error("Session timeout check error:", error);
    next(); // Continue even if check fails
  }
};

/* ===============================
   SECURITY HEADERS
================================= */
export const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.removeHeader("X-Powered-By");
  next();
};
